"use client";

import KaraokePreview from "@/components/landing/KaraokePreview";
import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { formatTimecode, type SyncResult } from "@/lib/sync-engine";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleAlert, Loader, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SAMPLE = `[Intro]
Neon rain on the overpass
[Verso 1]
We were younger than the streetlights
Counting stars we couldn't see
Every siren sounded like a promise
That the night would set us free

[Chorus]
Hold the line, hold the line
We are louder than the silence
Hold the line, hold the line
Every heartbeat is a lighthouse

[サビ]
Burn the map, we don't need it now
Run until the morning finds us out`;

const STEPS = [
  "Detecting language",
  "Transcribing (Whisper large-v3)",
  "Cleaning structural tags",
  "Aligning lyrics (DTW)",
  "Generating timeline",
];

export default function ForgeDemo({ initialRuns }: { initialRuns: number }) {
  const [lyrics, setLyrics] = useState(SAMPLE);
  const [duration, setDuration] = useState(96);
  const [bpm, setBpm] = useState(102);
  const [title, setTitle] = useState("Hold The Line — demo");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState(initialRuns);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const analyse = useCallback(async () => {
    if (!lyrics.trim()) {
      setError("Enter lyrics before analysing.");
      setStatus("error");
      return;
    }
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setStatus("running");
    setError(null);
    setResult(null);
    setActiveStep(0);

    STEPS.forEach((_, index) => {
      const id = window.setTimeout(() => setActiveStep(index), index * 260);
      timers.current.push(id);
    });

    try {
      const response = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics, durationSeconds: duration, bpm, title }),
      });
      const payload = (await response.json()) as { result?: SyncResult; error?: string };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Analysis failed.");
      }
      const finish = window.setTimeout(() => {
        setResult(payload.result as SyncResult);
        setActiveStep(STEPS.length);
        setStatus("done");
        setRuns((value) => value + 1);
      }, Math.max(0, STEPS.length * 260 - 200));
      timers.current.push(finish);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
      setStatus("error");
      setActiveStep(-1);
    }
  }, [bpm, duration, lyrics, title]);

  const charCount = lyrics.length;

  const timelineBlocks = useMemo(() => {
    if (!result) return [];
    return result.segments.map((segment) => ({
      id: segment.id,
      left: (segment.start / result.durationSeconds) * 100,
      width: Math.max(0.6, ((segment.end - segment.start) / result.durationSeconds) * 100),
      text: segment.text,
      confidence: segment.confidence,
      emotion: segment.emotion,
      animation: segment.inAnimation,
      start: segment.start,
    }));
  }, [result]);

  return (
    <section id="forge" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8">
      <SectionHeading
        eyebrow="Live alignment engine"
        title={
          <>
            Paste real lyrics. Watch the <span className="text-gradient">timeline forge itself</span>.
          </>
        }
        subtitle="This runs the actual production cleaner, language detector, prosody-weighted distributor and confidence scorer on our server, then renders the result through the same canvas karaoke renderer the desktop editor uses."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ---------------- input column ---------------- */}
        <Reveal className="space-y-4">
          <div className="glass rounded-[12px] p-5">
            <label className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-forge-faint">
              Lyrics
              <span className="font-mono text-[11px] normal-case tracking-normal text-forge-faint">
                {charCount.toLocaleString()} chars
              </span>
            </label>
            <textarea
              value={lyrics}
              onChange={(event) => setLyrics(event.target.value)}
              rows={12}
              spellCheck={false}
              className="mt-2.5 w-full resize-y rounded-[8px] border border-forge-border bg-[#0b0b14] p-3.5 font-mono text-[13px] leading-relaxed text-forge-text outline-none transition focus:border-forge-primary/70 focus:ring-2 focus:ring-forge-primary/25"
              placeholder="Paste .txt / .lrc / .srt lyrics — [Chorus], [Verso], [サビ] tags are stripped automatically"
            />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Slider
                label="Track length"
                value={duration}
                min={20}
                max={300}
                step={1}
                display={formatTimecode(duration)}
                onChange={setDuration}
              />
              <Slider
                label="Tempo"
                value={bpm}
                min={60}
                max={190}
                step={1}
                display={`${bpm} BPM`}
                onChange={setBpm}
              />
            </div>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-4 w-full rounded-[8px] border border-forge-border bg-[#0b0b14] px-3.5 py-2.5 text-sm text-forge-text outline-none transition focus:border-forge-primary/70"
              placeholder="Session name"
            />

            <motion.button
              type="button"
              whileHover={{ scale: status === "running" ? 1 : 1.015 }}
              whileTap={{ scale: 0.985 }}
              disabled={status === "running"}
              onClick={analyse}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-forge-primary to-forge-secondary px-5 py-3 text-[15px] font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.35)] transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "running" ? (
                <Loader className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {status === "running" ? "Forging timeline…" : "Analyse & sync"}
            </motion.button>

            <p className="mt-3 text-center font-mono text-[11px] text-forge-faint">
              {runs.toLocaleString()} timelines forged from this page
            </p>
          </div>

          <div className="glass rounded-[12px] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-forge-faint">Pipeline</p>
            <ol className="mt-3 space-y-2.5">
              {STEPS.map((step, index) => {
                const state =
                  activeStep > index || status === "done"
                    ? "done"
                    : activeStep === index && status === "running"
                      ? "active"
                      : "idle";
                return (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-300 ${
                        state === "done"
                          ? "border-forge-success/60 bg-forge-success/15 text-forge-success"
                          : state === "active"
                            ? "border-forge-primary/70 bg-forge-primary/15 text-forge-primary"
                            : "border-forge-border text-forge-faint"
                      }`}
                    >
                      {state === "done" ? (
                        <Check className="size-3.5" />
                      ) : state === "active" ? (
                        <Loader className="size-3.5 animate-spin" />
                      ) : (
                        <span className="font-mono text-[10px]">{index + 1}</span>
                      )}
                    </span>
                    <span className={state === "idle" ? "text-forge-faint" : "text-forge-text"}>{step}</span>
                  </li>
                );
              })}
            </ol>
            {error ? (
              <p className="mt-4 flex items-center gap-2 rounded-[8px] border border-forge-error/40 bg-forge-error/10 px-3 py-2 text-xs text-red-300">
                <CircleAlert className="size-3.5 shrink-0" /> {error}
              </p>
            ) : null}
          </div>
        </Reveal>

        {/* ---------------- output column ---------------- */}
        <Reveal delay={0.1} className="space-y-4">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45 }}
                className="space-y-4"
              >
                <KaraokePreview result={result} />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="language" value={result.language} accent />
                  <Stat label="segments" value={String(result.segments.length)} />
                  <Stat label="words timed" value={String(result.wordCount)} />
                  <Stat label="avg confidence" value={`${Math.round(result.avgConfidence * 100)}%`} />
                </div>

                <div className="glass rounded-[12px] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-forge-faint">
                      Lyrics track
                    </p>
                    <p className="font-mono text-[11px] text-forge-faint">
                      {result.tagsRemoved.length} tag(s) stripped · {result.lowConfidenceCount} to review ·{" "}
                      {result.processingMs}ms
                    </p>
                  </div>
                  <div className="relative mt-3 h-16 overflow-hidden rounded-[6px] border border-forge-border/70 bg-[#0b0b14]">
                    {timelineBlocks.map((block) => (
                      <span
                        key={block.id}
                        title={`${formatTimecode(block.start)} · ${block.text}`}
                        style={{ left: `${block.left}%`, width: `${block.width}%` }}
                        className={`absolute top-2 flex h-12 items-center overflow-hidden rounded-[6px] border px-1.5 text-[9px] leading-tight ${
                          block.confidence < 0.72
                            ? "border-forge-warning/70 bg-forge-warning/20 text-amber-100"
                            : "border-forge-primary/50 bg-gradient-to-b from-forge-primary/40 to-forge-secondary/25 text-white/85"
                        }`}
                      >
                        <span className="truncate">{block.text}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between font-mono text-[10px] text-forge-faint">
                    <span>00:00.00</span>
                    <span>{formatTimecode(result.durationSeconds / 2)}</span>
                    <span>{formatTimecode(result.durationSeconds)}</span>
                  </div>
                </div>

                <div className="glass rounded-[12px] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-forge-faint">
                    Engine log
                  </p>
                  <div className="mt-2 space-y-1 font-mono text-[11.5px] leading-relaxed text-forge-muted">
                    {result.log.map((line) => (
                      <p key={line} className="flex gap-2">
                        <span className="text-forge-success">›</span>
                        {line}
                      </p>
                    ))}
                    {result.tagsRemoved.length ? (
                      <p className="flex gap-2">
                        <span className="text-forge-success">›</span>
                        Removed: {result.tagsRemoved.slice(0, 8).join(" ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass grid min-h-[420px] place-items-center rounded-[12px] p-10 text-center"
              >
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-forge-primary/30 to-forge-accent/20 text-forge-accent">
                    <Sparkles className="size-6" />
                  </span>
                  <p className="mt-5 text-lg font-medium text-white">Your synced preview lands here</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-forge-muted">
                    Word-level timestamps, karaoke fill, low-confidence flags and a draggable lyrics
                    track — rendered live on a 1280×720 canvas at 60fps.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="uppercase tracking-[0.14em] text-forge-faint">{label}</span>
        <span className="font-mono text-forge-accent">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-forge-border accent-forge-primary"
      />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass rounded-[12px] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-forge-faint">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-semibold capitalize tabular-nums ${
          accent ? "text-forge-accent" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
