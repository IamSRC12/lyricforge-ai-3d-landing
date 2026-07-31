"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type View = "landing" | "upload" | "editor" | "export";

const NAV = [
  { id: "landing" as View, label: "Home", icon: "◉", desc: "3D Experience" },
  { id: "upload" as View, label: "Upload", icon: "⬆", desc: "Audio + Lyrics" },
  { id: "editor" as View, label: "Studio", icon: "◫", desc: "Timeline Edit" },
  { id: "export" as View, label: "Export", icon: "⬇", desc: "Render 60fps" },
];

export function Sidebar({ current, onChange }: { current: View; onChange: (v: View) => void }) {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[84px] flex-col items-center border-r border-white/[0.06] bg-[#0A0A0F]/90 backdrop-blur-xl py-6 lg:w-[280px] lg:items-stretch lg:px-4">
      <div className="mb-10 flex items-center gap-3 px-2 lg:px-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black font-black text-sm">LV</div>
        <div className="hidden lg:block">
          <div className="text-sm font-bold tracking-widest text-white">LYRICALVIDEO</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">PRO • v2.1</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {NAV.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                "group relative flex h-[56px] w-[56px] flex-col items-center justify-center rounded-2xl transition-all lg:h-auto lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3",
                active ? "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.2)]" : "text-white/50 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              <span className="text-[18px] lg:text-[16px]">{item.icon}</span>
              <span className="hidden lg:flex lg:flex-col lg:items-start">
                <span className="text-sm font-semibold leading-none">{item.label}</span>
                <span className={cn("text-[10px] tracking-wide", active ? "text-black/60" : "text-white/30")}>{item.desc}</span>
              </span>
              {active && (
                <motion.div layoutId="active-indicator" className="absolute -right-[1px] top-1/2 hidden h-8 w-[3px] -translate-y-1/2 rounded-full bg-white lg:block" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto hidden flex-col gap-3 px-3 lg:flex">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">Pro License</div>
          <div className="mt-1 text-xs leading-relaxed text-white/40">Export up to 4K 60fps with zero watermark. Lifetime updates.</div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[85%] rounded-full bg-white" />
          </div>
          <div className="mt-2 text-[10px] text-white/30">85% of quota used</div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/20">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Remotion Engine • Ready
        </div>
      </div>
    </aside>
  );
}
