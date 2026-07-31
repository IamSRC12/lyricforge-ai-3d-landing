import { useEffect, useRef, useState, useMemo } from "react";
import { useLyricStore } from "@/store/useLyricStore";
import { motion } from "framer-motion";

export function VideoPreview({ onTimeUpdate }: { onTimeUpdate?: (t: number) => void }) {
  const {
    lyricBlocks,
    backgroundAsset,
    audioUrl,
    currentTime,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    selectedBlockId,
    setSelectedBlock,
    updateBlockStyle,
    aiSettings,
    audioDuration,
    aspectRatio,
    pushHistory,
  } = useLyricStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoBgRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastPublishedTimeRef = useRef(0);
  const storeTimeRef = useRef(currentTime);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 1280, h: 720 });

  // Calculate container aspect ratio CSS class or inline style
  const aspectStyle = useMemo(() => {
    switch (aspectRatio) {
      case "16:9":
        return { aspectRatio: "16 / 9" };
      case "9:16":
        return { aspectRatio: "9 / 16" };
      case "1:1":
        return { aspectRatio: "1 / 1" };
      case "4:5":
        return { aspectRatio: "4 / 5" };
      case "21:9":
        return { aspectRatio: "21 / 9" };
      default:
        return { aspectRatio: "16 / 9" };
    }
  }, [aspectRatio]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ w: rect.width, h: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [aspectRatio]);

  // Keep latest store time available in ref
  useEffect(() => {
    storeTimeRef.current = currentTime;
  }, [currentTime]);

  // rAF-based audio time publishing (replaces slow timeupdate)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const stopFrameLoop = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const publishAudioTime = () => {
      const time = audio.currentTime;

      // Avoid unnecessary Zustand updates while still keeping smooth sync.
      if (Math.abs(time - lastPublishedTimeRef.current) >= 1 / 120) {
        lastPublishedTimeRef.current = time;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      }

      if (!audio.paused && !audio.ended) {
        animationFrameRef.current =
          requestAnimationFrame(publishAudioTime);
      }
    };

    const handlePlay = () => {
      stopFrameLoop();
      animationFrameRef.current =
        requestAnimationFrame(publishAudioTime);
    };

    const handlePause = () => {
      stopFrameLoop();
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      stopFrameLoop();
      setIsPlaying(false);

      const endTime = Number.isFinite(audio.duration)
        ? audio.duration
        : audioDuration;

      setCurrentTime(endTime || 0);
    };

    const handleError = () => {
      stopFrameLoop();
      setIsPlaying(false);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      stopFrameLoop();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [
    audioUrl,
    audioDuration,
    onTimeUpdate,
    setCurrentTime,
    setIsPlaying,
  ]);

  // Separate play/pause sync effect
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (Math.abs(audio.currentTime - storeTimeRef.current) > 0.08) {
        audio.currentTime = storeTimeRef.current;
      }

      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, audioUrl, setIsPlaying]);

  // Background video sync — correct large drift only, not every frame
  useEffect(() => {
    const video = videoBgRef.current;
    const audio = audioRef.current;

    if (!video) return;

    video.muted = true;
    video.loop = true;

    if (!isPlaying) {
      video.pause();

      if (
        audio &&
        Number.isFinite(video.duration) &&
        video.duration > 0
      ) {
        const expectedTime = audio.currentTime % video.duration;

        if (Math.abs(video.currentTime - expectedTime) > 0.15) {
          video.currentTime = expectedTime;
        }
      }

      return;
    }

    if (
      audio &&
      Number.isFinite(video.duration) &&
      video.duration > 0
    ) {
      const expectedTime = audio.currentTime % video.duration;

      // Correct only large drift. Do not seek every frame.
      if (Math.abs(video.currentTime - expectedTime) > 0.35) {
        video.currentTime = expectedTime;
      }
    }

    void video.play().catch(() => {
      // Background video failure must not stop audio playback.
    });
  }, [isPlaying, backgroundAsset?.url]);

  const visibleBlocks = lyricBlocks.filter(
    (block) =>
      currentTime >= block.startTime &&
      currentTime < block.endTime
  );

  const handlePointerDown = (e: React.PointerEvent, blockId: string) => {
    e.stopPropagation();
    pushHistory();
    setSelectedBlock(blockId);
    setDraggingBlockId(blockId);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingBlockId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    updateBlockStyle(draggingBlockId, { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingBlockId) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setDraggingBlockId(null);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden p-2">
      <div
        ref={containerRef}
        style={aspectStyle}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative max-h-full max-w-full overflow-hidden rounded-[20px] bg-black shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 select-none flex items-center justify-center"
      >
        {/* Background Layer */}
        <div className="absolute inset-0 pointer-events-none">
          {backgroundAsset?.type === "video" ? (
            <video
              ref={videoBgRef}
              src={backgroundAsset.url}
              className="h-full w-full object-cover"
              muted
              loop
              playsInline
            />
          ) : backgroundAsset?.type === "image" ? (
            <img src={backgroundAsset.url} className="h-full w-full object-cover" alt="Background" />
          ) : backgroundAsset?.type === "gradient" ? (
            <div
              className="h-full w-full"
              style={{
                background: `linear-gradient(135deg, ${backgroundAsset.gradientColors?.[0] || "#FF00FF"}, ${
                  backgroundAsset.gradientColors?.[1] || "#00FFAB"
                })`,
              }}
            />
          ) : backgroundAsset?.type === "solid" ? (
            <div className="h-full w-full" style={{ background: backgroundAsset.solidColor || "#0A0A0F" }} />
          ) : backgroundAsset?.type === "particles" ? (
            <div className="h-full w-full bg-[#0A0A0F] relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#2A1B4E_0%,_#0A0A0F_70%)]" />
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(white_1px,_transparent_1px)] [background-size:24px_24px] animate-pulse" />
            </div>
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,_#1C1C2E_0%,_#0A0A0F_70%)]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        </div>

        {/* Particles Overlay if enabled */}
        {aiSettings.particlesEnabled && backgroundAsset?.type !== "particles" && (
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute inset-0 bg-[radial-gradient(white_1px,_transparent_1px)] [background-size:24px_24px] animate-pulse" />
          </div>
        )}

        {/* Audio Element */}
        {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

        {/* Lyric Blocks */}
        {visibleBlocks.map((block) => {
          const isSelected = selectedBlockId === block.id;

          const wordElements = block.words.map((w, wi) => {
            const active = aiSettings.karaokeEnabled && currentTime >= w.start && currentTime < w.end;
            const past = aiSettings.karaokeEnabled && currentTime >= w.end;

            return (
              <span
                key={wi}
                style={{
                  color: active ? "#FFD60A" : past ? block.style.color : `${block.style.color}CC`,
                  textShadow: active ? "0 0 20px #FFD60A" : undefined,
                  transform: active ? "scale(1.12)" : "scale(1)",
                  display: "inline-block",
                  marginRight: "0.22em",
                  transition: "all 0.1s ease-out",
                }}
              >
                {w.word}
              </span>
            );
          });

          return (
            <motion.div
              key={block.id}
              onPointerDown={(e) => handlePointerDown(e, block.id)}
              className={`absolute cursor-grab active:cursor-grabbing ${
                isSelected ? "ring-2 ring-white/70 ring-offset-2 ring-offset-black rounded-lg" : ""
              }`}
              style={{
                left: `${block.style.x}%`,
                top: `${block.style.y}%`,
                transform: "translate(-50%, -50%)",
                fontFamily: block.style.fontFamily,
                fontSize: `${Math.max(14, (block.style.fontSize / 1080) * canvasSize.h)}px`,
                fontWeight: block.style.bold ? 800 : 600,
                fontStyle: block.style.italic ? "italic" : "normal",
                textTransform: block.style.uppercase ? "uppercase" : "none",
                color: block.style.gradient?.enabled ? "transparent" : block.style.color,
                backgroundImage: block.style.gradient?.enabled
                  ? `linear-gradient(${block.style.gradient.angle}deg, ${block.style.gradient.from}, ${block.style.gradient.to})`
                  : undefined,
                WebkitBackgroundClip: block.style.gradient?.enabled ? "text" : undefined,
                backgroundClip: block.style.gradient?.enabled ? "text" : undefined,
                WebkitTextStroke:
                  block.style.outlineWidth > 0
                    ? `${(block.style.outlineWidth / 1080) * canvasSize.h}px ${block.style.outlineColor}`
                    : undefined,
                textShadow: [
                  block.style.shadow ? `0 2px ${block.style.shadowBlur}px ${block.style.shadowColor}` : "",
                  block.style.glow ? `0 0 20px ${block.style.glowColor}` : "",
                ]
                  .filter(Boolean)
                  .join(", "),
                textAlign: block.style.align,
                lineHeight: 1.15,
                maxWidth: "85%",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {block.style.backgroundBox?.enabled && (
                <div
                  style={{
                    position: "absolute",
                    inset: `-${block.style.backgroundBox.padding}px`,
                    background: block.style.backgroundBox.color,
                    opacity: block.style.backgroundBox.opacity,
                    borderRadius: block.style.backgroundBox.radius,
                    zIndex: -1,
                  }}
                />
              )}
              <div className="lyric-custom">
                {aiSettings.karaokeEnabled && block.words.length > 0 ? wordElements : block.text}
              </div>
            </motion.div>
          );
        })}

        {/* Visualizer */}
        {aiSettings.visualizerEnabled && (
          <div className="pointer-events-none absolute bottom-12 left-0 right-0 flex h-14 items-end gap-[2px] px-4 opacity-70">
            {Array.from({ length: 48 }).map((_, i) => {
              const barH = 10 + Math.abs(Math.sin(currentTime * 4 + i * 0.4)) * 44;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full bg-white/70"
                  style={{ height: `${barH}px` }}
                />
              );
            })}
          </div>
        )}

        {/* Playhead Controls Overlay */}
        <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center gap-3 rounded-full bg-black/60 px-3 py-2 backdrop-blur border border-white/10">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors"
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={audioDuration || 100}
              step={0.01}
              value={currentTime}
              onPointerDown={() => {
                if (audioRef.current && !audioRef.current.paused) {
                  audioRef.current.pause();
                }
              }}
              onChange={(e) => {
                const nextTime = Number(e.target.value);
                const audio = audioRef.current;

                if (audio) {
                  audio.currentTime = nextTime;
                }

                lastPublishedTimeRef.current = nextTime;
                setCurrentTime(nextTime);
                onTimeUpdate?.(nextTime);
              }}
              className="w-full accent-white cursor-pointer"
            />
          </div>
          <div className="text-[11px] font-mono text-white/70">
            {currentTime.toFixed(2)}s / {(audioDuration || 0).toFixed(1)}s
          </div>
        </div>

        {/* Safe Margin Boundary */}
        <div className="pointer-events-none absolute inset-[3%] rounded-xl border border-dashed border-white/10" />
      </div>
    </div>
  );
}
