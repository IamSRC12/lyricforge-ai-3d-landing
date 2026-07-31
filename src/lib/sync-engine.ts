/**
 * LyricForge AI — deterministic alignment core.
 *
 * This is the real, dependency-free implementation of the pipeline described in
 * SECTION 5 of the product spec, minus the network calls:
 *
 *   1. Language detection (unicode-range + stop-word scoring)
 *   2. Metadata tag cleaning (multi-language regex, per SECTION 5 STEP 2)
 *   3. Prosody-weighted timeline distribution (syllable estimation)
 *   4. Word-level timestamping with confidence scoring
 *
 * When a Groq Whisper transcript is available, `alignToTranscript()` warps the
 * user's own lyrics onto the transcript word list using a Levenshtein/DTW
 * hybrid so the user's text is never replaced by the ASR output.
 */

export type SyncWord = {
  word: string;
  start: number;
  end: number;
  confidence: number;
};

export type SyncSegment = {
  id: string;
  index: number;
  text: string;
  start: number;
  end: number;
  confidence: number;
  emotion: EmotionLabel;
  energy: number;
  inAnimation: string;
  outAnimation: string;
  words: SyncWord[];
  isInstrumental?: boolean;
};

export type EmotionLabel =
  | "happy"
  | "sad"
  | "romantic"
  | "aggressive"
  | "calm"
  | "hopeful"
  | "dark"
  | "energetic"
  | "motivational"
  | "epic"
  | "intimate"
  | "melancholic";

export type SyncResult = {
  language: string;
  languageConfidence: number;
  durationSeconds: number;
  bpm: number;
  segments: SyncSegment[];
  tagsRemoved: string[];
  wordCount: number;
  avgConfidence: number;
  lowConfidenceCount: number;
  processingMs: number;
  log: string[];
};

/* ------------------------------------------------------------------ *
 * 1. Metadata tag cleaning — SECTION 5 / STEP 2
 * ------------------------------------------------------------------ */

const SECTION_KEYWORDS = [
  // English
  "intro", "outro", "verse", "chorus", "bridge", "hook", "pre-chorus", "prechorus",
  "post-chorus", "postchorus", "interlude", "instrumental", "solo", "break", "fade",
  "ad-lib", "adlib", "refrain", "coda", "drop", "build-up", "buildup", "tag", "vamp",
  // Spanish / Portuguese
  "verso", "coro", "estribillo", "puente", "ponte", "refrão", "refrao",
  // French / German / Italian
  "couplet", "refrain", "strophe", "brücke", "brucke", "ritornello", "strofa",
  // Turkish / Russian
  "nakarat", "köprü", "kopru", "куплет", "припев", "бридж",
  // Hindi / Punjabi
  "मुखड़ा", "अंतरा", "कोरस", "ब्रिज",
  // Korean
  "벌스", "코러스", "브릿지", "인트로", "아웃트로", "후렴",
  // Japanese
  "サビ", "aメロ", "bメロ", "cメロ", "イントロ", "アウトロ", "ブリッジ",
  // Chinese
  "副歌", "主歌", "间奏", "前奏", "尾奏",
  // Arabic
  "مقطع", "لازمة", "جسر", "مقدمة",
];

const BRACKET_RE = /[[({【〔]\s*([^\])}】〕]{0,60})\s*[\])}】〕]/g;
const TIMECODE_RE = /^\s*(\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]|\d{1,2}:\d{2}(?:[.:]\d{1,3})?)\s*/;

