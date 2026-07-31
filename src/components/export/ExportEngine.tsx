import { useRef, useState, useEffect } from "react";
import { useLyricStore } from "@/store/useLyricStore";
import { getCanvasDimensions } from "@/lib/audioUtils";
import { Button } from "@/components/ui/Button";

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "video/webm";
}

export function ExportEngine({ onDone }: { onDone?: (blob: Blob, url: string) => void }) {
  const {
    lyricBlocks,
    backgroundAsset,
    audioUrl,
    audioDuration,
    aiSettings,
    resolution,
    fps,
    aspectRatio,
  } = useLyricStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cancelRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const log = (m: string) => setLogs((l) => [...l.slice(-15), m]);

  useEffect(() => {
    return () => {
      if (exportedUrl && exportedUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(exportedUrl);
        } catch {}
      }
    };
  }, [exportedUrl]);

  const cancelExport = () => {
    cancelRef.current = true;
    log("Cancelling export...");
  };

  const startExport = async () => {
    if (isExporting) return;

    setErrorMsg(null);
    cancelRef.current = false;

    if (!audioUrl) {
      log("No audio file present – exporting video in silent mode");
    }

    setIsExporting(true);
    setProgress(0);

    if (exportedUrl) {
      try {
        URL.revokeObjectURL(exportedUrl);
      } catch {}
      setExportedUrl(null);
    }
    setLogs([]);

    const { w, h } = getCanvasDimensions(resolution, aspectRatio);
    const canvas = canvasRef.current;
    if (!canvas) {
      setIsExporting(false);
      return;
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    log(`Target resolution: ${w}×${h} (${aspectRatio}) @ ${fps}fps`);
    log(`Lyric blocks: ${lyricBlocks.length}, Audio duration: ${audioDuration.toFixed(2)}s`);

    let bgVideo: HTMLVideoElement | null = null;
    let bgImage: HTMLImageElement | null = null;
    let audioEl: HTMLAudioElement | null = null;
    let audioCtx: AudioContext | null = null;
    let mediaStreamSource: MediaElementAudioSourceNode | null = null;
    let recorder: MediaRecorder | null = null;
    let animFrameId = 0;

    try {
      // Prepare background
      if (backgroundAsset?.type === "video" && backgroundAsset.url) {
        bgVideo = document.createElement("video");
        bgVideo.crossOrigin = "anonymous";
        bgVideo.src = backgroundAsset.url;
        bgVideo.muted = true;
        bgVideo.loop = true;
        bgVideo.playsInline = true;
        await new Promise<void>((resolve) => {
          if (!bgVideo) return resolve();
          bgVideo.onloadedmetadata = () => resolve();
          bgVideo.onerror = () => resolve();
          setTimeout(resolve, 3000);
        });
        await bgVideo.play().catch(() => {});
      } else if (backgroundAsset?.type === "image" && backgroundAsset.url) {
        bgImage = new Image();
        bgImage.crossOrigin = "anonymous";
        bgImage.src = backgroundAsset.url;
        await new Promise<void>((resolve) => {
          if (!bgImage) return resolve();
          bgImage.onload = () => resolve();
          bgImage.onerror = () => resolve();
          setTimeout(resolve, 3000);
        });
      }

      // Check canvas stream support
      if (typeof (canvas as any).captureStream !== "function") {
        throw new Error("Your browser does not support canvas.captureStream API.");
      }

      const canvasStream = (canvas as any).captureStream(fps) as MediaStream;
      let combinedStream = canvasStream;

      if (audioUrl) {
        audioEl = new Audio(audioUrl);
        audioEl.crossOrigin = "anonymous";
        audioEl.preload = "auto";
        await new Promise<void>((resolve) => {
          if (!audioEl) return resolve();
          audioEl.oncanplaythrough = () => resolve();
          audioEl.onerror = () => resolve();
          setTimeout(resolve, 3000);
        });

        try {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();
          mediaStreamSource = audioCtx.createMediaElementSource(audioEl);
          mediaStreamSource.connect(dest);

          const audioTracks = dest.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
          }
        } catch (e: any) {
          log(`WebAudio stream capture warning: ${e.message}`);
        }
      }

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        throw new Error("MediaRecorder API is not supported in this browser environment.");
      }

      log(`Using MIME type: ${mimeType}`);

      const bitrate =
        w >= 3840
          ? 20_000_000
          : w >= 1920
          ? 10_000_000
          : 5_000_000;
      recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: bitrate,
        audioBitsPerSecond: 192_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const exportPromise = new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error("No MediaRecorder"));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = (e: any) => reject(new Error(`Recording error: ${e.error?.message || "Unknown error"}`));
      });

      recorder.start(1000);
      log("Real-time recording started...");

      if (audioCtx && audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      if (audioEl) {
        audioEl.currentTime = 0;
        await audioEl.play().catch(() => {});
      }

      const startTimeMs = performance.now();
      const targetDuration = Math.max(audioDuration || 0, 5);

      await new Promise<void>((resolve, reject) => {
        const renderLoop = () => {
          if (cancelRef.current) {
            reject(new Error("Export cancelled by user"));
            return;
          }

          const elapsedSec = audioEl ? audioEl.currentTime : (performance.now() - startTimeMs) / 1000;
          const currentSec = Math.min(elapsedSec, targetDuration);
          const currentProgress = Math.min(100, (currentSec / targetDuration) * 100);
          setProgress(currentProgress);

          // Clear Canvas
          ctx.clearRect(0, 0, w, h);

          // Render Background
          if (bgVideo && bgVideo.readyState >= 2) {
            if (
              bgVideo.paused &&
              currentSec < targetDuration
            ) {
              void bgVideo.play().catch(() => {});
            }

            try {
              ctx.drawImage(bgVideo, 0, 0, w, h);
            } catch {
              // Ignore a temporarily unavailable video frame.
            }
          } else if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
            const imgRatio = bgImage.naturalWidth / bgImage.naturalHeight;
            const canvasRatio = w / h;
            let drawW = w;
            let drawH = h;
            let offsetX = 0;
            let offsetY = 0;
            if (imgRatio > canvasRatio) {
              drawH = h;
              drawW = imgRatio * h;
              offsetX = (w - drawW) / 2;
            } else {
              drawW = w;
              drawH = w / imgRatio;
              offsetY = (h - drawH) / 2;
            }
            ctx.drawImage(bgImage, offsetX, offsetY, drawW, drawH);
          } else if (backgroundAsset?.type === "gradient") {
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, backgroundAsset.gradientColors?.[0] || "#FF00FF");
            grad.addColorStop(1, backgroundAsset.gradientColors?.[1] || "#00FFAB");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
          } else if (backgroundAsset?.type === "solid") {
            ctx.fillStyle = backgroundAsset.solidColor || "#0A0A0F";
            ctx.fillRect(0, 0, w, h);
          } else {
            ctx.fillStyle = "#0A0A0F";
            ctx.fillRect(0, 0, w, h);
          }

          // Dark overlay gradient
          const overlayGrad = ctx.createLinearGradient(0, 0, 0, h);
          overlayGrad.addColorStop(0, "rgba(0,0,0,0.35)");
          overlayGrad.addColorStop(0.5, "rgba(0,0,0,0.1)");
          overlayGrad.addColorStop(1, "rgba(0,0,0,0.65)");
          ctx.fillStyle = overlayGrad;
          ctx.fillRect(0, 0, w, h);

          // Render visible lyric blocks
          const visible = lyricBlocks.filter(
            (block) => currentSec >= block.startTime && currentSec < block.endTime
          );
          for (const block of visible) {
            const durationIn = Math.max(0.1, block.animation.durationIn);
            const pIn = Math.min(1, Math.max(0, (currentSec - block.startTime) / durationIn));
            const alpha = pIn < 0.2 ? pIn * 5 : 1;
            if (alpha <= 0) continue;

            ctx.save();
            ctx.globalAlpha = alpha;
            const posX = (block.style.x / 100) * w;
            const posY = (block.style.y / 100) * h;
            ctx.translate(posX, posY);

            if (block.animation.in === "pop") {
              const scale = 0.7 + pIn * 0.3;
              ctx.scale(scale, scale);
            }

            const fontSizeScale = w / 1920;
            const fontSizePx = Math.max(14, block.style.fontSize * fontSizeScale);
            ctx.font = `${block.style.bold ? "800" : "600"} ${fontSizePx}px ${block.style.fontFamily}, sans-serif`;
            ctx.textAlign = block.style.align;
            ctx.textBaseline = "middle";

            if (block.style.shadow) {
              ctx.shadowColor = block.style.shadowColor;
              ctx.shadowBlur = block.style.shadowBlur * fontSizeScale;
            }

            if (block.style.glow) {
              ctx.shadowColor = block.style.glowColor;
              ctx.shadowBlur = 20 * fontSizeScale;
            }

            if (block.style.outlineWidth > 0) {
              ctx.strokeStyle = block.style.outlineColor;
              ctx.lineWidth = block.style.outlineWidth * 2 * fontSizeScale;
              ctx.lineJoin = "round";
            }

            // Draw Background Box properly
            if (block.style.backgroundBox?.enabled) {
              const textMetrics = ctx.measureText(block.text);
              const pad = block.style.backgroundBox.padding * fontSizeScale;
              const boxW = textMetrics.width + pad * 2;
              const boxH = fontSizePx * 1.35;
              const alignOffset =
                block.style.align === "left" ? 0 : block.style.align === "right" ? -boxW : -boxW / 2;

              ctx.fillStyle = block.style.backgroundBox.color;
              ctx.globalAlpha = block.style.backgroundBox.opacity * alpha;
              ctx.beginPath();

              if ("roundRect" in ctx && typeof ctx.roundRect === "function") {
                ctx.roundRect(alignOffset, -boxH / 2, boxW, boxH, block.style.backgroundBox.radius * fontSizeScale);
              } else {
                ctx.fillRect(alignOffset, -boxH / 2, boxW, boxH);
              }
              ctx.fill();
              ctx.globalAlpha = alpha;
            }

            // Draw Karaoke Words or Block Text
            if (aiSettings.karaokeEnabled && block.words.length > 0) {
              const fullWidth = ctx.measureText(block.text).width;
              let cursorX =
                block.style.align === "center" ? -fullWidth / 2 : block.style.align === "right" ? -fullWidth : 0;

              for (const word of block.words) {
                const wordToken = word.word + " ";
                const wordW = ctx.measureText(wordToken).width;
                const isActive = currentSec >= word.start && currentSec < word.end;
                const isPast = currentSec >= word.end;

                ctx.fillStyle = isActive ? "#FFD60A" : isPast ? block.style.color : `${block.style.color}CC`;

                if (block.style.outlineWidth > 0) {
                  ctx.strokeText(wordToken, cursorX, 0);
                }
                ctx.fillText(wordToken, cursorX, 0);
                cursorX += wordW;
              }
            } else {
              ctx.fillStyle = block.style.color;
              const lines = block.text.split("\n");
              lines.forEach((lineText, i) => {
                const yOffset = (i - (lines.length - 1) / 2) * fontSizePx * 1.2;
                if (block.style.outlineWidth > 0) {
                  ctx.strokeText(lineText, 0, yOffset);
                }
                ctx.fillText(lineText, 0, yOffset);
              });
            }

            ctx.restore();
          }

          // Deterministic Audio Visualizer
          if (aiSettings.visualizerEnabled) {
            ctx.save();
            const barCount = 48;
            const barW = w / barCount;
            for (let i = 0; i < barCount; i++) {
              const hBar = 15 + Math.abs(Math.sin(currentSec * 4 + i * 0.4)) * 75;
              ctx.fillStyle = `rgba(255,255,255,0.7)`;
              ctx.fillRect(i * barW + 2, h - hBar - 12, barW - 4, hBar);
            }
            ctx.restore();
          }

          if (currentSec >= targetDuration || (audioEl && audioEl.ended)) {
            resolve();
            return;
          }

          animFrameId = requestAnimationFrame(renderLoop);
        };

        renderLoop();
      });

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      const finalBlob = await exportPromise;
      const finalUrl = URL.createObjectURL(finalBlob);
      setExportedUrl(finalUrl);
      setProgress(100);
      log(`Export clean success: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB WEBM`);
      onDone?.(finalBlob, finalUrl);
    } catch (err: any) {
      log(`Export failed: ${err.message}`);
      setErrorMsg(err.message || "Browser recording failed.");
    } finally {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (audioEl) {
        try { audioEl.pause(); } catch {}
      }
      if (bgVideo) {
        try { bgVideo.pause(); } catch {}
      }
      if (mediaStreamSource) {
        try { mediaStreamSource.disconnect(); } catch {}
      }
      if (audioCtx && audioCtx.state !== "closed") {
        try { await audioCtx.close(); } catch {}
      }
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={startExport}
          disabled={isExporting}
          loading={isExporting}
          className="rounded-full font-bold px-6"
        >
          ● REC Export {resolution} @ {fps}fps
        </Button>

        {isExporting && (
          <Button variant="danger" size="sm" onClick={cancelExport} className="rounded-full">
            Cancel
          </Button>
        )}

        <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-white/70">
          Format: WEBM (browser MediaRecorder)
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          ❌ {errorMsg}
        </div>
      )}

      {isExporting && (
        <div className="rounded-2xl border border-white/10 bg-[#14141C] p-4 space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Recording real-time browser stream…</span>
            <span className="font-mono font-bold text-white">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-white transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
          <div className="font-mono text-[11px] text-white/40 max-h-[100px] overflow-auto space-y-1">
            {logs.map((l, i) => (
              <div key={i}>› {l}</div>
            ))}
          </div>
        </div>
      )}

      {exportedUrl && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-300">✅ Video Export Ready</span>
            <span className="text-xs text-white/40">WebM format</span>
          </div>

          <video src={exportedUrl} controls className="w-full rounded-xl bg-black max-h-[400px]" />

          <div className="flex flex-wrap gap-2">
            <a
              href={exportedUrl}
              download={`lyrical-video-${Date.now()}.webm`}
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-xs font-bold text-black hover:bg-zinc-200 transition-colors"
            >
              Download WEBM Video
            </a>
            <button
              type="button"
              onClick={() => {
                if (exportedUrl) window.open(exportedUrl, "_blank");
              }}
              className="rounded-full bg-white/10 px-5 py-2.5 text-xs text-white hover:bg-white/20 transition-colors"
            >
              Open in New Tab
            </button>
          </div>

          <div className="text-[11px] text-white/40 leading-relaxed border-t border-white/10 pt-3">
            💡 For MP4 conversion, run locally: <code className="text-white/80 bg-black/40 px-1.5 py-0.5 rounded">ffmpeg -i lyrical-video.webm -c:v libx264 -crf 18 -c:a aac output.mp4</code>
          </div>
        </div>
      )}
    </div>
  );
}
