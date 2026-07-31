import { db } from "@/db";
import { syncDemos, waitlistSignups } from "@/db/schema";
import { sql } from "drizzle-orm";

export type LandingStats = {
  waitlistCount: number;
  timelinesForged: number;
  wordsAligned: number;
  avgConfidence: number;
  avgProcessingMs: number;
};

export async function getLandingStats(): Promise<LandingStats> {
  const [waitlist] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(waitlistSignups);

  const [demos] = await db
    .select({
      runs: sql<number>`count(*)::int`,
      words: sql<number>`coalesce(sum(${syncDemos.wordCount}), 0)::int`,
      confidence: sql<number>`coalesce(avg(${syncDemos.avgConfidence}), 0)::float8`,
      ms: sql<number>`coalesce(avg(${syncDemos.processingMs}), 0)::float8`,
    })
    .from(syncDemos);

  return {
    waitlistCount: waitlist?.count ?? 0,
    timelinesForged: demos?.runs ?? 0,
    wordsAligned: demos?.words ?? 0,
    avgConfidence: demos?.confidence ?? 0,
    avgProcessingMs: demos?.ms ?? 0,
  };
}
