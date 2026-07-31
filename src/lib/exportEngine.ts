import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { renderFrame, type BackgroundSource } from "./canvasRenderer";
import type { AISettings, LyricBlock } from "@/types/project";

export type ExportRequest = {
  width: number;
  height: number;
  fps: 30 | 60;
  duration: number;
  blocks: LyricBlock[];
  ai: AISettings;
  audioBuffer: AudioBuffer | null;
  amplitudeAt: (t: number, which?: "rms" | "bass") => number;
  background: {
    type: "none" | "solid" | "gradient" | "particles" | "image" | "video";
    url?: string;
    solidColor?: string;
    gradientColors?: string[];
  };
  quality: "fast" | "balanced" | "best";
  signal?: AbortSignal;
  onProgress?: (p: { percent: number; stage: string; fps: number; eta: number }) => void;
  onLog?: (m: string) => void;
};

export type ExportResult = { blob: Blob; mimeType: string; extension: string };

function avcCodec(w: number, h: number, fps: number) {
  const mb = Math.ceil(w / 16) * Math.ceil(h / 16) * fps;
  if (w > 1920 || h > 1920) return "avc1.640034"; // High 5.2 → 4K60
  if (mb > 522240) return "avc1.64002A";          // High 4.2 → 1080p60
  return "avc1.640028";                            // High 4.0
}

function bitrateFor(w: number, h: number, fps: number, quality: string) {
  const px = w * h;
  const base = px >= 3840 * 2160 ? 62_000_000 : px >= 1920 * 1080 ? 20_000_000 : 9_000_000;
  const q = quality === "best" ? 1.5 : quality === "fast" ? 0.65 : 1;
  return Math.round(base * q * (fps / 30) * 0.62);
}

export async function probeSupport(width: number, height: number, fps: number) {
  const out = { webcodecs: false, video: false, audio: false, hardware: false };
  if (typeof VideoEncoder === "undefined") return out;
  out.webcodecs = true;
  try {
    const cfg = {
      codec: avcCodec(width, height, fps),
      width,
      height,
      framerate: fps,
      bitrate: bitrateFor(width, height, fps, "balanced"),
      hardwareAcceleration: "prefer-hardware" as const,
      avc: { format: "avc" as const },
    };
    const s = await VideoEncoder.isConfigSupported(cfg);
    out.video = !!s.supported;
    out.hardware = s.config?.hardwareAcceleration === "prefer-hardware";
  } catch {}
  try {
    if (typeof AudioEncoder !== "undefined") {
      const s = await AudioEncoder.isConfigSupported({
        codec: "mp4a.40.2",
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 192_000,
      });
      out.audio = !!s.supported;
    }
  } catch {}
  return out;
}

class BackgroundProvider {
  private video: HTMLVideoElement | null = null;
  private image: HTMLImageElement | null = null;
  private videoDuration = 0;
  private lastSeek = -1;

  constructor(private cfg: ExportRequest["background"], private fps: number) {}

  async init() {
    if (this.cfg.type === "video" && this.cfg.url) {
      const v = document.createElement("video");
      v.src = this.cfg.url;
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      await new Promise<void>((res) => {
        const done = () => res();
        v.onloadeddata = done;
        v.onerror = done;
        setTimeout(done, 8000);
      });
      this.videoDuration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
      this.video = v;
    } else if (this.cfg.type === "image" && this.cfg.url) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = this.cfg.url;
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
        setTimeout(res, 8000);
      });
      this.image = img;
    }
  }

  async at(t: number): Promise<BackgroundSource> {
    if (this.video && this.videoDuration > 0) {
      const target = t % this.videoDuration;
      if (Math.abs(target - this.lastSeek) >= 1 / this.fps) {
        this.lastSeek = target;
        await seekVideo(this.video, target);
      }
      return { kind: "media", source: this.video, w: this.video.videoWidth || 16, h: this.video.videoHeight || 9 };
    }
    if (this.image && this.image.naturalWidth > 0) {
      return { kind: "media", source: this.image, w: this.image.naturalWidth, h: this.image.naturalHeight };
    }
    switch (this.cfg.type) {
      case "solid": return { kind: "solid", color: this.cfg.solidColor || "#0A0A0F" };
      case "gradient":
        return { kind: "gradient", from: this.cfg.gradientColors?.[0] || "#FF00FF", to: this.cfg.gradientColors?.[1] || "#00FFAB", angle: 135 };
      case "particles": return { kind: "particles" };
      default: return { kind: "none" };
    }
  }

  dispose() {
    if (this.video) { this.video.removeAttribute("src"); this.video.load(); }
    this.video = null;
    this.image = null;
  }
}

function seekVideo(v: HTMLVideoElement, t: number) {
  return new Promise<void>((res) => {
    let done = false;
    const finish = () => { if (!done) { done = true; cleanup(); res(); } };
    const cleanup = () => {
      v.removeEventListener("seeked", finish);
      clearTimeout(timer);
    };
    v.addEventListener("seeked", finish, { once: true });
    const timer = setTimeout(finish, 400);
    try { v.currentTime = t; } catch { finish(); }
    if (typeof (v as any).requestVideoFrameCallback === "function") {
      (v as any).requestVideoFrameCallback(() => finish());
    }
  });
}

