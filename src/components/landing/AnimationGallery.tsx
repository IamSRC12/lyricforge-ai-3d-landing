"use client";

import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import {
  ANIMATION_PRESETS,
  PRESET_CATEGORIES,
  type PresetCategory,
} from "@/lib/animation-presets";
import { useMemo, useState } from "react";

export default function AnimationGallery() {
  const [category, setCategory] = useState<PresetCategory | "all">("all");
  const [playAll, setPlayAll] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  const keyframeSheet = useMemo(
    () =>
      ANIMATION_PRESETS.map((preset) => `@keyframes lf-${preset.id}{${preset.keyframes}}`).join("\n"),
    [],
  );

  const visible = useMemo(
    () =>
      category === "all"
        ? ANIMATION_PRESETS
        : ANIMATION_PRESETS.filter((preset) => preset.category === category),
    [category],
  );

  return (
    <section id="animations" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8">
      <style dangerouslySetInnerHTML={{ __html: keyframeSheet }} />

      <SectionHeading
        eyebrow="Motion library"
        title={
          <>
            32 presets, all <span className="text-gradient">canvas-native</span>
          </>
        }
        subtitle="Every preset is a pure function of progress and direction, so it renders identically in the live preview and in the exported frames. Hover a card to play it."
      />

      <Reveal delay={0.05} className="mt-10 flex flex-wrap items-center justify-center gap-2">
        {PRESET_CATEGORIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setCategory(entry.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              category === entry.id
                ? "border-forge-primary/70 bg-forge-primary/20 text-white"
                : "border-forge-border bg-forge-surface/60 text-forge-muted hover:text-white"
            }`}
          >
            {entry.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPlayAll((value) => !value)}
          className="ml-1 rounded-full border border-forge-border bg-forge-surface/60 px-4 py-1.5 text-xs font-medium text-forge-muted transition hover:text-white"
        >
          {playAll ? "Pause all" : "Play all"}
        </button>
      </Reveal>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((preset, index) => {
          const active = playAll || hovered === preset.id;
          const duration = preset.duration || 1.4;
          return (
            <Reveal key={preset.id} delay={Math.min(0.3, index * 0.02)}>
              <div
                onMouseEnter={() => setHovered(preset.id)}
                onMouseLeave={() => setHovered(null)}
                className="group relative h-full overflow-hidden rounded-[12px] border border-forge-border/80 bg-forge-surface/60 p-4 transition hover:border-forge-primary/60 hover:bg-forge-elevated/70"
              >
                <div className="grid h-20 place-items-center overflow-hidden rounded-[8px] bg-[radial-gradient(80%_80%_at_50%_50%,rgba(124,58,237,0.22),transparent)]">
                  <span
                    key={`${preset.id}-${active}`}
                    style={{
                      animation: active
                        ? `lf-${preset.id} ${duration}s ${preset.easing} infinite`
                        : undefined,
                      backgroundImage:
                        preset.id === "karaoke-fill"
                          ? "linear-gradient(90deg,#06b6d4,#a78bfa)"
                          : undefined,
                      backgroundClip: preset.id === "karaoke-fill" ? "text" : undefined,
                      WebkitBackgroundClip: preset.id === "karaoke-fill" ? "text" : undefined,
                      color: preset.id === "karaoke-fill" ? "transparent" : undefined,
                      backgroundRepeat: "no-repeat",
                    }}
                    className="text-xl font-extrabold tracking-tight text-white will-change-transform"
                  >
                    Forge
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-white">{preset.name}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-forge-faint">
                  {preset.category} · {preset.duration ? `${preset.duration}s` : "beat-locked"}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-forge-muted">{preset.detail}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
