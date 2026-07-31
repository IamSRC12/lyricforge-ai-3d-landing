import type { AspectRatio, Resolution } from "@/types/project";
import { injectScopedCSS, removeScopedCSS, sanitizeCustomCSS } from "./cssSafety";

export { injectScopedCSS, removeScopedCSS, sanitizeCustomCSS };

const MAX_AUDIO_SIZE_BYTES = 200 * 1024 * 1024; // 200MB limit

export async function validateAudioFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (!file) return { valid: false, error: "No file selected." };

  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    return { valid: false, error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 200MB limit.` };
  }

  const validTypes = ["audio/", "video/mp4", "video/webm", "video/ogg"];
  const isTypeValid = validTypes.some((t) => file.type.startsWith(t)) || /\.(mp3|wav|m4a|mp4|ogg|flac|aac)$/i.test(file.name);
  if (!isTypeValid) {
    return { valid: false, error: "Unsupported audio format. Supported: MP3, WAV, M4A, OGG, FLAC, MP4." };
  }

  return { valid: true };
}

export async function getAudioDuration(file: File): Promise<number> {
  const validation = await validateAudioFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;

    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      try {
        URL.revokeObjectURL(url);
      } catch {}
    };

    audio.onloadedmetadata = () => {
      const dur = audio.duration;
      cleanup();
      if (!Number.isFinite(dur) || dur <= 0) {
        resolve(30);
      } else {
        resolve(dur);
      }
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load audio metadata for ${file.name}`));
    };
  });
}

export async function generateWaveform(file: File, samples = 200): Promise<number[]> {
  let audioCtx: AudioContext | null = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

    if (!audioBuffer || audioBuffer.length === 0) {
      return generateDeterministicWaveform(samples);
    }

    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channelData.length / samples));
    const waveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize && start + j < channelData.length; j++) {
        sum += Math.abs(channelData[start + j] || 0);
      }
      waveform.push(sum / blockSize);
    }

    const max = Math.max(...waveform, 0.0001);
    return waveform.map((v) => Number((v / max).toFixed(3)));
  } catch (e) {
    console.warn("Waveform generation fallback used:", e);
    return generateDeterministicWaveform(samples);
  } finally {
    if (audioCtx && audioCtx.state !== "closed") {
      try {
        await audioCtx.close();
      } catch {}
    }
  }
}

export function generateDeterministicWaveform(samples = 200): number[] {
  return Array.from({ length: samples }, (_, i) => {
    const v = 0.3 + Math.abs(Math.sin(i * 0.15)) * 0.5 + Math.cos(i * 0.3) * 0.15;
    return Number(Math.max(0.08, Math.min(0.95, v)).toFixed(3));
  });
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function getCanvasDimensions(resolution: Resolution, aspectRatio: AspectRatio): { w: number; h: number } {
  const baseHeightMap: Record<Resolution, number> = {
    "1280x720": 720,
    "1920x1080": 1080,
    "3840x2160": 2160,
  };

  const h = baseHeightMap[resolution] || 1080;

  switch (aspectRatio) {
    case "16:9":
      return { w: Math.round(h * (16 / 9)), h };
    case "9:16":
      return { w: Math.round(h * (9 / 16)), h };
    case "1:1":
      return { w: h, h };
    case "4:5":
      return { w: Math.round(h * (4 / 5)), h };
    case "21:9":
      return { w: Math.round(h * (21 / 9)), h };
    default:
      return { w: Math.round(h * (16 / 9)), h };
  }
}

export function getResolutionSize(res: string) {
  const map: Record<string, { w: number; h: number }> = {
    "1280x720": { w: 1280, h: 720 },
    "1920x1080": { w: 1920, h: 1080 },
    "3840x2160": { w: 3840, h: 2160 },
  };
  return map[res] || { w: 1920, h: 1080 };
}

export async function loadCustomFont(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["ttf", "otf", "woff", "woff2"].includes(extension)) {
    throw new Error("Invalid font format. Please upload a .ttf, .otf, .woff, or .woff2 file.");
  }

  const name = `LVP_${file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_")}_${Date.now().toString(36)}`;
  const url = URL.createObjectURL(file);

  try {
    const fontFace = new FontFace(name, `url(${url})`);
    const loaded = await fontFace.load();
    (document.fonts as any).add(loaded);
    return name;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