export async function exportVideo(req: ExportRequest): Promise<ExportResult> {
  const { width, height, fps, duration } = req;
  const log = req.onLog ?? (() => {});

  const support = await probeSupport(width, height, fps);
  if (!support.webcodecs || !support.video) {
    throw new Error(
      "WebCodecs H.264 encoding is unavailable in this browser. Use Chrome/Edge 116+ for 720p/1080p/4K 60fps export.",
    );
  }
  log(`Encoder ready · ${width}×${height}@${fps} · ${support.hardware ? "GPU" : "software"}`);

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const useAudio = !!req.audioBuffer && support.audio;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: "in-memory",
    video: { codec: "avc", width, height, frameRate: fps },
    ...(useAudio
      ? { audio: { codec: "aac", sampleRate: req.audioBuffer!.sampleRate, numberOfChannels: Math.min(2, req.audioBuffer!.numberOfChannels) } }
      : {}),
  });

  let encoderError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e as Error; },
  });
  videoEncoder.configure({
    codec: avcCodec(width, height, fps),
    width,
    height,
    framerate: fps,
    bitrate: bitrateFor(width, height, fps, req.quality),
    hardwareAcceleration: "prefer-hardware",
    latencyMode: "quality",
    avc: { format: "avc" },
  });

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = (canvas as any).getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) throw new Error("Could not create a 2D rendering context.");

  const bgProvider = new BackgroundProvider(req.background, fps);
  await bgProvider.init();

  const started = performance.now();
  const gopSize = fps * 2;

  try {
    if (useAudio) {
      log("Encoding AAC audio…");
      await encodeAudio(req.audioBuffer!, duration, muxer, req.signal);
      req.onProgress?.({ percent: 4, stage: "audio encoded", fps: 0, eta: 0 });
    } else if (req.audioBuffer) {
      log("AAC encoder unavailable — exporting silent video.");
    }

    for (let i = 0; i < totalFrames; i++) {
      if (req.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
      if (encoderError) throw encoderError;

      const t = i / fps;
      const background = await bgProvider.at(t);

      renderFrame(ctx, {
        time: t,
        width,
        height,
        blocks: req.blocks,
        background,
        ai: req.ai,
        amplitude: req.amplitudeAt(t, "rms"),
        bass: req.amplitudeAt(t, "bass"),
        showGuides: false,
      });

      const frame = new VideoFrame(canvas as any, {
        timestamp: Math.round((i * 1_000_000) / fps),
        duration: Math.round(1_000_000 / fps),
      });
      videoEncoder.encode(frame, { keyFrame: i % gopSize === 0 });
      frame.close();

      if (videoEncoder.encodeQueueSize > 8) await drain(videoEncoder);
      if (i % 12 === 0) {
        const elapsed = (performance.now() - started) / 1000;
        const rate = (i + 1) / Math.max(0.001, elapsed);
        req.onProgress?.({
          percent: 4 + ((i + 1) / totalFrames) * 94,
          stage: `rendering frame ${i + 1}/${totalFrames}`,
          fps: rate,
          eta: (totalFrames - i - 1) / Math.max(1, rate),
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    log("Flushing encoder…");
    await videoEncoder.flush();
    muxer.finalize();

    const buffer = (muxer.target as ArrayBufferTarget).buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });
    const secs = (performance.now() - started) / 1000;
    log(`Done in ${secs.toFixed(1)}s · ${(blob.size / 1048576).toFixed(1)} MB · ${(totalFrames / secs).toFixed(0)} fps render rate`);
    req.onProgress?.({ percent: 100, stage: "complete", fps: totalFrames / secs, eta: 0 });

    return { blob, mimeType: "video/mp4", extension: "mp4" };
  } finally {
    try { if (videoEncoder.state !== "closed") videoEncoder.close(); } catch {}
    bgProvider.dispose();
  }
}

function drain(enc: VideoEncoder) {
  return new Promise<void>((res) => {
    const anyEnc = enc as any;
    if ("ondequeue" in anyEnc) {
      anyEnc.ondequeue = () => { if (enc.encodeQueueSize <= 4) { anyEnc.ondequeue = null; res(); } };
      return;
    }
    const poll = () => (enc.encodeQueueSize <= 4 ? res() : setTimeout(poll, 4));
    poll();
  });
}

async function encodeAudio(buffer: AudioBuffer, duration: number, muxer: Muxer<ArrayBufferTarget>, signal?: AbortSignal) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const totalFrames = Math.min(buffer.length, Math.ceil(duration * sampleRate));
  const CHUNK = 4096;

  let err: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => { err = e as Error; },
  });
  encoder.configure({ codec: "mp4a.40.2", sampleRate, numberOfChannels: channels, bitrate: 192_000 });

  const planes: Float32Array[] = [];
  for (let c = 0; c < channels; c++) planes.push(buffer.getChannelData(c));

  for (let off = 0; off < totalFrames; off += CHUNK) {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    if (err) throw err;
    const n = Math.min(CHUNK, totalFrames - off);
    const interleaved = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) {
      const plane = planes[c];
      for (let i = 0; i < n; i++) interleaved[i * channels + c] = plane[off + i] || 0;
    }
    const data = new AudioData({
      format: "f32",
      sampleRate,
      numberOfFrames: n,
      numberOfChannels: channels,
      timestamp: Math.round((off / sampleRate) * 1_000_000),
      data: interleaved,
    });
    encoder.encode(data);
    data.close();
    if (encoder.encodeQueueSize > 12) await new Promise((r) => setTimeout(r, 0));
  }
  await encoder.flush();
  encoder.close();
}
