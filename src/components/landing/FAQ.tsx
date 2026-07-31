"use client";

import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    q: "Is the sync really perfect?",
    a: "No honest tool can promise that, and we won't. Whisper large-v3 word timestamps plus DTW alignment gets you professional-grade sync on clean vocals — typically 90-97% of words land without a touch. Everything below 72% confidence is highlighted yellow, and you get nudge (Alt+←/→, 10ms), draggable word boundaries, split and merge to finish the last mile in a minute or two.",
  },
  {
    q: "Why not MediaRecorder for export?",
    a: "Because it drops frames the moment your machine gets busy and lets audio drift out of sync — unacceptable in a paid product. LyricForge renders every frame deterministically on an OffscreenCanvas, encodes with the WebCodecs VideoEncoder, and muxes with FFmpeg. If your browser has no WebCodecs support we tell you instead of silently degrading.",
  },
  {
    q: "Which languages are supported?",
    a: "Anything Whisper transcribes. Tag cleaning ships with regex sets for English, Spanish, Portuguese, French, German, Italian, Turkish, Russian, Hindi, Korean, Japanese, Chinese and Arabic, and the LLM pass covers the leftovers. CJK text uses per-character syllable weighting so timing stays even.",
  },
  {
    q: "Do my files get uploaded anywhere?",
    a: "Only the audio you choose to transcribe goes to your transcription provider, using your own API key. Projects, media, fonts and exports stay on your disk. Keys are stored encrypted locally — never on our servers.",
  },
  {
    q: "What does the license actually include?",
    a: "A perpetual, non-expiring license for the app. Pro and Studio tiers include the full TypeScript source tree, Electron build scripts and the FFmpeg pipeline, so you can fork, rebrand internally or extend the provider adapters.",
  },
  {
    q: "Can it run offline?",
    a: "The editor, timeline, preview and export run fully offline. Only the AI stages — transcription, emotion analysis, animation direction — need a connection, and you can hand-sync a project without ever calling a model.",
  },
  {
    q: "What hardware do I need?",
    a: "Any machine with a modern Chromium browser (or the Electron build) and 8 GB of RAM. Export stays under 2 GB of memory by processing frames in batches of 300, and uses hardware encoding when the platform exposes it.",
  },
  {
    q: "Is there a demo project?",
    a: "The live alignment section on this page is the real engine — same cleaner, same distribution math, same confidence scoring, same canvas renderer. Paste your own lyrics and judge it yourself.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mx-auto max-w-4xl scroll-mt-24 px-5 py-24 sm:px-8">
      <SectionHeading eyebrow="Straight answers" title={<>Questions, without the spin</>} />

      <div className="mt-12 space-y-2.5">
        {FAQS.map((faq, index) => {
          const isOpen = open === index;
          return (
            <Reveal key={faq.q} delay={index * 0.03}>
              <div
                className={`overflow-hidden rounded-[12px] border transition-colors ${
                  isOpen
                    ? "border-forge-primary/50 bg-forge-elevated/60"
                    : "border-forge-border/80 bg-forge-surface/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-[15px] font-medium text-white">{faq.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid size-7 shrink-0 place-items-center rounded-full border border-forge-border text-forge-muted"
                  >
                    <Plus className="size-3.5" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-forge-muted">{faq.a}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
