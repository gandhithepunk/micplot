import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./index.js";
import { orgs } from "./schema.js";
import { eq } from "drizzle-orm";

migrate(db, { migrationsFolder: "./src/server/db/migrations" });

// Belt-and-suspenders column checks: drizzle can record a migration as applied
// without executing the DDL if the db is in a partially-migrated state.
// Explicitly verify each schema addition and apply it if missing.
type ColInfo = { name: string };
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
