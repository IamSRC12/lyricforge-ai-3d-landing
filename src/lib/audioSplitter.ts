import type { LyricBlock } from "@/types/project";

/**
 * "tight"   — cut exactly at the aligned line boundaries (default).
 *             Line spanning 1.00s → 12.00s produces a clip of exactly 11.00s.
 * "gapless" — each clip ends where the next begins; clip 0 starts at 0 and the
 *             last ends at `duration`. Concatenating all clips reproduces the
 *             original file bit-for-bit (minus fades).
 * "padded"  — tight bounds widened by padStart/padEnd, never overlapping.
 */
export type SplitMode = "tight" | "gapless" | "padded";

export type AudioSegment = {
  id: string;
  index: number;
  /** null for auto-inserted instrumental fillers */
  blockId: string | null;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  blob: Blob;
  url: string;
  fileName: string;
  sampleRate: number;
  channels: number;
  isInstrumental: boolean;
  /** 48 normalised values for the mini waveform in the preview UI */
  peaks: number[];
};

export type SegmentBound = {
  blockId: string | null;
  text: string;
  start: number;
  end: number;
  isInstrumental: boolean;
};

export type SplitOptions = {
  mode?: SplitMode;
  /** seconds, only used by mode "padded" */
  padStart?: number;
  padEnd?: number;
  /** anti-click fade applied to every clip edge, milliseconds */
  fadeMs?: number;
  /** emit extra clips for silent stretches between lines */
  includeInstrumentalGaps?: boolean;
  /** minimum gap length that becomes its own instrumental clip */
  minGapSeconds?: number;
  onProgress?: (percent: number, message: string) => void;
};

export const MIN_SEGMENT_SECONDS = 0.12;

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function slug(text: string, max = 34): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, max) || "segment"
  );
}

/* ------------------------------------------------------------------ *
 * 1. Boundary computation — pure, unit-testable, no audio touched.
 * ------------------------------------------------------------------ */

