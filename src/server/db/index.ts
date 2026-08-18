import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import path from "node:path";
import fs from "node:fs";

const DATABASE_PATH = process.env.DATABASE_PATH ?? "./data/mic-plot.db";

// Make sure the parent directory exists (e.g. a mounted Docker volume).
fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const sqlite = new Database(DATABASE_PATH);
sqlite.pragma("journal_mode = WAL"); // better concurrent read/write behavior
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
