import { useState } from "react";
import { VideoPreview } from "./VideoPreview";
import { PropertiesPanel } from "./PropertiesPanel";
import { Timeline } from "./Timeline";
import { useLyricStore } from "@/store/useLyricStore";
import { Button } from "@/components/ui/Button";
import type { AspectRatio, Resolution } from "@/types/project";
import { motion, AnimatePresence } from "framer-motion";
import { SegmentPreview } from "../upload/SegmentPreview";
import { audioEngine } from "@/lib/audioEngine";
import { splitAudioByLyrics, type SplitMode } from "@/lib/audioSplitter";

export function EditorPage({ onExport }: { onExport: () => void }) {
  const {
    lyricBlocks,
    audioName,
    audioUrl,
    undo,
    redo,
    historyIndex,
    history,
    setAspectRatio,
    aspectRatio,
    resolution,
    setResolution,
    saveProjectMeta,
    audioSegments,
    setAudioSegments,
    splitMode,
  } = useLyricStore();

  const [projectName, setProjectName] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [splitterOpen, setSplitterOpen] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [splitterError, setSplitterError] = useState<string | null>(null);
  const [splitterLog, setSplitterLog] = useState<string[]>([]);

  const handleSave = () => {
    const nameToSave = projectName.trim() || audioName || "Untitled Project";
    saveProjectMeta(nameToSave);
    setSaveMessage("Saved!");
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const triggerSplit = async (mode: SplitMode, gaps: boolean) => {
    const file = useLyricStore.getState().audioFile;
    if (!file) {
      setSplitterError("No audio file found. Please go back and upload an audio file.");
      return;
    }
    setSplitting(true);
    setSplitterError(null);
    setSplitterLog(["Decoding audio file..."]);
    try {
      let buffer = audioEngine.audioBuffer;
      let decodedDuration = audioEngine.duration;

      if (!buffer) {
        const result = await audioEngine.load(file);
        buffer = audioEngine.audioBuffer;
        decodedDuration = result.duration;
      }

      if (!buffer) throw new Error("Audio decode failed.");

      const blocks = useLyricStore.getState().lyricBlocks;
      setSplitterLog((l) => [...l, "Dividing audio segments..."]);
      const segments = await splitAudioByLyrics(buffer, blocks, decodedDuration, {
        mode,
        includeInstrumentalGaps: gaps,
        onProgress: (_, msg) => setSplitterLog((l) => [...l, msg]),
      });

      setAudioSegments(segments);
      setSplitterLog((l) => [...l, `Split complete! ${segments.length} segments ready.`]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Split failed.";
      setSplitterError(msg);
      setSplitterLog((l) => [...l, `Error: ${msg}`]);
    } finally {
      setSplitting(false);
    }
  };

  const isUndoDisabled = historyIndex <= 0;
  const isRedoDisabled = historyIndex >= history.length - 1;

  const hasContent = lyricBlocks.length > 0 || Boolean(audioUrl);

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0F] text-white">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 bg-[#0F0F14] px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold tracking-wider">STUDIO</div>
          <div className="hidden items-center gap-2 lg:flex">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/60 truncate max-w-[180px]">
              {audioName || "No audio"}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/60">
              {lyricBlocks.length} blocks
            </span>
          </div>
          <div className="ml-4 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={isUndoDisabled}
              title="Undo (Ctrl+Z)"
            >
              ↩
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={isRedoDisabled}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↪
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
            className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="16:9">16:9 Landscape</option>
            <option value="9:16">9:16 Portrait</option>
            <option value="1:1">1:1 Square</option>
            <option value="4:5">4:5 Feed</option>
            <option value="21:9">21:9 Cinematic</option>
          </select>

          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as Resolution)}
            className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="1280x720">720p</option>
            <option value="1920x1080">1080p</option>
            <option value="3840x2160">4K</option>
          </select>

          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={audioName || "Project name"}
            className="hidden rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none lg:block"
          />

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSplitterOpen(true);
              if (useLyricStore.getState().audioSegments.length === 0) {
                void triggerSplit(splitMode, false);
              }
            }}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold"
          >
            ✂ Audio Splitter
          </Button>

          <Button variant="secondary" size="sm" onClick={handleSave}>
            {saveMessage || "Save"}
          </Button>

          <Button size="sm" onClick={onExport} disabled={!hasContent}>
            Export →
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 p-3 lg:p-4 min-w-0">
          <div className="flex-1 overflow-hidden rounded-[20px] border border-white/10 bg-[#0F0F14] p-3 flex items-center justify-center relative">
            <VideoPreview />
          </div>

          <div className="h-[262px] shrink-0">
            <Timeline />
          </div>
        </div>

        <div className="w-[380px] shrink-0 overflow-hidden border-l border-white/10 bg-[#0A0A0F] p-3 hidden lg:block">
          <PropertiesPanel />
        </div>
      </div>

      <AnimatePresence>
        {splitterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
              onClick={() => !splitting && setSplitterOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              role="dialog"
              aria-label="Audio Splitter"
              aria-modal="true"
              className="fixed left-1/2 top-1/2 z-[101] w-[94%] max-w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-white/10 bg-[#14141C] p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-4 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>✂</span> Audio-Lyric Splitter
                  </h3>
                  <p className="mt-1 text-xs text-white/50">
                    Divide your audio into distinct WAV clips per lyric line, edit bounds, and export.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !splitting && setSplitterOpen(false)}
                  disabled={splitting}
                  aria-label="Close modal"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 min-h-0">
                {splitting ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                    <p className="mt-4 text-sm font-medium text-white">Splitting audio tracks...</p>
                    <div className="mt-6 w-full max-w-[400px] rounded-xl bg-black/50 p-4 border border-white/5 font-mono text-[10px] text-white/40 leading-relaxed h-[120px] overflow-y-auto">
                      {splitterLog.map((logStr, idx) => (
                        <div key={idx}>› {logStr}</div>
                      ))}
                    </div>
                  </div>
                ) : splitterError ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-center">
                    <p className="text-sm font-semibold text-red-400">Audio Splitting Failed</p>
                    <p className="mt-2 text-xs text-red-300/80">{splitterError}</p>
                    <Button
                      size="sm"
                      className="mt-4 bg-white/10 hover:bg-white/20 text-white"
                      onClick={() => void triggerSplit(splitMode, false)}
                    >
                      Retry Split
                    </Button>
                  </div>
                ) : audioSegments.length > 0 ? (
                  <SegmentPreview
                    onInsert={() => setSplitterOpen(false)}
                    onResplit={(m, g) => void triggerSplit(m, g)}
                  />
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-sm text-white/50">No segments divided yet.</p>
                    <Button
                      size="sm"
                      className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => void triggerSplit(splitMode, false)}
                    >
                      Run Audio Splitter
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
