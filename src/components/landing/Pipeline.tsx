"use client";

import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { motion } from "framer-motion";

const STEPS = [
  {
    id: "01",
    title: "Transcribe",
    provider: "Groq · whisper-large-v3",
    body: "verbose_json with timestamp_granularities: [\"word\", \"segment\"]. Every token comes back with start, end and a confidence value.",
  },
  {
    id: "02",
    title: "Clean",
    provider: "Regex + DeepSeek fallback",
    body: "Section tags, LRC timecodes, SRT artefacts, duplicate lines and stray whitespace are removed in 14 languages before anything is aligned.",
  },
  {
    id: "03",
    title: "Align",
    provider: "DTW / Levenshtein hybrid",
    body: "Your lyrics are the source of truth. The transcript is only a time grid — matched, warped, gap-filled for instrumentals, and scored.",
  },
  {
    id: "04",
    title: "Feel",
    provider: "DeepSeek V4 Flash",
    body: "Twelve emotion classes plus a 1–10 energy read per segment, blended with the audio envelope for tempo-aware motion decisions.",
  },
  {
    id: "05",
    title: "Direct",
    provider: "Animation selector",
    body: "Best-fit in/out presets per segment with anti-repetition rules and rhythm continuity, all overridable in one click.",
  },
  {
    id: "06",
    title: "Render",
    provider: "WebCodecs + FFmpeg",
    body: "Frames are drawn on an OffscreenCanvas in a worker, encoded in batches of 300, then muxed with AAC audio into an MP4/MOV/WEBM master.",
  },
];

const SNIPPET = `interface AIProvider {
  transcribe(audio: File): Promise<TranscriptionResult>;
  detectLanguage(text: string): Promise<string>;
  cleanLyrics(raw: string, language: string): Promise<string>;
  alignLyrics(
    lyrics: string,
    transcription: TranscriptionResult,
  ): Promise<AlignedTimeline>;
  analyzeEmotion(segments: LyricSegment[]): Promise<EmotionResult[]>;
  selectAnimations(
    segments: LyricSegment[],
    emotions: EmotionResult[],
  ): Promise<AnimationAssignment[]>;
  generateLiveAnimation(
    lyrics: string,
    language: string,
    duration: number,
  ): Promise<string>;
}`;

export default function Pipeline() {
  return (
    <section id="pipeline" className="relative scroll-mt-24 overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forge-primary/50 to-transparent" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Six stages, one click"
          title={
            <>
              From raw text to a <span className="text-gradient">frame-exact master</span>
            </>
          }
          subtitle="Providers sit behind one interface, so Groq, NVIDIA NIM, OpenRouter or a future OpenAI-compatible endpoint are a dropdown change — not a refactor."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          <div className="relative">
            <div className="absolute left-[19px] top-3 h-[calc(100%-24px)] w-px bg-gradient-to-b from-forge-primary via-forge-secondary to-forge-accent opacity-45" />
            <ol className="space-y-5">
              {STEPS.map((step, index) => (
                <Reveal key={step.id} delay={index * 0.05}>
                  <li className="relative flex gap-5 pl-1">
                    <motion.span
                      whileHover={{ scale: 1.12 }}
                      className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-forge-primary/45 bg-forge-bg font-mono text-xs text-forge-accent shadow-[0_0_18px_rgba(124,58,237,0.35)]"
                    >
                      {step.id}
                    </motion.span>
                    <div className="glass flex-1 rounded-[12px] px-5 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-base font-semibold text-white">{step.title}</h3>
                        <span className="font-mono text-[11px] text-forge-faint">{step.provider}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-forge-muted">{step.body}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>

          <Reveal delay={0.15}>
            <div className="glass-strong sticky top-24 overflow-hidden rounded-[12px]">
              <div className="flex items-center gap-2 border-b border-forge-border/80 px-4 py-3">
                <span className="size-2.5 rounded-full bg-forge-error/80" />
                <span className="size-2.5 rounded-full bg-forge-warning/80" />
                <span className="size-2.5 rounded-full bg-forge-success/80" />
                <span className="ml-2 font-mono text-[11px] text-forge-faint">
                  src/services/ai/AIProvider.ts
                </span>
              </div>
              <pre className="overflow-x-auto px-4 py-4 font-mono text-[11.5px] leading-relaxed text-[#c9d1e6]">
                <code>{SNIPPET}</code>
              </pre>
              <div className="grid grid-cols-2 gap-px border-t border-forge-border/80 bg-forge-border/60">
                {[
                  ["< 30s", "analysis · 4-min song"],
                  ["≤ 6 min", "export · 3-min video"],
                  ["< 2 GB", "peak export memory"],
                  ["500+", "segments without lag"],
                ].map(([value, label]) => (
                  <div key={label} className="bg-forge-surface/90 px-4 py-3">
                    <p className="font-mono text-base font-semibold text-white">{value}</p>
                    <p className="text-[11px] text-forge-faint">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
