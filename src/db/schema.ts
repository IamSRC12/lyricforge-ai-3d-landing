import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Early-access / perpetual license waitlist.
 */
export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    name: varchar("name", { length: 120 }),
    role: varchar("role", { length: 40 }).notNull().default("creator"),
    plan: varchar("plan", { length: 40 }).notNull().default("indie"),
    useCase: text("use_case"),
    source: varchar("source", { length: 60 }).notNull().default("landing"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("waitlist_signups_email_key").on(table.email)],
);

/**
 * Public roadmap board — visitors upvote what ships first.
 */
export const featureVotes = pgTable(
  "feature_votes",
  {
    id: serial("id").primaryKey(),
    featureKey: varchar("feature_key", { length: 60 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    category: varchar("category", { length: 40 }).notNull().default("engine"),
    phase: varchar("phase", { length: 40 }).notNull().default("phase-2"),
    votes: integer("votes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("feature_votes_key_unique").on(table.featureKey)],
);

/**
 * Every run of the in-browser alignment demo is persisted so the landing page
 * can show real "timelines forged" counters instead of fake social proof.
 */
export const syncDemos = pgTable(
  "sync_demos",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 160 }).notNull().default("Untitled session"),
    language: varchar("language", { length: 40 }).notNull().default("english"),
    durationSeconds: real("duration_seconds").notNull().default(0),
    bpm: integer("bpm").notNull().default(96),
    lineCount: integer("line_count").notNull().default(0),
    wordCount: integer("word_count").notNull().default(0),
    tagsRemoved: integer("tags_removed").notNull().default(0),
    avgConfidence: real("avg_confidence").notNull().default(0),
    lowConfidenceCount: integer("low_confidence_count").notNull().default(0),
    processingMs: integer("processing_ms").notNull().default(0),
    timeline: jsonb("timeline").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sync_demos_created_idx").on(table.createdAt)],
);

export type WaitlistSignup = typeof waitlistSignups.$inferSelect;
export type FeatureVote = typeof featureVotes.$inferSelect;
export type SyncDemo = typeof syncDemos.$inferSelect;
export type NewSyncDemo = typeof syncDemos.$inferInsert;
