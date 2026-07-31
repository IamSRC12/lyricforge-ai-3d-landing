"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { AudioWaveform, Braces, Menu, X } from "lucide-react";
import { useState } from "react";

const LINKS = [
  { href: "#pipeline", label: "Pipeline" },
  { href: "#forge", label: "Live demo" },
  { href: "#editor", label: "Editor" },
  { href: "#animations", label: "Animations" },
  { href: "#pricing", label: "Pricing" },
  { href: "#roadmap", label: "Roadmap" },
];

export default function Nav() {
  const { scrollY } = useScroll();
  const background = useTransform(scrollY, [0, 120], ["rgba(7,7,12,0)", "rgba(10,10,15,0.82)"]);
  const borderColor = useTransform(scrollY, [0, 120], ["rgba(42,42,62,0)", "rgba(42,42,62,1)"]);
  const [open, setOpen] = useState(false);

  return (
    <motion.header
      style={{ background, borderColor }}
      className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="relative grid size-9 place-items-center rounded-[10px] bg-gradient-to-br from-forge-primary to-forge-accent shadow-[0_0_22px_rgba(124,58,237,0.45)]">
            <AudioWaveform className="size-5 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Lyric<span className="text-gradient">Forge</span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-forge-faint">ai</span>
          </span>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-forge-muted transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#waitlist"
            className="hidden items-center gap-2 rounded-lg border border-forge-border bg-forge-surface/80 px-3.5 py-2 text-sm text-forge-muted transition hover:border-forge-primary/60 hover:text-white sm:inline-flex"
          >
            <Braces className="size-4" /> Source access
          </a>
          <a
            href="/studio"
            className="rounded-lg bg-gradient-to-r from-forge-primary to-forge-secondary px-4 py-2 text-sm font-medium text-white transition duration-200 hover:glow-primary hover:brightness-110"
          >
            Launch Studio →
          </a>
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((value) => !value)}
            className="grid size-9 place-items-center rounded-lg border border-forge-border text-forge-muted lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-forge-border/70 bg-forge-bg/95 px-5 py-3 lg:hidden">
          <div className="grid grid-cols-2 gap-1">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-forge-muted hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </motion.header>
  );
}
