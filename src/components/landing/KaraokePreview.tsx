"use client";

import { formatTimecode, type SyncResult, type SyncSegment } from "@/lib/sync-engine";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const W = 1280;
const H = 720;

type Layout = { words: Array<{ word: string; start: number; end: number; x: number; width: number }>; width: number };

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function layoutSegment(ctx: CanvasRenderingContext2D, segment: SyncSegment, maxWidth: number): Layout[] {
  const spaceWidth = ctx.measureText(" ").width;
  const lines: Layout[] = [];
  let current: Layout = { words: [], width: 0 };

  for (const word of segment.words) {
    const wordWidth = ctx.measureText(word.word).width;
    const next = current.width === 0 ? wordWidth : current.width + spaceWidth + wordWidth;
    if (next > maxWidth && current.words.length > 0) {
      lines.push(current);
      current = { words: [], width: 0 };
    }
    const x = current.width === 0 ? 0 : current.width + spaceWidth;
    current.words.push({ word: word.word, start: word.start, end: word.end, x, width: wordWidth });
    current.width = x + wordWidth;
  }
  if (current.words.length) lines.push(current);
  return lines;
}

export default function KaraokePreview({ result }: { result: SyncResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);

  const seek = useCallback((time: number) => {
    timeRef.current = Math.max(0, Math.min(result.durationSeconds, time));
    setDisplayTime(timeRef.current);
  }, [result.durationSeconds]);

  useEffect(() => {
    timeRef.current = 0;
    setDisplayTime(0);
    playingRef.current = true;
    setPlaying(true);
  }, [result]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const beat = 60 / result.bpm;
    let last = performance.now();
    let frames = 0;

    const draw = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playingRef.current) {
        timeRef.current += delta;
        if (timeRef.current > result.durationSeconds) timeRef.current = 0;
      }
      const time = timeRef.current;
      frames += 1;
      if (frames % 6 === 0) setDisplayTime(time);

      const pulse = Math.pow(1 - ((time % beat) / beat), 3);

      // ---- background layer -------------------------------------------------
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0a0a18");
      bg.addColorStop(0.5, `hsl(${250 + Math.sin(time * 0.2) * 25}, 60%, ${8 + pulse * 4}%)`);
      bg.addColorStop(1, "#04040a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const glow = ctx.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, 620);
      glow.addColorStop(0, `rgba(124,58,237,${0.18 + pulse * 0.22})`);
      glow.addColorStop(0.6, "rgba(59,130,246,0.06)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // audio-reactive bars along the bottom
      ctx.save();
      for (let i = 0; i < 64; i += 1) {
        const k = i / 63;
        const h = 12 + Math.abs(Math.sin(time * 2.1 + i * 0.4)) * 42 + pulse * 46;
        ctx.fillStyle = `rgba(${Math.round(124 + k * -80)},${Math.round(58 + k * 124)},${Math.round(237 - k * 25)},0.35)`;
        ctx.fillRect(k * (W - 26) + 12, H - h - 26, 10, h);
      }
      ctx.restore();

      // ---- text layer -------------------------------------------------------
      const active = result.segments.find((segment) => time >= segment.start && time <= segment.end);
      const upcoming = result.segments.find((segment) => segment.start > time);

      if (active) {
        const fontSize = active.words.length > 9 ? 58 : 74;
        ctx.font = `800 ${fontSize}px Inter, "Segoe UI", system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        const lines = layoutSegment(ctx, active, W * 0.82);

        const inDur = 0.42;
        const outDur = 0.32;
        const sinceIn = time - active.start;
        const untilOut = active.end - time;
        const inP = Math.min(1, Math.max(0, sinceIn / inDur));
        const outP = Math.min(1, Math.max(0, untilOut / outDur));

        let alpha = Math.min(easeOutCubic(inP), outP);
        let dy = 0;
        let scale = 1;
        let skew = 0;

        switch (active.inAnimation) {
          case "pop-in":
          case "punch-zoom":
            scale = 0.7 + easeOutBack(inP) * 0.3;
            break;
          case "bounce-in":
          case "elastic-in":
            dy = (1 - easeOutBack(inP)) * -70;
            break;
          case "slide-up":
          case "soft-rise":
          case "word-by-word":
            dy = (1 - easeOutCubic(inP)) * 52;
            break;
          case "glitch-in":
            skew = (1 - inP) * (Math.random() - 0.5) * 0.5;
            alpha = inP < 1 ? (Math.random() > 0.25 ? alpha : alpha * 0.3) : alpha;
            break;
          case "neon-flicker":
            alpha *= inP < 1 && Math.random() > 0.7 ? 0.35 : 1;
            break;
          case "scale-in":
          case "blur-in":
          default:
            scale = 0.94 + easeOutCubic(inP) * 0.06;
        }

        const lineHeight = fontSize * 1.22;
        const baseY = H * 0.52 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, lineIndex) => {
          const startX = (W - line.width) / 2;
          const y = baseY + lineIndex * lineHeight + dy;

          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.translate(W / 2, y);
          ctx.transform(1, 0, skew, 1, 0, 0);
          ctx.scale(scale, scale);
          ctx.translate(-W / 2, -y);

          for (const word of line.words) {
            const x = startX + word.x;
            const sung = time >= word.end;
            const singing = time >= word.start && time < word.end;
            const p = singing ? (time - word.start) / Math.max(0.001, word.end - word.start) : sung ? 1 : 0;

            // base (unsung) text
            ctx.fillStyle = "rgba(241,245,249,0.55)";
            ctx.shadowColor = "rgba(0,0,0,0.65)";
            ctx.shadowBlur = 14;
            ctx.shadowOffsetY = 3;
            ctx.fillText(word.word, x, y);

            if (p > 0) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(x - 2, y - fontSize, word.width * p + 4, fontSize * 2);
              ctx.clip();
              const fill = ctx.createLinearGradient(x, 0, x + word.width, 0);
              fill.addColorStop(0, "#06b6d4");
              fill.addColorStop(0.5, "#a78bfa");
              fill.addColorStop(1, "#f1f5f9");
              ctx.fillStyle = fill;
              ctx.shadowColor = "rgba(124,58,237,0.95)";
              ctx.shadowBlur = 26 + pulse * 18;
              ctx.shadowOffsetY = 0;
              ctx.fillText(word.word, x, y);
              ctx.restore();
            }

            if (singing) {
              ctx.save();
              ctx.globalAlpha = Math.max(0, alpha) * 0.5;
              ctx.strokeStyle = "rgba(6,182,212,0.75)";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(x, y + fontSize * 0.62);
              ctx.lineTo(x + word.width * p, y + fontSize * 0.62);
              ctx.stroke();
              ctx.restore();
            }
          }
          ctx.restore();
        });

        // low-confidence review badge (spec: yellow flag under 72%)
        if (active.confidence < 0.72) {
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "rgba(245,158,11,0.16)";
          ctx.strokeStyle = "rgba(245,158,11,0.7)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(W / 2 - 150, H * 0.52 + 96, 300, 40, 10);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#fbbf24";
          ctx.font = '600 19px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = "center";
          ctx.fillText("review · low confidence", W / 2, H * 0.52 + 117);
          ctx.textAlign = "left";
          ctx.restore();
        }
      } else if (upcoming) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.font = '500 30px "JetBrains Mono", ui-monospace, monospace';
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.fillText(`▸ ${formatTimecode(upcoming.start)}  ${upcoming.text.slice(0, 46)}`, W / 2, H * 0.52);
        ctx.textAlign = "left";
        ctx.restore();
      }

      // ---- HUD --------------------------------------------------------------
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, H - 8, W, 4);
      const progress = time / result.durationSeconds;
      const bar = ctx.createLinearGradient(0, 0, W, 0);
      bar.addColorStop(0, "#7c3aed");
      bar.addColorStop(1, "#06b6d4");
      ctx.fillStyle = bar;
      ctx.fillRect(0, H - 8, W * progress, 4);

      ctx.font = '500 18px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = "rgba(148,163,184,0.85)";
      ctx.fillText(`${formatTimecode(time)} / ${formatTimecode(result.durationSeconds)}`, 22, 34);
      ctx.textAlign = "right";
      ctx.fillText(`1920×1080 · 60fps · ${result.bpm} BPM`, W - 22, 34);
      ctx.textAlign = "left";
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [result]);

  return (
    <div className="overflow-hidden rounded-[12px] border border-forge-border bg-black">
      <canvas ref={canvasRef} width={W} height={H} className="block aspect-video w-full" />
      <div className="flex items-center gap-3 border-t border-forge-border bg-forge-surface/80 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-forge-primary to-forge-secondary text-white transition hover:brightness-110"
          aria-label={playing ? "Pause preview" : "Play preview"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => seek(0)}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-forge-border text-forge-muted transition hover:text-white"
          aria-label="Restart preview"
        >
          <RotateCcw className="size-4" />
        </button>
        <input
          type="range"
          min={0}
          max={result.durationSeconds}
          step={0.05}
          value={displayTime}
          onChange={(event) => seek(Number(event.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-forge-border accent-forge-accent"
          aria-label="Seek"
        />
        <span className="shrink-0 font-mono text-xs tabular-nums text-forge-muted">
          {formatTimecode(displayTime)}
        </span>
      </div>
    </div>
  );
}
