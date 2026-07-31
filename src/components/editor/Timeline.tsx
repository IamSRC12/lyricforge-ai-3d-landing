import { useRef, useState, useEffect, useMemo } from "react";
import { useLyricStore } from "@/store/useLyricStore";
import type { LyricBlock } from "@/types/project";
import { cn } from "@/lib/cn";
import { generateDeterministicWaveform } from "@/lib/audioUtils";
import { Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Layers } from "lucide-react";

type DraggingState = {
  id: string;
  mode: "move" | "left" | "right";
  startX: number;
  orig: LyricBlock;
  hasDragged: boolean;
};

export function Timeline() {
  const {
    lyricBlocks,
    audioDuration,
    currentTime,
    setCurrentTime,
    setSelectedBlock,
    selectedBlockId,
    updateLyricBlock,
    audioWaveform,
    pushHistory,
    isPlaying,
    setIsPlaying,
  } = useLyricStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<DraggingState | null>(null);

  const pixelsPerSecond = 120 * zoom;
  const safeDuration = Math.max(audioDuration || 0, 10);
  const totalWidth = Math.max(safeDuration * pixelsPerSecond, 800);

  const fallbackWaveform = useMemo(() => generateDeterministicWaveform(160), []);
  const waveformData = audioWaveform.length > 0 ? audioWaveform : fallbackWaveform;

  const formatTimecode = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const onPointerDownBlock = (e: React.PointerEvent, block: LyricBlock, mode: "move" | "left" | "right") => {
    e.stopPropagation();
    pushHistory();
    setDragging({
      id: block.id,
      mode,
      startX: e.clientX,
      orig: JSON.parse(JSON.stringify(block)),
      hasDragged: false,
    });
    setSelectedBlock(block.id);
  };

  useEffect(() => {
    if (!dragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragging.startX;
      if (Math.abs(dx) > 3 && !dragging.hasDragged) {
        setDragging((prev) => (prev ? { ...prev, hasDragged: true } : null));
      }

      const ds = dx / pixelsPerSecond;
      const orig = dragging.orig;
      const maxAudioEnd = audioDuration > 0 ? audioDuration : 9999;
      const minDuration = 0.2;

      let newBlock: LyricBlock = JSON.parse(JSON.stringify(orig));

      if (dragging.mode === "move") {
        const dur = orig.endTime - orig.startTime;
        let newStart = Math.max(0, orig.startTime + ds);
        if (newStart + dur > maxAudioEnd) {
          newStart = Math.max(0, maxAudioEnd - dur);
        }
        const actualShift = newStart - orig.startTime;
        newBlock.startTime = Number(newStart.toFixed(3));
        newBlock.endTime = Number((newStart + dur).toFixed(3));
        newBlock.words = orig.words.map((w) => ({
          ...w,
          start: Number(Math.max(0, w.start + actualShift).toFixed(3)),
          end: Number(Math.max(0, w.end + actualShift).toFixed(3)),
        }));
      } else if (dragging.mode === "left") {
        let newStart = Math.max(0, orig.startTime + ds);
        newStart = Math.min(newStart, orig.endTime - minDuration);
        newBlock.startTime = Number(newStart.toFixed(3));
        newBlock.words = orig.words
          .filter((w) => w.end > newStart)
          .map((w) => ({
            ...w,
            start: Number(Math.max(newStart, w.start).toFixed(3)),
            end: Number(Math.max(newStart + 0.05, w.end).toFixed(3)),
          }));
      } else if (dragging.mode === "right") {
        let newEnd = orig.endTime + ds;
        newEnd = Math.max(orig.startTime + minDuration, Math.min(newEnd, maxAudioEnd));
        newBlock.endTime = Number(newEnd.toFixed(3));
        newBlock.words = orig.words
          .filter((w) => w.start < newEnd)
          .map((w) => ({
            ...w,
            start: Number(Math.min(newEnd - 0.05, w.start).toFixed(3)),
            end: Number(Math.min(newEnd, w.end).toFixed(3)),
          }));
      }

      updateLyricBlock(dragging.id, newBlock);
    };

    const onPointerUp = () => {
      setDragging(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [dragging, pixelsPerSecond, audioDuration, updateLyricBlock]);

  const onTimelineClick = (e: React.MouseEvent) => {
    if (dragging?.hasDragged) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const t = Math.max(0, Math.min(audioDuration > 0 ? audioDuration : 9999, x / pixelsPerSecond));
    setCurrentTime(t);
  };

  const sortedBlocks = useMemo(() => {
    return lyricBlocks.slice().sort((a, b) => a.startTime - b.startTime);
  }, [lyricBlocks]);

  const rulerSecondMarks = Math.ceil(safeDuration) + 1;

  return (
    <div className="flex h-full flex-col rounded-[16px] border border-white/10 bg-[#0A0A0F] overflow-hidden select-none shadow-2xl">
      {/* Top Header & Controls */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0F0F14] px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-purple-400">
            <Layers className="h-3.5 w-3.5" />
            <span>4-TRACK STUDIO TIMELINE</span>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[10px] text-white/60">
            {lyricBlocks.length} segments • {(audioDuration || 0).toFixed(1)}s
          </span>
        </div>

        {/* Playback Controls & Timecode */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentTime(0)}
              className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10"
              title="Jump to start"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-full bg-white text-black hover:scale-105 transition"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-3 w-3 fill-black" /> : <Play className="h-3 w-3 fill-black ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => setCurrentTime(safeDuration)}
              className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10"
              title="Jump to end"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="font-mono text-[11px] text-white/80 bg-black/60 px-2.5 py-1 rounded-md border border-white/10">
            <span className="text-purple-300 font-bold">{formatTimecode(currentTime)}</span>
            <span className="text-white/30 mx-1">/</span>
            <span className="text-white/40">{formatTimecode(safeDuration)}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-3">
            <span className="font-mono text-[10px] text-white/30">SNAP 0.1S</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
            aria-label="Zoom out timeline"
            className="h-7 w-7 rounded-md bg-white/10 text-white/60 hover:text-white hover:bg-white/20 flex items-center justify-center text-xs"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-[11px] text-white/50 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            aria-label="Zoom in timeline"
            className="h-7 w-7 rounded-md bg-white/10 text-white/60 hover:text-white hover:bg-white/20 flex items-center justify-center text-xs"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main 4-Track Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Track Labels Rail */}
        <div className="w-20 shrink-0 border-r border-white/10 bg-[#0F0F14]/80 flex flex-col justify-between pt-7 pb-2 text-[10px] font-mono text-white/40 select-none z-30">
          <div className="h-9 flex items-center px-3 border-b border-white/5 font-bold text-indigo-300">
            🎵 AUDIO
          </div>
          <div className="h-10 flex items-center px-3 border-b border-white/5 font-bold text-purple-300">
            📝 LYRICS
          </div>
          <div className="h-9 flex items-center px-3 border-b border-white/5 font-bold text-amber-300">
            🎬 ANIM
          </div>
          <div className="h-9 flex items-center px-3 font-bold text-blue-300">
            🖼 BG
          </div>
        </div>

        {/* Scrollable Timeline Viewport */}
        <div ref={containerRef} className="relative flex-1 overflow-auto bg-[#07070B]" onClick={onTimelineClick}>
          <div style={{ width: totalWidth }} className="relative min-h-[170px] pb-3">
            {/* Ruler Time Markers */}
            <div className="sticky top-0 z-20 flex h-7 border-b border-white/10 bg-[#0D0D14] font-mono text-[10px] text-white/40 pointer-events-none">
              {Array.from({ length: rulerSecondMarks }).map((_, i) => (
                <div key={i} style={{ width: pixelsPerSecond }} className="shrink-0 border-r border-white/5 px-1 py-1">
                  {i}s
                </div>
              ))}
            </div>

            {/* Glowing Red Playhead Line across all tracks */}
            <div
              style={{ left: currentTime * pixelsPerSecond }}
              className="pointer-events-none absolute top-0 bottom-0 z-40 w-[2px] bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)]"
            >
              <div className="absolute -top-1 -left-1.5 h-3 w-3 rotate-45 bg-red-500" />
            </div>

            {/* 1. Track 🎵 AUDIO */}
            <div className="relative h-9 w-full border-b border-white/10 bg-black/40 pointer-events-none">
              <div className="absolute inset-0 flex items-end px-1 gap-[2px]">
                {waveformData.map((v, i) => {
                  const left = (i / waveformData.length) * totalWidth;
                  const width = Math.max(1, totalWidth / waveformData.length - 1);
                  return (
                    <div
                      key={i}
                      style={{ left, width, height: `${Math.max(12, v * 90)}%` }}
                      className="absolute bottom-0 rounded-t bg-gradient-to-t from-indigo-600/40 to-purple-400/80"
                    />
                  );
                })}
              </div>
            </div>

            {/* 2. Track 📝 LYRICS */}
            <div className="relative h-10 w-full border-b border-white/10 bg-black/20">
              {sortedBlocks.map((block, idx) => {
                const left = block.startTime * pixelsPerSecond;
                const width = Math.max(32, (block.endTime - block.startTime) * pixelsPerSecond);
                const isSelected = selectedBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    onPointerDown={(e) => onPointerDownBlock(e, block, "move")}
                    style={{ left, width }}
                    className={cn(
                      "absolute top-1 bottom-1 flex cursor-grab items-center rounded-md border px-2 text-[10.5px] font-medium leading-none transition shadow-sm active:cursor-grabbing",
                      isSelected
                        ? "border-purple-400 bg-purple-600/80 text-white ring-2 ring-purple-400/60 z-20"
                        : "border-purple-500/40 bg-gradient-to-r from-purple-900/60 to-indigo-900/40 text-purple-100 hover:border-purple-400/70"
                    )}
                  >
                    {/* Left Trim Handle */}
                    <div
                      onPointerDown={(e) => onPointerDownBlock(e, block, "left")}
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l-md hover:bg-white/40"
                    />
                    <span className="truncate px-1">{block.text}</span>
                    {/* Right Trim Handle */}
                    <div
                      onPointerDown={(e) => onPointerDownBlock(e, block, "right")}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r-md hover:bg-white/40"
                    />
                  </div>
                );
              })}
            </div>

            {/* 3. Track 🎬 ANIM */}
            <div className="relative h-9 w-full border-b border-white/10 bg-black/40">
              {sortedBlocks.map((block) => {
                const left = block.startTime * pixelsPerSecond;
                const width = Math.max(32, (block.endTime - block.startTime) * pixelsPerSecond);
                const animLabel = block.animation?.in || "fade";

                return (
                  <div
                    key={`anim_${block.id}`}
                    style={{ left, width }}
                    className="absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border border-amber-500/40 bg-amber-500/15 px-2 font-mono text-[9px] text-amber-200"
                  >
                    <span className="truncate">in: {animLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* 4. Track 🖼 BG */}
            <div className="relative h-9 w-full bg-black/20">
              <div
                style={{ left: 0, width: totalWidth }}
                className="absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border border-blue-500/30 bg-blue-500/10 px-3 font-mono text-[9px] text-blue-200"
              >
                <span>3D Canvas Scene / Background Renderer Track</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
