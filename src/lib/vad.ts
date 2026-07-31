/**
 * Offline audio listening pass.
 *
 * Produces the information the aligner needs in order to place lyrics on
 * *real* vocal onsets instead of trusting Whisper's word offsets blindly:
 *
 *   - RMS / bass / vocal-band energy envelopes at 100 Hz
 *   - voice-activity regions with hysteresis + minimum-duration smoothing
 *   - onset times (region starts + internal energy jumps)
 *   - noise floor and a rough BPM from the onset envelope
 *
 * Everything here is deterministic: identical input gives identical output in
 * the editor and in the exporter.
 */

export type VadRegion = { start: number; end: number; peak: number };

export type AudioAnalysis = {
  duration: number;
  frameRate: number;
  rms: Float32Array;
  bass: Float32Array;
  /** ~300–3500 Hz energy — tracks vocals far better than full-band RMS */
  voice: Float32Array;
  voiced: Uint8Array;
  regions: VadRegion[];
  onsets: number[];
  noiseFloor: number;
  bpm: number;
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function onePoleAlpha(cutoffHz: number, sampleRate: number) {
  return 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
}

function percentile(sorted: Float32Array, p: number) {
  if (!sorted.length) return 0;
  const i = clamp(Math.floor(p * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[i];
}

function normalise(a: Float32Array) {
  let max = 1e-9;
  for (let i = 0; i < a.length; i++) if (a[i] > max) max = a[i];
  for (let i = 0; i < a.length; i++) a[i] = Math.min(1, a[i] / max);
}

export function analyzeAudioBuffer(
  buffer: AudioBuffer,
  frameRate = 100,
): AudioAnalysis {
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const channels = buffer.numberOfChannels;
  const frameSize = Math.max(1, Math.round(sr / frameRate));
  const frames = Math.max(1, Math.ceil(len / frameSize));

  const rms = new Float32Array(frames);
  const bass = new Float32Array(frames);
  const voice = new Float32Array(frames);

  // Pull channel refs once; mixing inline avoids allocating a mono copy.
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

  const aBass = onePoleAlpha(150, sr);
  const aLowVoice = onePoleAlpha(280, sr); // removes bass/kick
  const aHighVoice = onePoleAlpha(3600, sr); // removes hats/air

  let lpBass = 0;
  let lpLow = 0;
  let lpHigh = 0;

  for (let f = 0; f < frames; f++) {
    const off = f * frameSize;
    const n = Math.min(frameSize, len - off);
    let sRms = 0;
    let sBass = 0;
    let sVoice = 0;

    for (let i = 0; i < n; i++) {
      let x = 0;
      for (let c = 0; c < channels; c++) x += data[c][off + i];
      x /= channels;

      lpBass += (x - lpBass) * aBass;
      lpLow += (x - lpLow) * aLowVoice;
      const hp = x - lpLow; // > ~280 Hz
      lpHigh += (hp - lpHigh) * aHighVoice; // band-limited ~280–3600 Hz

      sRms += x * x;
      sBass += lpBass * lpBass;
      sVoice += lpHigh * lpHigh;
    }

    const inv = 1 / Math.max(1, n);
    rms[f] = Math.sqrt(sRms * inv);
    bass[f] = Math.sqrt(sBass * inv);
    voice[f] = Math.sqrt(sVoice * inv);
  }

  normalise(rms);
  normalise(bass);
  normalise(voice);

  // ---- noise floor + hysteresis thresholds -------------------------------
  const sorted = Float32Array.from(voice).sort();
  const noiseFloor = percentile(sorted, 0.15);
  const p95 = percentile(sorted, 0.95);
  const span = Math.max(1e-4, p95 - noiseFloor);
  const thrHigh = noiseFloor + span * 0.18;
  const thrLow = noiseFloor + span * 0.08;

  const voiced = new Uint8Array(frames);
  let open = false;
  for (let f = 0; f < frames; f++) {
    const v = voice[f];
    if (!open && v >= thrHigh) open = true;
    else if (open && v < thrLow) open = false;
    voiced[f] = open ? 1 : 0;
  }

  // ---- minimum-duration smoothing ---------------------------------------
  const minSpeech = Math.round(0.12 * frameRate);
  const minGap = Math.round(0.18 * frameRate);

  // close short gaps first
  let f = 0;
  while (f < frames) {
    if (voiced[f] === 0) {
      let e = f;
      while (e < frames && voiced[e] === 0) e++;
      const gapPrecededAndFollowed = f > 0 && e < frames;
      if (gapPrecededAndFollowed && e - f < minGap) {
        for (let i = f; i < e; i++) voiced[i] = 1;
      }
      f = e;
    } else f++;
  }
  // then drop short blips
  f = 0;
  while (f < frames) {
    if (voiced[f] === 1) {
      let e = f;
      while (e < frames && voiced[e] === 1) e++;
      if (e - f < minSpeech) for (let i = f; i < e; i++) voiced[i] = 0;
      f = e;
    } else f++;
  }

  // ---- regions ----------------------------------------------------------
  const regions: VadRegion[] = [];
  f = 0;
  while (f < frames) {
    if (voiced[f] === 1) {
      let e = f;
      let peak = 0;
      while (e < frames && voiced[e] === 1) {
        if (voice[e] > peak) peak = voice[e];
        e++;
      }
      regions.push({
        start: f / frameRate,
        end: e / frameRate,
        peak,
      });
      f = e;
    } else f++;
  }

  // ---- onsets: region starts + internal spectral-flux style jumps -------
  const onsetSet = new Set<number>();
  for (const r of regions) onsetSet.add(Math.round(r.start * 1000) / 1000);

  const fluxGuard = Math.round(0.09 * frameRate);
  let lastOnsetFrame = -fluxGuard;
  for (let i = 2; i < frames; i++) {
    if (!voiced[i]) continue;
    const prev = Math.max(voice[i - 1], voice[i - 2]);
    const rising = voice[i] - prev;
    if (
      rising > span * 0.14 &&
      voice[i] > thrHigh &&
      i - lastOnsetFrame >= fluxGuard
    ) {
      onsetSet.add(Math.round((i / frameRate) * 1000) / 1000);
      lastOnsetFrame = i;
    }
  }
  const onsets = Array.from(onsetSet).sort((a, b) => a - b);

  // ---- rough BPM from onset envelope autocorrelation --------------------
  const bpm = estimateBpm(rms, frameRate);

  return {
    duration: buffer.duration,
    frameRate,
    rms,
    bass,
    voice,
    voiced,
    regions,
    onsets,
    noiseFloor,
    bpm,
  };
}

function estimateBpm(env: Float32Array, frameRate: number): number {
  const n = env.length;
  if (n < frameRate * 4) return 96;

  // half-wave rectified difference = onset strength
  const flux = new Float32Array(n);
  let mean = 0;
  for (let i = 1; i < n; i++) {
    const d = env[i] - env[i - 1];
    flux[i] = d > 0 ? d : 0;
    mean += flux[i];
  }
  mean /= n;
  for (let i = 0; i < n; i++) flux[i] = Math.max(0, flux[i] - mean);

  const minLag = Math.round((60 / 190) * frameRate);
  const maxLag = Math.round((60 / 55) * frameRate);
  let bestLag = minLag;
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += flux[i] * flux[i - lag];
    // mild preference for 90–140 bpm so we don't lock onto half/double time
    const bpmAt = (60 * frameRate) / lag;
    const prior = 1 - Math.min(1, Math.abs(bpmAt - 112) / 150) * 0.25;
    const score = (s / (n - lag)) * prior;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return clamp(Math.round((60 * frameRate) / bestLag), 50, 200);
}

/** Nearest onset to `t` within `tolerance` seconds, or null. */
export function snapToOnset(
  onsets: number[],
  t: number,
  tolerance = 0.32,
): number | null {
  if (!onsets.length) return null;
  let lo = 0;
  let hi = onsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (onsets[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  let best: number | null = null;
  let bestD = tolerance;
  for (let i = Math.max(0, lo - 2); i <= Math.min(onsets.length - 1, lo + 2); i++) {
    const d = Math.abs(onsets[i] - t);
    if (d < bestD) {
      bestD = d;
      best = onsets[i];
    }
  }
  return best;
}

/** Is the whole span [a,b] silent (no voiced frame)? Used to detect breaks. */
export function isSilentSpan(a: AudioAnalysis, from: number, to: number) {
  const s = Math.max(0, Math.floor(from * a.frameRate));
  const e = Math.min(a.voiced.length, Math.ceil(to * a.frameRate));
  for (let i = s; i < e; i++) if (a.voiced[i]) return false;
  return true;
}