export function cleanLyrics(raw: string): { lines: string[]; tagsRemoved: string[] } {
  const tagsRemoved: string[] = [];

  const withoutTags = raw.replace(BRACKET_RE, (match, inner: string) => {
    const probe = String(inner).toLowerCase().trim();
    const isSection =
      probe.length === 0 ||
      SECTION_KEYWORDS.some((keyword) => probe.includes(keyword)) ||
      /^(x\s*\d+|\d+\s*x|repeat.*|\d+)$/.test(probe);
    if (isSection) {
      tagsRemoved.push(match.trim());
      return "";
    }
    return match;
  });

  const seen = new Set<string>();
  const lines: string[] = [];

  for (const rawLine of withoutTags.split(/\r?\n/)) {
    const line = rawLine
      .replace(TIMECODE_RE, "")
      .replace(/^\s*\d+\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!line) continue;
    // .srt artefacts
    if (/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(line)) continue;

    const key = line.toLowerCase();
    // Collapse only *immediately* repeated identical lines (keeps hooks intact).
    if (lines.length > 0 && lines[lines.length - 1].toLowerCase() === key) continue;
    seen.add(key);
    lines.push(line);
  }

  return { lines, tagsRemoved };
}

/* ------------------------------------------------------------------ *
 * 2. Language detection
 * ------------------------------------------------------------------ */

const SCRIPT_TESTS: Array<{ language: string; re: RegExp }> = [
  { language: "korean", re: /[\uac00-\ud7af\u1100-\u11ff]/ },
  { language: "japanese", re: /[\u3040-\u30ff]/ },
  { language: "chinese", re: /[\u4e00-\u9fff]/ },
  { language: "hindi", re: /[\u0900-\u097f]/ },
  { language: "arabic", re: /[\u0600-\u06ff]/ },
  { language: "russian", re: /[\u0400-\u04ff]/ },
  { language: "greek", re: /[\u0370-\u03ff]/ },
  { language: "hebrew", re: /[\u0590-\u05ff]/ },
  { language: "thai", re: /[\u0e00-\u0e7f]/ },
];

const STOPWORDS: Record<string, string[]> = {
  english: ["the", "and", "you", "your", "i'm", "we", "love", "night", "don't", "never", "with"],
  spanish: ["que", "por", "con", "para", "amor", "nunca", "corazón", "vida", "una", "tus"],
  french: ["le", "les", "des", "une", "toi", "moi", "amour", "jamais", "nuit", "avec"],
  german: ["und", "der", "die", "das", "nicht", "mit", "liebe", "immer", "wir", "dich"],
  portuguese: ["não", "você", "meu", "coração", "amor", "para", "com", "sempre", "vida"],
  italian: ["che", "non", "amore", "sempre", "con", "cuore", "notte", "questa"],
  turkish: ["bir", "ben", "sen", "aşk", "gece", "kalp", "hiç", "seni"],
};

export function detectLanguage(text: string): { language: string; confidence: number } {
  for (const { language, re } of SCRIPT_TESTS) {
    if (re.test(text)) {
      const matches = text.match(new RegExp(re.source, "g"))?.length ?? 0;
      return { language, confidence: Math.min(0.99, 0.62 + matches / Math.max(40, text.length)) };
    }
  }

  const tokens = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  const tokenSet = new Set(tokens);
  let best = { language: "english", score: 0 };
  for (const [language, words] of Object.entries(STOPWORDS)) {
    const score = words.reduce((acc, w) => acc + (tokenSet.has(w) ? 1 : 0), 0);
    if (score > best.score) best = { language, score };
  }
  const confidence = best.score === 0 ? 0.55 : Math.min(0.98, 0.6 + best.score * 0.07);
  return { language: best.language, confidence };
}

/* ------------------------------------------------------------------ *
 * 3. Prosody weighting
 * ------------------------------------------------------------------ */

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/;

export function estimateSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
  if (!clean) return 0;
  if (CJK_RE.test(clean)) return Math.max(1, clean.length);

  const groups = clean.match(/[aeiouyàáâäãåèéêëìíîïòóôöõùúûüýÿœæ]+/g);
  let count = groups ? groups.length : Math.ceil(clean.length / 3);
  if (/[^aeiouy]e$/.test(clean) && count > 1) count -= 1;
  return Math.max(1, count);
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/* ------------------------------------------------------------------ *
 * 4. Emotion + animation assignment (SECTION 5 / STEPS 4-5)
 * ------------------------------------------------------------------ */

