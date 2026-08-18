import type { FastifyInstance } from "fastify";
import { checkPassword, createSession, COOKIE_NAME } from "../auth.js";

export async function authRoutes(app: FastifyInstance) {
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
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return { ok: true };
  });

  app.post("/api/logout", async (request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  });
}
