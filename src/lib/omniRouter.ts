import { LyricBlock, defaultStyle, defaultAnimation } from "@/store/useLyricStore";
import { GroqTranscriptionResult } from "./groq";
import { sanitizeCustomCSS } from "./cssSafety";

export type NimTimelineResult = {
  blocks: LyricBlock[];
  detectedEmotion: string;
  suggestedStyle: string;
  customCSS?: string;
};

const ANIM_IN_OPTIONS: LyricBlock["animation"]["in"][] = [
  "fade",
  "pop",
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "zoom",
  "typewriter",
  "bounce",
  "glitch",
  "kinetic",
];

const ANIM_OUT_OPTIONS: LyricBlock["animation"]["out"][] = [
  "fade",
  "pop",
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "zoom",
  "none",
];

function getApiBaseUrl(endpoint: string): string {
  const trimmed = (endpoint || "https://integrate.api.nvidia.com").trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

function generateBlockId(prefix = "block"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function analyzeWithNvidiaNim(
  cleanedLyricsBlocks: string[],
  whisperResult: GroqTranscriptionResult,
  endpoint: string,
  apiKey: string,
  model: string,
  onProgress?: (msg: string) => void
): Promise<NimTimelineResult> {
  onProgress?.("Sending timeline request to NVIDIA NIM...");

  const baseUrl = getApiBaseUrl(endpoint);
  const targetUrl = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey && apiKey.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  const prompt = buildPrompt(cleanedLyricsBlocks, whisperResult);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: model || "minimaxai/minimax-m3",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`NVIDIA NIM HTTP ${res.status}: ${txt.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      logFallback(onProgress, "Empty content from NVIDIA NIM");
      return mockNimResult(cleanedLyricsBlocks, whisperResult);
    }

    onProgress?.("Parsing NVIDIA NIM timeline response...");
    const parsed = JSON.parse(content);
    return normalizeNimResult(parsed, cleanedLyricsBlocks, whisperResult);
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      logFallback(onProgress, "NVIDIA NIM connection timed out (15s)");
    } else {
      logFallback(onProgress, e.message || "NVIDIA NIM request failed");
    }
    return mockNimResult(cleanedLyricsBlocks, whisperResult);
  }
}

function logFallback(onProgress?: (msg: string) => void, reason?: string) {
  if (reason) onProgress?.(`NVIDIA NIM fallback (${reason}) → using local timeline engine`);
}

const SYSTEM_PROMPT = `
You are the VISUAL STYLING assistant for LyricalVideoPro.

ABSOLUTE RULES (violating these breaks the product):
1. Timing is ALREADY DONE by Groq Whisper + deterministic forced-alignment.
2. You must NEVER return startTime, endTime, start, end, words, or any timing field.
3. Return ONLY: emotion, animationIn, animationOut, durationIn, durationOut, styleOverride, customCSS.
4. Preserve the EXACT text of every input block (no edits, no trimming, no reordering).
5. Return one block per input block, in the same order.
6. Return ONE valid JSON object. No markdown, no comments, no explanations.

RESPONSE SCHEMA:
{
  "detectedEmotion": "happy|sad|energetic|calm|romantic|angry|mysterious|uplifting",
  "suggestedStyle": "short description",
  "customCSS": "optional scoped CSS using only .lyric-custom",
  "blocks": [
    {
      "text": "EXACT input block text",
      "emotion": "string",
      "animationIn": "fade|pop|slideUp|slideDown|slideLeft|slideRight|zoom|typewriter|bounce|glitch|kinetic|none",
      "animationOut": "fade|pop|slideUp|slideDown|slideLeft|slideRight|zoom|none",
      "durationIn": 0.3,
      "durationOut": 0.3,
      "styleOverride": {
        "fontFamily": "Inter", "fontSize": 64, "color": "#FFFFFF",
        "outlineColor": "#000000", "outlineWidth": 3,
        "x": 50, "y": 75, "bold": true, "italic": false,
        "uppercase": false, "align": "center",
        "shadow": true, "shadowColor": "#000000", "shadowBlur": 12,
        "glow": false, "glowColor": "#FFFFFF"
      }
    }
  ]
}

FORBIDDEN IN OUTPUT: startTime, endTime, start, end, words, word, timestamp, time.
`;

function buildPrompt(cleanedBlocks: string[], whisper: GroqTranscriptionResult): string {
  const whisperWords = (whisper.words || [])
    .map((w) => `${w.word}[${Number(w.start).toFixed(2)}-${Number(w.end).toFixed(2)}]`)
    .join(" ");
  return JSON.stringify({
    lyricBlocks: cleanedBlocks,
    whisperText: (whisper.text || "").slice(0, 4000), // Raised limit
    whisperWords, // Removed 600 cap
    duration: whisper.duration,
    language: whisper.language,
    note: "Timing is already finalized. Use this data only to pick animations that match energy. DO NOT return timing fields."
  });
}

function normalizeNimResult(
  raw: any,
  cleanedBlocks: string[],
  _whisper: GroqTranscriptionResult
): NimTimelineResult {
  const detectedEmotion =
    typeof raw?.detectedEmotion === "string" ? raw.detectedEmotion : "energetic";
  const rawBlocks = Array.isArray(raw?.blocks) ? raw.blocks : [];

  // Build a TEXT → style lookup so we can match by content, not by index.
  const styleByBlockText = new Map<string, any>();
  for (const b of rawBlocks) {
    const t = String(b?.text || "").trim().toLowerCase();
    if (t) styleByBlockText.set(t, b);
  }

  const blocks: LyricBlock[] = cleanedBlocks.map((blockText, idx) => {
    const b = styleByBlockText.get(blockText.trim().toLowerCase()) || rawBlocks[idx] || {};

    const style: LyricBlock["style"] = {
      ...defaultStyle,
      x: Number(b.styleOverride?.x) || 50,
      y: Number(b.styleOverride?.y) || 65 + (idx % 4) * 6,
      fontFamily: String(b.styleOverride?.fontFamily || defaultStyle.fontFamily),
      fontSize: Number(b.styleOverride?.fontSize) || defaultStyle.fontSize,
      color: String(b.styleOverride?.color || defaultStyle.color),
      outlineColor: String(b.styleOverride?.outlineColor || defaultStyle.outlineColor),
      outlineWidth: Number(b.styleOverride?.outlineWidth) ?? defaultStyle.outlineWidth,
      bold: b.styleOverride?.bold !== undefined ? Boolean(b.styleOverride.bold) : defaultStyle.bold,
      italic: b.styleOverride?.italic !== undefined ? Boolean(b.styleOverride.italic) : defaultStyle.italic,
      uppercase: b.styleOverride?.uppercase !== undefined ? Boolean(b.styleOverride.uppercase) : defaultStyle.uppercase,
      align: (["left", "center", "right"] as const).includes(b.styleOverride?.align)
        ? b.styleOverride.align
        : defaultStyle.align,
      shadow: b.styleOverride?.shadow !== undefined ? Boolean(b.styleOverride.shadow) : defaultStyle.shadow,
      shadowColor: String(b.styleOverride?.shadowColor || defaultStyle.shadowColor),
      shadowBlur: Number(b.styleOverride?.shadowBlur) ?? defaultStyle.shadowBlur,
      glow: b.styleOverride?.glow !== undefined ? Boolean(b.styleOverride.glow) : defaultStyle.glow,
      glowColor: String(b.styleOverride?.glowColor || defaultStyle.glowColor),
      gradient: { ...defaultStyle.gradient! },
      backgroundBox: { ...defaultStyle.backgroundBox! },
    };

    const animation: LyricBlock["animation"] = {
      in: ANIM_IN_OPTIONS.includes(b.animationIn) ? b.animationIn : defaultAnimation.in,
      out: ANIM_OUT_OPTIONS.includes(b.animationOut) ? b.animationOut : defaultAnimation.out,
      durationIn: Number(b.durationIn) || defaultAnimation.durationIn,
      durationOut: Number(b.durationOut) || defaultAnimation.durationOut,
      customCSS: null,
      staggerWords: defaultAnimation.staggerWords,
    };

    // ⚠️ NO timing fields here. Timing comes ONLY from alignLyricsToWhisper.
    return {
      id: generateBlockId("block_nim"),
      text: blockText,
      startTime: 0,      // placeholder — replaced by alignment in UploadPage
      endTime: 0,
      words: [],
      style,
      animation,
      emotion: b.emotion || detectedEmotion,
    };
  });

  const suggestedStyle =
    typeof raw?.suggestedStyle === "string" ? raw.suggestedStyle : "NVIDIA NIM AI Timeline";
  const rawCustomCSS = typeof raw?.customCSS === "string" ? raw.customCSS : "";

  return {
    blocks,
    detectedEmotion,
    suggestedStyle,
    customCSS: rawCustomCSS ? sanitizeCustomCSS(rawCustomCSS) : undefined,
  };
}

export function mockWordsFromText(text: string, start: number, end: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const duration = Math.max(0.2, end - start);
  const perWord = duration / words.length;
  return words.map((w, i) => ({
    word: w,
    start: Number((start + i * perWord).toFixed(2)),
    end: Number((start + i * perWord + perWord * 0.85).toFixed(2)),
  }));
}

export async function testNvidiaNimConnection(endpoint: string, apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const baseUrl = getApiBaseUrl(endpoint);
    const targetUrl = `${baseUrl}/models`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey && apiKey.trim()) headers["Authorization"] = `Bearer ${apiKey.trim()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, { method: "GET", headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, message: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, message: "NVIDIA NIM server connected on " + baseUrl };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { ok: false, message: "Connection timed out" };
    }
    return { ok: false, message: e.message || "Connection failed" };
  }
}

export function mockNimResult(
  cleanedBlocks: string[],
  _whisper: GroqTranscriptionResult
): NimTimelineResult {
  const detected = "energetic";
  const blocks: LyricBlock[] = cleanedBlocks.map((blockText, idx) => ({
    id: generateBlockId("block_mock"),
    text: blockText,
    startTime: 0,    // ← never fabricate timing
    endTime: 0,
    words: [],
    style: {
      ...defaultStyle,
      x: 50,
      y: 65 + (idx % 4) * 6,
      color: "#FFFFFF",
    },
    animation: {
      ...defaultAnimation,
      in: ANIM_IN_OPTIONS[idx % ANIM_IN_OPTIONS.length],
      out: "fade",
      customCSS: null,
    },
    emotion: detected,
  }));

  return {
    blocks,
    detectedEmotion: detected,
    suggestedStyle: "Default Styles (NIM offline)",
    customCSS: undefined,
  };
}