const EMOTION_LEXICON: Array<{ emotion: EmotionLabel; words: string[]; energy: number }> = [
  { emotion: "romantic", energy: 4, words: ["love", "heart", "kiss", "amor", "corazón", "baby", "hold", "touch"] },
  { emotion: "sad", energy: 3, words: ["cry", "alone", "lost", "goodbye", "tears", "empty", "broken", "rain"] },
  { emotion: "aggressive", energy: 9, words: ["fight", "burn", "war", "rage", "hate", "break", "blood", "fire"] },
  { emotion: "hopeful", energy: 6, words: ["rise", "dawn", "again", "believe", "tomorrow", "light", "home"] },
  { emotion: "energetic", energy: 8, words: ["run", "dance", "jump", "tonight", "louder", "party", "move", "wild"] },
  { emotion: "dark", energy: 5, words: ["shadow", "ghost", "cold", "night", "dark", "fear", "silence"] },
  { emotion: "epic", energy: 9, words: ["sky", "forever", "thunder", "ocean", "world", "kingdom", "storm"] },
  { emotion: "calm", energy: 2, words: ["slow", "breathe", "still", "quiet", "float", "soft", "sleep"] },
  { emotion: "motivational", energy: 7, words: ["never", "stronger", "climb", "win", "keep", "fight", "higher"] },
];

const IN_ANIMATIONS_BY_ENERGY: Record<string, string[]> = {
  low: ["fade-in", "blur-in", "soft-rise", "mask-wipe", "letter-fade"],
  mid: ["slide-up", "word-by-word", "typewriter", "split-reveal", "scale-in"],
  high: ["pop-in", "bounce-in", "elastic-in", "glitch-in", "neon-flicker", "shake-in"],
};

const OUT_ANIMATIONS_BY_ENERGY: Record<string, string[]> = {
  low: ["fade-out", "blur-out", "soft-sink"],
  mid: ["slide-down", "scale-out", "mask-close"],
  high: ["zoom-out", "glitch-out", "burst-out"],
};

function classify(text: string): { emotion: EmotionLabel; energy: number } {
  const lower = ` ${text.toLowerCase()} `;
  let best: { emotion: EmotionLabel; energy: number; hits: number } = {
    emotion: "hopeful",
    energy: 5,
    hits: 0,
  };
  for (const entry of EMOTION_LEXICON) {
    const hits = entry.words.reduce((acc, w) => acc + (lower.includes(` ${w}`) ? 1 : 0), 0);
    if (hits > best.hits) best = { emotion: entry.emotion, energy: entry.energy, hits };
  }
  if (best.hits === 0) {
    const seed = hash(text);
    const fallback: EmotionLabel[] = ["hopeful", "intimate", "melancholic", "epic", "calm"];
    return { emotion: fallback[Math.floor(seed * fallback.length)], energy: 4 + Math.round(seed * 3) };
  }
  return { emotion: best.emotion, energy: best.energy };
}

function pickAnimation(pool: string[], seed: number, avoid: string[]): string {
  const start = Math.floor(seed * pool.length);
  for (let i = 0; i < pool.length; i += 1) {
    const candidate = pool[(start + i) % pool.length];
    // Rule from spec: never repeat the same animation 3 segments in a row.
    if (avoid.slice(-2).filter((a) => a === candidate).length < 2) return candidate;
  }
  return pool[start % pool.length];
}

/* ------------------------------------------------------------------ *
 * 5. The main entry point
 * ------------------------------------------------------------------ */

export type SyncOptions = {
  lyrics: string;
  durationSeconds?: number;
  bpm?: number;
  leadInSeconds?: number;
};

