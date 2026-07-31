"use client";

import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { motion } from "framer-motion";
import {
  Download,
  Image as ImageIcon,
  Layers,
  Music,
  Redo2,
  Settings2,
  Sparkles,
  Type,
  Undo2,
} from "lucide-react";

const TOOLS = [Type, Sparkles, ImageIcon, Music, Layers, Settings2];

const SEGMENTS = [
  { text: "We were younger than the streetlights", left: 2, width: 20, low: false },
  { text: "Counting stars we couldn't see", left: 23.5, width: 17, low: false },
  { text: "Every siren sounded like a promise", left: 41.5, width: 19, low: true },
  { text: "That the night would set us free", left: 61.5, width: 16, low: false },
  { text: "Hold the line, hold the line", left: 78.5, width: 19, low: false },
];

const ANIM_BLOCKS = [
  { left: 2, width: 8, label: "slide-up" },
  { left: 23.5, width: 7, label: "word-by-word" },
  { left: 41.5, width: 9, label: "glitch-in" },
  { left: 61.5, width: 7, label: "pop-in" },
  { left: 78.5, width: 10, label: "elastic-in" },
];

export default function EditorShowcase() {
  return (
    <section id="editor" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8">
      <SectionHeading
        eyebrow="The workspace"
        title={
          <>
            Four tracks, one canvas, <span className="text-gradient">zero guesswork</span>
          </>
        }
        subtitle="Drag word boundaries, nudge timestamps by 10ms with Alt+←/→, split and merge segments, and watch the 1920×1080 preview update at 60fps while you do it."
      />

      <Reveal delay={0.1} className="mt-12">
        <div className="glass-strong overflow-hidden rounded-[16px]">
          {/* top bar */}
          <div className="flex items-center justify-between border-b border-forge-border/80 bg-forge-bg/70 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-forge-error/70" />
                <span className="size-2.5 rounded-full bg-forge-warning/70" />
                <span className="size-2.5 rounded-full bg-forge-success/70" />
              </div>
              <span className="font-mono text-[11px] text-forge-muted">hold-the-line.lfproj</span>
              <span className="rounded-full border border-forge-success/40 bg-forge-success/10 px-2 py-0.5 font-mono text-[10px] text-forge-success">
                autosaved
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="grid size-7 place-items-center rounded-md border border-forge-border text-forge-muted" aria-label="Undo">
                <Undo2 className="size-3.5" />
              </button>
              <button className="grid size-7 place-items-center rounded-md border border-forge-border text-forge-muted" aria-label="Redo">
                <Redo2 className="size-3.5" />
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-forge-primary to-forge-secondary px-3 py-1.5 text-xs font-medium text-white">
                <Download className="size-3.5" /> Export
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[48px_minmax(0,1fr)] lg:grid-cols-[48px_minmax(0,1fr)_260px]">
            {/* tool rail */}
            <div className="flex flex-col items-center gap-1.5 border-r border-forge-border/80 bg-forge-bg/50 py-3">
              {TOOLS.map((Icon, index) => (
                <span
                  key={index}
                  className={`grid size-8 place-items-center rounded-lg ${
                    index === 0
                      ? "bg-forge-primary/20 text-forge-accent ring-1 ring-forge-primary/40"
                      : "text-forge-faint"
                  }`}
                >
                  <Icon className="size-4" />
                </span>
              ))}
            </div>

            {/* preview */}
            <div className="relative bg-[#05050b] p-4">
              <div className="relative aspect-video overflow-hidden rounded-[10px] border border-forge-border/70 bg-[radial-gradient(90%_80%_at_50%_40%,rgba(124,58,237,0.35),rgba(5,5,11,0.95))]">
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <p className="text-[clamp(1.1rem,3.4vw,2.4rem)] font-extrabold leading-tight tracking-tight">
                    <span className="text-white/45">Every siren sounded </span>
                    <span className="karaoke-fill drop-shadow-[0_0_18px_rgba(124,58,237,0.85)]">like a</span>
                    <span className="text-white/45"> promise</span>
                  </p>
                </div>
                {/* safe area guides */}
                <div className="pointer-events-none absolute inset-[7%] rounded-[6px] border border-dashed border-white/12" />
                <div className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-forge-muted">
                  01:12.40 / 03:45.00
                </div>
                <div className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-forge-success">
                  60 fps · GPU
                </div>
              </div>
            </div>

            {/* right properties panel */}
            <div className="hidden flex-col gap-3 border-l border-forge-border/80 bg-forge-bg/50 p-3 lg:flex">
              <PanelBlock title="Typography">
                <Row label="Font" value="Montserrat 800" />
                <Row label="Size" value="96 px" />
                <Row label="Tracking" value="-2" />
                <div className="mt-2 flex gap-1.5">
                  {["#f1f5f9", "#a78bfa", "#06b6d4", "#f59e0b", "#ef4444"].map((color) => (
                    <span
                      key={color}
                      style={{ background: color }}
                      className="size-5 rounded-md ring-1 ring-white/15"
                    />
                  ))}
                </div>
              </PanelBlock>
              <PanelBlock title="Animation">
                <Row label="In" value="glitch-in" />
                <Row label="Out" value="burst-out" />
                <Row label="Duration" value="0.6 s" />
              </PanelBlock>
              <PanelBlock title="AI features">
                {[
                  ["Auto highlight", true],
                  ["Auto animations", true],
                  ["Live animations", false],
                  ["AI suggestions", true],
                ].map(([label, on]) => (
                  <div key={String(label)} className="flex items-center justify-between py-1">
                    <span className="text-[11px] text-forge-muted">{label}</span>
                    <span
                      className={`flex h-4 w-7 items-center rounded-full px-0.5 ${
                        on ? "justify-end bg-forge-primary" : "justify-start bg-forge-border"
                      }`}
                    >
                      <span className="size-3 rounded-full bg-white" />
                    </span>
                  </div>
                ))}
              </PanelBlock>
            </div>
          </div>

          {/* timeline */}
          <div className="relative border-t border-forge-border/80 bg-forge-bg/70 px-3 pb-4 pt-2">
            <div className="flex items-center gap-3 pb-2 font-mono text-[10px] text-forge-faint">
              <span>⏮ ⏪ ▶ ⏩ ⏭</span>
              <span className="text-forge-text">01:12.40 / 03:45.00</span>
              <span>snap 0.1s</span>
              <span>zoom 140%</span>
            </div>

            <div className="relative space-y-1.5">
              <motion.div
                aria-hidden
                initial={{ left: "0%" }}
                animate={{ left: ["0%", "100%"] }}
                transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 z-20 h-full w-px bg-forge-error shadow-[0_0_10px_rgba(239,68,68,0.9)]"
              >
                <span className="absolute -left-1.5 -top-1 size-3 rotate-45 rounded-[2px] bg-forge-error" />
              </motion.div>

              <TrackRow label="🎵 audio">
                <div className="flex h-full items-center gap-[2px] px-1">
                  {Array.from({ length: 140 }).map((_, index) => (
                    <span
                      key={index}
                      style={{
                        height: `${18 + Math.abs(Math.sin(index * 0.5)) * 60 + (index % 7) * 3}%`,
                      }}
                      className="w-full rounded-[1px] bg-gradient-to-t from-forge-secondary/40 to-forge-accent/70"
                    />
                  ))}
                </div>
              </TrackRow>

              <TrackRow label="📝 lyrics">
                {SEGMENTS.map((segment) => (
                  <span
                    key={segment.text}
                    style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                    className={`absolute inset-y-1 flex items-center overflow-hidden rounded-[6px] border px-2 text-[10px] ${
                      segment.low
                        ? "border-forge-warning/70 bg-forge-warning/20 text-amber-100"
                        : "border-forge-primary/50 bg-gradient-to-b from-forge-primary/45 to-forge-secondary/25 text-white/90"
                    }`}
                  >
                    <span className="truncate">{segment.text}</span>
                  </span>
                ))}
              </TrackRow>

              <TrackRow label="🎬 anim">
                {ANIM_BLOCKS.map((block) => (
                  <span
                    key={block.label}
                    style={{ left: `${block.left}%`, width: `${block.width}%` }}
                    className="absolute inset-y-1 flex items-center overflow-hidden rounded-[6px] border border-forge-accent/40 bg-forge-accent/15 px-2 font-mono text-[9px] text-forge-accent"
                  >
                    <span className="truncate">{block.label}</span>
                  </span>
                ))}
              </TrackRow>

              <TrackRow label="🖼 bg">
                <span className="absolute inset-y-1 left-[1%] w-[97%] rounded-[6px] border border-forge-border bg-[repeating-linear-gradient(45deg,rgba(59,130,246,0.18)_0_10px,rgba(124,58,237,0.12)_10px_20px)] px-2 font-mono text-[9px] leading-[26px] text-forge-muted">
                  city-rain-loop.mp4 · double-buffered loop
                </span>
              </TrackRow>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function TrackRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-2">
      <span className="w-16 shrink-0 self-center font-mono text-[10px] text-forge-faint">{label}</span>
      <div className="relative h-8 flex-1 overflow-hidden rounded-[6px] border border-forge-border/70 bg-[#0b0b14]">
        {children}
      </div>
    </div>
  );
}

function PanelBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-forge-border/70 bg-forge-surface/70 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-forge-faint">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px]">
      <span className="text-forge-faint">{label}</span>
      <span className="font-mono text-forge-text">{value}</span>
    </div>
  );
}
