type Listener = (time: number, playing: boolean) => void;

const ENVELOPE_RATE = 100; // samples per second

class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private startedAtCtx = 0;
  private startOffset = 0;
  private playing = false;
  private raf = 0;
  private listeners = new Set<Listener>();

  envelope = new Float32Array(0);
  bassEnvelope = new Float32Array(0);
  peaks: number[] = [];
  duration = 0;

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async load(file: File | ArrayBuffer, peakCount = 1200) {
    const ctx = this.ensureCtx();
    const bytes = file instanceof File ? await file.arrayBuffer() : file;
    this.stop();
    this.buffer = await ctx.decodeAudioData(bytes.slice(0));
    this.duration = this.buffer.duration;
    this.computeEnvelopes();
    this.peaks = this.computePeaks(peakCount);
    this.startOffset = 0;
    this.emit();
    return { duration: this.duration, peaks: this.peaks };
  }

  private computeEnvelopes() {
    if (!this.buffer) return;
    const data = this.buffer.getChannelData(0);
    const sr = this.buffer.sampleRate;
    const n = Math.ceil(this.buffer.duration * ENVELOPE_RATE);
    const block = Math.max(1, Math.floor(sr / ENVELOPE_RATE));
    const env = new Float32Array(n);
    const bass = new Float32Array(n);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let bassSum = 0;
      const off = i * block;
      for (let j = 0; j < block && off + j < data.length; j++) {
        const s = data[off + j];
        sum += s * s;
        lp += (s - lp) * 0.02; // crude ~150Hz one-pole low pass
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
    const i = clampInt(Math.floor(t * ENVELOPE_RATE), 0, src.length - 1);
    return src[i];
  }

  get time() {
    if (!this.playing || !this.ctx) return this.startOffset;
    const t = this.startOffset + (this.ctx.currentTime - this.startedAtCtx);
    return this.duration ? Math.min(t, this.duration) : t;
  }

  get isPlaying() {
    return this.playing;
  }

  get audioBuffer() {
    return this.buffer;
  }

  async play() {
    if (this.playing) return;
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") await ctx.resume();

    if (!this.buffer) {
      // Silent mode: advance clock for preview animation.
      this.startedAtCtx = ctx.currentTime;
      this.playing = true;
      this.loop();
      return;
    }
    if (this.startOffset >= this.duration - 0.01) this.startOffset = 0;

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.gain!);
    src.onended = () => {
      if (this.source === src && this.playing) {
        this.playing = false;
        this.startOffset = this.duration;
        this.emit();
      }
    };
    src.start(0, this.startOffset);
    this.source = src;
    this.startedAtCtx = ctx.currentTime;
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
    return this.playing ? (this.pause(), false) : (void this.play(), true);
  }

  seek(t: number) {
    const target = this.duration ? Math.max(0, Math.min(t, this.duration)) : Math.max(0, t);
    const wasPlaying = this.playing;
    if (wasPlaying) {
      this.stopSource();
      this.playing = false;
    }
    this.startOffset = target;
    if (wasPlaying) void this.play();
    else this.emit();
  }

  setVolume(v: number) {
    if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, v));
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
      } catch {}
      this.source = null;
    }
  }

  private loop = () => {
    if (!this.playing) return;
    this.emit();
    if (this.duration && this.time >= this.duration) {
      this.playing = false;
      this.startOffset = this.duration;
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

function clampInt(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

export const audioEngine = new AudioEngine();
