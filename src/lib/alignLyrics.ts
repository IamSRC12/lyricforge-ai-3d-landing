import type { GroqTranscriptionResult, GroqWord } from "./groq";
import type { LyricBlock, WordTimestamp } from "@/types/project";
import { defaultAnimation, defaultStyle } from "@/store/useLyricStore";

type FlatLyricWord = {
  original: string;
  normalized: string;
  blockIndex: number;
  syllables: number;
};

export type AlignmentResult = {
  blocks: LyricBlock[];
  confidence: number;
  matchedWords: number;
  totalWords: number;
  warning?: string;
};

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `aligned_${crypto.randomUUID()}`;
  }
  return `aligned_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function estimateSyllableCount(word: string): number {
  const clean = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (!clean) return 1;
  // CJK characters
  if (/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(clean)) return Math.max(1, clean.length);

  const vowels = clean.match(/[aeiouyàáâäãåèéêëìíîïòóôöõùúûüýÿ]+/g);
  let count = vowels ? vowels.length : Math.ceil(clean.length / 3);
  if (/[^aeiouy]e$/.test(clean) && count > 1) count -= 1;
  return Math.max(1, count);
}

function normalizeToken(token: string): string {
  return token
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, "")
    .replace(/^'+|'+$/g, "");
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const noApostropheA = a.replace(/'/g, "");
  const noApostropheB = b.replace(/'/g, "");
  if (noApostropheA === noApostropheB) return 0.98;

  // Prefix matching e.g. "singing" vs "sing"
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) {
    return 0.88;
  }

  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;

  return Math.max(0, 1 - editDistance(a, b) / longest);
}

function sanitizeWhisperWords(words: GroqWord[]): GroqWord[] {
  return words
    .map((word) => {
      const start = Math.max(0, Number(word.start) || 0);
      const rawEnd = Number(word.end);
      const end = Number.isFinite(rawEnd)
        ? Math.max(start + 0.02, rawEnd)
        : start + 0.12;

      return {
        word: String(word.word || "").trim(),
        start,
        end,
      };
    })
    .filter(
      (word) =>
        word.word.length > 0 &&
        normalizeToken(word.word).length > 0 &&
        Number.isFinite(word.start) &&
        Number.isFinite(word.end)
    )
    .sort((a, b) => a.start - b.start);
}

function flattenLyrics(blockTexts: string[]): FlatLyricWord[] {
  const result: FlatLyricWord[] = [];

  blockTexts.forEach((text, blockIndex) => {
    const words = text.split(/\s+/).filter(Boolean);

    for (const word of words) {
      const normalized = normalizeToken(word);
      if (!normalized) continue;

      result.push({
        original: word,
        normalized,
        blockIndex,
        syllables: estimateSyllableCount(word),
      });
    }
  });

  return result;
}

/**
 * Dynamic Time Warping (DTW) Sequence Alignment:
 * Align user's exact lyrics onto Whisper word timestamps with prosodic weighting.
 */
function createWordMapping(
  lyricWords: FlatLyricWord[],
  whisperWords: GroqWord[]
): Array<number | null> {
  const lyricCount = lyricWords.length;
  const whisperCount = whisperWords.length;

  if (lyricCount === 0 || whisperCount === 0) {
    return Array.from({ length: lyricCount }, () => null);
  }

  const width = whisperCount + 1;
  const directions = new Uint8Array((lyricCount + 1) * width);

  let previous = new Float64Array(width);
  let current = new Float64Array(width);

  previous[0] = 0;
  for (let j = 1; j <= whisperCount; j++) {
    previous[j] = previous[j - 1] - 0.1;
    directions[j] = 3;
  }

  for (let i = 1; i <= lyricCount; i++) {
    current[0] = previous[0] - 1.1;
    directions[i * width] = 2;

    const lyricToken = lyricWords[i - 1].normalized;

    for (let j = 1; j <= whisperCount; j++) {
      const whisperToken = normalizeToken(whisperWords[j - 1].word);
      const similarity = tokenSimilarity(lyricToken, whisperToken);

      const diagonalScore =
        previous[j - 1] +
        (similarity >= 0.98
          ? 3.5
          : similarity >= 0.82
          ? 2.0
          : similarity >= 0.62
          ? 0.5
          : -1.0);

      const skipLyricScore = previous[j] - 1.1;
      const skipWhisperScore = current[j - 1] - 0.1;

      if (
        diagonalScore >= skipLyricScore &&
        diagonalScore >= skipWhisperScore
      ) {
        current[j] = diagonalScore;
        directions[i * width + j] = 1;
      } else if (skipLyricScore >= skipWhisperScore) {
        current[j] = skipLyricScore;
        directions[i * width + j] = 2;
      } else {
        current[j] = skipWhisperScore;
        directions[i * width + j] = 3;
      }
    }

    const swap = previous;
    previous = current;
    current = swap;
    current.fill(0);
  }

  const mapping: Array<number | null> = Array.from(
    { length: lyricCount },
    () => null
  );

  let i = lyricCount;
  let j = whisperCount;

  while (i > 0 || j > 0) {
    const direction = directions[i * width + j];

    if (direction === 1 && i > 0 && j > 0) {
      const similarity = tokenSimilarity(
        lyricWords[i - 1].normalized,
        normalizeToken(whisperWords[j - 1].word)
      );

      if (similarity >= 0.58) {
        mapping[i - 1] = j - 1;
      }

      i--;
      j--;
    } else if (direction === 2 && i > 0) {
      i--;
    } else if (direction === 3 && j > 0) {
      j--;
    } else if (i > 0) {
      i--;
    } else {
      j--;
    }
  }

  return mapping;
}

function findPreviousMapped(
  mapping: Array<number | null>,
  index: number
): number {
  for (let i = index - 1; i >= 0; i--) {
    if (mapping[i] !== null) return i;
  }
  return -1;
}

function findNextMapped(
  mapping: Array<number | null>,
  index: number
): number {
  for (let i = index + 1; i < mapping.length; i++) {
    if (mapping[i] !== null) return i;
  }
  return -1;
}

/**
 * Build Interpolated Timestamps with Prosodic Syllable Allocation
 */
function buildInterpolatedTimestamps(
  lyricWords: FlatLyricWord[],
  whisperWords: GroqWord[],
  mapping: Array<number | null>,
  duration: number
): WordTimestamp[] {
  const safeDuration = Math.max(
    duration,
    whisperWords[whisperWords.length - 1]?.end || 0,
    lyricWords.length * 0.2,
    1
  );

  const output: WordTimestamp[] = lyricWords.map((lyricWord, index) => {
    const mappedIndex = mapping[index];

    if (mappedIndex !== null) {
      const mapped = whisperWords[mappedIndex];
      return {
        word: lyricWord.original,
        start: mapped.start,
        end: Math.max(mapped.start + 0.03, mapped.end),
      };
    }

    const previousLyricIndex = findPreviousMapped(mapping, index);
    const nextLyricIndex = findNextMapped(mapping, index);

    if (previousLyricIndex >= 0 && nextLyricIndex >= 0) {
      const previousWhisperIndex = mapping[previousLyricIndex];
      const nextWhisperIndex = mapping[nextLyricIndex];

      if (previousWhisperIndex !== null && nextWhisperIndex !== null) {
        const rangeStart = whisperWords[previousWhisperIndex].end;
        const rangeEnd = whisperWords[nextWhisperIndex].start;

        // Prosodic Syllable Weighting among unmapped gap words
        let totalGapSyllables = 0;
        let elapsedSyllables = 0;

        for (let k = previousLyricIndex + 1; k < nextLyricIndex; k++) {
          const syl = lyricWords[k].syllables || 1;
          totalGapSyllables += syl;
          if (k < index) elapsedSyllables += syl;
        }

        const mySyllables = lyricWord.syllables || 1;
        const availableTime = Math.max(0.04 * (nextLyricIndex - previousLyricIndex - 1), rangeEnd - rangeStart);

        const startFraction = totalGapSyllables > 0 ? elapsedSyllables / totalGapSyllables : 0;
        const durationFraction = totalGapSyllables > 0 ? mySyllables / totalGapSyllables : 1 / (nextLyricIndex - previousLyricIndex - 1);

        const start = rangeStart + startFraction * availableTime;
        const wordDur = Math.max(0.04, durationFraction * availableTime * 0.9);

        return {
          word: lyricWord.original,
          start,
          end: Math.min(rangeEnd, start + wordDur),
        };
      }
    }

    if (previousLyricIndex >= 0) {
      const previousWhisperIndex = mapping[previousLyricIndex];
      if (previousWhisperIndex !== null) {
        const offset = index - previousLyricIndex;
        const start = whisperWords[previousWhisperIndex].end + (offset - 1) * 0.2;
        return {
          word: lyricWord.original,
          start: Math.min(safeDuration, start),
          end: Math.min(safeDuration, start + 0.16),
        };
      }
    }

    if (nextLyricIndex >= 0) {
      const nextWhisperIndex = mapping[nextLyricIndex];
      if (nextWhisperIndex !== null) {
        const distance = nextLyricIndex - index;
        const end = Math.max(0.03, whisperWords[nextWhisperIndex].start - (distance - 1) * 0.2);
        return {
          word: lyricWord.original,
          start: Math.max(0, end - 0.16),
          end,
        };
      }
    }

    const slot = safeDuration / Math.max(1, lyricWords.length);
    const start = index * slot;

    return {
      word: lyricWord.original,
      start,
      end: Math.min(safeDuration, start + Math.max(0.05, slot * 0.85)),
    };
  });

  let cursor = 0;

  return output.map((word) => {
    const start = Math.max(cursor, word.start);
    const end = Math.max(start + 0.025, word.end);
    cursor = start + 0.001;

    return {
      ...word,
      start: Number(Math.min(start, safeDuration).toFixed(3)),
      end: Number(Math.min(Math.max(start + 0.025, end), safeDuration).toFixed(3)),
    };
  });
}

export function alignLyricsToWhisper(
  blockTexts: string[],
  whisperResult: GroqTranscriptionResult,
  audioDuration: number
): AlignmentResult {
  const cleanBlocks = blockTexts.map((block) => block.trim()).filter(Boolean);
  const lyricWords = flattenLyrics(cleanBlocks);
  const whisperWords = sanitizeWhisperWords(whisperResult.words || []);

  if (lyricWords.length === 0) {
    throw new Error("No lyric words were available for alignment.");
  }

  if (whisperWords.length === 0) {
    throw new Error(
      "Whisper returned no word timestamps. Exact lyric synchronization cannot be generated."
    );
  }

  const mapping = createWordMapping(lyricWords, whisperWords);
  const matchedWords = mapping.filter((value) => value !== null).length;
  const confidence = matchedWords / Math.max(1, lyricWords.length);

  const timestamps = buildInterpolatedTimestamps(
    lyricWords,
    whisperWords,
    mapping,
    Math.max(audioDuration, whisperResult.duration || 0)
  );

  const groupedWords: WordTimestamp[][] = cleanBlocks.map(() => []);
  timestamps.forEach((timestamp, index) => {
    const blockIndex = lyricWords[index].blockIndex;
    groupedWords[blockIndex].push(timestamp);
  });

  const rawBlocks = cleanBlocks.map((text, blockIndex) => {
    const words = groupedWords[blockIndex];
    if (words.length === 0) return null;

    const startTime = Math.max(0, words[0].start - 0.02);
    const endTime = Math.max(
      startTime + 0.15,
      words[words.length - 1].end + 0.04
    );

    const block: LyricBlock = {
      id: createId(),
      text,
      startTime: Number(startTime.toFixed(3)),
      endTime: Number(endTime.toFixed(3)),
      words,
      style: {
        ...defaultStyle,
        gradient: { ...defaultStyle.gradient! },
        backgroundBox: { ...defaultStyle.backgroundBox! },
      },
      animation: {
        ...defaultAnimation,
        in: "fade",
        out: "fade",
        durationIn: 0.12,
        durationOut: 0.12,
        customCSS: null,
      },
    };
    return block;
  });

  const blocks: LyricBlock[] = rawBlocks
    .filter((block): block is LyricBlock => block !== null)
    .sort((a, b) => a.startTime - b.startTime);

  return {
    blocks,
    confidence,
    matchedWords,
    totalWords: lyricWords.length,
    warning:
      confidence < 0.65
        ? "Low alignment confidence. Check that the supplied lyrics match the recorded performance, including repeated choruses."
        : undefined,
  };
}
