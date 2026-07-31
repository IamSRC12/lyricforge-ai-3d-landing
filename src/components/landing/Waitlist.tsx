"use client";

import { Reveal, SectionHeading } from "@/components/ui/Reveal";
import type { PlanId } from "@/components/landing/Pricing";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Loader, Rocket } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const ROLES = [
  { id: "artist", label: "Artist / songwriter" },
  { id: "producer", label: "Producer" },
  { id: "editor", label: "Video editor" },
  { id: "studio", label: "Studio / agency" },
  { id: "label", label: "Label" },
  { id: "creator", label: "Content creator" },
];

type Recent = { handle: string; role: string; plan: string; createdAt: string };

export default function Waitlist({ initialCount }: { initialCount: number }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("artist");
  const [plan, setPlan] = useState<PlanId>("pro");
  const [useCase, setUseCase] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [count, setCount] = useState(initialCount);
  const [recent, setRecent] = useState<Recent[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PlanId>).detail;
      if (detail) setPlan(detail);
      window.setTimeout(() => emailRef.current?.focus(), 550);
    };
    window.addEventListener("lyricforge:select-plan", handler);
    return () => window.removeEventListener("lyricforge:select-plan", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/waitlist")
      .then((response) => response.json())
      .then((data: { count: number; recent: Recent[] }) => {
        if (cancelled) return;
        setCount(data.count);
        setRecent(data.recent ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [state]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("sending");
    setMessage(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, plan, useCase }),
      });
      const payload = (await response.json()) as {
        error?: string;
        position?: number;
        count?: number;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not save your spot.");
      setPosition(payload.position ?? null);
      setCount(payload.count ?? count + 1);
      setState("done");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save your spot.");
      setState("error");
    }
  };

  return (
    <section id="waitlist" className="relative scroll-mt-24 overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(124,58,237,0.22),transparent_70%)]" />
      <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Early access"
          title={
            <>
              Claim a <span className="text-gradient">founding license</span>
            </>
          }
          subtitle="First 200 seats ship with the full source tree at the Indie price. Tell us what you make and we'll shape the build order around it."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Reveal>
            <div className="glass-strong rounded-[16px] p-6 sm:p-8">
              <AnimatePresence mode="wait">
                {state === "done" ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-8 text-center"
                  >
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-forge-success/15 text-forge-success">
                      <CircleCheck className="size-7" />
                    </span>
                    <h3 className="mt-5 text-2xl font-semibold text-white">You&apos;re on the list</h3>
                    <p className="mt-2 text-sm text-forge-muted">
                      {position ? (
                        <>
                          Position <span className="font-mono text-forge-accent">#{position}</span> of{" "}
                          {count.toLocaleString()} · {plan} license reserved.
                        </>
                      ) : (
                        "Your seat is reserved."
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => setState("idle")}
                      className="mt-6 rounded-[8px] border border-forge-border px-5 py-2.5 text-sm text-forge-muted transition hover:text-white"
                    >
                      Add another email
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={submit}
                    className="space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Email">
                        <input
                          ref={emailRef}
                          type="email"
                          required
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@studio.com"
                          className="w-full rounded-[8px] border border-forge-border bg-[#0b0b14] px-3.5 py-2.5 text-sm text-forge-text outline-none transition focus:border-forge-primary/70 focus:ring-2 focus:ring-forge-primary/25"
                        />
                      </Field>
                      <Field label="Name (optional)">
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Alex Rivera"
                          className="w-full rounded-[8px] border border-forge-border bg-[#0b0b14] px-3.5 py-2.5 text-sm text-forge-text outline-none transition focus:border-forge-primary/70"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="You are a">
                        <select
                          value={role}
                          onChange={(event) => setRole(event.target.value)}
                          className="w-full rounded-[8px] border border-forge-border bg-[#0b0b14] px-3.5 py-2.5 text-sm text-forge-text outline-none focus:border-forge-primary/70"
                        >
                          {ROLES.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="License">
                        <div className="flex gap-2">
                          {(["indie", "pro", "studio"] as PlanId[]).map((entry) => (
                            <button
                              key={entry}
                              type="button"
                              onClick={() => setPlan(entry)}
                              className={`flex-1 rounded-[8px] border px-2 py-2.5 text-xs font-medium capitalize transition ${
                                plan === entry
                                  ? "border-forge-primary/70 bg-forge-primary/20 text-white"
                                  : "border-forge-border bg-[#0b0b14] text-forge-muted hover:text-white"
                              }`}
                            >
                              {entry}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </div>

                    <Field label="What are you making? (optional)">
                      <textarea
                        rows={3}
                        value={useCase}
                        onChange={(event) => setUseCase(event.target.value)}
                        placeholder="Bilingual lyric videos for an indie label, ~6 releases a month…"
                        className="w-full resize-y rounded-[8px] border border-forge-border bg-[#0b0b14] px-3.5 py-2.5 text-sm text-forge-text outline-none transition focus:border-forge-primary/70"
                      />
                    </Field>

                    {message ? (
                      <p className="flex items-center gap-2 rounded-[8px] border border-forge-error/40 bg-forge-error/10 px-3 py-2 text-xs text-red-300">
                        <CircleAlert className="size-3.5 shrink-0" /> {message}
                      </p>
                    ) : null}

                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      disabled={state === "sending"}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-forge-primary to-forge-secondary px-5 py-3 text-[15px] font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.35)] transition disabled:opacity-60"
                    >
                      {state === "sending" ? (
                        <Loader className="size-4 animate-spin" />
                      ) : (
                        <Rocket className="size-4" />
                      )}
                      Reserve my license
                    </motion.button>
                    <p className="text-center text-[11px] text-forge-faint">
                      Stored in our Postgres instance only. No newsletter, no resale, unsubscribe by reply.
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="glass h-full rounded-[16px] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forge-faint">
                live signups
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold text-white tabular-nums">
                {count.toLocaleString()}
              </p>
              <p className="text-xs text-forge-muted">creators queued for v1.0</p>
              <div className="mt-5 space-y-2.5">
                {recent.length === 0 ? (
                  <p className="text-xs text-forge-faint">Be the first name on this list.</p>
                ) : (
                  recent.map((entry) => (
                    <div
                      key={`${entry.handle}-${entry.createdAt}`}
                      className="flex items-center justify-between rounded-[8px] border border-forge-border/70 bg-forge-bg/60 px-3 py-2"
                    >
                      <span className="truncate font-mono text-[11px] text-forge-muted">
                        {entry.handle}
                      </span>
                      <span className="ml-2 shrink-0 rounded-full bg-forge-primary/15 px-2 py-0.5 text-[10px] capitalize text-forge-accent">
                        {entry.plan}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-forge-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
