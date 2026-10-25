import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error(
    "Usage: npm run restore -- <backup.sqlite> <new-destination.sqlite>. Existing destinations are never overwritten.",
  );
if ([destination, destination + "-wal", destination + "-shm"].some(existsSync))
  throw new Error(
    "Destination already exists. Restore to a new filename and verify it before switching the server.",
  );
const db = new DatabaseSync(resolve(source), { readOnly: true });
if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok")
  throw new Error("Backup integrity check failed.");
if (
  !db
    .prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'")
    .get()
)
  throw new Error("This is not an Uru database.");
mkdirSync(dirname(resolve(destination)), { recursive: true });
await backup(db, resolve(destination));
chmodSync(resolve(destination), 0o600);
db.close();
console.log("Restored and verified: " + destination);
