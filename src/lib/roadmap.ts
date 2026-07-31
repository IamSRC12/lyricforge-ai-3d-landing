import { db } from "@/db";
import { featureVotes } from "@/db/schema";
import { desc } from "drizzle-orm";

export const DEFAULT_ROADMAP = [
  {
    featureKey: "webcodecs-export",
    label: "WebCodecs 1080p60 export",
    description: "VideoEncoder + OffscreenCanvas pipeline muxed with FFmpeg.wasm. No MediaRecorder, ever.",
    category: "engine",
    phase: "phase-2",
    votes: 412,
  },
  {
    featureKey: "electron-shell",
    label: "Electron desktop shell",
    description: "System FFmpeg for ~10× faster renders, native file dialogs, offline license check.",
    category: "platform",
    phase: "phase-4",
    votes: 338,
  },
  {
    featureKey: "live-animations",
    label: "DeepSeek live animation layer",
    description: "Model writes renderFrame(ctx, time, audioData); sandboxed in a Web Worker, composited per frame.",
    category: "ai",
    phase: "phase-3",
    votes: 297,
  },
  {
    featureKey: "stem-separation",
    label: "Stem-aware highlighting",
    description: "Separate vocals from the mix so karaoke fill locks to the vocal envelope, not the drums.",
    category: "ai",
    phase: "phase-4",
    votes: 254,
  },
  {
    featureKey: "vertical-presets",
    label: "9:16 + 1:1 export presets",
    description: "Reels / Shorts / TikTok safe areas with auto text re-flow from the 16:9 master.",
    category: "engine",
    phase: "phase-3",
    votes: 231,
  },
  {
    featureKey: "collab-projects",
    label: "Shared project JSON sync",
    description: "Portable project files with media references so a team can pass a session around.",
    category: "platform",
    phase: "phase-4",
    votes: 176,
  },
];

let seeded = false;

export async function ensureRoadmapSeeded(): Promise<void> {
  if (seeded) return;
  await db.insert(featureVotes).values(DEFAULT_ROADMAP).onConflictDoNothing();
  seeded = true;
}

export async function getRoadmap() {
  await ensureRoadmapSeeded();
  return db.select().from(featureVotes).orderBy(desc(featureVotes.votes));
}