export function computeSegmentBounds(
  blocks: LyricBlock[],
  duration: number,
  options: SplitOptions = {},
): SegmentBound[] {
  const mode: SplitMode = options.mode ?? "tight";
  const padStart = Math.max(0, options.padStart ?? 0.08);
  const padEnd = Math.max(0, options.padEnd ?? 0.12);
  const minGap = Math.max(0.3, options.minGapSeconds ?? 1.2);
  const total = Math.max(duration, 0);

  const lines = [...blocks]
    .filter((b) => !b.isInstrumental)
    .sort((a, b) => a.startTime - b.startTime);

  if (lines.length === 0) return [];

  // Base pass: clamp, de-overlap, enforce a minimum length.
  const base: SegmentBound[] = lines.map((block, i) => {
    const next = lines[i + 1];
    let start = clamp(block.startTime, 0, total);
    let end = clamp(block.endTime, start + MIN_SEGMENT_SECONDS, total || block.endTime);
    if (next && end > next.startTime) end = Math.max(start + MIN_SEGMENT_SECONDS, next.startTime);
    return {
      blockId: block.id,
      text: block.text,
      start: r3(start),
      end: r3(end),
      isInstrumental: false,
    };
  });

  if (mode === "gapless") {
    for (let i = 0; i < base.length; i++) {
      base[i].start = i === 0 ? 0 : base[i - 1].end;
      base[i].end = r3(i === base.length - 1 ? total || base[i].end : base[i + 1].start);
      if (base[i].end - base[i].start < MIN_SEGMENT_SECONDS) {
        base[i].end = r3(base[i].start + MIN_SEGMENT_SECONDS);
      }
    }
    return base;
  }

  if (mode === "padded") {
    for (let i = 0; i < base.length; i++) {
      const prevEnd = i > 0 ? base[i - 1].end : 0;
      const nextStart = i < base.length - 1 ? base[i + 1].start : total || base[i].end;
      base[i].start = r3(Math.max(prevEnd, base[i].start - padStart));
      base[i].end = r3(Math.min(nextStart, base[i].end + padEnd));
    }
  }

  if (!options.includeInstrumentalGaps) return base;

  // Interleave instrumental fillers. Lyric clips keep their exact bounds.
  const out: SegmentBound[] = [];
  if (base[0].start >= minGap) {
    out.push({
      blockId: null,
      text: "🎵 Instrumental intro",
      start: 0,
      end: base[0].start,
      isInstrumental: true,
    });
  }
  for (let i = 0; i < base.length; i++) {
    out.push(base[i]);
    const next = base[i + 1];
    if (next && next.start - base[i].end >= minGap) {
      out.push({
        blockId: null,
        text: "🎵 Instrumental break",
        start: base[i].end,
        end: next.start,
        isInstrumental: true,
      });
    }
  }
  const last = base[base.length - 1];
  if (total - last.end >= minGap) {
    out.push({
      blockId: null,
      text: "🎵 Instrumental outro",
      start: last.end,
      end: r3(total),
      isInstrumental: true,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 2. Buffer slicing + fades
 * ------------------------------------------------------------------ */

function sliceChannels(
  buffer: AudioBuffer,
  start: number,
  end: number,
  fadeMs: number,
): { channels: Float32Array[]; length: number } {
  const sr = buffer.sampleRate;
  const from = clamp(Math.floor(start * sr), 0, buffer.length);
  const to = clamp(Math.ceil(end * sr), from + 1, buffer.length);
  const length = to - from;
  const fade = Math.min(Math.floor((fadeMs / 1000) * sr), Math.floor(length / 2));

  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    // copy — subarray would alias the source buffer
    const out = buffer.getChannelData(c).slice(from, to);
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      out[i] *= g;
      out[length - 1 - i] *= g;
    }
    channels.push(out);
  }
  return { channels, length };
}

function computePeaks(channel: Float32Array, buckets = 48): number[] {
  const block = Math.max(1, Math.floor(channel.length / buckets));
  const peaks: number[] = [];
  let max = 1e-6;
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const off = i * block;
    for (let j = 0; j < block && off + j < channel.length; j += 4) {
      const v = Math.abs(channel[off + j]);
      if (v > peak) peak = v;
    }
    if (peak > max) max = peak;
    peaks.push(peak);
  }
  return peaks.map((p) => Number((p / max).toFixed(3)));
}

/* ------------------------------------------------------------------ *
 * 3. 16-bit PCM RIFF/WAVE encoder (correct rounding — unlike the legacy one)
 * ------------------------------------------------------------------ */

export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = channels.length;
  const frames = channels[0]?.length ?? 0;
  const dataBytes = frames * numChannels * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  let pos = 0;
  const u32 = (v: number) => {
    view.setUint32(pos, v, true);
    pos += 4;
  };
  const u16 = (v: number) => {
    view.setUint16(pos, v, true);
    pos += 2;
  };
  const ascii = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
    pos += s.length;
  };

  ascii("RIFF");
  u32(36 + dataBytes);
  ascii("WAVE");
  ascii("fmt ");
  u32(16);
  u16(1); // PCM
  u16(numChannels);
  u32(sampleRate);
  u32(sampleRate * numChannels * 2); // byte rate
  u16(numChannels * 2); // block align
  u16(16); // bits per sample
  ascii("data");
  u32(dataBytes);

  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = clamp(channels[c][i], -1, 1);
      // symmetric, correctly-parenthesised conversion
      view.setInt16(pos, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      pos += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/* ------------------------------------------------------------------ *
 * 4. Public entry point
 * ------------------------------------------------------------------ */

export async function splitAudioByLyrics(
  buffer: AudioBuffer,
  blocks: LyricBlock[],
  duration: number,
  options: SplitOptions = {},
): Promise<AudioSegment[]> {
  if (!buffer) throw new Error("No decoded AudioBuffer — call audioEngine.load(file) first.");

  const total = Math.max(duration || 0, buffer.duration);
  const bounds = computeSegmentBounds(blocks, total, options);
  if (bounds.length === 0) throw new Error("No lyric blocks available to split.");

  const fadeMs = options.fadeMs ?? 6;
  const segments: AudioSegment[] = [];

  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i];
    options.onProgress?.(
      Math.round((i / bounds.length) * 100),
      `Cutting segment ${i + 1} of ${bounds.length}…`,
    );

    const { channels } = sliceChannels(buffer, b.start, b.end, fadeMs);
    const blob = encodeWav(channels, buffer.sampleRate);
    const label = String(i + 1).padStart(3, "0");
    const fileName = `${label}_${b.start.toFixed(2)}-${b.end.toFixed(2)}_${slug(b.text)}.wav`;

    segments.push({
      id: uid("seg"),
      index: i,
      blockId: b.blockId,
      text: b.text,
      startTime: b.start,
      endTime: b.end,
      duration: r3(b.end - b.start),
      blob,
      url: URL.createObjectURL(blob),
      fileName,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      isInstrumental: b.isInstrumental,
      peaks: computePeaks(channels[0]),
    });

    // keep the UI responsive on long tracks
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }

  options.onProgress?.(100, `${segments.length} segments ready.`);
  return segments;
}

/** Hard guarantee for the "X lyric lines → X clips" contract. */
export function assertSegmentCount(segments: AudioSegment[], expectedLines: number): void {
  const lyricClips = segments.filter((s) => !s.isInstrumental).length;
  if (lyricClips !== expectedLines) {
    throw new Error(
      `Split mismatch: ${expectedLines} lyric lines produced ${lyricClips} clips. Aborting insert.`,
    );
  }
}

export function revokeSegments(segments: AudioSegment[]): void {
  for (const s of segments) {
    if (s.url?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(s.url);
      } catch {
        /* ignore */
      }
    }
  }
}
