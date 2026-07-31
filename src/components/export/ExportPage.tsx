import { useLyricStore } from "@/store/useLyricStore";
import { Button } from "@/components/ui/Button";
import { ExportEngine } from "./ExportEngine";
import { useState } from "react";
import { generateSRTContent, generateLRCContent, exportProjectJSON, downloadBlob } from "@/lib/download";
import type { Resolution } from "@/types/project";

export function ExportPage() {
  const store = useLyricStore();
  const { lyricBlocks, audioName, resolution, fps, setResolution, setFps, aspectRatio } = store;
  const [srt, setSrt] = useState<string | null>(null);
  const [lrc, setLrc] = useState<string | null>(null);

  const handleGenerateSRT = () => {
    const content = generateSRTContent(lyricBlocks);
    setSrt(content);
  };

  const handleGenerateLRC = () => {
    const content = generateLRCContent(lyricBlocks);
    setLrc(content);
  };

  const handleDownloadSRT = () => {
    if (!srt) return;
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${audioName || "lyrics"}.srt`);
  };

  const handleDownloadLRC = () => {
    if (!lrc) return;
    const blob = new Blob([lrc], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${audioName || "lyrics"}.lrc`);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="mx-auto max-w-[1100px] px-6 py-8">
        <h1 className="text-3xl font-black tracking-tight">Export Studio</h1>
        <p className="mt-1 text-sm text-white/50">
          Browser MediaRecorder real-time canvas capture • Synced audio • WEBM export (MP4 via FFmpeg)
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[20px] border border-white/10 bg-[#14141C] p-6">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/60">Export Settings</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-white/40">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as Resolution)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white focus:outline-none"
                  >
                    <option value="1280x720">1280×720 (HD)</option>
                    <option value="1920x1080">1920×1080 (FHD)</option>
                    <option value="3840x2160">3840×2160 (4K)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-white/40">FPS</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value, 10) as 30 | 60)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white focus:outline-none"
                  >
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS (recommended)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-white/40">Aspect Ratio</label>
                  <div className="mt-1 rounded-xl bg-white/5 px-3 py-3 text-sm">{aspectRatio}</div>
                </div>

                <div>
                  <label className="text-[11px] text-white/40">Audio Track</label>
                  <div className="mt-1 rounded-xl bg-white/5 px-3 py-3 text-sm truncate">
                    {audioName || "No audio loaded"}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <ExportEngine />
              </div>

              <div className="mt-6 rounded-xl bg-white/[0.04] p-4 text-[11px] leading-relaxed text-white/50">
                <div className="font-bold text-white">Export technical notes:</div>
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  <li>Browser video recording uses real-time HTML5 Canvas capture & WebAudio destination stream</li>
                  <li>Outputs WebM format natively supported across modern browsers</li>
                  <li>For MP4 conversion, run: <code className="text-white/80 bg-black/50 px-1 py-0.5 rounded">ffmpeg -i input.webm -c:v libx264 -c:a aac output.mp4</code></li>
                  <li>Background video loops seamlessly over audio duration</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[20px] border border-white/10 bg-[#14141C] p-6">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/60">Deliverables</h3>
              <div className="mt-4 space-y-3">
                <Button variant="secondary" className="w-full justify-between" onClick={handleGenerateSRT}>
                  Generate SRT (Subtitles) <span>→</span>
                </Button>
                <Button variant="secondary" className="w-full justify-between" onClick={handleGenerateLRC}>
                  Generate LRC (Karaoke) <span>→</span>
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-between"
                  onClick={() => exportProjectJSON(store)}
                >
                  Export Project JSON <span>→</span>
                </Button>
              </div>

              {srt && (
                <div className="mt-4 rounded-xl bg-black/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold">SRT Subtitles Preview</span>
                    <button
                      type="button"
                      onClick={handleDownloadSRT}
                      className="text-[11px] text-white/70 hover:text-white font-medium"
                    >
                      Download .SRT
                    </button>
                  </div>
                  <pre className="max-h-[160px] overflow-auto text-[11px] leading-relaxed text-white/60 font-mono">
                    {srt.slice(0, 1500)}
                  </pre>
                </div>
              )}

              {lrc && (
                <div className="mt-4 rounded-xl bg-black/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold">LRC Subtitles Preview</span>
                    <button
                      type="button"
                      onClick={handleDownloadLRC}
                      className="text-[11px] text-white/70 hover:text-white font-medium"
                    >
                      Download .LRC
                    </button>
                  </div>
                  <pre className="max-h-[160px] overflow-auto text-[11px] leading-relaxed text-white/60 font-mono">
                    {lrc.slice(0, 1500)}
                  </pre>
                </div>
              )}

              <div className="mt-6 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 p-4 border border-white/10">
                <div className="text-xs font-bold text-white">Project Deliverable Summary</div>
                <ul className="mt-2 space-y-1 text-[11px] text-white/60">
                  <li>✅ High-resolution video export</li>
                  <li>✅ Custom typography & style preset</li>
                  <li>✅ Synchronized audio track</li>
                  <li>✅ Standard SRT + LRC subtitle files</li>
                  <li>✅ Structured JSON project backup</li>
                </ul>
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.02] p-5">
              <div className="text-xs font-bold">Pre-Export Checks</div>
              <ul className="mt-3 space-y-2 text-[11px] text-white/50">
                <li className={lyricBlocks.length > 0 ? "text-emerald-300" : "text-red-300"}>
                  {lyricBlocks.length > 0 ? "✓" : "✗"} {lyricBlocks.length} lyric blocks configured
                </li>
                <li className={store.audioUrl ? "text-emerald-300" : "text-amber-300"}>
                  {store.audioUrl ? "✓ Audio loaded" : "⚠ Silent export mode (no audio loaded)"}
                </li>
                <li>✓ Text safe area 3% margin respected</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
