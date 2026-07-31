import { db } from "@/db";
import { featureVotes } from "@/db/schema";
import { getRoadmap } from "@/lib/roadmap";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const features = await getRoadmap();
  return Response.json({ features });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const featureKey = String((body as Record<string, unknown>)?.featureKey ?? "").trim();
  if (!featureKey) {
    return Response.json({ error: "featureKey is required." }, { status: 400 });
  }

  const [updated] = await db
    .update(featureVotes)
    .set({ votes: sql`${featureVotes.votes} + 1` })
    .where(eq(featureVotes.featureKey, featureKey))
    .returning();

  if (!updated) {
    return Response.json({ error: "Unknown feature." }, { status: 404 });
  }

  return Response.json({ ok: true, feature: updated });
}
