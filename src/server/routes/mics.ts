import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { micEntries, micPhotos } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { photoStorage } from "../storage.js";

const ORG_ID = 1;

// Mic IDs are always text and always at least 2 digits, e.g. "7" -> "07".
// Centralized here so the padding rule lives in exactly one place.
function normalizeMicId(raw: string): string {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? trimmed.padStart(2, "0") : trimmed;
}

const EDITABLE_FIELDS = [
  "performer",
  "pronouns",
  "micColor",
  "placement",
  "sensitivity",
  "allergy",
  "notes",
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
    return reply.code(201).send(row);
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
    return row;
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
