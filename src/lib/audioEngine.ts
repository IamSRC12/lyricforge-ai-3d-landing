import { analyzeAudioBuffer, type AudioAnalysis } from "./vad";

type Listener = (time: number, playing: boolean) => void;

const ENVELOPE_RATE = 100;
const SCHEDULE_AHEAD = 0.08; // seconds — deterministic start point

const clampNum = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;

  /** ctx.currentTime at which `startOffset` is *heard*. */
  private startCtxTime = 0;
  private startOffset = 0;
  private playing = false;
  private raf = 0;
  private listeners = new Set<Listener>();
  private region: { start: number; end: number; loop: boolean } | null = null;

  /** user-tuned extra compensation, ms (positive = visuals wait longer) */
  private userLatencyMs = 0;

  envelope = new Float32Array(0);
  bassEnvelope = new Float32Array(0);
  peaks: number[] = [];
  duration = 0;
  analysis: AudioAnalysis | null = null;

  /* ------------------------------------------------------------------ */

  private ensureCtx() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: "interactive" });
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Round-trip latency the browser reports, in seconds. */
  get hardwareLatency() {
    const ctx = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    if (!ctx) return 0;
    const out = typeof ctx.outputLatency === "number" ? ctx.outputLatency : 0;
    const base = typeof ctx.baseLatency === "number" ? ctx.baseLatency : 0;
    // outputLatency already includes baseLatency on Chrome; use the larger.
    return Math.max(out, base);
  }

  get latencySeconds() {
    return this.hardwareLatency + this.userLatencyMs / 1000;
  }

  setLatencyMs(ms: number) {
    this.userLatencyMs = clampNum(ms, -500, 500);
  }

  get latencyMs() {
    return this.userLatencyMs;
  }

  /* ------------------------------------------------------------------ */

  async load(file: File | ArrayBuffer, peakCount = 1400) {
    const ctx = this.ensureCtx();
    const bytes = file instanceof File ? await file.arrayBuffer() : file;
    this.stop();
    this.buffer = await ctx.decodeAudioData(bytes.slice(0));
    this.duration = this.buffer.duration;
    this.computeEnvelopes();
    this.peaks = this.computePeaks(peakCount);
    this.analysis = null;
    this.startOffset = 0;
    this.region = null;
    this.emit();
    return { duration: this.duration, peaks: this.peaks };
  }

  /** Heavy listening pass. Cached; safe to call repeatedly. */
  async listen(frameRate = 100): Promise<AudioAnalysis | null> {
    if (!this.buffer) return null;
    if (this.analysis && this.analysis.frameRate === frameRate) return this.analysis;
    // yield so the UI can paint a "listening…" state
    await new Promise((r) => setTimeout(r, 0));
    this.analysis = analyzeAudioBuffer(this.buffer, frameRate);
    return this.analysis;
  }

  private computeEnvelopes() {
    if (!this.buffer) return;
    const data = this.buffer.getChannelData(0);
    const sr = this.buffer.sampleRate;
    const n = Math.ceil(this.buffer.duration * ENVELOPE_RATE);
    const block = Math.max(1, Math.floor(sr / ENVELOPE_RATE));
    const env = new Float32Array(n);
    const bass = new Float32Array(n);
    const alpha = 1 - Math.exp((-2 * Math.PI * 150) / sr);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let bassSum = 0;
      const off = i * block;
      for (let j = 0; j < block && off + j < data.length; j++) {
        const s = data[off + j];
        sum += s * s;
        lp += (s - lp) * alpha;
        bassSum += lp * lp;
      }
      env[i] = Math.sqrt(sum / block);
      bass[i] = Math.sqrt(bassSum / block);
    }
    const norm = (a: Float32Array) => {
      let max = 1e-6;
      for (const v of a) max = Math.max(max, v);
      for (let i = 0; i < a.length; i++) a[i] = Math.min(1, a[i] / max);
    };
    norm(env);
    norm(bass);
    this.envelope = env;
    this.bassEnvelope = bass;
  }

  private computePeaks(count: number) {
    if (!this.buffer) return [];
    const data = this.buffer.getChannelData(0);
    const block = Math.max(1, Math.floor(data.length / count));
    const out: number[] = [];
    let max = 1e-6;
    for (let i = 0; i < count; i++) {
      let peak = 0;
      const off = i * block;
      for (let j = 0; j < block && off + j < data.length; j += 8) {
        peak = Math.max(peak, Math.abs(data[off + j]));
      }
      max = Math.max(max, peak);
      out.push(peak);
    }
    return out.map((v) => Number((v / max).toFixed(3)));
  }

  amplitudeAt(t: number, which: "rms" | "bass" = "rms") {
    const src = which === "bass" ? this.bassEnvelope : this.envelope;
    if (!src.length) return 0;
    const i = clampNum(Math.floor(t * ENVELOPE_RATE), 0, src.length - 1) | 0;
    return src[i];
  }

  /* ------------------------------------------------------------------ */

  /** Latency-compensated position — this is what the renderer must use. */
  get time() {
    if (!this.playing || !this.ctx) return this.startOffset;
    const raw = this.startOffset + (this.ctx.currentTime - this.startCtxTime);
    const heard = raw - this.latencySeconds;
    const lo = this.startOffset;
    const hi = this.duration || Number.MAX_SAFE_INTEGER;
    return clampNum(heard, lo, hi);
  }

  /** Uncompensated scheduling clock — only useful for debugging. */
  get rawTime() {
    if (!this.playing || !this.ctx) return this.startOffset;
    return this.startOffset + (this.ctx.currentTime - this.startCtxTime);
  }

  get isPlaying() {
    return this.playing;
  }

  get audioBuffer() {
    return this.buffer;
  }

  get activeRegion() {
    return this.region;
  }

  /* ------------------------------------------------------------------ */

  async play() {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") await ctx.resume();

    const t0 = ctx.currentTime + SCHEDULE_AHEAD;

    if (!this.buffer) {
      // silent preview mode — still advance the clock
      this.startCtxTime = t0;
      this.playing = true;
      this.loop();
      return;
    }

    const regionEnd = this.region ? this.region.end : this.duration;
    if (this.startOffset >= regionEnd - 0.01) {
      this.startOffset = this.region ? this.region.start : 0;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain!);
    src.onended = () => {
      if (this.source !== src || !this.playing) return;
      if (this.region?.loop) {
        this.startOffset = this.region.start;
        this.playing = false;
        void this.play();
        return;
      }
      this.playing = false;
      this.startOffset = regionEnd;
      this.emit();
    };

    const playDur = this.region
      ? Math.max(0.01, this.region.end - this.startOffset)
      : undefined;

    if (playDur === undefined) src.start(t0, this.startOffset);
    else src.start(t0, this.startOffset, playDur);

    this.source = src;
    this.startCtxTime = t0;
    this.playing = true;
    this.loop();
  }

  pause() {
    if (!this.playing) return;
    this.startOffset = this.time;
    this.playing = false;
    this.stopSource();
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  toggle() {
    if (this.playing) {
      this.pause();
      return false;
    }
    void this.play();
    return true;
  }

  seek(t: number) {
    const lo = this.region ? this.region.start : 0;
    const hi = this.region ? this.region.end : this.duration || Number.MAX_SAFE_INTEGER;
    const target = clampNum(t, lo, hi);
    const wasPlaying = this.playing;
    if (wasPlaying) {
      this.stopSource();
      this.playing = false;
      cancelAnimationFrame(this.raf);
    }
    this.startOffset = target;
    if (wasPlaying) void this.play();
    else this.emit();
  }

  /** Audition one segment. `loop` keeps it cycling until clearRegion(). */
  playRegion(start: number, end: number, loop = false) {
    const s = Math.max(0, start);
    const e = Math.max(s + 0.05, end);
    this.stopSource();
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.region = { start: s, end: e, loop };
    this.startOffset = s;
    void this.play();
  }

  clearRegion() {
    const wasPlaying = this.playing;
    const at = this.time;
    this.region = null;
    if (wasPlaying) {
      this.stopSource();
      this.playing = false;
      this.startOffset = at;
      void this.play();
    } else this.emit();
  }

  setVolume(v: number) {
    if (this.gain) this.gain.gain.value = clampNum(v, 0, 1);
  }

  stop() {
    this.stopSource();
    this.playing = false;
    cancelAnimationFrame(this.raf);
  }

  private stopSource() {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
        this.source.disconnect();
      } catch {
        /* already stopped */
      }
      this.source = null;
    }
  }

  private loop = () => {
    if (!this.playing) return;
    this.emit();
    const limit = this.region ? this.region.end : this.duration;
    if (limit && this.time >= limit - 1e-4) {
      if (this.region?.loop) {
        this.stopSource();
        this.playing = false;
        this.startOffset = this.region.start;
        void this.play();
        return;
      }
      this.playing = false;
      this.startOffset = limit;
      this.stopSource();
      this.emit();
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.time, this.playing);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const t = this.time;
    for (const fn of this.listeners) fn(t, this.playing);
  }
}

export const audioEngine = new AudioEngine();
