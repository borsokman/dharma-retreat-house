import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type Db = Database.Database;

const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

/**
 * Open the database file (created if missing) and bring its STRUCTURE up to date.
 * This never recreates or empties anything: migrations that already ran are skipped.
 */
export function openDb(file: string, migrationsDir: string = DEFAULT_MIGRATIONS_DIR): Db {
  const db = new Database(file);
  db.pragma("journal_mode = WAL"); // stored in the file; harmless for :memory:
  db.pragma("foreign_keys = ON"); // per connection: SQLite forgets it, so set it every time
  db.pragma("busy_timeout = 5000"); // wait up to 5 s if another writer holds the lock
  migrate(db, migrationsDir);
  return db;
}

/**
 * Apply NNN_name.sql files in order. The database file remembers how many it has
 * applied in PRAGMA user_version, so each file runs exactly once, in its own
 * transaction (a failing migration leaves the database untouched).
 */
export function migrate(db: Db, dir: string): number {
  const files = readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  let version = db.pragma("user_version", { simple: true }) as number;

  for (const file of files) {
    const n = Number.parseInt(file.slice(0, 3), 10);
    if (n <= version) continue; // already applied
    if (n !== version + 1) {
      throw new Error(`migration gap: database is at ${version}, next file is ${file}`);
    }
    const sql = readFileSync(join(dir, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${n}`);
    })();
    version = n;
  }
  return version;
}
