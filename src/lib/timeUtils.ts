import type { LyricBlock, WordTimestamp } from "@/types/project";

export const MIN_BLOCK_DURATION = 0.12;
export const MIN_WORD_DURATION = 0.03;

export const r3 = (n: number) => Math.round(n * 1000) / 1000;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Move every word by a constant delta (used when dragging a whole block). */
export function shiftWords(words: WordTimestamp[], delta: number): WordTimestamp[] {
  return words.map((w) => ({
    word: w.word,
    start: r3(Math.max(0, w.start + delta)),
    end: r3(Math.max(MIN_WORD_DURATION, w.end + delta)),
  }));
}

/**
 * Linearly time-warp words from [oldStart,oldEnd] onto [newStart,newEnd].
 * This keeps captions synced when trimming a block from left or right edge.
 */
export function scaleWords(
  words: WordTimestamp[],
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
): WordTimestamp[] {
  const oldSpan = Math.max(1e-6, oldEnd - oldStart);
  const newSpan = Math.max(MIN_BLOCK_DURATION, newEnd - newStart);
  const k = newSpan / oldSpan;
  return words.map((w) => {
    const s = newStart + (w.start - oldStart) * k;
    const e = newStart + (w.end - oldStart) * k;
    return { word: w.word, start: r3(Math.max(0, s)), end: r3(Math.max(s + MIN_WORD_DURATION, e)) };
  });
}

export type RetimeMode = "move" | "scale" | "trim";

/**
 * Produce a fully consistent block patch for a new [start,end].
 *  move  → shift words (duration unchanged)
 *  scale → time-warp words (duration changed, karaoke stays proportional)
 *  trim  → keep absolute word timings, only clip the visible window
 */
export function retimeBlock(
  block: LyricBlock,
  newStart: number,
  newEnd: number,
  mode: RetimeMode,
): Partial<LyricBlock> {
  const start = r3(Math.max(0, newStart));
  const end = r3(Math.max(start + MIN_BLOCK_DURATION, newEnd));

  if (mode === "move") {
    return { startTime: start, endTime: end, words: shiftWords(block.words, start - block.startTime) };
  }
  if (mode === "trim") {
    return { startTime: start, endTime: end, words: block.words };
  }
  return {
    startTime: start,
    endTime: end,
    words: scaleWords(block.words, block.startTime, block.endTime, start, end),
  };
}

/** Drag a single word boundary; neighbours absorb the change so nothing overlaps. */
export function retimeWordBoundary(
  words: WordTimestamp[],
  index: number,
  edge: "start" | "end",
  time: number,
): WordTimestamp[] {
  const out = words.map((w) => ({ ...w }));
  const cur = out[index];
  if (!cur) return out;

  if (edge === "start") {
    const lo = index > 0 ? out[index - 1].start + MIN_WORD_DURATION : 0;
    const hi = cur.end - MIN_WORD_DURATION;
    cur.start = r3(clamp(time, lo, hi));
    if (index > 0) out[index - 1].end = cur.start;
  } else {
    const lo = cur.start + MIN_WORD_DURATION;
    const hi = index < out.length - 1 ? out[index + 1].end - MIN_WORD_DURATION : Number.MAX_SAFE_INTEGER;
    cur.end = r3(clamp(time, lo, hi));
    if (index < out.length - 1) out[index + 1].start = cur.end;
  }
  return out;
}

export function snap(time: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return time;
  return Math.round(time / grid) * grid;
}

/** Snap to the nearest interesting time (word edge / block edge) within tolerance. */
export function magneticSnap(time: number, candidates: number[], tolerance: number): number {
  let best = time;
  let bestD = tolerance;
  for (const c of candidates) {
    const d = Math.abs(c - time);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function formatTimecode(seconds: number, showMs = true): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  const base = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return showMs ? `${base}.${String(cs).padStart(2, "0")}` : base;
}
