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

// ── Crew auth (APP_PASSWORD) ─────────────────────────────────────────────────
const APP_PASSWORD = process.env.APP_PASSWORD ?? "";
const COOKIE_NAME = "mic_plot_session";

const sessions = new Set<string>();

export function checkPassword(password: string): boolean {
  if (!APP_PASSWORD) return true;
  return password === APP_PASSWORD;
}

export function createSession(): string {
  const token = randomBytes(24).toString("hex");
  sessions.add(token);
  return token;
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!APP_PASSWORD) return done();
  const token = request.cookies[COOKIE_NAME];
  if (token && sessions.has(token)) return done();
  reply.code(401).send({ error: "Not authenticated" });
}

export { COOKIE_NAME };

// ── Admin auth (ADMIN_PIN) ────────────────────────────────────────────────────
const ADMIN_PIN = process.env.ADMIN_PIN ?? "";
const ADMIN_COOKIE_NAME = "mic_plot_admin";

const adminSessions = new Set<string>();

export function checkAdminPin(pin: string): boolean {
  if (!ADMIN_PIN) return true; // no PIN configured -> admin open
  return pin === ADMIN_PIN;
}

export function createAdminSession(): string {
  const token = randomBytes(24).toString("hex");
  adminSessions.add(token);
  return token;
}

export function isAdminSession(token: string): boolean {
  return adminSessions.has(token);
}

export function requireAdminAuth(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!ADMIN_PIN) return done();
  const token = request.cookies[ADMIN_COOKIE_NAME];
  if (token && adminSessions.has(token)) return done();
  reply.code(401).send({ error: "Admin access required" });
}

export { ADMIN_COOKIE_NAME, ADMIN_PIN };
