import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { micPhotos } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { photoStorage } from "../storage.js";

export async function photosRoutes(app: FastifyInstance) {
  // Upload one or more photos for a mic entry (add multiple at once or
  // one at a time, from camera or library -- that choice is entirely a
  // client-side <input type="file" multiple> concern, this route just
  // accepts whatever files arrive).
  app.post("/api/mics/:id/photos", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parts = request.files();

    const saved = [];
    for await (const part of parts) {
      const buffer = await part.toBuffer();
      const extension = part.filename.split(".").pop() ?? "jpg";
      const key = await photoStorage.save(buffer, extension);
      const row = db
        .insert(micPhotos)
        .values({ micEntryId: Number(id), filename: key })
        .returning()
        .get();
      saved.push(row);
    }

    if (saved.length === 0) {
      return reply.code(400).send({ error: "No files received" });
    }
    return reply.code(201).send(saved);
  });

  // Serve a photo's bytes. The server fetches and re-serves the bytes
  // itself (never a redirect to a cross-origin URL) -- this is the fix
  // for the Safari/iPadOS broken-image issue from the prototype, and
  // stays correct even after a future swap to cloud storage as long as
  // this route still streams bytes through rather than redirecting.
  app.get("/api/photos/:filename", async (request, reply) => {
    const { filename } = request.params as { filename: string };
    try {
      const buffer = await photoStorage.read(filename);
      reply.type("image/jpeg").send(buffer);
    } catch {
      reply.code(404).send({ error: "Photo not found" });
    }
  });
}
