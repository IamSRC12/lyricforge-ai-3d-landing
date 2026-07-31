"use client";

import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import type { FeatureVote } from "@/db/schema";
import { motion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

const PHASE_LABEL: Record<string, string> = {
  "phase-1": "Phase 1 · shipped",
  "phase-2": "Phase 2 · in build",
  "phase-3": "Phase 3 · next",
  "phase-4": "Phase 4 · planned",
};

const STORAGE_KEY = "lyricforge:votes";

export default function Roadmap({ initialFeatures }: { initialFeatures: FeatureVote[] }) {
  const [features, setFeatures] = useState(initialFeatures);
  const [voted, setVoted] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setVoted(JSON.parse(raw) as string[]);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const vote = async (featureKey: string) => {
    if (voted.includes(featureKey) || pending) return;
    setPending(featureKey);
    setFeatures((current) =>
      [...current]
        .map((feature) =>
          feature.featureKey === featureKey ? { ...feature, votes: feature.votes + 1 } : feature,
        )
        .sort((a, b) => b.votes - a.votes),
    );
    const next = [...voted, featureKey];
    setVoted(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }

    try {
      await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureKey }),
      });
    } catch {
      /* optimistic UI keeps the increment; the next load re-syncs */
    } finally {
      setPending(null);
    }
  };

  const max = Math.max(...features.map((feature) => feature.votes), 1);

  return (
    <section id="roadmap" className="relative mx-auto max-w-5xl scroll-mt-24 px-5 py-24 sm:px-8">
      <SectionHeading
        eyebrow="Public roadmap"
        title={
          <>
            You decide what gets <span className="text-gradient">forged next</span>
          </>
        }
        subtitle="Votes are stored in Postgres and re-ranked live. One vote per feature, per browser."
      />

      <div className="mt-12 space-y-3">
        {features.map((feature, index) => {
          const hasVoted = voted.includes(feature.featureKey);
          return (
            <Reveal key={feature.featureKey} delay={index * 0.04}>
              <div className="glass relative overflow-hidden rounded-[12px] p-4 sm:p-5">
                <motion.span
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-forge-primary/18 to-transparent"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(feature.votes / max) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
                <div className="relative flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => vote(feature.featureKey)}
                    disabled={hasVoted}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-[10px] border px-2 py-2 transition ${
                      hasVoted
                        ? "border-forge-success/50 bg-forge-success/12 text-forge-success"
                        : "border-forge-border bg-forge-surface/80 text-forge-muted hover:border-forge-primary/60 hover:text-white"
                    }`}
                  >
                    <ChevronUp className="size-4" />
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {feature.votes.toLocaleString()}
                    </span>
                  </button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-white">{feature.label}</h3>
                      <span className="rounded-full border border-forge-border bg-forge-bg/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-forge-faint">
                        {PHASE_LABEL[feature.phase] ?? feature.phase}
                      </span>
                      <span className="rounded-full border border-forge-accent/30 bg-forge-accent/10 px-2 py-0.5 font-mono text-[10px] text-forge-accent">
                        {feature.category}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-forge-muted">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
