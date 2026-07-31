import type { AISettings, LyricBlock } from "@/types/project";

export const DESIGN_HEIGHT = 1080;

export type BackgroundSource =
  | { kind: "none" }
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string; angle: number }
  | { kind: "particles" }
  | { kind: "media"; source: CanvasImageSource; w: number; h: number };

export type RenderOptions = {
  time: number;
  width: number;
  height: number;
  blocks: LyricBlock[];
  background: BackgroundSource;
  ai: AISettings;
  amplitude: number;
  bass: number;
  selectedId?: string | null;
  showGuides?: boolean;
  vignette?: boolean;
};

export type LayoutBox = { id: string; x: number; y: number; w: number; h: number };

/* ---------- easing ---------- */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutBounce = (t: number) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

/** deterministic hash → pseudo random 0..1 (identical in preview and export) */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

type Xform = { opacity: number; dx: number; dy: number; sx: number; sy: number; rot: number; skew: number; clip: number };
const IDENT: Xform = { opacity: 1, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, skew: 0, clip: 1 };

function animation(name: string, p: number, dir: "in" | "out", seed: number, unit: number): Xform {
  const q = dir === "out" ? 1 - p : p;
  const x = { ...IDENT, opacity: q };
  switch (name) {
    case "none": return { ...IDENT };
    case "fade": return x;
    case "pop": return { ...x, opacity: Math.min(1, q * 4), sx: 0.4 + easeOutBack(q) * 0.6, sy: 0.4 + easeOutBack(q) * 0.6 };
    case "zoom": return { ...x, sx: 1.8 - 0.8 * easeOutCubic(q), sy: 1.8 - 0.8 * easeOutCubic(q) };
    case "slideUp": return { ...x, dy: (1 - easeOutCubic(q)) * 0.9 * unit };
    case "slideDown": return { ...x, dy: -(1 - easeOutCubic(q)) * 0.9 * unit };
    case "slideLeft": return { ...x, dx: (1 - easeOutCubic(q)) * 1.4 * unit };
    case "slideRight": return { ...x, dx: -(1 - easeOutCubic(q)) * 1.4 * unit };
    case "bounce": return { ...IDENT, opacity: Math.min(1, q * 5), dy: (1 - easeOutBounce(q)) * -1.1 * unit };
    case "kinetic": return { ...x, rot: (1 - easeOutCubic(q)) * -0.14, sx: 0.8 + easeOutCubic(q) * 0.2, sy: 0.8 + easeOutCubic(q) * 0.2 };
    case "glitch": {
      const r = rand(seed);
      return { ...IDENT, opacity: q > 0.12 ? 1 : 0, dx: q < 1 ? (r - 0.5) * 0.35 * unit : 0, skew: q < 1 ? (rand(seed + 7) - 0.5) * 0.35 : 0 };
    }
    case "typewriter": return { ...IDENT, clip: easeOutCubic(q) };
    default: return x;
  }
}

/* ---------- layout ---------- */
type LaidWord = { word: string; start: number; end: number; x: number; w: number; line: number };

function layoutBlock(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, block: LyricBlock, maxWidth: number) {
  const useWords = block.words.length > 0;
  const tokens = useWords
    ? block.words.map((w) => ({ word: w.word, start: w.start, end: w.end }))
    : block.text.split(/\s+/).filter(Boolean).map((w, i, a) => {
        const span = (block.endTime - block.startTime) / Math.max(1, a.length);
        return { word: w, start: block.startTime + i * span, end: block.startTime + (i + 1) * span };
      });

  const space = ctx.measureText(" ").width;
  const words: LaidWord[] = [];
  const lineWidths: number[] = [];
  let line = 0;
  let cursor = 0;

  for (const t of tokens) {
    const w = ctx.measureText(t.word).width;
    const next = cursor === 0 ? w : cursor + space + w;
    if (next > maxWidth && cursor > 0) {
      lineWidths[line] = cursor;
      line++;
      cursor = 0;
    }
    const x = cursor === 0 ? 0 : cursor + space;
    words.push({ ...t, x, w, line });
    cursor = x + w;
  }
  lineWidths[line] = cursor;
  return { words, lineWidths, lineCount: line + 1 };
}

