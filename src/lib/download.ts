import { LyricBlock, ProjectState } from "@/types/project";

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  // Correctly round milliseconds so 59.9995 does not overflow or output invalid strings
  const ms = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function generateSRTContent(blocks: LyricBlock[]): string {
  const sorted = [...blocks].sort((a, b) => a.startTime - b.startTime);
  return sorted
    .map((b, i) => {
      const start = Math.max(0, b.startTime);
      const end = Math.max(start + 0.1, b.endTime);
      const text = b.text.replace(/\r?\n/g, " ").trim();
      return `${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${text}\n`;
    })
    .join("\n");
}

export function formatLrcTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  const wholeSec = Math.floor(s);
  const hundredths = Math.floor((s - wholeSec) * 100);
  return `[${String(m).padStart(2, "0")}:${String(wholeSec).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}]`;
}

export function generateLRCContent(blocks: LyricBlock[]): string {
  const sorted = [...blocks].sort((a, b) => a.startTime - b.startTime);
  return sorted
    .map((b) => {
      const start = Math.max(0, b.startTime);
      const text = b.text.replace(/\r?\n/g, " ").trim();
      return `${formatLrcTime(start)}${text}`;
    })
    .join("\n");
}

export function exportProjectJSON(state: ProjectState, fileName = "lyrical-video-project.json") {
  const serializableProject = {
    app: "LyricalVideoPro",
    version: "2.1",
    exportedAt: new Date().toISOString(),
    audioName: state.audioName,
    audioDuration: state.audioDuration,
    aspectRatio: state.aspectRatio,
    resolution: state.resolution,
    fps: state.fps,
    backgroundAsset: state.backgroundAsset
      ? {
          type: state.backgroundAsset.type,
          duration: state.backgroundAsset.duration,
          fileName: state.backgroundAsset.fileName,
          gradientColors: state.backgroundAsset.gradientColors,
          solidColor: state.backgroundAsset.solidColor,
          note: state.backgroundAsset.type === "image" || state.backgroundAsset.type === "video" ? "Media asset file requires reattachment on import" : undefined,
        }
      : null,
    lyricBlocks: state.lyricBlocks,
    aiSettings: state.aiSettings,
  };

  const jsonString = JSON.stringify(serializableProject, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  downloadBlob(blob, fileName);
}
