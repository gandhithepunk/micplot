import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { micEntries, micPhotos } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { photoStorage } from "../storage.js";
import { broadcastShow } from "./events.js";
import { requireAdminAuth } from "../auth.js";

const ORG_ID = 1;

// Mic IDs are always text and always at least 2 digits, e.g. "7" -> "07".
// Centralized here so the padding rule lives in exactly one place.
function normalizeMicId(raw: string): string {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? trimmed.padStart(2, "0") : trimmed;
}

const EDITABLE_FIELDS = [
  "performer",
  "character",
  "pronouns",
  "micColor",
  "placement",
  "sensitivity",
  "allergy",
  "notes",
  "micModel",
  "frequency",
  "packModel",
] as const;

export async function micsRoutes(app: FastifyInstance) {
  // Dashboard grid: every mic logged for a show.
  app.get("/api/shows/:showId/mics", async (request) => {
    const { showId } = request.params as { showId: string };
    return db
      .select()
      .from(micEntries)
      .where(and(eq(micEntries.orgId, ORG_ID), eq(micEntries.showId, Number(showId))))
      .all();
  });

  // Mic switcher dropdown on the entry form: same data as above, this route
  // exists separately so the client intent (populating the switcher vs.
  // rendering the dashboard grid) stays distinct even though the query
  // is currently identical -- they're free to diverge later (e.g. the
  // switcher might want performer name only, no photos).
  app.get("/api/shows/:showId/mics/switcher", async (request) => {
    const { showId } = request.params as { showId: string };
    const rows = db
      .select({
        micId: micEntries.micId,
        performer: micEntries.performer,
      })
      .from(micEntries)
      .where(and(eq(micEntries.orgId, ORG_ID), eq(micEntries.showId, Number(showId))))
      .all();
    return rows.sort((a, b) => a.micId.localeCompare(b.micId, undefined, { numeric: true }));
  });

  // Fetch (or confirm absence of) a specific Show+Mic row -- powers the
  // "pick a show, then pre-fill or leave blank" behavior on the entry form.
  app.get("/api/shows/:showId/mics/:micId", async (request, reply) => {
    const { showId, micId } = request.params as { showId: string; micId: string };
    const normalized = normalizeMicId(micId);
    const row = db
      .select()
      .from(micEntries)
      .where(
        and(
          eq(micEntries.orgId, ORG_ID),
          eq(micEntries.showId, Number(showId)),
          eq(micEntries.micId, normalized)
        )
      )
      .get();
    if (!row) return reply.code(404).send({ error: "No entry yet for this mic/show" });

    const photos = db
      .select()
      .from(micPhotos)
      .where(eq(micPhotos.micEntryId, row.id))
      .all();
    return { ...row, photos };
  });

  // Create or update a Show+Mic row from the mic entry form OR the
  // dashboard's edit view. Deliberately never accepts `status` -- see
  // the dedicated status route below. Status is the dashboard's job only.
  app.put("/api/shows/:showId/mics/:micId", async (request, reply) => {
    const { showId, micId } = request.params as { showId: string; micId: string };
    const normalized = normalizeMicId(micId);
    const body = request.body as Partial<Record<(typeof EDITABLE_FIELDS)[number], string>>;

    const patch: Record<string, string> = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) patch[field] = body[field]!;
    }

    const existing = db
      .select()
      .from(micEntries)
      .where(
        and(
          eq(micEntries.orgId, ORG_ID),
          eq(micEntries.showId, Number(showId)),
          eq(micEntries.micId, normalized)
        )
      )
      .get();

    if (existing) {
      const row = db
        .update(micEntries)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(micEntries.id, existing.id))
        .returning()
        .get();
      broadcastShow(Number(showId));
      return row;
    }

    const row = db
      .insert(micEntries)
      .values({
        orgId: ORG_ID,
        showId: Number(showId),
        micId: normalized,
        ...patch,
      })
      .returning()
      .get();
    broadcastShow(Number(showId));
    return reply.code(201).send(row);
  });

  // Admin: bulk-create mic stubs 01–N for a show.
  // Skips mic IDs that already exist so it's safe to call repeatedly
  // (e.g. adding more mics to a partially set-up show).
  app.post("/api/shows/:showId/mics/bulk", { preHandler: requireAdminAuth }, async (request, reply) => {
    const { showId } = request.params as { showId: string };
    const { count } = request.body as { count: number };

    if (!Number.isInteger(count) || count < 1 || count > 99) {
      return reply.code(400).send({ error: "count must be a whole number between 1 and 99" });
    }

    const existing = new Set(
      db
        .select({ micId: micEntries.micId })
        .from(micEntries)
        .where(and(eq(micEntries.orgId, ORG_ID), eq(micEntries.showId, Number(showId))))
        .all()
        .map((r) => r.micId)
    );

    const created: string[] = [];
    for (let i = 1; i <= count; i++) {
      const micId = String(i).padStart(2, "0");
      if (existing.has(micId)) continue;
      db.insert(micEntries)
        .values({ orgId: ORG_ID, showId: Number(showId), micId })
        .run();
      created.push(micId);
    }

    if (created.length > 0) broadcastShow(Number(showId));
    return reply.code(201).send({ created: created.length, skipped: count - created.length });
  });

  // Dashboard-only: instant-save status toggle, no separate save step.
  app.patch("/api/mics/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: "not_started" | "miced" | "checked" };
    if (!["not_started", "miced", "checked"].includes(status)) {
      return reply.code(400).send({ error: "Invalid status" });
    }
    const row = db
      .update(micEntries)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(micEntries.id, Number(id)))
      .returning()
      .get();
    if (!row) return reply.code(404).send({ error: "Mic entry not found" });
    broadcastShow(row.showId);
    return row;
  });

  // Delete a mic entry and all its photos (files + DB rows).
  // DB cascade handles mic_photos rows; we clean up files manually first.
  app.delete("/api/mics/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const photos = db
      .select()
      .from(micPhotos)
      .where(eq(micPhotos.micEntryId, Number(id)))
      .all();

    const deleted = db
      .delete(micEntries)
      .where(eq(micEntries.id, Number(id)))
      .returning()
      .get();
    if (!deleted) return reply.code(404).send({ error: "Mic entry not found" });

    for (const photo of photos) {
      await photoStorage.delete(photo.filename).catch(() => {});
    }

    broadcastShow(deleted.showId);
    return reply.code(204).send();
  });

  // Remove a single photo from an entry (individually removable, per the
  // entry-form gallery behavior).
  app.delete("/api/mics/:id/photos/:photoId", async (request, reply) => {
    const { photoId } = request.params as { id: string; photoId: string };
    const photo = db.select().from(micPhotos).where(eq(micPhotos.id, Number(photoId))).get();
    if (!photo) return reply.code(404).send({ error: "Photo not found" });
    await photoStorage.delete(photo.filename);
    db.delete(micPhotos).where(eq(micPhotos.id, Number(photoId))).run();
    return reply.code(204).send();
  });
}
