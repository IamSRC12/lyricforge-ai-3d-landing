import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/Button";
import { useLyricStore } from "@/store/useLyricStore";
import { getAudioDuration, generateWaveform, validateAudioFile, injectScopedCSS } from "@/lib/audioUtils";
import { cleanLyricsText, splitIntoBlocks, validateLyrics } from "@/lib/cleanLyrics";
import { transcribeWithGroq } from "@/lib/groq";
import { analyzeWithNvidiaNim } from "@/lib/omniRouter";
import { alignLyricsToWhisper } from "@/lib/alignLyrics";
import { SettingsModal } from "./SettingsModal";

export function UploadPage({ onAnalyzed }: { onAnalyzed: () => void }) {
  const { setAudio, settings, setLyricBlocks } = useLyricStore();
  const [audioFile, setAudioFileLocal] = useState<File | null>(null);
  const [audioUrl, setAudioUrlLocal] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [lyricsText, setLyricsText] = useState("");
  const [cleanInfo, setCleanInfo] = useState<{ removed: string[]; warnings: string[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stage, setStage] = useState<"idle" | "transcribing" | "analyzing" | "done" | "error">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const log = useCallback((m: string) => {
    if (isMounted.current) {
      setLogs((l) => [...l.slice(-12), m]);
    }
  }, []);

  const onDropAudio = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      const validation = await validateAudioFile(file);
      if (!validation.valid) {
        setError(validation.error || "Invalid file");
        return;
      }

      setError(null);
      if (audioUrl) {
        try {
          URL.revokeObjectURL(audioUrl);
        } catch {}
      }

      setAudioFileLocal(file);
      const url = URL.createObjectURL(file);
      setAudioUrlLocal(url);

      try {
        const dur = await getAudioDuration(file);
        if (isMounted.current) {
          setDuration(dur);
          log(`Audio loaded: ${file.name} – ${dur.toFixed(2)}s`);
        }
      } catch (err: any) {
        if (isMounted.current) {
          log(`Duration detection warning: ${err.message}, using 30s fallback`);
          setDuration(30);
        }
      }
    },
    [audioUrl, log]
  );

  const { getRootProps: getAudioRoot, getInputProps: getAudioInput, isDragActive: audioDrag } = useDropzone({
    onDrop: onDropAudio,
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"],
      "video/*": [".mp4", ".webm"],
    },
    maxFiles: 1,
  });

  const onDropLyrics = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      file
        .text()
        .then((t) => {
          if (!isMounted.current) return;
          setLyricsText(t);
          const { removedTags, warnings } = cleanLyricsText(t);
          setCleanInfo({ removed: removedTags, warnings });
          log(`Lyrics file loaded: ${t.length} chars, removed ${removedTags.length} tags`);
        })
        .catch((err) => {
          if (isMounted.current) {
            setError(`Failed to read lyrics file: ${err.message}`);
          }
        });
    },
    [log]
  );

  const { getRootProps: getLyricsRoot, getInputProps: getLyricsInput } = useDropzone({
    onDrop: onDropLyrics,
    accept: { "text/plain": [".txt", ".lrc", ".srt"] },
    maxFiles: 1,
  });

  const handleAnalyze = async () => {
    if (!audioFile || !lyricsText.trim()) {
      setError("Please select an audio file and enter lyrics before analyzing.");
      return;
    }

    const validation = validateLyrics(lyricsText);
    if (!validation.valid) {
      setError(validation.issues.join(", "));
      return;
    }

    setError(null);
    setStage("transcribing");

    try {
      if (!settings.groqApiKey?.trim()) {
        throw new Error(
          "A Groq API key is required for exact synchronization. Demo timestamps are intentionally disabled because they cannot produce accurate lyric sync."
        );
      }

      log("Generating audio waveform...");
      const waveform = await generateWaveform(audioFile);

      let whisperResult;

      try {
        whisperResult = await transcribeWithGroq(
          audioFile,
          settings.groqApiKey,
          log
        );
      } catch (transcriptionError: unknown) {
        const message =
          transcriptionError instanceof Error
            ? transcriptionError.message
            : "Unknown transcription error";

        throw new Error(
          `Transcription failed: ${message}. No fake timeline was generated.`
        );
      }

      if (!isMounted.current) return;

      const finalDuration = Math.max(
        duration || 0,
        whisperResult.duration || 0
      );

      const finalUrl = audioUrl || URL.createObjectURL(audioFile);

      setAudio(
        audioFile,
        finalUrl,
        finalDuration,
        waveform
      );

      if (!isMounted.current) return;
      setStage("analyzing");

      const { cleaned } = cleanLyricsText(lyricsText);
      const cleanedBlocks = splitIntoBlocks(cleaned);

      if (cleanedBlocks.length === 0) {
        throw new Error("No usable lyric lines remained after cleaning.");
      }

      log(`Preserved ${cleanedBlocks.length} lyric lines`);
      log("Running deterministic forced alignment...");

      const alignment = alignLyricsToWhisper(
        cleanedBlocks,
        whisperResult,
        finalDuration
      );

      log(
        `Alignment confidence: ${(alignment.confidence * 100).toFixed(1)}% ` +
        `(${alignment.matchedWords}/${alignment.totalWords} words)`
      );

      if (alignment.warning) {
        log(`Warning: ${alignment.warning}`);
      }

      /*
       * AI may suggest appearance and animation, but it must never own
       * startTime, endTime or word timestamps.
       */
      let finalBlocks = alignment.blocks;

      try {
        const aiResult = await analyzeWithNvidiaNim(
          cleanedBlocks,
          whisperResult,
          settings.nvidiaNimEndpoint || "https://integrate.api.nvidia.com",
          settings.nvidiaNimApiKey || "",
          settings.nvidiaNimModel || "minimaxai/minimax-m3",
          log
        );

        // Build a TEXT → styledBlock map (case-insensitive) so we don't depend on
        // the LLM preserving order or count.
        const styleMap = new Map<string, any>();
        for (const sb of aiResult.blocks) {
          const key = String(sb.text || "").trim().toLowerCase();
          if (key) styleMap.set(key, sb);
        }

        finalBlocks = alignment.blocks.map((alignedBlock) => {
          const key = alignedBlock.text.trim().toLowerCase();
          const styledBlock = styleMap.get(key);

          if (!styledBlock) {
            // No style found — keep aligned block untouched (still perfectly synced).
            return alignedBlock;
          }

          return {
            ...alignedBlock,
            // ONLY visual fields from AI — timing & words come EXCLUSIVELY from alignment.
            style: {
              ...alignedBlock.style,
              ...styledBlock.style,
              gradient: { ...alignedBlock.style.gradient!, ...styledBlock.style.gradient },
              backgroundBox: { ...alignedBlock.style.backgroundBox!, ...styledBlock.style.backgroundBox },
            },
            animation: { ...alignedBlock.animation, ...styledBlock.animation },
            emotion: styledBlock.emotion ?? alignedBlock.emotion,

            // 🔒 Hard guarantee: these are never overwritten by AI.
            text: alignedBlock.text,
            startTime: alignedBlock.startTime,
            endTime: alignedBlock.endTime,
            words: alignedBlock.words,
          };
        });

        if (aiResult.customCSS) {
          injectScopedCSS("lyric-ai-custom", aiResult.customCSS);
        }
      } catch (styleError: unknown) {
        const message = styleError instanceof Error ? styleError.message : "AI styling failed";
        log(`${message}; continuing with aligned default styles`);
        // finalBlocks already == alignment.blocks → still perfectly synced.
      }

      if (!isMounted.current) return;

      setLyricBlocks(finalBlocks);
      log(`Generated ${finalBlocks.length} synchronized lyric blocks`);

      setStage("done");

      window.setTimeout(() => {
        if (isMounted.current) onAnalyzed();
      }, 300);
    } catch (e: any) {
      if (isMounted.current) {
        setStage("error");
        setError(e.message || "An error occurred during analysis.");
        log(`Error: ${e.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="mx-auto max-w-[1200px] px-6 py-8 lg:py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Upload & Analyze</h1>
            <p className="mt-1 text-sm text-white/50">Groq Whisper Turbo + NVIDIA NIM Timeline Engine</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            ⚙ Settings
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left */}
          <div className="space-y-6">
            <div
              className={`rounded-[20px] border-2 border-dashed p-8 transition-colors ${
                audioDrag ? "border-white bg-white/[0.04]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
              {...getAudioRoot()}
            >
              <input {...getAudioInput()} />
              <div className="text-center cursor-pointer">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black text-xl">♪</div>
                <div className="mt-4 text-sm font-bold">Drop audio file here or click to browse</div>
                <div className="mt-1 text-xs text-white/40">MP3, WAV, M4A, OGG, FLAC, MP4 – up to 200MB</div>
                {audioFile && (
                  <div className="mt-4 rounded-xl bg-white text-black px-4 py-2 text-xs font-bold inline-flex items-center gap-2">
                    <span>●</span> {audioFile.name} – {duration.toFixed(1)}s
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/60">Lyrics Input</label>
                <div className="flex gap-2">
                  <div {...getLyricsRoot()} className="rounded-full bg-white/10 px-3 py-1 text-[11px] hover:bg-white/20 cursor-pointer">
                    <input {...getLyricsInput()} />
                    Upload .txt/.lrc/.srt
                  </div>
                  {lyricsText && (
                    <button type="button" onClick={() => setLyricsText("")} className="text-[11px] text-white/40 hover:text-white">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                placeholder={`Paste lyrics here…\n\nExample:\n[Intro]\nHello world this is my song\n[Chorus]\nWe are the champions...`}
                className="mt-4 min-h-[280px] w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 text-sm leading-relaxed text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-white/40">
                  {lyricsText.length} chars • ~{Math.ceil(lyricsText.split(/\s+/).filter(Boolean).length / 2.5)} sec estimated
                </span>
                {cleanInfo && (
                  <span className="text-white/60">
                    Removed {cleanInfo.removed.length} tags • {cleanInfo.warnings.length} warnings
                  </span>
                )}
              </div>
              {cleanInfo && cleanInfo.removed.length > 0 && (
                <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-200">
                  Auto-cleaned headers: {cleanInfo.removed.slice(0, 6).join(", ")}
                  {cleanInfo.removed.length > 6 ? ` +${cleanInfo.removed.length - 6} more` : ""}
                </div>
              )}
            </div>
          </div>

          {/* Right pipeline */}
          <div className="space-y-4">
            <div className="rounded-[20px] border border-white/10 bg-[#14141C] p-6">
              <h3 className="text-sm font-bold">Analysis Pipeline</h3>
              <div className="mt-4 space-y-3">
                {[
                  { id: "transcribing", title: "Groq Whisper v3 Turbo", desc: "Word-level timestamps, auto language" },
                  { id: "analyzing", title: "NVIDIA NIM AI Engine", desc: "minimaxai/minimax-m3 timeline generation" },
                  { id: "done", title: "Timeline Ready", desc: "Push to editor" },
                ].map((s, i) => {
                  const active = stage === s.id;
                  const done = (stage === "analyzing" && i === 0) || (stage === "done" && i <= 1) || (stage === "done" && i === 2);
                  return (
                    <div
                      key={s.id}
                      className={`flex gap-3 rounded-xl border p-3 ${
                        active
                          ? "border-white bg-white text-black"
                          : done
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          active ? "bg-black text-white" : done ? "bg-emerald-400 text-black" : "bg-white/10 text-white/40"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{s.title}</div>
                        <div className={`text-[11px] ${active ? "text-black/60" : "text-white/40"}`}>{s.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                <Button
                  size="lg"
                  className="w-full rounded-full"
                  onClick={handleAnalyze}
                  loading={stage === "transcribing" || stage === "analyzing"}
                  disabled={!audioFile || !lyricsText.trim()}
                >
                  Analyze → Build Timeline
                </Button>
                {error && <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300">{error}</div>}
              </div>

              <div className="mt-6 rounded-xl bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-white/50 max-h-[200px] overflow-auto">
                <div className="text-white/30 mb-2">LIVE LOG</div>
                {logs.length === 0 ? <div>No logs yet</div> : logs.map((l, i) => <div key={i}>› {l}</div>)}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <div className="text-[10px] text-white/40">AUDIO</div>
                  <div className="text-xs font-bold">{audioFile ? `${duration.toFixed(1)}s` : "No file"}</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <div className="text-[10px] text-white/40">NIM</div>
                  <div className="text-xs font-bold">NVIDIA NIM</div>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-5">
              <div className="text-xs font-bold">Studio Features ✨</div>
              <ul className="mt-3 space-y-2 text-[11px] text-white/50">
                <li>• Auto-loop background video if shorter than audio</li>
                <li>• Custom font upload via FontFace API</li>
                <li>• Karaoke word highlight & beat pulse</li>
                <li>• Particle + visualizer backgrounds</li>
                <li>• SRT & LRC export for YouTube</li>
                <li>• Save/load projects locally</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
