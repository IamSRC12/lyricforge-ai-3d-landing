import { useRef, useState, useEffect, useMemo } from "react";
import { useLyricStore } from "@/store/useLyricStore";
import type { LyricBlock } from "@/types/project";
import { cn } from "@/lib/cn";
import { generateDeterministicWaveform } from "@/lib/audioUtils";

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
  } = useLyricStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<DraggingState | null>(null);

  const pixelsPerSecond = 120 * zoom;
  const safeDuration = Math.max(audioDuration || 0, 10);
  const totalWidth = Math.max(safeDuration * pixelsPerSecond, 800);

  const fallbackWaveform = useMemo(() => generateDeterministicWaveform(200), []);
  const waveformData = audioWaveform.length > 0 ? audioWaveform : fallbackWaveform;

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

        // Trim or clamp words
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

        // Trim or clamp words
        newBlock.words = orig.words
          .filter((w) => w.start < newEnd)
          .map((w) => ({
            ...w,
            start: Number(Math.min(newEnd - 0.05, w.start).toFixed(3)),
            end: Number(Math.min(newEnd, w.end).toFixed(3)),
          }));
      }

      updateLyricBlock(dragging.id, newBlock);

      // Auto-adjust neighboring blocks to prevent overlap
      if (dragging.mode === "left") {
        const sorted = [...lyricBlocks].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex((b) => b.id === dragging.id);
        if (idx > 0) {
          const prev = sorted[idx - 1];
          if (prev.endTime > newBlock.startTime) {
            updateLyricBlock(prev.id, {
              ...prev,
              endTime: Math.max(prev.startTime + 0.1, newBlock.startTime),
            });
          }
        }
      } else if (dragging.mode === "right") {
        const sorted = [...lyricBlocks].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex((b) => b.id === dragging.id);
        if (idx >= 0 && idx < sorted.length - 1) {
          const next = sorted[idx + 1];
          if (next.startTime < newBlock.endTime) {
            updateLyricBlock(next.id, {
              ...next,
              startTime: Math.min(next.endTime - 0.1, newBlock.endTime),
            });
          }
        }
      }
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

  const rulerSecondMarks = Math.ceil(safeDuration) + 1;

  return (
    <div className="flex h-full flex-col rounded-[16px] border border-white/10 bg-[#0F0F14] overflow-hidden select-none">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/60">
          <span>Timeline</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
            {lyricBlocks.length} blocks • {(audioDuration || 0).toFixed(1)}s
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
            aria-label="Zoom out timeline"
            className="h-7 w-7 rounded-full bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs"
          >
            -
          </button>
          <span className="text-[11px] text-white/40 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            aria-label="Zoom in timeline"
            className="h-7 w-7 rounded-full bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-xs"
          >
            +
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-auto" onClick={onTimelineClick}>
        <div style={{ width: totalWidth }} className="relative min-h-[180px]">
          {/* Ruler */}
          <div className="sticky top-0 z-20 flex border-b border-white/5 bg-[#0F0F14] text-[10px] text-white/30 pointer-events-none">
            {Array.from({ length: rulerSecondMarks }).map((_, i) => (
              <div key={i} style={{ width: pixelsPerSecond }} className="shrink-0 border-r border-white/5 px-1 py-1">
                {i}s
              </div>
            ))}
          </div>

          {/* Waveform */}
          <div className="relative h-[56px] w-full border-b border-white/10 bg-black/30 pointer-events-none">
            <div className="absolute inset-0 flex items-end px-1">
              {waveformData.map((v, i) => {
                const left = (i / waveformData.length) * totalWidth;
                const width = Math.max(1, totalWidth / waveformData.length - 1);
                return (
                  <div
                    key={i}
                    style={{ left, width, height: `${Math.max(6, v * 100)}%` }}
                    className="absolute bottom-0 bg-white/20 rounded-t"
                  />
                );
              })}
            </div>
            {/* Playhead */}
            <div
              style={{ left: currentTime * pixelsPerSecond }}
              className="pointer-events-none absolute top-0 z-30 h-full w-[2px] bg-white shadow-[0_0_10px_white]"
            >
              <div className="absolute -top-1 -left-1.5 h-3 w-3 rounded-full bg-white" />
            </div>
          </div>

          {/* Blocks lane */}
          <div className="relative mt-2 min-h-[100px]">
            {lyricBlocks
              .slice()
              .sort((a, b) => a.startTime - b.startTime)
              .map((block, idx) => {
                const left = block.startTime * pixelsPerSecond;
                const width = Math.max(28, (block.endTime - block.startTime) * pixelsPerSecond);
                const isSelected = selectedBlockId === block.id;
                const isOdd = idx % 2 === 0;

                return (
                  <div
                    key={block.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBlock(block.id);
                    }}
                    style={{ left, width, top: (idx % 3) * 36 + 4 }}
                    className={cn(
                      "group absolute flex h-[32px] cursor-grab items-center rounded-lg border px-2 text-[11px] font-medium transition-all select-none",
                      isSelected
                        ? "z-10 border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] font-bold"
                        : isOdd
                        ? "border-violet-500/30 bg-violet-500/20 text-violet-100"
                        : "border-cyan-500/30 bg-cyan-500/20 text-cyan-100"
                    )}
                  >
                    {/* Left trim handle */}
                    <div
                      onPointerDown={(e) => onPointerDownBlock(e, block, "left")}
                      className="absolute left-0 top-0 z-20 h-full w-2.5 cursor-ew-resize rounded-l-lg bg-white/40 hover:bg-white transition-colors"
                      title="Trim start"
                    />

                    {/* Main drag area */}
                    <div
                      onPointerDown={(e) => onPointerDownBlock(e, block, "move")}
                      className="flex-1 overflow-hidden px-2 text-center"
                    >
                      <span className="truncate block">{block.text}</span>
                    </div>

                    {/* Right trim handle */}
                    <div
                      onPointerDown={(e) => onPointerDownBlock(e, block, "right")}
                      className="absolute right-0 top-0 z-20 h-full w-2.5 cursor-ew-resize rounded-r-lg bg-white/40 hover:bg-white transition-colors"
                      title="Trim end"
                    />
                  </div>
                );
              })}
          </div>

          {/* Grid vertical lines */}
          <div className="pointer-events-none absolute inset-0 top-[24px]">
            {Array.from({ length: rulerSecondMarks }).map((_, i) => (
              <div key={i} style={{ left: i * pixelsPerSecond }} className="absolute top-0 h-full w-px bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-[11px] text-white/40 shrink-0">
        <span>💡 Drag block body to move • Drag handles to trim • Click timeline to seek</span>
      </div>
    </div>
  );
}
