import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

/**
 * `orgs` exists from day one even though this app is single-org today.
 * Every other table hangs off an org_id so that a future hosted/multi-tenant
 * version doesn't require a schema rewrite -- just stop assuming org 1.
 */
export const orgs = sqliteTable("orgs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * Admin-managed list of shows. `active` drives crew-facing pickers;
 * retired shows stay in the DB so their mic history is never lost.
 */
export const shows = sqliteTable("shows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orgId: integer("org_id")
    .notNull()
    .references(() => orgs.id),
  code: text("code").notNull(), // short code, e.g. "HAM"
  name: text("name").notNull(), // display name, e.g. "Hamlet"
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

/**
 * One row per Show + Mic combination -- the same physical mic pack can
 * carry completely different info per show. micId is TEXT on purpose:
 * see the leading-zero lesson in the project handoff. Never infer it as
 * a number anywhere in the app.
 */
export const micEntries = sqliteTable(
  "mic_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgId: integer("org_id")
      .notNull()
      .references(() => orgs.id),
    showId: integer("show_id")
      .notNull()
      .references(() => shows.id),
    micId: text("mic_id").notNull(), // e.g. "01", "02" -- always text

    performer: text("performer").notNull().default(""),
    pronouns: text("pronouns").notNull().default(""), // preset value OR free-text custom
    micColor: text("mic_color").notNull().default(""), // Light Beige / Tan / Cocoa / Black / White
    placement: text("placement").notNull().default(""), // Hairline/Wigline / Right Ear / Left Ear
    sensitivity: text("sensitivity").notNull().default(""), // dB value as free text, e.g. "-6"
    allergy: text("allergy").notNull().default(""), // flagged red in UI when non-empty
    notes: text("notes").notNull().default(""),

    // Not started / Mic'd / Checked -- only ever written from the dashboard,
    // never from the mic entry form. Enforce that in the route layer, not here.
    status: text("status", { enum: ["not_started", "miced", "checked"] })
      .notNull()
      .default("not_started"),

    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    // A given mic can only have one row per show.
    showMicUnique: uniqueIndex("show_mic_unique").on(table.showId, table.micId),
  })
);

/** Multiple photos per mic entry. Stored on local disk behind a small
 * storage interface (see storage.ts) so swapping to S3/R2 later for a
 * hosted version doesn't touch the rest of the app. */
export const micPhotos = sqliteTable("mic_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  micEntryId: integer("mic_entry_id")
    .notNull()
    .references(() => micEntries.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(), // storage key, not a full path
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// --- relations (for Drizzle's relational query API) ---

export const showsRelations = relations(shows, ({ many }) => ({
  micEntries: many(micEntries),
}));

export const micEntriesRelations = relations(micEntries, ({ one, many }) => ({
  show: one(shows, { fields: [micEntries.showId], references: [shows.id] }),
  photos: many(micPhotos),
}));

export const micPhotosRelations = relations(micPhotos, ({ one }) => ({
  micEntry: one(micEntries, {
    fields: [micPhotos.micEntryId],
    references: [micEntries.id],
  }),
}));
