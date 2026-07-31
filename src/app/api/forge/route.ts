import { db } from "@/db";
import { syncDemos } from "@/db/schema";
import { forgeTimeline } from "@/lib/sync-engine";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_LYRIC_CHARS = 6000;

export async function GET() {
  const [aggregate] = await db
    .select({
      runs: sql<number>`count(*)::int`,
      words: sql<number>`coalesce(sum(${syncDemos.wordCount}), 0)::int`,
      avgConfidence: sql<number>`coalesce(avg(${syncDemos.avgConfidence}), 0)::float8`,
    })
    .from(syncDemos);

  const recent = await db
    .select({
      id: syncDemos.id,
      title: syncDemos.title,
      language: syncDemos.language,
      bpm: syncDemos.bpm,
      lineCount: syncDemos.lineCount,
      wordCount: syncDemos.wordCount,
      avgConfidence: syncDemos.avgConfidence,
      processingMs: syncDemos.processingMs,
      createdAt: syncDemos.createdAt,
    })
    .from(syncDemos)
    .orderBy(desc(syncDemos.createdAt))
    .limit(5);

  return Response.json({ aggregate, recent });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const lyrics = String(payload.lyrics ?? "").slice(0, MAX_LYRIC_CHARS);
  const title = String(payload.title ?? "Untitled session").trim().slice(0, 160) || "Untitled session";
  const durationSeconds = Number(payload.durationSeconds ?? 90);
  const bpm = Number(payload.bpm ?? 96);

  if (!lyrics.trim()) {
    return Response.json({ error: "Enter lyrics before analysing." }, { status: 400 });
  }

  const result = forgeTimeline({
    lyrics,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 90,
    bpm: Number.isFinite(bpm) ? bpm : 96,
  });

  if (result.segments.length === 0) {
    return Response.json(
      { error: "No lyric content survived cleaning — check for stray tags only." },
      { status: 422 },
    );
  }

  const [saved] = await db
    .insert(syncDemos)
    .values({
      title,
      language: result.language,
      durationSeconds: result.durationSeconds,
      bpm: result.bpm,
      lineCount: result.segments.length,
      wordCount: result.wordCount,
      tagsRemoved: result.tagsRemoved.length,
      avgConfidence: result.avgConfidence,
      lowConfidenceCount: result.lowConfidenceCount,
      processingMs: result.processingMs,
      timeline: result.segments,
    })
    .returning({ id: syncDemos.id });

  return Response.json({ ok: true, demoId: saved.id, result }, { status: 201 });
}
