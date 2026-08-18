import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { shows } from "../db/schema.js";
import { eq } from "drizzle-orm";

// Hardcoded until real multi-org auth exists -- see notes in db/schema.ts.
const ORG_ID = 1;

export async function showsRoutes(app: FastifyInstance) {
  // List shows. ?active=true restricts to active-only (for crew-facing pickers).
  app.get("/api/shows", async (request) => {
    const { active } = request.query as { active?: string };
    const rows = db.select().from(shows).where(eq(shows.orgId, ORG_ID)).all();
    return active === "true" ? rows.filter((s) => s.active) : rows;
  });

  // Admin: add a show.
  app.post("/api/shows", async (request, reply) => {
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

  // Admin: rename a show or toggle active.
  app.patch("/api/shows/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{ code: string; name: string; active: boolean }>;
    const row = db
      .update(shows)
      .set(body)
      .where(eq(shows.id, Number(id)))
      .returning()
      .get();
    if (!row) return reply.code(404).send({ error: "Show not found" });
    return row;
  });
}
