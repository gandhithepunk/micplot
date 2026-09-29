import type { FastifyRequest, FastifyReply } from "fastify";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db/index.js";
import { appSettings } from "./db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Deliberately minimal for v0.1: one shared password for the whole crew,
 * a random session token stored in an httpOnly cookie. No per-user
 * identity yet.
 *
 * This exists as a REAL seam, not a placeholder: swapping this file's
 * internals for per-user accounts (magic link, OAuth, whatever) later
 * shouldn't require touching any route -- routes only ever call
 * `requireAuth`, they never know how auth is implemented.
 *
 * All three secrets below (crew password, admin PIN, API token) can be set
 * two ways: env vars (APP_PASSWORD/ADMIN_PIN/API_TOKEN -- set at deploy
 * time, needs a restart to change) or the Admin > Server Access panel
 * (stored in the app_settings table -- live, no restart). A DB-stored
 * value always wins over the env var when both are set; clearing it in
 * Admin falls back to the env var, so the env var stays a working
 * bootstrap/recovery path even after the panel has been used.
 */

const SETTINGS_ID = 1;

function getSettingsRow() {
  return db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID)).get();
}

function upsertSettings(
  patch: Partial<{ appPassword: string | null; adminPin: string | null; apiTokenHash: string | null }>
): void {
  const existing = getSettingsRow();
  const values = { ...patch, updatedAt: new Date().toISOString() };
  if (existing) {
    db.update(appSettings).set(values).where(eq(appSettings.id, SETTINGS_ID)).run();
  } else {
    db.insert(appSettings)
      .values({ id: SETTINGS_ID, ...values })
      .run();
  }
}

// ── Crew auth (APP_PASSWORD) ─────────────────────────────────────────────────
const APP_PASSWORD_ENV = process.env.APP_PASSWORD ?? "";
const COOKIE_NAME = "mic_plot_session";

const sessions = new Set<string>();

function effectiveAppPassword(): string {
  return getSettingsRow()?.appPassword || APP_PASSWORD_ENV;
}

export function checkPassword(password: string): boolean {
  const effective = effectiveAppPassword();
  if (!effective) return true;
  return password === effective;
}

export function createSession(): string {
  const token = randomBytes(24).toString("hex");
  sessions.add(token);
  return token;
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (!effectiveAppPassword()) return done();
  if (hasValidApiToken(request)) return done();
  const token = request.cookies[COOKIE_NAME];
  if (token && sessions.has(token)) return done();
  reply.code(401).send({ error: "Not authenticated" });
}

export { COOKIE_NAME };

// ── API token auth (for machine clients, e.g. a Bitfocus Companion module) ──
// Stored as a one-way hash -- there's no "look it up later" for this one,
// only regenerate. The env var fallback stays a plain string comparison,
// same as before, since it was never hashable (the operator sets it
// directly and can already see it in their own environment).
const API_TOKEN_ENV = process.env.API_TOKEN ?? "";

function hashSecret(value: string, salt: string): string {
  return scryptSync(value, salt, 64).toString("hex");
}

function hashApiToken(token: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashSecret(token, salt)}`;
}

function verifyApiToken(token: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = Buffer.from(hashSecret(token, salt), "hex");
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function hasValidApiToken(request: FastifyRequest): boolean {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  if (!provided) return false;

  const storedHash = getSettingsRow()?.apiTokenHash;
  if (storedHash) return verifyApiToken(provided, storedHash);
  if (API_TOKEN_ENV) return provided === API_TOKEN_ENV;
  return false;
}

// ── Admin auth (ADMIN_PIN) ────────────────────────────────────────────────────
const ADMIN_PIN_ENV = process.env.ADMIN_PIN ?? "";
const ADMIN_COOKIE_NAME = "mic_plot_admin";

const adminSessions = new Set<string>();

function effectiveAdminPin(): string {
  return getSettingsRow()?.adminPin || ADMIN_PIN_ENV;
}

export function checkAdminPin(pin: string): boolean {
  const effective = effectiveAdminPin();
  if (!effective) return true;
  return pin === effective;
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
  if (!effectiveAdminPin()) return done();
  const token = request.cookies[ADMIN_COOKIE_NAME];
  if (token && adminSessions.has(token)) return done();
  reply.code(401).send({ error: "Admin access required" });
}

/** Whether admin.html should show the PIN overlay at all. */
export function isAdminPinConfigured(): boolean {
  return !!effectiveAdminPin();
}

export { ADMIN_COOKIE_NAME };

// ── Server Access settings (Admin-panel-editable secrets) ───────────────────
export interface ServerAccessStatus {
  appPasswordSet: boolean;
  appPassword: string; // effective value, plaintext -- shown in Admin for lookup
  adminPinSet: boolean;
  adminPin: string; // effective value, plaintext
  apiTokenSet: boolean; // the token itself is never returned once hashed
}

export function getServerAccessStatus(): ServerAccessStatus {
  const row = getSettingsRow();
  return {
    appPasswordSet: !!(row?.appPassword || APP_PASSWORD_ENV),
    appPassword: effectiveAppPassword(),
    adminPinSet: !!(row?.adminPin || ADMIN_PIN_ENV),
    adminPin: effectiveAdminPin(),
    apiTokenSet: !!(row?.apiTokenHash || API_TOKEN_ENV),
  };
}

export function setAppPassword(password: string | null): void {
  upsertSettings({ appPassword: password?.trim() || null });
}

export function setAdminPin(pin: string | null): void {
  upsertSettings({ adminPin: pin?.trim() || null });
}

/**
 * Generates a new random API token, stores its hash, and returns the
 * plaintext token. This is the only time the plaintext is ever available --
 * copy it into the Companion module's config now.
 */
export function generateApiToken(): string {
  const token = randomBytes(24).toString("hex");
  upsertSettings({ apiTokenHash: hashApiToken(token) });
  return token;
}

export function clearApiToken(): void {
  upsertSettings({ apiTokenHash: null });
}