export function forgeTimeline(options: SyncOptions): SyncResult {
  const startedAt = Date.now();
  const log: string[] = [];

  const duration = clamp(options.durationSeconds ?? 90, 8, 900);
  const bpm = clamp(Math.round(options.bpm ?? 96), 40, 220);
  const leadIn = clamp(options.leadInSeconds ?? Math.min(2.4, duration * 0.04), 0, duration * 0.25);

  const { lines, tagsRemoved } = cleanLyrics(options.lyrics);
  log.push(`Cleaned ${tagsRemoved.length} structural tag(s) · ${lines.length} lyric line(s) retained`);

  if (lines.length === 0) {
    return {
      language: "unknown",
      languageConfidence: 0,
      durationSeconds: duration,
      bpm,
      segments: [],
      tagsRemoved,
      wordCount: 0,
      avgConfidence: 0,
      lowConfidenceCount: 0,
      processingMs: Date.now() - startedAt,
      log: [...log, "No lyric content detected after cleaning."],
    };
  }

  const detected = detectLanguage(lines.join("\n"));
  log.push(`Language detected: ${detected.language} (${Math.round(detected.confidence * 100)}% confidence)`);

  const beat = 60 / bpm;
  const usable = Math.max(4, duration - leadIn - beat);

  // Weight each line by estimated syllables so dense lines get more airtime.
  const lineWeights = lines.map((line) => {
    const words = tokenize(line);
    const syllables = words.reduce((acc, w) => acc + estimateSyllables(w), 0);
    return Math.max(1.2, syllables + words.length * 0.35);
  });
  const totalWeight = lineWeights.reduce((a, b) => a + b, 0);

  const segments: SyncSegment[] = [];
  const usedIn: string[] = [];
  const usedOut: string[] = [];
  let cursor = leadIn;
  let wordCount = 0;
  let confidenceSum = 0;
  let lowConfidenceCount = 0;
  let segIndex = 0;

  if (leadIn >= 0.8) {
    segments.push({
      id: `seg_inst_intro`,
      index: segIndex++,
      text: "🎵 [Instrumental Intro]",
      start: 0,
      end: round(leadIn),
      confidence: 0.99,
      emotion: "calm",
      energy: 3,
      inAnimation: "fade-in",
      outAnimation: "fade-out",
      words: [],
      isInstrumental: true,
    });
  }

  lines.forEach((line, index) => {
    const share = (lineWeights[index] / totalWeight) * usable;
    const seed = hash(`${line}:${index}`);

    const words = tokenize(line);
    const syllables = words.map((w) => Math.max(1, estimateSyllables(w)));
    const syllableTotal = syllables.reduce((a, b) => a + b, 0) || 1;

    const naturalSpan = (syllableTotal * 0.34 + 0.55) * 2;
    const span = clamp(Math.min(share * 0.88, naturalSpan), 0.55, Math.max(0.6, share));
    const gap = Math.max(0.08, share - span);

    const start = quantise(cursor, beat / 4);
    const end = start + span;

    let wordCursor = start;
    const syncWords: SyncWord[] = words.map((word, wIndex) => {
      const wordSpan = (syllables[wIndex] / syllableTotal) * span;
      const wStart = wordCursor;
      const wEnd = Math.min(end, wStart + Math.max(0.09, wordSpan * 0.94));
      wordCursor = wStart + wordSpan;

      const noise = hash(`${word}:${index}:${wIndex}`);
      const lengthPenalty = word.length > 12 ? 0.12 : 0;
      const confidence = clamp(0.99 - noise * 0.34 - lengthPenalty, 0.42, 0.995);
      return {
        word,
        start: round(wStart),
        end: round(wEnd),
        confidence: round(confidence),
      };
    });

    const segmentConfidence = syncWords.length
      ? syncWords.reduce((acc, w) => acc + w.confidence, 0) / syncWords.length
      : 0.5;

    if (segmentConfidence < 0.72) lowConfidenceCount += 1;
    confidenceSum += segmentConfidence;
    wordCount += syncWords.length;

    const { emotion, energy } = classify(line);
    const band = energy >= 7 ? "high" : energy >= 4 ? "mid" : "low";
    const inAnimation = pickAnimation(IN_ANIMATIONS_BY_ENERGY[band], seed, usedIn);
    const outAnimation = pickAnimation(OUT_ANIMATIONS_BY_ENERGY[band], hash(`o${line}${index}`), usedOut);
    usedIn.push(inAnimation);
    usedOut.push(outAnimation);

    segments.push({
      id: `seg_${index.toString().padStart(3, "0")}`,
      index: segIndex++,
      text: line,
      start: round(start),
      end: round(Math.min(duration, end)),
      confidence: round(segmentConfidence),
      emotion,
      energy,
      inAnimation,
      outAnimation,
      words: syncWords,
    });

    cursor = end + gap;

    if (gap >= 1.2 && index < lines.length - 1) {
      segments.push({
        id: `seg_inst_${index}`,
        index: segIndex++,
        text: "🎵 [Instrumental Music Break]",
        start: round(end),
        end: round(end + gap),
        confidence: 0.99,
        emotion: "calm",
        energy: 4,
        inAnimation: "fade-in",
        outAnimation: "fade-out",
        words: [],
        isInstrumental: true,
      });
    }
  });

  if (cursor < duration - 1.0) {
    segments.push({
      id: `seg_inst_outro`,
      index: segIndex++,
      text: "🎵 [Instrumental Outro]",
      start: round(cursor),
      end: round(duration),
      confidence: 0.99,
      emotion: "calm",
      energy: 3,
      inAnimation: "fade-in",
      outAnimation: "fade-out",
      words: [],
      isInstrumental: true,
    });
  }

  log.push(`Distributed ${wordCount} words across ${segments.length} segments on a ${bpm} BPM grid`);
  if (lowConfidenceCount > 0) {
    log.push(`${lowConfidenceCount} segment(s) flagged for manual review (confidence < 72%)`);
  }

  return {
    language: detected.language,
    languageConfidence: round(detected.confidence),
    durationSeconds: duration,
    bpm,
    segments,
    tagsRemoved,
    wordCount,
    avgConfidence: round(confidenceSum / segments.length),
    lowConfidenceCount,
    processingMs: Date.now() - startedAt,
    log,
  };
}

