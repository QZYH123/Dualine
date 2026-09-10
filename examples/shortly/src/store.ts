import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Link {
  slug: string;
  url: string;
  createdAt: number;
  clicks: number;
}

export interface Store {
  insert(slug: string, url: string): boolean;
  get(slug: string): Link | undefined;
  recordClick(slug: string): void;
  close(): void;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS links (
    slug       TEXT PRIMARY KEY,
    url        TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    clicks     INTEGER NOT NULL DEFAULT 0
  );
`;

export function openStore(path: string): Store {
  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  const insertStmt = db.prepare(
    "INSERT INTO links (slug, url, created_at) VALUES (?, ?, ?)",
  );
  const getStmt = db.prepare(
    "SELECT slug, url, created_at AS createdAt, clicks FROM links WHERE slug = ?",
  );
  const clickStmt = db.prepare(
    "UPDATE links SET clicks = clicks + 1 WHERE slug = ?",
  );

  return {
    insert(slug, url) {
      try {
        insertStmt.run(slug, url, Date.now());
        return true;
      } catch (err) {
        if (isUniqueViolation(err)) return false;
        throw err;
      }
    },

    get(slug) {
      return getStmt.get(slug) as Link | undefined;
    },

    recordClick(slug) {
      clickStmt.run(slug);
    },

    close() {
      db.close();
    },
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "SQLITE_CONSTRAINT_PRIMARYKEY"
  );
}
