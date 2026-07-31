export class LyricsAnalyzer {
  private audioBuffer: AudioBuffer;
  private sampleRate: number;
  private duration: number;

  constructor(audioBuffer: AudioBuffer) {
    this.audioBuffer = audioBuffer;
    this.sampleRate = audioBuffer.sampleRate;
    this.duration = audioBuffer.duration;
  }

  parseLines(lyricsText: string): string[] {
    return lyricsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  async detectSilencePoints(threshold = 0.01, minSilenceDuration = 0.3): Promise<number[]> {
    const channelData = this.audioBuffer.getChannelData(0);
    const silencePoints: number[] = [];

    let silenceStart: number | null = null;
    const samplesPerCheck = Math.floor(this.sampleRate * 0.01); // Check every 10ms

    for (let i = 0; i < channelData.length; i += samplesPerCheck) {
      const slice = channelData.slice(i, i + samplesPerCheck);
      const rms = this.calculateRMS(slice);

      if (rms < threshold) {
        if (silenceStart === null) {
          silenceStart = i / this.sampleRate;
        }
      } else {
        if (silenceStart !== null) {
          const silenceEnd = i / this.sampleRate;
          const silenceDuration = silenceEnd - silenceStart;

          if (silenceDuration >= minSilenceDuration) {
            silencePoints.push(silenceStart + silenceDuration / 2);
          }
          silenceStart = null;
        }
      }
    }

    return silencePoints;
  }

  calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  async detectEnergyChanges(): Promise<number[]> {
    const channelData = this.audioBuffer.getChannelData(0);
    const windowSize = Math.floor(this.sampleRate * 0.1); // 100ms windows
    const energyPoints: number[] = [];

    let prevEnergy = 0;

    for (let i = 0; i < channelData.length; i += windowSize) {
      const slice = channelData.slice(i, i + windowSize);
      const energy = this.calculateRMS(slice);

      if (prevEnergy > 0 && energy < prevEnergy * 0.5) {
        energyPoints.push(i / this.sampleRate);
      }

      prevEnergy = energy;
    }

    return energyPoints;
  }

  async generateTimestamps(
    lyricLines: string[],
    onProgress?: (progress: number, msg: string) => void
  ): Promise<Array<{ index: number; lyrics: string; startTime: number; endTime: number; duration: number }>> {
    const segments: Array<{ index: number; lyrics: string; startTime: number; endTime: number; duration: number }> = [];

    if (onProgress) onProgress(10, "Analyzing audio patterns...");

    const silencePoints = await this.detectSilencePoints();

    if (onProgress) onProgress(40, "Detecting segment boundaries...");

    let breakPoints = silencePoints;
    if (breakPoints.length < lyricLines.length - 1) {
      const energyPoints = await this.detectEnergyChanges();
      breakPoints = [...silencePoints, ...energyPoints].sort((a, b) => a - b);
    }

    if (onProgress) onProgress(70, "Mapping lyrics to timestamps...");

    if (breakPoints.length < lyricLines.length - 1) {
      breakPoints = this.distributeEvenly(lyricLines.length);
    }

    let startTime = 0;

    for (let i = 0; i < lyricLines.length; i++) {
      const endTime = i < lyricLines.length - 1 ? breakPoints[i] : this.duration;

      segments.push({
        index: i,
        lyrics: lyricLines[i],
        startTime: Math.max(0, startTime),
        endTime: Math.min(this.duration, endTime),
        duration: endTime - startTime,
      });

      startTime = endTime;
    }

    if (onProgress) onProgress(100, "Analysis complete!");

    return segments;
  }

  distributeEvenly(lineCount: number): number[] {
    const segmentDuration = this.duration / lineCount;
    const breakPoints: number[] = [];

    for (let i = 1; i < lineCount; i++) {
      breakPoints.push(i * segmentDuration);
    }

    return breakPoints;
  }
}
