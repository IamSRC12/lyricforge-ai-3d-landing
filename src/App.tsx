"use client";
import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Sidebar, View } from "@/components/layout/Sidebar";
import LandingPage from "@/components/landing/LandingPage";
import { UploadPage } from "@/components/upload/UploadPage";
import { EditorPage } from "@/components/editor/EditorPage";
import { ExportPage } from "@/components/export/ExportPage";
import { useLyricStore } from "@/store/useLyricStore";

function MainAppShell({ defaultView = "upload" }: { defaultView?: View }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentView: View = (location.pathname.replace("/", "") as View) || defaultView;

  const { lyricBlocks, audioUrl } = useLyricStore();

  const handleViewChange = (newView: View) => {
    if (newView === "landing") {
      navigate("/");
    } else {
      navigate(`/${newView}`);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) useLyricStore.getState().redo();
          else useLyricStore.getState().undo();
        }
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          useLyricStore.getState().saveProjectMeta(`autosave_${Date.now()}`);
        }
      }
      if (e.code === "Space" && currentView === "editor") {
        e.preventDefault();
        useLyricStore.getState().setIsPlaying(!useLyricStore.getState().isPlaying);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentView]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Sidebar current={currentView} onChange={handleViewChange} />

      <div className="ml-[84px] lg:ml-[280px] min-h-screen">
        {currentView === "upload" && <UploadPage onAnalyzed={() => navigate("/editor")} />}
        {currentView === "editor" && <EditorPage onExport={() => navigate("/export")} />}
        {currentView === "export" && <ExportPage />}

        <div className="fixed bottom-4 left-[50%] z-30 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#14141C]/90 px-4 py-2 text-[11px] text-white/50 backdrop-blur lg:flex ml-[140px]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span>Space = Play/Pause • Drag text on preview to reposition • Ctrl+Z Undo • Ctrl+S Autosave • Blocks: {lyricBlocks.length} • Audio: {audioUrl ? "loaded" : "none"}</span>
        </div>
      </div>
    </div>
  );
}

export default function App(): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/" element={<LandingPage onGetStarted={() => navigate("/upload")} />} />
      <Route path="/upload" element={<MainAppShell defaultView="upload" />} />
      <Route path="/editor" element={<MainAppShell defaultView="editor" />} />
      <Route path="/export" element={<MainAppShell defaultView="export" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
