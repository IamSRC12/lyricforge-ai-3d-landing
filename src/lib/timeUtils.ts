import type { LyricBlock, WordTimestamp } from "@/types/project";

export const MIN_BLOCK_DURATION = 0.18;
export const MIN_WORD_DURATION = 0.04;
/** how long a word's highlight may hold past its own end while waiting for the next */
export const MAX_WORD_HOLD = 0.55;

export const r3 = (n: number) => Math.round(n * 1000) / 1000;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------------ *
 * word-level operations
 * ------------------------------------------------------------------ */

export function shiftWords(words: WordTimestamp[], delta: number): WordTimestamp[] {
  return words.map((w) => ({
    ...w,
    start: r3(Math.max(0, w.start + delta)),
    end: r3(Math.max(MIN_WORD_DURATION, w.end + delta)),
  }));
}

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
    return {
      ...w,
      start: r3(Math.max(0, s)),
      end: r3(Math.max(s + MIN_WORD_DURATION, e)),
    };
  });
}

/**
 * THE fix for "the highlight blinks off between words".
 *
 * Whisper reports tight word ends, so there are 40–300 ms holes where no word
 * is `singing` and the karaoke fill snaps back. Extend every word up to the
 * next word's start (capped by MAX_WORD_HOLD so a long instrumental pause
 * doesn't leave one word lit forever).
 */
export function fillWordGaps(
  words: WordTimestamp[],
  blockEnd: number,
  maxHold = MAX_WORD_HOLD,
): WordTimestamp[] {
  if (words.length === 0) return words;
  const out = words.map((w) => ({ ...w }));
  for (let i = 0; i < out.length; i++) {
    const nextStart = i + 1 < out.length ? out[i + 1].start : blockEnd;
    const gap = nextStart - out[i].end;
    if (gap > 0.001) out[i].end = r3(out[i].end + Math.min(gap, maxHold));
    if (out[i].end <= out[i].start) out[i].end = r3(out[i].start + MIN_WORD_DURATION);
  }
  return out;
}

/** Even syllable-agnostic distribution — used when a block has no word data. */
export function distributeWords(
  text: string,
  start: number,
  end: number,
): WordTimestamp[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const span = Math.max(MIN_BLOCK_DURATION, end - start);
  const per = span / tokens.length;
  return tokens.map((word, i) => ({
    word,
    start: r3(start + i * per),
    end: r3(start + (i + 1) * per),
    confidence: 0.4,
  }));
}

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
    const hi =
      index < out.length - 1
        ? out[index + 1].end - MIN_WORD_DURATION
        : Number.MAX_SAFE_INTEGER;
    cur.end = r3(clamp(time, lo, hi));
    if (index < out.length - 1) out[index + 1].start = cur.end;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * block-level operations
 * ------------------------------------------------------------------ */

export type RetimeMode = "move" | "scale" | "trim";

/**
 * `move`  – shift words with the block (duration unchanged)   ← dragging
 * `scale` – time-warp words to fill the new span              ← stretching
 * `trim`  – keep absolute word timings, only clip the window  ← NEVER touches sync
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
    return {
      startTime: start,
      endTime: end,
      words: shiftWords(block.words, start - block.startTime),
    };
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

export function sortBlocks(blocks: LyricBlock[]) {
  return [...blocks].sort((a, b) => a.startTime - b.startTime);
}

/**
 * Bounds a drag so it can never overlap its neighbours — this REPLACES the old
 * behaviour of rescaling the neighbours (which silently destroyed their sync).
 */
export function neighbourBounds(
  blocks: LyricBlock[],
  id: string,
  duration: number,
): { lo: number; hi: number } {
  const sorted = sortBlocks(blocks);
  const idx = sorted.findIndex((b) => b.id === id);
  if (idx < 0) return { lo: 0, hi: duration };
  const lo = idx > 0 ? sorted[idx - 1].endTime : 0;
  const hi = idx < sorted.length - 1 ? sorted[idx + 1].startTime : duration;
  return { lo, hi };
}

export type RippleOptions = {
  /** stretch the target's word timings with the segment (default true) */
  stretchWords?: boolean;
  /** absorb into the neighbour's gap and cascade if it would be crushed */
  cascade?: boolean;
  duration: number;
};

/**
 * Resize one segment; everything after/before it auto-adjusts.
 * Locked blocks act as walls. Neighbours are `trim`-retimed, so their word
 * timestamps are never warped — only their visible window moves.
 */
