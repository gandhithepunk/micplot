import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { chatMessages } from "../db/schema.js";
import { asc, eq } from "drizzle-orm";
import { broadcastChatMessage } from "./events.js";

const MAX_NAME_LENGTH = 60;
const MAX_BODY_LENGTH = 2000;

export async function chatRoutes(app: FastifyInstance) {
  // Full history for a show, oldest first -- the client appends new
  // messages onto this via SSE rather than re-fetching on every send.
  app.get("/api/shows/:showId/chat", async (request) => {
    const { showId } = request.params as { showId: string };
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.showId, Number(showId)))
      .orderBy(asc(chatMessages.id))
      .all();
  });

  app.post("/api/shows/:showId/chat", async (request, reply) => {
    const { showId } = request.params as { showId: string };
    const { senderName, body } = request.body as { senderName?: string; body?: string };

    const trimmedName = senderName?.trim() ?? "";
    const trimmedBody = body?.trim() ?? "";
    if (!trimmedName) return reply.code(400).send({ error: "senderName is required" });
    if (!trimmedBody) return reply.code(400).send({ error: "body is required" });
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return reply.code(400).send({ error: `senderName must be ${MAX_NAME_LENGTH} characters or fewer` });
    }
    if (trimmedBody.length > MAX_BODY_LENGTH) {
      return reply.code(400).send({ error: `body must be ${MAX_BODY_LENGTH} characters or fewer` });
    }

    const row = db
      .insert(chatMessages)
      .values({ showId: Number(showId), senderName: trimmedName, body: trimmedBody })
      .returning()
      .get();

    broadcastChatMessage(Number(showId), row);
    return reply.code(201).send(row);
  });
}
