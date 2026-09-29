import type { FastifyInstance } from "fastify";
import {
  checkPassword, createSession, COOKIE_NAME,
  checkAdminPin, createAdminSession, isAdminSession, ADMIN_COOKIE_NAME, isAdminPinConfigured,
  requireAdminAuth, getServerAccessStatus, setAppPassword, setAdminPin, generateApiToken, clearApiToken,
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
    if (!isAdminPinConfigured()) return { ok: true };
    const token = request.cookies[ADMIN_COOKIE_NAME];
    if (token && isAdminSession(token)) return { ok: true };
    return reply.code(401).send({ ok: false });
  });

  app.post("/api/admin/logout", async (_request, reply) => {
    reply.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  // ── Server Access settings (Admin > Server Access panel) ───────────────────
  app.get("/api/admin/settings", { preHandler: requireAdminAuth }, async () => {
    return getServerAccessStatus();
  });

  app.patch("/api/admin/settings/app-password", { preHandler: requireAdminAuth }, async (request) => {
    const { password } = request.body as { password: string | null };
    setAppPassword(password);
    return getServerAccessStatus();
  });

  app.patch("/api/admin/settings/admin-pin", { preHandler: requireAdminAuth }, async (request, reply) => {
    const { pin } = request.body as { pin: string | null };
    setAdminPin(pin);
    // Setting a PIN can transition admin from open to gated. Without this,
    // the current browser -- which got here via the open-access bypass, not
    // an actual PIN login -- would lock itself out on its very next admin
    // request, since it has no session cookie to back one up.
    if (pin) {
      const token = createAdminSession();
      reply.setCookie(ADMIN_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
    }
    return getServerAccessStatus();
  });

  app.post("/api/admin/settings/api-token/generate", { preHandler: requireAdminAuth }, async () => {
    const token = generateApiToken();
    return { token };
  });

  app.delete("/api/admin/settings/api-token", { preHandler: requireAdminAuth }, async (_request, reply) => {
    clearApiToken();
    return reply.code(204).send();
  });
}
