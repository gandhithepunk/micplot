import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index.js";
import { orgs } from "./schema.js";
import { eq } from "drizzle-orm";

migrate(db, { migrationsFolder: "./src/server/db/migrations" });

// Every install needs at least one org to hang shows/mics off of.
// This is org id 1 for a self-hosted single-org install. A future hosted
// version would create additional orgs through a real signup flow instead.
const existing = db.select().from(orgs).where(eq(orgs.id, 1)).get();
if (!existing) {
  db.insert(orgs).values({ id: 1, name: "Default Org" }).run();
  console.log("Seeded default org (id=1).");
}

console.log("Migrations complete.");
