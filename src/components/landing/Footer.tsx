import { AudioWaveform } from "lucide-react";

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    links: [
      { label: "Pipeline", href: "#pipeline" },
      { label: "Live demo", href: "#forge" },
      { label: "Editor", href: "#editor" },
      { label: "Animations", href: "#animations" },
    ],
  },
  {
    title: "Buy",
    links: [
      { label: "Pricing", href: "#pricing" },
      { label: "Roadmap", href: "#roadmap" },
      { label: "Early access", href: "#waitlist" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Engineering",
    links: [
      { label: "Health check", href: "/api/health" },
      { label: "Alignment API", href: "/api/forge" },
      { label: "Roadmap API", href: "/api/roadmap" },
      { label: "Waitlist API", href: "/api/waitlist" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-forge-border/70 bg-forge-bg/80">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-[10px] bg-gradient-to-br from-forge-primary to-forge-accent">
                <AudioWaveform className="size-5 text-white" />
              </span>
              <span className="text-[15px] font-semibold text-white">
                Lyric<span className="text-gradient">Forge</span> AI
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-forge-muted">
              A local-first lyrical video editor: Whisper-grade word timing, canvas-native motion
              design and a frame-exact WebCodecs exporter. Perpetual license, source included.
            </p>
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-forge-faint">
              v1.0.0 · React 19 · WebCodecs · FFmpeg · Drizzle + Postgres
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forge-faint">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-forge-muted transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-forge-border/70 pt-6 text-xs text-forge-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LyricForge AI. Built for people who ship videos, not demos.</p>
          <p className="font-mono">
            Honest claim: professional-grade sync + manual correction tools. Not magic.
          </p>
        </div>
      </div>
    </footer>
  );
}