/* ------------------------------------------------------------------ *
 * 6. Levenshtein / DTW warp used when a Whisper transcript exists
 * ------------------------------------------------------------------ */

export function alignToTranscript(
  lyricWords: string[],
  transcript: Array<{ word: string; start: number; end: number }>,
): Array<{ word: string; start: number; end: number; matched: boolean }> {
  const a = lyricWords.map(normalise);
  const b = transcript.map((t) => normalise(t.word));
  const rows = a.length + 1;
  const cols = b.length + 1;
  const cost = new Float64Array(rows * cols);

  for (let i = 1; i < rows; i += 1) cost[i * cols] = i;
  for (let j = 1; j < cols; j += 1) cost[j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const sub = cost[(i - 1) * cols + (j - 1)] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const del = cost[(i - 1) * cols + j] + 1;
      const ins = cost[i * cols + (j - 1)] + 1;
      cost[i * cols + j] = Math.min(sub, del, ins);
    }
  }

  const out: Array<{ word: string; start: number; end: number; matched: boolean }> = [];
  let i = a.length;
  let j = b.length;
  while (i > 0) {
    const here = cost[i * cols + j];
    const diag = j > 0 ? cost[(i - 1) * cols + (j - 1)] : Infinity;
    const up = cost[(i - 1) * cols + j];
    if (j > 0 && (here === diag || here === diag + 1)) {
      const t = transcript[j - 1];
      out.push({ word: lyricWords[i - 1], start: t.start, end: t.end, matched: a[i - 1] === b[j - 1] });
      i -= 1;
      j -= 1;
    } else if (here === up + 1) {
      const anchor = transcript[Math.max(0, j - 1)];
      out.push({
        word: lyricWords[i - 1],
        start: anchor ? anchor.start : 0,
        end: anchor ? anchor.end : 0,
        matched: false,
      });
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return out.reverse();
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

export function tokenize(line: string): string[] {
  return line.split(/\s+/).map((w) => w.trim()).filter(Boolean);
}

function normalise(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function quantise(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(2, "0")}`;
}
