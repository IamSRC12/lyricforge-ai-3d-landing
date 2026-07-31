import { db } from "@/db";
import { waitlistSignups } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = new Set(["artist", "producer", "editor", "studio", "label", "creator"]);
const PLANS = new Set(["indie", "pro", "studio"]);

export async function GET() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(waitlistSignups);

  const recent = await db
    .select({
      role: waitlistSignups.role,
      plan: waitlistSignups.plan,
      email: waitlistSignups.email,
      createdAt: waitlistSignups.createdAt,
    })
    .from(waitlistSignups)
    .orderBy(desc(waitlistSignups.createdAt))
    .limit(6);

  return Response.json({
    count: row?.count ?? 0,
    recent: recent.map((entry) => ({
      role: entry.role,
      plan: entry.plan,
      handle: maskEmail(entry.email),
      createdAt: entry.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const email = String(payload.email ?? "").trim().toLowerCase();
  const name = String(payload.name ?? "").trim().slice(0, 120);
  const role = String(payload.role ?? "creator").trim().toLowerCase();
  const plan = String(payload.plan ?? "indie").trim().toLowerCase();
  const useCase = String(payload.useCase ?? "").trim().slice(0, 600);

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const [inserted] = await db
    .insert(waitlistSignups)
    .values({
      email,
      name: name || null,
      role: ROLES.has(role) ? role : "creator",
      plan: PLANS.has(plan) ? plan : "indie",
      useCase: useCase || null,
      source: "landing",
    })
    .onConflictDoUpdate({
      target: waitlistSignups.email,
      set: {
        name: name || null,
        role: ROLES.has(role) ? role : "creator",
        plan: PLANS.has(plan) ? plan : "indie",
        useCase: useCase || null,
      },
    })
    .returning({ id: waitlistSignups.id, createdAt: waitlistSignups.createdAt });

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(waitlistSignups);

  const [{ position }] = await db
    .select({ position: sql<number>`count(*)::int` })
    .from(waitlistSignups)
    .where(
      sql`${waitlistSignups.createdAt} <= (select created_at from ${waitlistSignups} where id = ${inserted.id})`,
    );

  return Response.json({ ok: true, id: inserted.id, position, count }, { status: 201 });
}

function maskEmail(email: string): string {
  const [local, domain = ""] = email.split("@");
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}
