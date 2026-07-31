import JSZip from "jszip";
import type { AudioSegment } from "./audioSplitter";
import { downloadBlob, formatSrtTime } from "./download";

export function buildSegmentManifest(segments: AudioSegment[], projectName: string) {
  return {
    app: "LyricForge Studio",
    kind: "audio-lyric-split",
    version: 1,
    project: projectName,
    exportedAt: new Date().toISOString(),
    sampleRate: segments[0]?.sampleRate ?? null,
    channels: segments[0]?.channels ?? null,
    count: segments.length,
    segments: segments.map((s) => ({
      index: s.index,
      fileName: s.fileName,
      text: s.text,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      isInstrumental: s.isInstrumental,
    })),
  };
}

function buildCsv(segments: AudioSegment[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = segments.map((s) =>
    [s.index + 1, esc(s.fileName), s.startTime, s.endTime, s.duration, esc(s.text)].join(","),
  );
  return ["index,file,start,end,duration,text", ...rows].join("\n");
}

function buildSrt(segments: AudioSegment[]): string {
  return segments
    .filter((s) => !s.isInstrumental)
    .map(
      (s, i) =>
        `${i + 1}\n${formatSrtTime(s.startTime)} --> ${formatSrtTime(s.endTime)}\n${s.text.replace(
          /\r?\n/g,
          " ",
        )}\n`,
    )
    .join("\n");
}

export async function downloadSegmentsZip(
  segments: AudioSegment[],
  projectName = "lyricforge",
  onProgress?: (percent: number, message: string) => void,
): Promise<void> {
  if (segments.length === 0) throw new Error("No segments to export.");

  const zip = new JSZip();
  const audio = zip.folder("audio")!;

  for (let i = 0; i < segments.length; i++) {
    audio.file(segments[i].fileName, segments[i].blob);
    onProgress?.(Math.round(((i + 1) / segments.length) * 70), `Packing ${i + 1}/${segments.length}…`);
  }

  zip.file("segments.json", JSON.stringify(buildSegmentManifest(segments, projectName), null, 2));
  zip.file("segments.csv", buildCsv(segments));
  zip.file("lyrics.srt", buildSrt(segments));

  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" }, (meta) => {
    onProgress?.(70 + Math.round(meta.percent * 0.3), "Generating ZIP…");
  });

  downloadBlob(blob, `${projectName.replace(/[^\w.-]+/g, "_")}_segments.zip`);
  onProgress?.(100, "Download started.");
}
