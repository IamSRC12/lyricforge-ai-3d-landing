"use client";

import { useEffect, useRef, useState } from "react";
import { useLyricStore } from "@/store/useLyricStore";
import { audioEngine } from "@/lib/audioEngine";
import { renderFrame, hitTest, type BackgroundSource, type LayoutBox } from "@/lib/canvasRenderer";
import { Play, Pause, SkipBack } from "lucide-react";

const AR: Record<string, number> = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5, "21:9": 21 / 9 };

export function VideoPreview() {
  const {
    lyricBlocks, backgroundAsset, aiSettings, aspectRatio, resolution,
    selectedBlockId, setSelectedBlock, updateBlockStyle, pushHistory,
    audioDuration, currentTime, setCurrentTime,
  } = useLyricStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const boxesRef = useRef<LayoutBox[]>([]);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({ lyricBlocks, aiSettings, backgroundAsset, selectedBlockId });
  const [playing, setPlaying] = useState(false);
  const [uiTime, setUiTime] = useState(0);

  stateRef.current = { lyricBlocks, aiSettings, backgroundAsset, selectedBlockId };

  const ratio = AR[aspectRatio] ?? 16 / 9;
  const baseH = resolution === "3840x2160" ? 2160 : resolution === "1280x720" ? 720 : 1080;
  const renderH = Math.min(1080, baseH);
  const renderW = Math.round(renderH * ratio);

  useEffect(() => {
    bgVideoRef.current?.remove();
    bgVideoRef.current = null;
    bgImgRef.current = null;
    if (!backgroundAsset?.url) return;

    if (backgroundAsset.type === "video") {
      const v = document.createElement("video");
      v.src = backgroundAsset.url;
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
      bgVideoRef.current = v;
      void v.play().catch(() => {});
    } else if (backgroundAsset.type === "image") {
      const img = new Image();
      img.src = backgroundAsset.url;
      bgImgRef.current = img;
    }
  }, [backgroundAsset?.url, backgroundAsset?.type]);

  useEffect(() => {
    let last = 0;
    return audioEngine.subscribe((t, isPlaying) => {
      setPlaying(isPlaying);
      if (t - last > 0.03 || !isPlaying) { last = t; setUiTime(t); setCurrentTime(t); }
    });
  }, [setCurrentTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = renderW;
    canvas.height = renderH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const draw = () => {
      const s = stateRef.current;
      const t = audioEngine.isPlaying ? audioEngine.time : useLyricStore.getState().currentTime;

      let bg: BackgroundSource = { kind: "none" };
      const a = s.backgroundAsset;
      if (a?.type === "video" && bgVideoRef.current && bgVideoRef.current.readyState >= 2) {
        const v = bgVideoRef.current;
        if (audioEngine.isPlaying && v.paused) void v.play().catch(() => {});
        if (!audioEngine.isPlaying && !v.paused) v.pause();
        const dur = v.duration || 0;
        if (dur > 0 && Math.abs(v.currentTime - (t % dur)) > 0.3) v.currentTime = t % dur;
        bg = { kind: "media", source: v, w: v.videoWidth || 16, h: v.videoHeight || 9 };
      } else if (a?.type === "image" && bgImgRef.current?.complete && bgImgRef.current.naturalWidth) {
        bg = { kind: "media", source: bgImgRef.current, w: bgImgRef.current.naturalWidth, h: bgImgRef.current.naturalHeight };
      } else if (a?.type === "gradient") {
        bg = { kind: "gradient", from: a.gradientColors?.[0] || "#FF00FF", to: a.gradientColors?.[1] || "#00FFAB", angle: 135 };
      } else if (a?.type === "solid") {
        bg = { kind: "solid", color: a.solidColor || "#0A0A0F" };
      } else if (a?.type === "particles") {
        bg = { kind: "particles" };
      }

      boxesRef.current = renderFrame(ctx, {
        time: t, width: renderW, height: renderH,
        blocks: s.lyricBlocks, background: bg, ai: s.aiSettings,
        amplitude: audioEngine.amplitudeAt(t), bass: audioEngine.amplitudeAt(t, "bass"),
        selectedId: s.selectedBlockId, showGuides: true,
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderW, renderH]);

  const toCanvas = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * renderW, y: ((e.clientY - r.top) / r.height) * renderH };
  };

  const onDown = (e: React.PointerEvent) => {
    const p = toCanvas(e);
    const id = hitTest(boxesRef.current, p.x, p.y);
    setSelectedBlock(id);
    if (!id) return;
    const blk = lyricBlocks.find((b) => b.id === id);
    if (!blk) return;
    pushHistory();
    dragRef.current = { id, dx: (blk.style.x / 100) * renderW - p.x, dy: (blk.style.y / 100) * renderH - p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toCanvas(e);
    const x = Math.max(2, Math.min(98, ((p.x + d.dx) / renderW) * 100));
    const y = Math.max(2, Math.min(98, ((p.y + d.dy) / renderH) * 100));
    updateBlockStyle(d.id, { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  };

  const onUp = () => { dragRef.current = null; };

  const dur = audioDuration || audioEngine.duration || 60;
  const timeStr = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const cs = Math.floor((s % 1) * 100);
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
      <div ref={wrapRef} style={{ aspectRatio: `${ratio}` }} className="relative max-h-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        />
      </div>

      <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-black/60 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => audioEngine.seek(0)} className="p-1 text-white/60 hover:text-white">
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => audioEngine.toggle()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:scale-105 transition"
        >
          {playing ? <Pause className="h-4 w-4 fill-black" /> : <Play className="h-4 w-4 fill-black ml-0.5" />}
        </button>
        <span className="font-mono text-xs text-white/80">{timeStr(uiTime)}</span>
        <input
          type="range"
          min={0}
          max={dur}
          step={0.01}
          value={uiTime}
          onChange={(e) => audioEngine.seek(parseFloat(e.target.value))}
          className="flex-1 accent-purple-500 cursor-pointer"
        />
        <span className="font-mono text-xs text-white/40">{timeStr(dur)}</span>
      </div>
    </div>
  );
}
