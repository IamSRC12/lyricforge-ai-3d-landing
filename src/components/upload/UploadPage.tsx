import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/Button";
import { useLyricStore, type LyricBlock } from "@/store/useLyricStore";
import { audioEngine } from "@/lib/audioEngine";
import { splitAudioByLyrics, type SplitMode } from "@/lib/audioSplitter";
import { SegmentPreview } from "./SegmentPreview";
import { getAudioDuration, generateWaveform, validateAudioFile, injectScopedCSS } from "@/lib/audioUtils";
import { cleanLyricsText, splitIntoBlocks, validateLyrics } from "@/lib/cleanLyrics";
import { transcribeWithGroq } from "@/lib/groq";
import { analyzeWithNvidiaNim } from "@/lib/omniRouter";
import { alignLyricsToWhisper } from "@/lib/alignLyrics";
import { SettingsModal } from "./SettingsModal";
import { Wand2 } from "lucide-react";
import { LyricsAnalyzer, generateWordTimestamps } from "@/lib/lyricsAnalyzer";
import { defaultStyle, defaultAnimation } from "@/store/useLyricStore";

export function UploadPage({ onAnalyzed }: { onAnalyzed: () => void }) {
  const { setAudio, settings, setLyricBlocks, setAudioSegments, splitMode } = useLyricStore();
  const [audioFile, setAudioFileLocal] = useState<File | null>(null);
  const [audioUrl, setAudioUrlLocal] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [lyricsText, setLyricsText] = useState("");
  const [cleanInfo, setCleanInfo] = useState<{ removed: string[]; warnings: string[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stage, setStage] = useState<
    "idle" | "transcribing" | "analyzing" | "splitting" | "review" | "error"
  >("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Optional NIM Toggle
  const [enableNim, setEnableNim] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const log = useCallback((m: string) => {
    if (isMounted.current) {
      setLogs((l) => [...l.slice(-14), m]);
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

  const runSplit = async (mode: SplitMode, includeGaps: boolean) => {
    if (!audioFile) return;
    setStage("splitting");
    setError(null);
    try {
      // Await the decode explicitly — setAudio() kicks it off via a dynamic
      // import, which is a race condition we must not rely on here.
      const { duration: decodedDuration } = await audioEngine.load(audioFile);
      const buffer = audioEngine.audioBuffer;
      if (!buffer) throw new Error("Audio decode failed — try converting to WAV or MP3.");

      const blocks = useLyricStore.getState().lyricBlocks;
      const segments = await splitAudioByLyrics(buffer, blocks, decodedDuration, {
        mode,
        includeInstrumentalGaps: includeGaps,
        onProgress: (_, msg) => log(msg),
      });

      setAudioSegments(segments);
      log(`Split into ${segments.length} clips (mode: ${mode})`);
      setStage("review");
    } catch (e) {
      setStage("error");
      const msg = e instanceof Error ? e.message : "Split failed.";
      setError(msg);
      log(`Split error: ${msg}`);
    }
  };

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

    const startTime = Date.now();
    setError(null);
    setStage("transcribing");

    try {
      log("Generating audio waveform...");
      const waveform = await generateWaveform(audioFile);

      if (!settings.groqApiKey?.trim()) {
        throw new Error(
          "A Groq API key is required for Groq Whisper alignment. Please add your Groq API key in Settings (⚙)."
        );
      }

      log("Running Groq Whisper v3 Turbo transcription...");
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
          `Groq Transcription failed: ${message}. Check your API key and connection.`
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

      const { cleaned, removedTags } = cleanLyricsText(lyricsText);
      const cleanedBlocks = splitIntoBlocks(cleaned);

      if (cleanedBlocks.length === 0) {
        throw new Error("No usable lyric lines remained after cleaning.");
      }

      log(`Preserved ${cleanedBlocks.length} lyric lines`);
      log("Executing Groq deterministic forced alignment...");

      const alignment = alignLyricsToWhisper(
        cleanedBlocks,
        whisperResult,
        finalDuration
      );

      log(
        `Groq Alignment confidence: ${(alignment.confidence * 100).toFixed(1)}% ` +
        `(${alignment.matchedWords}/${alignment.totalWords} words)`
      );

      let finalBlocks = alignment.blocks;

      if (enableNim) {
        if (!settings.nvidiaNimApiKey?.trim()) {
          log("NVIDIA NIM toggle active but no API key set; skipping NIM & using Groq aligned defaults.");
        } else {
          try {
            log("Sending timeline request to NVIDIA NIM AI Engine...");
            const aiResult = await analyzeWithNvidiaNim(
              cleanedBlocks,
              whisperResult,
              settings.nvidiaNimEndpoint || "https://integrate.api.nvidia.com",
              settings.nvidiaNimApiKey,
              settings.nvidiaNimModel || "minimaxai/minimax-m3",
              log
            );

            const styleMap = new Map<string, any>();
            for (const sb of aiResult.blocks) {
              const key = String(sb.text || "").trim().toLowerCase();
              if (key) styleMap.set(key, sb);
            }

            finalBlocks = alignment.blocks.map((alignedBlock) => {
              const key = alignedBlock.text.trim().toLowerCase();
              const styledBlock = styleMap.get(key);

              if (!styledBlock) return alignedBlock;

              return {
                ...alignedBlock,
                style: {
                  ...alignedBlock.style,
                  ...styledBlock.style,
                  gradient: { ...alignedBlock.style.gradient!, ...styledBlock.style.gradient },
                  backgroundBox: { ...alignedBlock.style.backgroundBox!, ...styledBlock.style.backgroundBox },
                },
                animation: { ...alignedBlock.animation, ...styledBlock.animation },
                emotion: styledBlock.emotion ?? alignedBlock.emotion,
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
            const message = styleError instanceof Error ? styleError.message : "NIM styling failed";
            log(`${message}; falling back to Groq aligned defaults`);
          }
        }
      } else {
        log("NVIDIA NIM feature skipped (Groq handles full lyrics alignment)");
      }

      if (!isMounted.current) return;

      setLyricBlocks(finalBlocks);
      log(`Aligned ${finalBlocks.length} lyric lines — now cutting audio…`);
      await runSplit(splitMode, false);
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
      <div className="mx-auto max-w-[1240px] px-6 py-8 lg:py-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              LyricForge Studio
              <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-3 py-0.5 text-xs font-semibold text-purple-300">
                Groq Primary Alignment
              </span>
            </h1>
            <p className="mt-1 text-sm text-white/50">
              High-precision Groq Whisper v3 Turbo lyrics timing + optional NVIDIA NIM styling
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              ⚙ Settings
            </Button>
          </div>
        </div>

        {/* -------------------- INPUT & PIPELINE STAGE -------------------- */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left Column: Upload & Lyrics */}
          <div className="space-y-6">
            {/* Audio Upload */}
            <div
              className={`rounded-[20px] border-2 border-dashed p-8 transition-colors ${
                audioDrag ? "border-white bg-white/[0.04]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
              {...getAudioRoot()}
            >
              <input {...getAudioInput()} />
              <div className="text-center cursor-pointer">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black text-xl font-bold">
                  ♪
                </div>
                <div className="mt-4 text-sm font-bold">Drop audio file here or click to browse</div>
                <div className="mt-1 text-xs text-white/40">MP3, WAV, M4A, OGG, FLAC, MP4 – up to 200MB</div>
                {audioFile && (
                  <div className="mt-4 rounded-xl bg-white text-black px-4 py-2 text-xs font-bold inline-flex items-center gap-2 shadow-lg">
                    <span>●</span> {audioFile.name} – {duration.toFixed(1)}s
                  </div>
                )}
              </div>
            </div>

            {/* Lyrics Input Box */}
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
                className="mt-4 min-h-[280px] w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm leading-relaxed text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
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
            </div>
          </div>

          {/* Right Column: Pipeline & Settings */}
          <div className="space-y-4">
            <div className="rounded-[20px] border border-white/10 bg-[#14141C] p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Analysis Pipeline</h3>

              {/* Pipeline Steps */}
              <div className="mt-4 space-y-3">
                {[
                  { id: "transcribing", title: "Groq Whisper v3 Turbo (Primary)", desc: "Exact word timestamps & lyrics alignment" },
                  { id: "analyzing", title: "NVIDIA NIM Engine (Optional)", desc: "AI visual themes & emotion styling" },
                  { id: "splitting", title: "Segment Splitter", desc: "Cut one WAV clip per lyric line" },
                ].map((s, i) => {
                  const active = stage === s.id;
                  const done =
                    (stage === "analyzing" && i === 0) ||
                    (stage === "splitting" && i <= 1) ||
                    (stage === "review" && i <= 2);
                  return (
                    <div
                      key={s.id}
                      className={`flex gap-3 rounded-xl border p-3 transition ${
                        active
                          ? "border-purple-400 bg-purple-500/20 text-white"
                          : done
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          active ? "bg-purple-500 text-white" : done ? "bg-emerald-400 text-black" : "bg-white/10 text-white/40"
                        }`}
                      >
                        {done ? "✓" : i + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{s.title}</div>
                        <div className={`text-[11px] ${active ? "text-purple-200" : "text-white/40"}`}>{s.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Optional NVIDIA NIM Switch */}
              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white/90">NVIDIA NIM Styling (Optional)</div>
                  <div className="text-[11px] text-white/40">Main lyrics timing is always handled by Groq</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableNim((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enableNim ? "bg-purple-600" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enableNim ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Analyze Action Button */}
              <div className="mt-6">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 font-bold py-3 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:scale-[1.02] transition"
                  onClick={handleAnalyze}
                  loading={stage === "transcribing" || stage === "analyzing" || stage === "splitting"}
                  disabled={!audioFile || !lyricsText.trim()}
                >
                  <Wand2 className="mr-2 h-4 w-4" /> Analyze → Divide Lyrics
                </Button>
                {error && <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300">{error}</div>}
              </div>

              {/* Live Log Window */}
              <div className="mt-6 rounded-xl bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-white/50 max-h-[160px] overflow-auto border border-white/5">
                <div className="text-white/30 mb-1.5 flex items-center justify-between">
                  <span>LIVE LOG</span>
                  <span className="text-[10px]">Groq Engine</span>
                </div>
                {logs.length === 0 ? <div>No logs yet</div> : logs.map((l, i) => <div key={i}>› {l}</div>)}
              </div>

              {/* Engine badges */}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300">MAIN ENGINE</div>
                  <div className="text-xs font-bold text-white">Groq Whisper Turbo</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">NIM FEATURE</div>
                  <div className="text-xs font-bold text-white/80">
                    {enableNim ? "NVIDIA NIM Active" : "Optional (Off)"}
                  </div>
                </div>
              </div>

            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-5">
              <div className="text-xs font-bold text-white/90">Studio Features ✨</div>
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

        {stage === "review" && (
          <div className="mt-6">
            <SegmentPreview onInsert={onAnalyzed} onResplit={(m, g) => void runSplit(m, g)} />
          </div>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
