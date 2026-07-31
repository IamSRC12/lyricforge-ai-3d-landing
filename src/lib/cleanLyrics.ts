/**
 * Multi-language Lyric Cleaner & Header Stripper
 *
 * Strips structural section labels in any language (English, Spanish, Portuguese, French,
 * German, Italian, Turkish, Russian, Hindi, Punjabi, Korean, Japanese, Chinese, Arabic, etc.)
 * whether formatted with brackets [Intro], (Verse 1), 【Chorus】, or as standalone header lines
 * (e.g. "Intro:", "Verse 1", "Bridge -", "Chorus x2").
 */

export const MULTI_LANG_STRUCTURAL_KEYWORDS: string[] = [
  // English
  "intro", "outro", "verse", "chorus", "bridge", "hook", "pre-chorus", "prechorus",
  "post-chorus", "postchorus", "interlude", "instrumental", "solo", "break", "breakdown",
  "drop", "buildup", "build-up", "tag", "vamp", "coda", "refrain", "skit", "spoken",
  "ad-lib", "adlib", "part", "section", "lead", "guitar solo", "piano solo", "repeat",

  // Spanish / Portuguese
  "verso", "coro", "estribillo", "puente", "ponte", "refrão", "refrao", "introducción",
  "introducao", "estanza", "letra", "estrofa",

  // French
  "couplet", "refrain", "pont", "strophe", "introduction", "outro",

  // German
  "strophe", "brücke", "brucke", "kehreim", "refrain", "vorspiel", "nachspiel",

  // Italian
  "strofa", "ritornello", "ponte", "introduzione",

  // Turkish / Central Asian / Azerbaijani
  "nakarat", "köprü", "kopru", "giriş", "giris", "çıkış", "cikis",
  "kuplet", "kuple", "band", "kiriş", "kiris", "chiqish", "nakorat", "tashqi", "boshlanishi", "tugashi",
  "naqarot", "naqorot", "naqorat", "naqoroat",

  // Metadata / Script tags
  "optional cyrillic", "optional latin", "optional", "cyrillic", "latin", "translation", "transcription",
  "metadata", "credits", "romaji", "pinyin", "kanji", "hangul", "english", "uzbek",

  // Russian / Ukrainian / Belarussian
  "куплет", "припев", "бридж", "интро", "аутро", "вступление", "концовка", "соло",
  "заспів", "приспів", "вступ", "кінець",

  // Hindi / Punjabi
  "मुखड़ा", "अंतरा", "कोरस", "ब्रिज", "मुखडा", "अंतर", "संगीत",

  // Korean
  "벌스", "코러스", "브릿지", "인트로", "아웃트로", "후렴", "간주", "절",

  // Japanese
  "サビ", "aメロ", "bメロ", "cメロ", "イントロ", "アウトロ", "ブリッジ", "間奏", "前奏", "後奏",

  // Chinese
  "副歌", "主歌", "间奏", "前奏", "尾奏", "过门", "主歌1", "主歌2",

  // Arabic
  "مقطع", "لازمة", "جسر", "مقدمة", "خاتمة",
];

// Regex matching enclosed tags: [Intro], (Verse 1), {Bridge}, 【Chorus】, 〔Outro〕
const ENCLOSED_TAG_REGEX = /[[({【〔]\s*([^\])}】〕]{1,60})\s*[\])}】〕]/gi;
const LRC_TIMESTAMP_REGEX = /\[\d{2,}:\d{2}(?:\.\d{1,3})?\]/gi;
const SRT_TIMESTAMP_REGEX = /^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}$/i;
const SRT_NUMBER_REGEX = /^\d+$/;

function isStructuralHeader(text: string): boolean {
  const clean = text.trim().toLowerCase();
  if (!clean) return false;

  // Stripped numbers at beginning/end, colon, hyphens, and trailing x2/x3 etc.
  // e.g. "1-kuplet" -> "kuplet", "Verse 1:" -> "verse", "Chorus x2" -> "chorus"
  const normalized = clean
    .replace(/[:\-–—]+$/, "")
    .replace(/\s*\(?x?\s*\d+\s*\)?$/i, "") // matches (x2) or x2
    .replace(/^\d+[- ]*/, "") // matches "1-", "1 " at start
    .replace(/[- ]*\d+$/, "") // matches "-1", " 1" at end
    .trim();

  // Direct keyword match
  if (MULTI_LANG_STRUCTURAL_KEYWORDS.some((kw) => normalized === kw || normalized.startsWith(kw + " ") || normalized.endsWith(" " + kw))) {
    return true;
  }

  // Regex pattern matching
  const pattern = /^(intro|verse|verso|couplet|strophe|куплет|chorus|coro|refrain|припев|サビ|副歌|主歌|bridge|ponte|puente|бридж|hook|outro|interlude|solo|part|section|aメロ|bメロ|cメロ|kuplet|kuple|band|kiriş|kiris|chiqish|nakorat|tashqi|boshlanishi|tugashi|naqarot|naqorot|naqorat|заспів|приспів|вступ|кінець)\s*[:\-–—]?\s*\d*[a-c]?$/i;
  return pattern.test(normalized);
}

export function cleanLyricsText(raw: string): { cleaned: string; removedTags: string[]; warnings: string[] } {
  const removedTags: string[] = [];
  const warnings: string[] = [];

  if (!raw) return { cleaned: "", removedTags, warnings };

  // Remove UTF-8 BOM & normalize line endings
  let sanitized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

  // Strip LRC timestamps
  sanitized = sanitized.replace(LRC_TIMESTAMP_REGEX, (match) => {
    removedTags.push(match);
    return "";
  });

  const lines = sanitized.split("\n");
  const cleanedLines: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Remove SRT index numbers
    if (SRT_NUMBER_REGEX.test(line)) {
      removedTags.push(line);
      continue;
    }

    // Remove SRT timestamp ranges
    if (SRT_TIMESTAMP_REGEX.test(line)) {
      removedTags.push(line);
      continue;
    }

    // Check if whole line is an enclosed tag like [Intro], (Verse 1), 【Chorus】 (allowing trailing colons outside brackets)
    const bracketMatch = line.match(/^[[({【〔]\s*([^\])}】〕]{1,60})\s*[\])}】〕][: \-–—]*$/);
    if (bracketMatch) {
      const inner = bracketMatch[1].trim();
      if (isStructuralHeader(inner) || /^(repeat|\d+x|x\d+)/i.test(inner)) {
        removedTags.push(line);
        continue;
      }
    }

    // Check if whole line is an unbracketed structural header (e.g. "Intro:", "Verse 1", "Chorus")
    if (isStructuralHeader(line)) {
      removedTags.push(line);
      continue;
    }

    // Strip inline enclosed structural tags e.g. "[Chorus] We are the champions" -> "We are the champions"
    line = line.replace(ENCLOSED_TAG_REGEX, (match, p1) => {
      const inner = String(p1 || "").trim();
      if (isStructuralHeader(inner)) {
        removedTags.push(match);
        return "";
      }
      return match;
    });

    line = line.replace(/\s{2,}/g, " ").trim();
    if (line && !isStructuralHeader(line)) {
      cleanedLines.push(line);
    }
  }

  const cleaned = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { cleaned, removedTags, warnings };
}

export function splitIntoBlocks(cleanedText: string): string[] {
  if (!cleanedText) return [];

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
    // Skip residual header lines if any survived
    if (isStructuralHeader(line)) continue;

    const words = line.split(/\s+/).filter(Boolean);
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
