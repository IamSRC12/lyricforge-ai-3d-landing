import { useRef, useState, useEffect } from "react";
import { useLyricStore } from "@/store/useLyricStore";
import { exportVideo, probeSupport } from "@/lib/exportEngine";
import { audioEngine } from "@/lib/audioEngine";
import { Button } from "@/components/ui/Button";

export function ExportEngine({ onDone }: { onDone?: (blob: Blob, url: string) => void }) {
  const {
    lyricBlocks,
    backgroundAsset,
    audioDuration,
    aiSettings,
    resolution,
    fps,
    aspectRatio,
  } = useLyricStore();

  const [progress, setProgress] = useState<{ percent: number; stage: string; fps: number; eta: number }>({
    percent: 0,
    stage: "idle",
    fps: 0,
    eta: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      log("Export cancellation requested...");
    }
  };

  const startExport = async () => {
    if (isExporting) return;

    setErrorMsg(null);
    setIsExporting(true);
    setProgress({ percent: 0, stage: "initializing", fps: 0, eta: 0 });

    if (exportedUrl) {
      try {
        URL.revokeObjectURL(exportedUrl);
      } catch {}
      setExportedUrl(null);
    }
    setLogs([]);

    const [wStr, hStr] = resolution.split("x");
    let w = parseInt(wStr, 10) || 1920;
    let h = parseInt(hStr, 10) || 1080;

    // Adjust for aspect ratio
    if (aspectRatio === "9:16") {
      const temp = w;
      w = h;
      h = temp;
    } else if (aspectRatio === "1:1") {
      h = w;
    } else if (aspectRatio === "4:5") {
      h = Math.round(w * 1.25);
    } else if (aspectRatio === "21:9") {
      h = Math.round(w / 2.33);
    }

    const dur = Math.max(audioDuration || audioEngine.duration || 5, 2);
    abortControllerRef.current = new AbortController();

    try {
      log(`Starting WebCodecs MP4 Export · ${w}×${h} @ ${fps}fps · Duration ${dur.toFixed(1)}s`);

      const res = await exportVideo({
        width: w,
        height: h,
        fps,
        duration: dur,
        blocks: lyricBlocks,
        ai: aiSettings,
        audioBuffer: audioEngine.audioBuffer,
        amplitudeAt: (t, which) => audioEngine.amplitudeAt(t, which),
        background: {
          type: backgroundAsset?.type || "none",
          url: backgroundAsset?.url,
          solidColor: backgroundAsset?.solidColor,
          gradientColors: backgroundAsset?.gradientColors,
        },
        quality: "best",
        signal: abortControllerRef.current.signal,
        onProgress: (p) => setProgress(p),
        onLog: log,
      });

      const url = URL.createObjectURL(res.blob);
      setExportedUrl(url);
      onDone?.(res.blob, url);
    } catch (err: any) {
      if (err.name === "AbortError") {
        log("Export cancelled.");
      } else {
        log(`Export failed: ${err.message}`);
        setErrorMsg(err.message || "Video export failed.");
      }
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={startExport}
          disabled={isExporting}
          loading={isExporting}
          className="rounded-full font-bold px-6 bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg"
        >
          🎬 Export MP4 Video ({resolution} @ {fps}fps)
        </Button>

        {isExporting && (
          <Button variant="danger" size="sm" onClick={cancelExport} className="rounded-full">
            Cancel
          </Button>
        )}

        <div className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-mono text-purple-300">
          Engine: WebCodecs + MP4 Muxer (Deterministic 60FPS)
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
            <span className="text-white/60 font-semibold">{progress.stage}</span>
            <span className="font-mono font-bold text-purple-300">{progress.percent.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-150" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-white/40">
            <span>{progress.fps > 0 ? `${progress.fps.toFixed(0)} FPS render speed` : ""}</span>
            <span>{progress.eta > 0 ? `~${progress.eta.toFixed(0)}s remaining` : ""}</span>
          </div>
          <div className="font-mono text-[11px] text-white/40 max-h-[120px] overflow-auto space-y-1 border-t border-white/5 pt-2">
            {logs.map((l, i) => (
              <div key={i}>› {l}</div>
            ))}
          </div>
        </div>
      )}

      {exportedUrl && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-300">✅ MP4 Video Export Ready</span>
            <span className="text-xs text-emerald-400/80 font-mono">H.264 / AAC MP4</span>
          </div>

          <video src={exportedUrl} controls className="w-full rounded-xl bg-black max-h-[400px]" />

          <div className="flex flex-wrap gap-2">
            <a
              href={exportedUrl}
              download={`lyricforge-${Date.now()}.mp4`}
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-2.5 text-xs font-bold text-black hover:bg-emerald-300 transition-colors shadow-lg"
            >
              Download MP4 Video
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
        </div>
      )}
    </div>
  );
}
