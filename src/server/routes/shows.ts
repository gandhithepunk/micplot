import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { shows, micEntries, micPhotos } from "../db/schema.js";
import { and, eq } from "drizzle-orm";
import { photoStorage } from "../storage.js";
import { requireAdminAuth } from "../auth.js";

// Hardcoded until real multi-org auth exists -- see notes in db/schema.ts.
const ORG_ID = 1;

export async function showsRoutes(app: FastifyInstance) {
  function parseFieldConfig(raw: string | null) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  // List shows. ?active=true restricts to active-only (for crew-facing pickers).
  app.get("/api/shows", async (request) => {
    const { active } = request.query as { active?: string };
    const rows = db.select().from(shows).where(eq(shows.orgId, ORG_ID)).all();
    const filtered = active === "true" ? rows.filter((s) => s.active && !s.archived) : rows;
    return filtered.map(s => ({ ...s, fieldConfig: parseFieldConfig(s.fieldConfig) }));
  });

  // Admin: add a show.
  app.post("/api/shows", { preHandler: requireAdminAuth }, async (request, reply) => {
    const body = request.body as { code: string; name: string };
    if (!body.code?.trim() || !body.name?.trim()) {
      return reply.code(400).send({ error: "code and name are required" });
    }
    const row = db
      .insert(shows)
      .values({ orgId: ORG_ID, code: body.code.trim(), name: body.name.trim() })
      .returning()
      .get();
    return reply.code(201).send(row);
  });

  // Admin: permanently delete a show and all its mic entries + photo files.
  // Intended for archived (inactive) shows only — the admin UI enforces the
  // archive-first step, but the server doesn't block active show deletion.
  app.delete("/api/shows/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Collect all mic entries so we can clean up their photo files
    const entries = db
      .select()
      .from(micEntries)
      .where(and(eq(micEntries.orgId, ORG_ID), eq(micEntries.showId, Number(id))))
      .all();

    for (const entry of entries) {
      const photos = db
        .select()
        .from(micPhotos)
        .where(eq(micPhotos.micEntryId, entry.id))
        .all();
      for (const photo of photos) {
        await photoStorage.delete(photo.filename).catch(() => {});
      }
      db.delete(micEntries).where(eq(micEntries.id, entry.id)).run();
    }

    const deleted = db
      .delete(shows)
      .where(and(eq(shows.id, Number(id)), eq(shows.orgId, ORG_ID)))
      .returning()
      .get();
    if (!deleted) return reply.code(404).send({ error: "Show not found" });

    return reply.code(204).send();
  });

  // Admin: rename a show, toggle active/archived, or update field config.
  app.patch("/api/shows/:id", { preHandler: requireAdminAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      code: string;
      name: string;
      active: boolean;
      archived: boolean;
      fieldConfig: Record<string, boolean> | null;
    }>;

    // Explicit allowlist prevents arbitrary fields leaking into the DB.
    const patch: Record<string, unknown> = {};
    if (body.code     !== undefined) patch.code     = body.code;
    if (body.name     !== undefined) patch.name     = body.name;
    if (body.active   !== undefined) patch.active   = body.active;
    if (body.archived !== undefined) patch.archived = body.archived;
    if ("fieldConfig" in body) {
      patch.fieldConfig = body.fieldConfig !== null ? JSON.stringify(body.fieldConfig) : null;
    }

    const row = db
      .update(shows)
      .set(patch)
      .where(eq(shows.id, Number(id)))
      .returning()
      .get();
    if (!row) return reply.code(404).send({ error: "Show not found" });
    return { ...row, fieldConfig: parseFieldConfig(row.fieldConfig) };
  });
}
