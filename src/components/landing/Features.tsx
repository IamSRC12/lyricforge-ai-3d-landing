"use client";

import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { motion } from "framer-motion";
import {
  Braces,
  Cpu,
  Film,
  KeyRound,
  Layers,
  MonitorPlay,
  Palette,
  Scissors,
  Waves,
} from "lucide-react";

const FEATURES = [
  {
    icon: Waves,
    title: "Word-level Whisper sync",
    body: "Groq whisper-large-v3 with verbose_json + word granularity. Your lyrics are warped onto the transcript with a Levenshtein/DTW hybrid — the ASR never overwrites your text.",
    tag: "alignment",
  },
  {
    icon: Scissors,
    title: "Multilingual tag cleaning",
    body: "[Intro], [Estribillo], [मुखड़ा], [사비], [サビ], [副歌] — 24 section keywords across 14 languages stripped by regex, with an LLM pass for the leftovers.",
    tag: "cleanup",
  },
  {
    icon: Palette,
    title: "Full typographic control",
    body: "Custom .ttf/.otf drops via FontFace API, outline, shadow, glow, gradient fill, stroke, letter spacing, anchor points, corner radius and per-segment overrides.",
    tag: "design",
  },
  {
    icon: Film,
    title: "32 canvas animations",
    body: "Fade, elastic, glitch, neon flicker, mask wipe, split reveal, karaoke fill, letter-by-letter — each preset is a pure function of (progress, direction).",
    tag: "motion",
  },
  {
    icon: Cpu,
    title: "AI direction, optional",
    body: "Emotion + energy analysis assigns in/out animations per segment, never repeating the same one three times in a row, and can write a live renderFrame() overlay.",
    tag: "ai",
  },
  {
    icon: MonitorPlay,
    title: "WebCodecs export, strictly",
    body: "OffscreenCanvas → ImageBitmap → VideoEncoder → FFmpeg mux. No MediaRecorder, no html2canvas — frame-exact 1080p60 with AAC 192kbps audio.",
    tag: "export",
  },
  {
    icon: Layers,
    title: "Seamless background loops",
    body: "Double-buffered video elements crossfade at the loop point, so a 9-second clip under a 4-minute song never shows a black frame.",
    tag: "background",
  },
  {
    icon: Braces,
    title: "Portable project JSON",
    body: "Timeline, styles, animations and export settings serialise to one shareable file. Autosave to IndexedDB with crash recovery on reload.",
    tag: "projects",
  },
  {
    icon: KeyRound,
    title: "Local-first & licensed",
    body: "Keys live in encrypted local storage, media never leaves your machine, and the perpetual license ships the full source tree.",
    tag: "ownership",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8">
      <SectionHeading
        eyebrow="What's inside"
        title={
          <>
            A real editor, not a <span className="text-gradient">template filler</span>
          </>
        }
        subtitle="Every subsystem below exists because lyric videos break in exactly these places: drift, mangled tags, ugly typography, and exporters that drop frames."
      />

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={index * 0.04}>
            <motion.article
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="group relative h-full overflow-hidden rounded-[12px] border border-forge-border/80 bg-gradient-to-b from-forge-elevated/70 to-forge-surface/60 p-6 backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-forge-primary/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <span className="grid size-11 place-items-center rounded-[10px] border border-forge-primary/30 bg-forge-primary/12 text-forge-accent">
                  <feature.icon className="size-5" />
                </span>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-forge-faint">
                  {feature.tag}
                </p>
                <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-white">{feature.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-forge-muted">{feature.body}</p>
              </div>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
