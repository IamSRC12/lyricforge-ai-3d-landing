"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { AudioWaveform } from "lucide-react";

export default function Nav() {
  const { scrollY } = useScroll();
  const background = useTransform(scrollY, [0, 120], ["rgba(7,7,12,0)", "rgba(10,10,15,0.82)"]);
  const borderColor = useTransform(scrollY, [0, 120], ["rgba(42,42,62,0)", "rgba(42,42,62,1)"]);

  return (
    <motion.header
      style={{ background, borderColor }}
      className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="/" className="group flex items-center gap-2.5">
          <span className="relative grid size-9 place-items-center rounded-[10px] bg-gradient-to-br from-forge-primary to-forge-accent shadow-[0_0_22px_rgba(124,58,237,0.45)]">
            <AudioWaveform className="size-5 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Lyric<span className="text-gradient">Forge</span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-forge-faint">ai</span>
          </span>
        </a>

        <a
          href="/studio"
          className="rounded-lg bg-gradient-to-r from-forge-primary to-forge-secondary px-4 py-2 text-sm font-medium text-white transition duration-200 hover:glow-primary hover:brightness-110"
        >
          Launch Studio →
        </a>
      </nav>
    </motion.header>
  );
}
