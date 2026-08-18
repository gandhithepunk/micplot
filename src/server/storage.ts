import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";

const PHOTOS_DIR = process.env.PHOTOS_DIR ?? "./photos";

/**
 * Minimal storage interface. Every place in the app that touches photo
 * bytes goes through here, not `fs` directly -- so a hosted version can
 * later swap this implementation for S3/R2/etc. without changing routes.
 */
export interface PhotoStorage {
  save(buffer: Buffer, extension: string): Promise<string>; // returns a storage key
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalDiskStorage implements PhotoStorage {
  private dir = PHOTOS_DIR;

  private ready = fs.mkdir(this.dir, { recursive: true });

  async save(buffer: Buffer, extension: string): Promise<string> {
    await this.ready;
    const key = `${nanoid()}.${extension.replace(/^\./, "")}`;
    await fs.writeFile(path.join(this.dir, key), buffer);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.dir, safeKey(key)));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(this.dir, safeKey(key)), { force: true });
  }
}

// Guard against path traversal via a stored/requested key.
function safeKey(key: string): string {
  const base = path.basename(key);
  if (base !== key) throw new Error("Invalid storage key");
  return base;
}

export const photoStorage: PhotoStorage = new LocalDiskStorage();
