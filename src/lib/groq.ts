export type GroqWord = {
  word: string;
  start: number;
  end: number;
};

export type GroqTranscriptionResult = {
  text: string;
  language: string;
  duration: number;
  words: GroqWord[];
  segments?: { id: number; seek: number; start: number; end: number; text: string; words: GroqWord[] }[];
  isFallback?: boolean;
};

export async function transcribeWithGroq(
  audioFile: File,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<GroqTranscriptionResult> {
  const cleanKey = apiKey ? apiKey.trim() : "";
  if (!cleanKey) {
    throw new Error("Groq API Key is missing. Please configure it in Settings or enable demo mode.");
  }

  onProgress?.("Uploading audio and requesting word timestamps...");

  const form = new FormData();
  form.append("file", audioFile);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    180_000
  );

  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      let msg = `Groq API HTTP ${res.status}`;
      try {
        const jsonErr = JSON.parse(errText);
        if (jsonErr.error?.message) msg += `: ${jsonErr.error.message}`;
      } catch {
        msg += `: ${errText.slice(0, 200)}`;
      }
      throw new Error(msg);
    }

    const data = await res.json();
    onProgress?.("Parsing word-level timestamps...");

    const wordsRaw = Array.isArray(data.words) ? data.words : [];
    const words: GroqWord[] = wordsRaw
      .map((w: any) => ({
        word: String(w.word || "").trim(),
        start: Math.max(0, Number(w.start) || 0),
        end: Math.max(0, Number(w.end) || 0),
      }))
      .filter((w: GroqWord) => w.word.length > 0 && Number.isFinite(w.start) && Number.isFinite(w.end));

    if (words.length === 0) {
      throw new Error(
        "Whisper completed without word timestamps. Try converting the audio to WAV or MP3 and analyze again."
      );
    }

    return {
      text: String(data.text || "").trim(),
      language: String(data.language || "en"),
      duration: Math.max(0, Number(data.duration) || 0),
      words,
      segments: Array.isArray(data.segments) ? data.segments : undefined,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(
        "Transcription timed out after 180 seconds. Try a smaller audio file or use server-side transcription."
      );
    }
    throw err;
  }
}

export async function testGroqConnection(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const cleanKey = apiKey ? apiKey.trim() : "";
  if (!cleanKey) return { ok: false, message: "API key is empty." };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${cleanKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, message: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }

    return { ok: true, message: "Groq API connected successfully." };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      return { ok: false, message: "Groq connection attempt timed out." };
    }
    return { ok: false, message: e.message || "Network error connecting to Groq." };
  }
}

export function mockGroqResult(duration: number, lyricsText: string): GroqTranscriptionResult {
  const wordsRaw = lyricsText.split(/\s+/).filter(Boolean);
  const safeDuration = Math.max(duration || 0, wordsRaw.length * 0.35, 10);
  const avg = safeDuration / Math.max(1, wordsRaw.length);

  const words: GroqWord[] = wordsRaw.map((w, i) => ({
    word: w,
    start: Number((i * avg).toFixed(2)),
    end: Number((i * avg + avg * 0.85).toFixed(2)),
  }));

  return {
    text: lyricsText,
    language: "en",
    duration: safeDuration,
    words,
    segments: [{ id: 0, seek: 0, start: 0, end: safeDuration, text: lyricsText, words }],
    isFallback: true,
  };
}
