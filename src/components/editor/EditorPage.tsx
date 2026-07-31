import { useState } from "react";
import { VideoPreview } from "./VideoPreview";
import { PropertiesPanel } from "./PropertiesPanel";
import { Timeline } from "./Timeline";
import { useLyricStore } from "@/store/useLyricStore";
import { Button } from "@/components/ui/Button";
import type { AspectRatio, Resolution } from "@/types/project";

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
  } = useLyricStore();

  const [projectName, setProjectName] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSave = () => {
    const nameToSave = projectName.trim() || audioName || "Untitled Project";
    saveProjectMeta(nameToSave);
    setSaveMessage("Saved!");
    setTimeout(() => setSaveMessage(null), 2000);
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

          <div className="h-[220px] shrink-0">
            <Timeline />
          </div>
        </div>

        <div className="w-[380px] shrink-0 overflow-hidden border-l border-white/10 bg-[#0A0A0F] p-3 hidden lg:block">
          <PropertiesPanel />
        </div>
      </div>

      {/* Mobile properties drawer */}
      <div className="border-t border-white/10 bg-[#0F0F14] p-3 lg:hidden max-h-[40vh] overflow-auto">
        <PropertiesPanel />
      </div>
    </div>
  );
}
