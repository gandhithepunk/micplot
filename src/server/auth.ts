import type { FastifyRequest, FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";

/**
 * Deliberately minimal for v0.1: one shared password for the whole crew,
 * a random session token stored in an httpOnly cookie. No per-user
 * identity yet.
 *
 * This exists as a REAL seam, not a placeholder: swapping this file's
 * internals for per-user accounts (magic link, OAuth, whatever) later
 * shouldn't require touching any route -- routes only ever call
 * `requireAuth`, they never know how auth is implemented.
 */

const APP_PASSWORD = process.env.APP_PASSWORD ?? "";
const COOKIE_NAME = "mic_plot_session";

// In-memory session store. Fine for a single-process self-hosted deploy;
// swap for a `sessions` table or Redis if you ever run multiple instances.
const sessions = new Set<string>();

export function checkPassword(password: string): boolean {
  if (!APP_PASSWORD) return true; // no password configured -> auth disabled
  return password === APP_PASSWORD;
}

export function createSession(): string {
  const token = randomBytes(24).toString("hex");
  sessions.add(token);
  return token;
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!APP_PASSWORD) return done(); // auth disabled for local/dev use

  const token = request.cookies[COOKIE_NAME];
  if (token && sessions.has(token)) return done();

  reply.code(401).send({ error: "Not authenticated" });
}

export { COOKIE_NAME };
