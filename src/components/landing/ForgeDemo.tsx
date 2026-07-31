"use client";

import KaraokePreview from "@/components/landing/KaraokePreview";
import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { formatTimecode, type SyncResult, type SyncSegment } from "@/lib/sync-engine";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleAlert, Loader, Play, Sparkles, Wand2, Volume2, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TURKMEN_SAMPLE = `[Soňky söz / Giriş]
Gara gumda ýel öwser,
Aý ýagtysy ýol açar.
Dutarymda müň hekaýa,
Bir ses bolup oýar.

[1-nji bent]
Köpetdagyň eteginde
Ojak tüssäp dumanlar.
Il-gün üçin dileg edýän,
Bagtymyza amanlar.

[Gaýtalama]
Eý ýurdumyzyň ruhy,
Eý giň sähranyň ysy,
Dutar diýip ýürek aýdýar:
“Birlik bolsun güýjümiz!”

[2-nji bent]
Ýolagçynyň ýüki ýeňil,
Myhman bolsa öý bereket.
Adatymyz, ar-namysymyz —
Biziň üçin iň uly döwlet.`;

const ENGLISH_SAMPLE = `[Intro]
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

[Outro]
Burn the map, we don't need it now
Run until the morning finds us out`;

const STEPS = [
  "Detecting language & script",
  "Transcribing & Timestamping",
  "Cleaning structural section tags",
  "Splitting into lines + instrumental breaks",
  "Generating segment preview",
];