export function rippleResize(
  blocks: LyricBlock[],
  id: string,
  newStart: number,
  newEnd: number,
  opts: RippleOptions,
): LyricBlock[] {
  const { duration } = opts;
  const stretchWords = opts.stretchWords !== false;
  const cascade = opts.cascade !== false;

  const sorted = sortBlocks(blocks).map((b) => ({ ...b }));
  const idx = sorted.findIndex((b) => b.id === id);
  if (idx < 0) return blocks;

  let s = clamp(r3(newStart), 0, duration - MIN_BLOCK_DURATION);
  let e = clamp(r3(newEnd), s + MIN_BLOCK_DURATION, duration);

  const target = sorted[idx];
  const patch = retimeBlock(target, s, e, stretchWords ? "scale" : "trim");
  Object.assign(target, patch);
  s = target.startTime;
  e = target.endTime;

  // ---- walk left --------------------------------------------------------
  let wall = s;
  for (let i = idx - 1; i >= 0; i--) {
    const b = sorted[i];
    if (b.endTime <= wall) break;
    if (b.locked) {
      // locked block wins: push the target back instead
      const shifted = Math.max(b.endTime, s);
      Object.assign(
        target,
        retimeBlock(target, shifted, Math.max(shifted + MIN_BLOCK_DURATION, e), "move"),
      );
      break;
    }
    let bs = b.startTime;
    let be = wall;
    if (be - bs < MIN_BLOCK_DURATION) {
      if (!cascade) {
        be = bs + MIN_BLOCK_DURATION;
      } else {
        bs = be - MIN_BLOCK_DURATION;
      }
    }
    Object.assign(b, retimeBlock(b, bs, be, "trim"));
    wall = b.startTime;
    if (!cascade) break;
  }

  // ---- walk right -------------------------------------------------------
  wall = target.endTime;
  for (let i = idx + 1; i < sorted.length; i++) {
    const b = sorted[i];
    if (b.startTime >= wall) break;
    if (b.locked) {
      const cappedEnd = Math.min(b.startTime, target.endTime);
      Object.assign(
        target,
        retimeBlock(
          target,
          Math.min(target.startTime, cappedEnd - MIN_BLOCK_DURATION),
          cappedEnd,
          "trim",
        ),
      );
      break;
    }
    let bs = wall;
    let be = b.endTime;
    if (be - bs < MIN_BLOCK_DURATION) {
      be = Math.min(duration, bs + MIN_BLOCK_DURATION);
    }
    Object.assign(b, retimeBlock(b, bs, be, "trim"));
    wall = b.endTime;
    if (!cascade) break;
  }

  return sorted;
}

/** Shift every (unlocked) block by delta — used to bake a global offset. */
export function shiftAllBlocks(
  blocks: LyricBlock[],
  delta: number,
  duration: number,
): LyricBlock[] {
  return blocks.map((b) => {
    if (b.locked) return b;
    const s = clamp(r3(b.startTime + delta), 0, Math.max(0, duration - MIN_BLOCK_DURATION));
    const e = clamp(r3(b.endTime + delta), s + MIN_BLOCK_DURATION, duration || b.endTime + delta);
    return { ...b, ...retimeBlock(b, s, e, "move") } as LyricBlock;
  });
}

/**
 * Karaoke look: hold each line on screen until the next one starts (bounded).
 * Without this, lines pop out and the screen goes blank between phrases.
 */
export function extendBlocksToNextLine(
  blocks: LyricBlock[],
  maxHold = 1.6,
  duration = 0,
): LyricBlock[] {
  const sorted = sortBlocks(blocks);
  return sorted.map((b, i) => {
    const nextStart = i + 1 < sorted.length ? sorted[i + 1].startTime : duration || b.endTime;
    const gap = nextStart - b.endTime;
    if (gap <= 0.02) return b;
    return { ...b, endTime: r3(b.endTime + Math.min(gap, maxHold)) };
  });
}

/** One-click repair for imported / hand-edited timelines. */
export function repairTimeline(
  blocks: LyricBlock[],
  duration: number,
  opts: { holdLines?: boolean; fillWords?: boolean } = {},
): LyricBlock[] {
  let out = sortBlocks(blocks).map((b) => {
    const start = clamp(r3(b.startTime), 0, Math.max(0, duration - MIN_BLOCK_DURATION));
    const end = clamp(r3(b.endTime), start + MIN_BLOCK_DURATION, duration || b.endTime);
    let words = b.words.length ? b.words : distributeWords(b.text, start, end);
    words = words
      .map((w) => ({
        ...w,
        start: clamp(r3(w.start), start, end),
        end: clamp(r3(w.end), start + MIN_WORD_DURATION, end),
      }))
      .filter((w) => w.word.trim().length > 0 && w.end > w.start);
    return { ...b, startTime: start, endTime: end, words };
  });

  // de-overlap without warping words
  for (let i = 1; i < out.length; i++) {
    if (out[i].startTime < out[i - 1].endTime) {
      out[i - 1] = { ...out[i - 1], endTime: r3(out[i].startTime) };
    }
  }

  if (opts.holdLines !== false) out = extendBlocksToNextLine(out, 1.6, duration);
  if (opts.fillWords !== false) {
    out = out.map((b) => ({ ...b, words: fillWordGaps(b.words, b.endTime) }));
  }
  return out;
}

export function snap(time: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return time;
  return Math.round(time / grid) * grid;
}

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

export function collectSnapPoints(blocks: LyricBlock[]): number[] {
  const pts: number[] = [0];
  for (const b of blocks) {
    pts.push(b.startTime, b.endTime);
    for (const w of b.words) pts.push(w.start, w.end);
  }
  return pts;
}

export function formatTimecode(seconds: number, showMs = true): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  const base = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return showMs ? `${base}.${String(cs).padStart(2, "0")}` : base;
}
