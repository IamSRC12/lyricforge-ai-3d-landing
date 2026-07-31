"use client";

import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import { motion } from "framer-motion";
import { Check, Infinity as InfinityIcon } from "lucide-react";

export type PlanId = "indie" | "pro" | "studio";

const PLANS: Array<{
  id: PlanId;
  name: string;
  price: string;
  blurb: string;
  featured?: boolean;
  perks: string[];
}> = [
  {
    id: "indie",
    name: "Indie",
    price: "$500",
    blurb: "One artist, one machine, forever.",
    perks: [
      "Perpetual license · 1 seat",
      "Full editor + 32 animation presets",
      "1080p60 WebCodecs export",
      "Bring your own Groq / DeepSeek keys",
      "12 months of updates",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro + Source",
    price: "$750",
    blurb: "The whole repo, yours to fork.",
    featured: true,
    perks: [
      "Everything in Indie · 3 seats",
      "Complete TypeScript source tree",
      "Electron build scripts (win/mac/linux)",
      "System FFmpeg pipeline (~10× faster)",
      "Live AI animation layer",
      "Lifetime updates + priority issues",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$1,000",
    blurb: "Label and agency deployments.",
    perks: [
      "Everything in Pro · 10 seats",
      "White-label branding + custom presets",
      "Render farm / batch export scripts",
      "Private provider adapters (NVIDIA NIM, OpenCode)",
      "Onboarding session + SLA",
      "Commercial redistribution add-on",
    ],
  },
];

export function selectPlan(plan: PlanId) {
  window.dispatchEvent(new CustomEvent<PlanId>("lyricforge:select-plan", { detail: plan }));
  document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Pricing() {
  return (
    <section id="pricing" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8">
      <SectionHeading
        eyebrow="Own it outright"
        title={
          <>
            Buy once. Render <span className="text-gradient">forever</span>.
          </>
        }
        subtitle="No render credits, no watermark tax, no monthly bill. Your audio, lyrics and exports never leave your machine — the only network calls are the AI ones you trigger with your own keys."
      />

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan, index) => (
          <Reveal key={plan.id} delay={index * 0.06}>
            <motion.div
              whileHover={{ y: -8 }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              className={`relative flex h-full flex-col overflow-hidden rounded-[12px] border p-6 ${
                plan.featured
                  ? "border-forge-primary/60 bg-gradient-to-b from-forge-primary/18 via-forge-elevated/70 to-forge-surface/70 glow-primary"
                  : "border-forge-border/80 bg-forge-surface/60"
              }`}
            >
              {plan.featured ? (
                <span className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-forge-primary to-forge-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  most picked
                </span>
              ) : null}
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-forge-muted">{plan.blurb}</p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-white">{plan.price}</span>
                <span className="font-mono text-xs text-forge-faint">one time</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-sm text-forge-muted">
                    <Check className="mt-0.5 size-4 shrink-0 text-forge-success" />
                    {perk}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => selectPlan(plan.id)}
                className={`mt-7 w-full rounded-[8px] px-5 py-3 text-[15px] font-semibold transition ${
                  plan.featured
                    ? "bg-gradient-to-r from-forge-primary to-forge-secondary text-white hover:brightness-110"
                    : "border border-forge-border bg-forge-bg/60 text-forge-text hover:border-forge-primary/60"
                }`}
              >
                Reserve {plan.name}
              </button>
            </motion.div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.15} className="mt-8">
        <p className="glass mx-auto flex max-w-3xl items-center justify-center gap-3 rounded-[12px] px-5 py-4 text-center text-sm text-forge-muted">
          <InfinityIcon className="size-4 shrink-0 text-forge-accent" />
          Offline license validation on first launch, stored in electron-store — no phone-home,
          no seat server, no kill switch.
        </p>
      </Reveal>
    </section>
  );
}
