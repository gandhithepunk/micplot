import type { FastifyInstance } from "fastify";
import {
  checkPassword, createSession, COOKIE_NAME,
  checkAdminPin, createAdminSession, isAdminSession, ADMIN_COOKIE_NAME, ADMIN_PIN,
} from "../auth.js";

export async function authRoutes(app: FastifyInstance) {
  // ── Crew auth ─────────────────────────────────────────────────────────────
  app.post("/api/login", async (request, reply) => {
    const { password } = request.body as { password?: string };
    if (!checkPassword(password ?? "")) {
      return reply.code(401).send({ error: "Incorrect password" });
    }
    const token = createSession();
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return { ok: true };
  });

  app.post("/api/logout", async (_request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  // ── Admin auth ────────────────────────────────────────────────────────────
  // These routes are intentionally excluded from the crew requireAuth hook
  // in index.ts so that the admin login flow works independently.

  app.post("/api/admin/login", async (request, reply) => {
    const { pin } = request.body as { pin?: string };
    if (!checkAdminPin(pin ?? "")) {
      return reply.code(401).send({ error: "Incorrect PIN" });
    }
    const token = createAdminSession();
    reply.setCookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
    return { ok: true };
  });

  // admin.html calls this on load to decide whether to show the PIN overlay.
  app.get("/api/admin/check", async (request, reply) => {
    if (!ADMIN_PIN) return { ok: true };
    const token = request.cookies[ADMIN_COOKIE_NAME];
    if (token && isAdminSession(token)) return { ok: true };
    return reply.code(401).send({ ok: false });
  });

  app.post("/api/admin/logout", async (_request, reply) => {
    reply.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });
}