/* ---------- main ---------- */
export function renderFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  o: RenderOptions,
): LayoutBox[] {
  const { width: W, height: H, time } = o;
  const k = H / DESIGN_HEIGHT;
  const boxes: LayoutBox[] = [];

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  /* background */
  const bg = o.background;
  if (bg.kind === "media") {
    const ar = bg.w / bg.h;
    const car = W / H;
    let dw = W, dh = H, dx = 0, dy = 0;
    if (ar > car) { dh = H; dw = H * ar; dx = (W - dw) / 2; }
    else { dw = W; dh = W / ar; dy = (H - dh) / 2; }
    try { ctx.drawImage(bg.source, dx, dy, dw, dh); } catch {}
  } else if (bg.kind === "gradient") {
    const a = ((bg.angle ?? 135) * Math.PI) / 180;
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * W, Math.sin(a) * H);
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.kind === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.kind === "particles") {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, "#241A44");
    g.addColorStop(1, "#0A0A0F");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, "#1C1C2E");
    g.addColorStop(1, "#0A0A0F");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (o.ai.particlesEnabled || bg.kind === "particles") {
    ctx.save();
    const count = 90;
    for (let i = 0; i < count; i++) {
      const sx = rand(i * 3.1) * W;
      const sy = (rand(i * 7.7) * H + time * (12 + rand(i) * 26) * k) % H;
      const r = (1 + rand(i * 13.3) * 2.4) * k;
      ctx.globalAlpha = 0.15 + rand(i * 17.1) * 0.45;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(sx, H - sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (o.vignette !== false) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0.34)");
    g.addColorStop(0.5, "rgba(0,0,0,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* visualizer */
  if (o.ai.visualizerEnabled) {
    ctx.save();
    const bars = 56;
    const bw = W / bars;
    for (let i = 0; i < bars; i++) {
      const shape = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.37 + o.amplitude * 6));
      const h = (14 + o.amplitude * 150 * shape) * k;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + o.amplitude * 0.4})`;
      ctx.fillRect(i * bw + bw * 0.15, H - h - 26 * k, bw * 0.7, h);
    }
    ctx.restore();
  }

  /* lyric blocks */
  const pulse = o.ai.beatPulseEnabled ? 1 + o.bass * 0.05 : 1;

  for (const block of o.blocks) {
    if (time < block.startTime || time >= block.endTime) continue;

    const fontPx = Math.max(12, block.style.fontSize * k);
    const weight = block.style.bold ? 800 : 600;
    const style = block.style.italic ? "italic " : "";
    ctx.font = `${style}${weight} ${fontPx}px "${block.style.fontFamily}", Inter, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    const maxWidth = W * 0.86;
    const { words, lineWidths, lineCount } = layoutBlock(ctx, block, maxWidth);
    const lineH = fontPx * 1.18;
    const totalH = lineCount * lineH;

    const inDur = Math.max(0.05, block.animation.durationIn);
    const outDur = Math.max(0, block.animation.durationOut);
    const pIn = Math.min(1, (time - block.startTime) / inDur);
    const outStart = block.endTime - outDur;
    const pOut = outDur > 0 && time >= outStart ? Math.min(1, (time - outStart) / outDur) : 0;

    const seed = Math.floor(time * 60);
    const a = animation(block.animation.in, pIn, "in", seed, fontPx);
    const b = pOut > 0 ? animation(block.animation.out, pOut, "out", seed + 91, fontPx) : IDENT;

    const opacity = Math.min(a.opacity, b.opacity);
    if (opacity <= 0.002) continue;

    const cx = (block.style.x / 100) * W + a.dx + b.dx;
    const cy = (block.style.y / 100) * H + a.dy + b.dy;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(cx, cy);
    ctx.rotate(a.rot + b.rot);
    ctx.transform(1, 0, a.skew + b.skew, 1, 0, 0);
    ctx.scale(a.sx * b.sx * pulse, a.sy * b.sy * pulse);

    /* background box */
    if (block.style.backgroundBox?.enabled) {
      const box = block.style.backgroundBox;
      const bwMax = Math.max(...lineWidths);
      const pad = box.padding * k;
      const bx = alignOffset(block.style.align, bwMax);
      ctx.save();
      ctx.globalAlpha = opacity * box.opacity;
      ctx.fillStyle = box.color;
      roundRect(ctx, bx - pad, -totalH / 2 - pad, bwMax + pad * 2, totalH + pad * 2, box.radius * k);
      ctx.fill();
      ctx.restore();
    }

    if (block.style.outlineWidth > 0) {
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeStyle = block.style.outlineColor;
      ctx.lineWidth = block.style.outlineWidth * 2 * k;
    }

    const clipFrac = Math.min(a.clip, b.clip);
    if (clipFrac < 1) {
      const bwMax = Math.max(...lineWidths);
      ctx.beginPath();
      ctx.rect(alignOffset(block.style.align, bwMax), -totalH, bwMax * clipFrac, totalH * 2);
      ctx.clip();
    }

    const baseFill = (): string | CanvasGradient => {
      if (block.style.gradient?.enabled) {
        const bwMax = Math.max(...lineWidths);
        const gx = alignOffset(block.style.align, bwMax);
        const g = ctx.createLinearGradient(gx, -totalH / 2, gx + bwMax, totalH / 2);
        g.addColorStop(0, block.style.gradient.from);
        g.addColorStop(1, block.style.gradient.to);
        return g;
      }
      return block.style.color;
    };

    const karaoke = o.ai.karaokeEnabled && block.words.length > 0;

    for (let li = 0; li < lineCount; li++) {
      const lw = lineWidths[li] || 0;
      const ox = alignOffset(block.style.align, lw);
      const y = -totalH / 2 + lineH * li + lineH / 2;

      for (const w of words) {
        if (w.line !== li) continue;
        const x = ox + w.x;

        ctx.save();
        if (block.style.shadow) {
          ctx.shadowColor = block.style.shadowColor;
          ctx.shadowBlur = block.style.shadowBlur * k;
          ctx.shadowOffsetY = 2 * k;
        }
        if (block.style.glow) {
          ctx.shadowColor = block.style.glowColor;
          ctx.shadowBlur = 26 * k;
          ctx.shadowOffsetY = 0;
        }
        if (block.style.outlineWidth > 0) ctx.strokeText(w.word, x, y);

        const sung = karaoke && time >= w.end;
        const singing = karaoke && time >= w.start && time < w.end;
        ctx.fillStyle = karaoke && !sung && !singing ? withAlpha(block.style.color, 0.55) : baseFill();
        ctx.fillText(w.word, x, y);
        ctx.restore();

        if (singing) {
          const prog = (time - w.start) / Math.max(0.001, w.end - w.start);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - 2 * k, y - fontPx, w.w * prog + 3 * k, fontPx * 2);
          ctx.clip();
          ctx.shadowColor = "rgba(255,214,10,0.9)";
          ctx.shadowBlur = 26 * k;
          ctx.fillStyle = "#FFD60A";
          ctx.fillText(w.word, x, y);
          ctx.restore();
        }
      }
    }
    ctx.restore();

    const bwMax = Math.max(...lineWidths);
    boxes.push({
      id: block.id,
      x: cx + alignOffset(block.style.align, bwMax),
      y: cy - totalH / 2,
      w: bwMax,
      h: totalH,
    });

    if (o.selectedId === block.id && o.showGuides) {
      const box = boxes[boxes.length - 1];
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(box.x - 8, box.y - 8, box.w + 16, box.h + 16);
      ctx.restore();
    }
  }

  if (o.showGuides) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 1;
    ctx.strokeRect(W * 0.03, H * 0.03, W * 0.94, H * 0.94);
    ctx.restore();
  }

  ctx.restore();
  return boxes;
}

function alignOffset(align: "left" | "center" | "right", w: number) {
  return align === "left" ? 0 : align === "right" ? -w : -w / 2;
}

function withAlpha(hex: string, a: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") { ctx.roundRect(x, y, w, h, r); return; }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function hitTest(boxes: LayoutBox[], x: number, y: number): string | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (x >= b.x - 12 && x <= b.x + b.w + 12 && y >= b.y - 12 && y <= b.y + b.h + 12) return b.id;
  }
  return null;
}
