"use client";

import { useEffect, useRef, useState } from "react";
import { useLyricStore } from "@/store/useLyricStore";
import { downloadSegmentsZip } from "@/lib/segmentExport";
import { downloadBlob } from "@/lib/download";
import { formatTimecode } from "@/lib/timeUtils";
import type { SplitMode } from "@/lib/audioSplitter";
import { Play, Pause, Download, Package, ArrowRight, RefreshCw } from "lucide-react";

export function SegmentPreview({
  onInsert,
  onResplit,
}: {
  onInsert: () => void;
  onResplit: (mode: SplitMode, includeGaps: boolean) => void;
}) {
  const { audioSegments, audioName, splitMode, setSplitMode, insertSegmentsIntoTimeline } =
    useLyricStore();

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [includeGaps, setIncludeGaps] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const play = (id: string, url: string) => {
    audioRef.current?.pause();
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    const el = new Audio(url);
    el.onended = () => setPlayingId(null);
    el.onerror = () => setPlayingId(null);
    audioRef.current = el;
    void el.play().catch(() => setPlayingId(null));
    setPlayingId(id);
  };

  const handleInsert = () => {
    setError(null);
    try {
      insertSegmentsIntoTimeline({ includeInstrumentalBlocks: includeGaps });
      onInsert();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insert failed.");
    }
  };

  const handleZip = async () => {
    setZipStatus("Packing…");
    try {
      await downloadSegmentsZip(audioSegments, audioName ?? "lyricforge", (_, m) => setZipStatus(m));
    } catch (e) {
      setZipStatus(e instanceof Error ? e.message : "ZIP failed.");
      return;
    }
    setTimeout(() => setZipStatus(null), 2500);
  };

  if (audioSegments.length === 0) return null;

  const lyricCount = audioSegments.filter((s) => !s.isInstrumental).length;
  const gapCount = audioSegments.length - lyricCount;
  const covered = audioSegments.reduce((a, s) => a + s.duration, 0);

  return (
    <div className="rounded-[20px] border border-purple-500/30 bg-[#14141C] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Verify split segments</h3>
          <p className="mt-1 text-xs text-white/50">
            {lyricCount} lyric clips{gapCount > 0 ? ` + ${gapCount} instrumental` : ""} ·{" "}
            {covered.toFixed(2)}s covered · {audioSegments[0].sampleRate} Hz /{" "}
            {audioSegments[0].channels === 1 ? "mono" : "stereo"} WAV
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={splitMode}
            onChange={(e) => {
              const mode = e.target.value as SplitMode;
              setSplitMode(mode);
              onResplit(mode, includeGaps);
            }}
            className="rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white"
          >
            <option value="tight">Tight cuts (exact line bounds)</option>
            <option value="gapless">Gapless (clips tile the whole track)</option>
            <option value="padded">Padded (+80ms / +120ms)</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={includeGaps}
              onChange={(e) => {
                setIncludeGaps(e.target.checked);
                onResplit(splitMode, e.target.checked);
              }}
            />
            Instrumental gaps
          </label>
          <button
            type="button"
            onClick={() => onResplit(splitMode, includeGaps)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20"
          >
            <RefreshCw className="h-3 w-3" /> Re-split
          </button>
        </div>
      </div>

      <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {audioSegments.map((seg) => (
          <div
            key={seg.id}
            className={`rounded-xl border p-3 ${
              seg.isInstrumental
                ? "border-purple-500/30 bg-purple-500/10"
                : "border-white/10 bg-black/40"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70">
                  {String(seg.index + 1).padStart(2, "0")}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-purple-300">
                  {formatTimecode(seg.startTime)} → {formatTimecode(seg.endTime)}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-white/40">
                  {seg.duration.toFixed(2)}s
                </span>
                <span className="truncate text-xs text-white">{seg.text || "—"}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => play(seg.id, seg.url)}
                  className="rounded-md bg-white/10 p-1.5 text-white hover:bg-white/20"
                  aria-label={playingId === seg.id ? "Pause clip" : "Play clip"}
                >
                  {playingId === seg.id ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => downloadBlob(seg.blob, seg.fileName)}
                  className="rounded-md bg-white/10 p-1.5 text-white/70 hover:bg-white/20"
                  aria-label="Download clip"
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex h-6 items-end gap-[1px]">
              {seg.peaks.map((p, i) => (
                <span
                  key={i}
                  style={{ height: `${Math.max(6, p * 100)}%` }}
                  className={`flex-1 rounded-sm ${
                    seg.isInstrumental ? "bg-purple-400/50" : "bg-indigo-400/60"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={handleZip}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
        >
          <Package className="h-3.5 w-3.5" /> {zipStatus ?? "Download all as ZIP"}
        </button>
        <button
          type="button"
          onClick={handleInsert}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg hover:brightness-110"
        >
          Insert {lyricCount} segments into timeline <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