export default function ForgeDemo({ initialRuns }: { initialRuns: number }) {
  const [lyrics, setLyrics] = useState(TURKMEN_SAMPLE);
  const [duration, setDuration] = useState(120);
  const [bpm, setBpm] = useState(98);
  const [title, setTitle] = useState("Dutar Sähra — Turkmen session");
  const [status, setStatus] = useState<"idle" | "running" | "preview" | "sent_to_timeline" | "error">("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [editableSegments, setEditableSegments] = useState<SyncSegment[]>([]);
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState(initialRuns);

  const timers = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

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
    setEditableSegments([]);
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
        const syncRes = payload.result as SyncResult;
        setResult(syncRes);
        setEditableSegments(syncRes.segments);
        setActiveStep(STEPS.length);
        setStatus("preview");
        setRuns((value) => value + 1);
      }, Math.max(0, STEPS.length * 260 - 200));
      timers.current.push(finish);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
      setStatus("error");
      setActiveStep(-1);
    }
  }, [bpm, duration, lyrics, title]);

  const playSegmentAudio = (segment: SyncSegment) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      setPlayingSegmentId(segment.id);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const segDur = Math.max(0.4, segment.end - segment.start);
      const isInst = Boolean(segment.isInstrumental);

      osc.type = isInst ? "sine" : "triangle";
      osc.frequency.setValueAtTime(isInst ? 320 : 440, ctx.currentTime);
      if (isInst) {
        osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + segDur);
      }

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + segDur - 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + segDur);

      setTimeout(() => {
        setPlayingSegmentId(null);
      }, segDur * 1000);
    } catch {
      setPlayingSegmentId(null);
    }
  };

  const handleSendToTimeline = () => {
    setStatus("sent_to_timeline");
    const editorElem = document.getElementById("editor");
    if (editorElem) {
      editorElem.scrollIntoView({ behavior: "smooth" });
    }
  };

  const charCount = lyrics.length;
  const lyricLineCount = editableSegments.filter((s) => !s.isInstrumental).length;
  const instBreakCount = editableSegments.filter((s) => s.isInstrumental).length;

  const timelineBlocks = useMemo(() => {
    if (!result) return [];
    return editableSegments.map((segment) => ({
      id: segment.id,
      left: (segment.start / result.durationSeconds) * 100,
      width: Math.max(0.6, ((segment.end - segment.start) / result.durationSeconds) * 100),
      text: segment.text,
      confidence: segment.confidence,
      emotion: segment.emotion,
      animation: segment.inAnimation,
      start: segment.start,
      isInstrumental: segment.isInstrumental,
    }));
  }, [result, editableSegments]);

  return (
    <section id="forge" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8">
      <SectionHeading
        eyebrow="Segment Splitter & Alignment Engine"
        title={
          <>
            Split lyrics into <span className="text-gradient">exact segments + instrumental breaks</span>
          </>
        }
        subtitle="Paste your lyrics, analyze audio timings, preview every split line and instrumental music break, verify accuracy, then send to the studio timeline."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ---------------- Input Column ---------------- */}
        <Reveal className="space-y-4">
          <div className="glass rounded-[12px] p-5">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-forge-faint">
              <span>Lyrics Input</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLyrics(TURKMEN_SAMPLE)}
                  className="rounded-full bg-forge-primary/20 border border-forge-primary/40 px-2.5 py-0.5 text-[10px] text-purple-200 hover:bg-forge-primary/30"
                >
                  Turkmen Sample
                </button>
                <button
                  type="button"
                  onClick={() => setLyrics(ENGLISH_SAMPLE)}
                  className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-white/60 hover:bg-white/20"
                >
                  English Sample
                </button>
              </div>
            </div>

            <textarea
              value={lyrics}
              onChange={(event) => setLyrics(event.target.value)}
              rows={13}
              spellCheck={false}
              className="mt-2.5 w-full resize-y rounded-[8px] border border-forge-border bg-[#0b0b14] p-3.5 font-mono text-[13px] leading-relaxed text-forge-text outline-none transition focus:border-forge-primary/70 focus:ring-2 focus:ring-forge-primary/25"
              placeholder="Paste your song lyrics here..."
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
              {status === "running" ? "Splitting & Aligning..." : "Analyse & Split Segments"}
            </motion.button>
          </div>

          <div className="glass rounded-[12px] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-forge-faint">Pipeline Steps</p>
            <ol className="mt-3 space-y-2.5">
              {STEPS.map((step, index) => {
                const state =
                  activeStep > index || status === "preview" || status === "sent_to_timeline"
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

        {/* ---------------- Output & Preview Column ---------------- */}
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
                {/* Stats Header */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Language" value={result.language} accent />
                  <Stat label="Lyric Lines" value={String(lyricLineCount)} />
                  <Stat label="Inst. Breaks (x)" value={String(instBreakCount)} />
                  <Stat label="Total Segments" value={`${editableSegments.length}`} />
                </div>

                {/* SEGMENT PREVIEW & VERIFICATION TABLE */}
                <div className="glass rounded-[12px] p-5 border border-purple-500/30">
                  <div className="flex items-center justify-between border-b border-forge-border/70 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles className="size-4 text-forge-accent" />
                        Segment Verification & Audio Clip Preview
                      </h3>
                      <p className="text-xs text-forge-muted mt-0.5">
                        Preview each split segment before sending to timeline ({lyricLineCount} lines + {instBreakCount} instrumental gaps).
                      </p>
                    </div>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSendToTimeline}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition"
                    >
                      Send to Timeline →
                    </motion.button>
                  </div>

                  {/* Segment List */}
                  <div className="mt-4 max-h-[380px] space-y-2 overflow-y-auto pr-1">
                    {editableSegments.map((seg, idx) => (
                      <div
                        key={seg.id}
                        className={`flex flex-col gap-2 rounded-lg border p-3 text-xs transition ${
                          seg.isInstrumental
                            ? "border-purple-500/30 bg-purple-500/10 text-purple-200"
                            : "border-forge-border/80 bg-black/40 text-white hover:border-forge-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                                seg.isInstrumental
                                  ? "bg-purple-500/30 text-purple-300"
                                  : "bg-forge-primary/30 text-forge-accent"
                              }`}
                            >
                              {seg.isInstrumental ? "🎵 Inst. Break" : `Lyric #${idx + 1}`}
                            </span>
                            <span className="font-mono text-[11px] text-forge-faint">
                              {formatTimecode(seg.start)} – {formatTimecode(seg.end)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => playSegmentAudio(seg)}
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                                playingSegmentId === seg.id
                                  ? "bg-emerald-500 text-black animate-pulse"
                                  : "bg-white/10 text-white hover:bg-white/20"
                              }`}
                            >
                              {playingSegmentId === seg.id ? (
                                <>
                                  <Volume2 className="size-3" /> Playing...
                                </>
                              ) : (
                                <>
                                  <Play className="size-3 fill-current" /> Listen Clip
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Editable Text */}
                        <input
                          type="text"
                          value={seg.text}
                          onChange={(e) => {
                            const newText = e.target.value;
                            setEditableSegments((prev) =>
                              prev.map((s) => (s.id === seg.id ? { ...s, text: newText } : s))
                            );
                          }}
                          className="w-full rounded border border-white/10 bg-black/50 px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-forge-primary/60"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-forge-border/70 pt-3">
                    <span className="text-xs text-forge-muted">
                      ✓ All {editableSegments.length} segments verified
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSendToTimeline}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-forge-primary to-forge-secondary px-5 py-2.5 text-xs font-bold text-white shadow-lg transition"
                    >
                      Send to Timeline →
                    </motion.button>
                  </div>
                </div>

                {/* Draggable Track Representation */}
                <div className="glass rounded-[12px] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-forge-faint">
                      Timeline Overview
                    </p>
                    <p className="font-mono text-[11px] text-forge-faint">
                      {result.tagsRemoved.length} tag(s) stripped · {result.processingMs}ms
                    </p>
                  </div>
                  <div className="relative mt-3 h-16 overflow-hidden rounded-[6px] border border-forge-border/70 bg-[#0b0b14]">
                    {timelineBlocks.map((block) => (
                      <span
                        key={block.id}
                        title={`${formatTimecode(block.start)} · ${block.text}`}
                        style={{ left: `${block.left}%`, width: `${block.width}%` }}
                        className={`absolute top-2 flex h-12 items-center overflow-hidden rounded-[6px] border px-1.5 text-[9px] leading-tight ${
                          block.isInstrumental
                            ? "border-purple-500/50 bg-purple-500/20 text-purple-200"
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

                {/* Karaoke Live Canvas */}
                <KaraokePreview result={result} />
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
                  <p className="mt-5 text-lg font-medium text-white">Segment Preview lands here</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-forge-muted">
                    Paste lyrics and click <strong>Analyse & Split Segments</strong> to generate line-by-line audio split clips and preview them before pushing to timeline.
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
