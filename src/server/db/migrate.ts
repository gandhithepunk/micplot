import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./index.js";
import { orgs } from "./schema.js";
import { eq } from "drizzle-orm";

// If a column was previously added manually (outside of Drizzle), the column
// exists in the DB but the migration isn't recorded in __drizzle_migrations.
// Drizzle will then crash trying to re-add it. Pre-record those migrations here
// so Drizzle sees them as already applied.
type ColInfo = { name: string };
sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL,
  created_at NUMERIC
)`);
type MigRow = { created_at: number };
const lastMig = sqlite.prepare(
  "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1"
).get() as MigRow | undefined;

// Migration 0002 adds mic_entries.character and shows.archived (when=1787168594063).
// Pre-record it if the column already exists but the migration isn't recorded yet.
const micColsPre = (sqlite.pragma("table_info(mic_entries)") as ColInfo[]).map(c => c.name);
if (micColsPre.includes("character") && (!lastMig || lastMig.created_at < 1787168594063)) {
  sqlite.exec(`INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('0002_shiny_captain_america', 1787168594063)`);
  console.log("Pre-recorded migration 0002 (columns already exist from manual migration).");
}

migrate(db, { migrationsFolder: "./src/server/db/migrations" });

// Belt-and-suspenders column checks: drizzle can record a migration as applied
// without executing the DDL if the db is in a partially-migrated state.
// Explicitly verify each schema addition and apply it if missing.
const micCols = (sqlite.pragma("table_info(mic_entries)") as ColInfo[]).map(c => c.name);
if (!micCols.includes("character")) {
  sqlite.exec("ALTER TABLE mic_entries ADD COLUMN character TEXT NOT NULL DEFAULT ''");
  console.log("Applied missing column: mic_entries.character");
}
const showCols = (sqlite.pragma("table_info(shows)") as ColInfo[]).map(c => c.name);
if (!showCols.includes("archived")) {
  sqlite.exec("ALTER TABLE shows ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  console.log("Applied missing column: shows.archived");
}

// Every install needs at least one org to hang shows/mics off of.
// This is org id 1 for a self-hosted single-org install. A future hosted
// version would create additional orgs through a real signup flow instead.
const existing = db.select().from(orgs).where(eq(orgs.id, 1)).get();
if (!existing) {
  db.insert(orgs).values({ id: 1, name: "Default Org" }).run();
  console.log("Seeded default org (id=1).");
}

console.log("Migrations complete.");
