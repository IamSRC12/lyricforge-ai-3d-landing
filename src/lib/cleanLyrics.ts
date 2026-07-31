/**
 * Clean lyrics text without destroying legitimate parenthesized lyrics (e.g. "I'm (still) here").
 * Strips structural labels like [Chorus], [Verse 2], [Intro], [Bridge], SRT timestamps, LRC timestamps, and BOM.
 */

const STRUCTURAL_KEYWORDS = [
  "intro",
  "outro",
  "verse",
  "chorus",
  "pre-chorus",
  "prechorus",
  "post-chorus",
  "postchorus",
  "bridge",
  "hook",
  "refrain",
  "interlude",
  "solo",
  "instrumental",
  "breakdown",
  "drop",
  "build",
  "buildup",
  "tag",
  "coda",
  "estribillo",
  "verso",
  "coro",
  "puente",
  "introducción",
  "couplet",
  "pont",
  "strophe",
  "kehreim",
  "サビ",
  "イントロ",
  "アウトロ",
  "repeat",
];

const LRC_TIMESTAMP_REGEX = /\[\d{2,}:\d{2}(?:\.\d{1,3})?\]/gi;
const SRT_TIMESTAMP_REGEX = /^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}$/i;
const SRT_NUMBER_REGEX = /^\d+$/;
const BRACKET_TAG_REGEX = /^[\[\(\{]\s*([^\]\)\}]{1,50})\s*[\]\)\}]$/;

export function cleanLyricsText(raw: string): { cleaned: string; removedTags: string[]; warnings: string[] } {
  const removedTags: string[] = [];
  const warnings: string[] = [];

  if (!raw) return { cleaned: "", removedTags, warnings };

  // Remove UTF-8 BOM & normalize CRLF
  let sanitized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

  // Remove LRC timestamps from lines
  sanitized = sanitized.replace(LRC_TIMESTAMP_REGEX, (match) => {
    removedTags.push(match);
    return "";
  });

  const lines = sanitized.split("\n");
  const cleanedLines: string[] = [];

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Remove SRT index numbers (e.g., "1", "2") if followed by time
    if (SRT_NUMBER_REGEX.test(line)) {
      removedTags.push(line);
      continue;
    }

    // Remove SRT timestamp lines
    if (SRT_TIMESTAMP_REGEX.test(line)) {
      removedTags.push(line);
      continue;
    }

    // Check bracketed structural tags e.g. [Chorus], [Verse 1], (Bridge)
    const bracketMatch = line.match(BRACKET_TAG_REGEX);
    if (bracketMatch) {
      const inner = bracketMatch[1].trim().toLowerCase();
      const isKnownKeyword = STRUCTURAL_KEYWORDS.some((kw) => inner.includes(kw));
      const isShortHeader = /^(intro|verse|chorus|bridge|hook|outro|part|section)\s*\d*$/i.test(inner);

      if (isKnownKeyword || isShortHeader) {
        removedTags.push(line);
        continue; // drop structural header line
      }
    }

    // Strip inline bracketed structural tags like "[Chorus] Hello" -> "Hello"
    line = line.replace(/\[([^\]]{1,30})\]|\(([^\)]{1,30})\)/g, (match, p1, p2) => {
      const inner = (p1 || p2 || "").trim().toLowerCase();
      const isKnownKeyword = STRUCTURAL_KEYWORDS.some((kw) => inner.includes(kw));
      if (isKnownKeyword) {
        removedTags.push(match);
        return "";
      }
      return match; // preserve legitimate parens like "(still)"
    });

    line = line.replace(/\s{2,}/g, " ").trim();
    if (line) {
      cleanedLines.push(line);
    }
  }

  const cleaned = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { cleaned, removedTags, warnings };
}

export function splitIntoBlocks(cleanedText: string): string[] {
  if (!cleanedText) return [];

  // Strip SRT-style index numbers, SRT timestamps, and LRC timestamps first.
  const cleaned = cleanedText
    .replace(/^\s*\d+\s*$/gm, "")
    .replace(/^\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}.*$/gm, "")
    .replace(/\[(?:\d{1,3}:)?\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, "")
    .trim();

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const blocks: string[] = [];

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);

    // Keep natural lyric lines intact unless they are excessively long.
    if (words.length <= 14) {
      blocks.push(line);
      continue;
    }

    for (let index = 0; index < words.length; index += 10) {
      blocks.push(words.slice(index, index + 10).join(" "));
    }
  }

  return blocks;
}

export function validateLyrics(lyrics: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!lyrics || lyrics.trim().length < 3) {
    issues.push("Lyrics text is empty or too short.");
  }
  if (lyrics.length > 50000) {
    issues.push("Lyrics text exceeds maximum length limit of 50,000 characters.");
  }
  return { valid: issues.length === 0, issues };
}
