"use client";

import { useState } from "react";
import { UploadPage } from "@/components/upload/UploadPage";
import { EditorPage } from "@/components/editor/EditorPage";
import { ExportPage } from "@/components/export/ExportPage";
import Nav from "@/components/landing/Nav";

export default function StudioPage() {
  const [view, setView] = useState<"upload" | "editor" | "export">("upload");

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Nav />
      <div className="pt-20 min-h-[calc(100vh-80px)]">
        {/* Navigation Bar for Studio Steps */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0F0F14]/90 backdrop-blur px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">
              LyricForge Studio Mode
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1">
            <button
              type="button"
              onClick={() => setView("upload")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                view === "upload"
                  ? "bg-white text-black shadow-lg"
                  : "text-white/60 hover:text-white"
              }`}
            >
              1. Upload & Analyse
            </button>
            <button
              type="button"
              onClick={() => setView("editor")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                view === "editor"
                  ? "bg-white text-black shadow-lg"
                  : "text-white/60 hover:text-white"
              }`}
            >
              2. Timeline & Studio
            </button>
            <button
              type="button"
              onClick={() => setView("export")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                view === "export"
                  ? "bg-white text-black shadow-lg"
                  : "text-white/60 hover:text-white"
              }`}
            >
              3. Export 60FPS
            </button>
          </div>
        </div>

        {/* Content */}
        {view === "upload" && <UploadPage onAnalyzed={() => setView("editor")} />}
        {view === "editor" && <EditorPage onExport={() => setView("export")} />}
        {view === "export" && <ExportPage />}
      </div>
    </div>
  );
}
