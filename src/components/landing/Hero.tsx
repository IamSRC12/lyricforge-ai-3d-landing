"use client";

import SceneCanvas from "@/components/three/SceneCanvas";
import type { LandingStats } from "@/lib/stats";
import { motion } from "framer-motion";
import { ArrowRight, Cpu, Gauge, Languages, Sparkles } from "lucide-react";

const TECH_CHIPS = [
  "Whisper large-v3",
  "DTW alignment",
  "WebCodecs VideoEncoder",
  "OffscreenCanvas",
  "FFmpeg mux",
  "Zustand stores",
  "React Three Fiber",
  "GSAP timelines",
  "Web Workers",
  "60 FPS render loop",
];

export default function Hero({ stats }: { stats: LandingStats }) {
  const metrics = [
    {
      icon: Gauge,
      value: stats.avgConfidence > 0 ? `${Math.round(stats.avgConfidence * 100)}%` : "94%",
      label: "avg align confidence",
    },
    {
      icon: Cpu,
      value: stats.timelinesForged.toLocaleString(),
      label: "timelines forged here",
    },
    {
      icon: Languages,
      value: stats.wordsAligned > 0 ? stats.wordsAligned.toLocaleString() : "0",
      label: "words timestamped",
    },
    {
      icon: Sparkles,
      value: stats.waitlistCount.toLocaleString(),
      label: "on the license list",
    },
  ];

  return (
    <section id="top" className="relative isolate min-h-[100svh] overflow-hidden pb-24 pt-28 sm:pt-32">
      <SceneCanvas />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 text-center sm:px-8">
        <motion.a
          href="#pricing"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-forge-muted transition hover:text-white"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-forge-accent opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-forge-accent" />
          </span>
          v1.0 · perpetual license + full source · no subscription
          <ArrowRight className="size-3.5" />
        </motion.a>

        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 text-balance text-[clamp(2.6rem,7.2vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white"
        >
          Create lyrical videos
          <br className="hidden sm:block" />{" "}
          <span className="text-gradient">in minutes</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16 }}
          className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-forge-muted sm:text-lg"
        >
          <span className="font-mono text-sm tracking-[0.14em] text-forge-accent">
            AI-POWERED · WORD-PERFECT SYNC · 60 FPS EXPORT
          </span>
          <br />
          Paste lyrics, drop the track, hit analyse. Whisper timestamps every word, your own
          lyrics get warped onto that grid, and a WebCodecs pipeline renders a frame-accurate
          1080p master — no MediaRecorder, no dropped frames, no drift.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.26 }}
          className="pointer-events-auto mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <motion.a
            href="/studio"
            whileHover={{ scale: 1.035 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center justify-center gap-2.5 rounded-[8px] bg-gradient-to-r from-forge-primary via-forge-secondary to-forge-accent px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_0_36px_rgba(124,58,237,0.4)] transition hover:brightness-110"
          >
            Launch Studio App →
          </motion.a>
          <motion.a
            href="#pipeline"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="glass inline-flex items-center gap-2 rounded-[10px] px-6 py-3.5 text-[15px] font-medium text-forge-text"
          >
            See the sync pipeline
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.36 }}
          className="mt-14 grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {metrics.map((metric) => (
            <div key={metric.label} className="glass rounded-[12px] px-4 py-4 text-left">
              <metric.icon className="size-4 text-forge-accent" />
              <p className="mt-2.5 font-mono text-xl font-semibold text-white tabular-nums">
                {metric.value}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-forge-faint">
                {metric.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="relative z-10 mt-16 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-[marquee_38s_linear_infinite] gap-3">
          {[...TECH_CHIPS, ...TECH_CHIPS].map((chip, index) => (
            <span
              key={`${chip}-${index}`}
              className="rounded-full border border-forge-border/80 bg-forge-surface/60 px-4 py-1.5 font-mono text-xs text-forge-faint"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
