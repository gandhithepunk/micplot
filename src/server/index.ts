import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import fastifyCookie from "@fastify/cookie";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { showsRoutes } from "./routes/shows.js";
import { micsRoutes } from "./routes/mics.js";
import { photosRoutes } from "./routes/photos.js";
import { eventsRoutes } from "./routes/events.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

const app = Fastify({ logger: true });

await app.register(fastifyCookie);
await app.register(fastifyMultipart);

// Serve the built frontend (see src/client). In dev, run the client's own
// dev server separately and point it at this API instead.
await app.register(fastifyStatic, {
  root: path.join(__dirname, "../client"),
});

// Everything under /api requires auth (a no-op if APP_PASSWORD isn't set).
app.addHook("onRequest", (request, reply, done) => {
  if (request.url.startsWith("/api") && request.url !== "/api/login") {
    return requireAuth(request, reply, done);
  }
  done();
});

await app.register(authRoutes);
await app.register(showsRoutes);
await app.register(micsRoutes);
await app.register(photosRoutes);
await app.register(eventsRoutes);

app.get("/health", async () => ({ ok: true }));

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
