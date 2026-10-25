import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { makeSeeds } from "../src/shared/seeds";
import type { RecordData } from "../src/shared/schema";
export const uid = () => randomUUID();
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function openDatabase(path: string) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  db.exec(readFileSync(new URL("./001_initial.sql", import.meta.url), "utf8"));
  if (
    !db.prepare("SELECT version FROM schema_migrations WHERE version=2").get()
  )
    db.exec(
      readFileSync(
        new URL("./002_catalog_archive.sql", import.meta.url),
        "utf8",
      ),
    );
  if (
    !db.prepare("SELECT version FROM schema_migrations WHERE version=3").get()
  )
    db.exec(
      readFileSync(new URL("./003_onboarding.sql", import.meta.url), "utf8"),
    );
  if (
    !db.prepare("SELECT version FROM schema_migrations WHERE version=4").get()
  )
    db.exec(
      readFileSync(new URL("./004_indexes.sql", import.meta.url), "utf8"),
    );
  if (
    !db.prepare("SELECT version FROM schema_migrations WHERE version=5").get()
  )
    db.exec(
      readFileSync(
        new URL("./005_reply_idempotency.sql", import.meta.url),
        "utf8",
      ),
    );
  return db;
}
export type DB = ReturnType<typeof openDatabase>;
export function one(db: DB, sql: string, ...args: any[]): any {
  return db.prepare(sql).get(...args);
}
export function all(db: DB, sql: string, ...args: any[]): any[] {
  return db.prepare(sql).all(...args);
}
export function run(db: DB, sql: string, ...args: any[]) {
  return db.prepare(sql).run(...args);
}
export function transaction<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function audit(
  db: DB,
  workspace: string,
  actor: string | null,
  action: string,
  entity: string,
) {
  run(
    db,
    "INSERT INTO audit(id,workspace_id,actor_id,action,entity_id) VALUES(?,?,?,?,?)",
    uid(),
    workspace,
    actor,
    action,
    entity,
  );
}
export function publicRecords(
  db: DB,
  siteId: string,
  includeArchived = false,
): (RecordData & { archived?: number })[] {
  return all(
    db,
    `SELECT id,kind,name,description,price,image,category,duration${includeArchived ? ",archived" : ""} FROM catalog WHERE site_id=?${includeArchived ? "" : " AND archived=0"}`,
    siteId,
  ).map((row) => ({
    ...row,
    variants: all(
      db,
      "SELECT id,name,stock FROM variants WHERE record_id=?",
      row.id,
    ),
  }));
}
export function createWorkspace(db: DB, userId: string, name: string) {
  const id = uid();
  run(db, "INSERT INTO workspaces(id,name) VALUES(?,?)", id, name);
  run(db, "INSERT INTO memberships VALUES(?,?,?)", userId, id, "owner");
  for (const seed of makeSeeds()) {
    const siteId = uid();
    const doc = structuredClone(seed.document);
    const recordMap = new Map(seed.records.map((r) => [r.id, uid()]));
    run(
      db,
      "INSERT INTO sites(id,workspace_id,slug,name,theme,business,draft) VALUES(?,?,?,?,?,?,?)",
      siteId,
      id,
      `${seed.slug}-${id.slice(0, 6)}`,
      seed.name,
      seed.theme,
      JSON.stringify(seed.business),
      JSON.stringify(doc),
    );
    run(
      db,
      "UPDATE sites SET business_type=?,goal=? WHERE id=?",
      seed.theme === "shop"
        ? "products"
        : seed.theme === "salon"
          ? "bookings"
          : "services",
      seed.theme === "shop"
        ? "Борлуулалт"
        : seed.theme === "salon"
          ? "Цаг захиалах"
          : "Хүсэлт цуглуулах",
      siteId,
    );
    for (const r of seed.records) {
      const rid = recordMap.get(r.id)!;
      run(
        db,
        "INSERT INTO catalog(id,workspace_id,site_id,kind,name,description,price,image,category,duration) VALUES(?,?,?,?,?,?,?,?,?,?)",
        rid,
        id,
        siteId,
        r.kind,
        r.name,
        r.description,
        r.price,
        r.image,
        r.category,
        r.duration ?? null,
      );
      for (const v of r.variants)
        run(
          db,
          "INSERT INTO variants VALUES(?,?,?,?)",
          uid(),
          rid,
          v.name,
          v.stock,
        );
    }
  }
  return id;
}
export function expireOrders(db: DB) {
  const expired = all(
    db,
    "SELECT id FROM orders WHERE status='awaiting_payment' AND expires<?",
    Date.now(),
  );
  for (const order of expired) {
    run(
      db,
      "UPDATE orders SET status='expired' WHERE id=? AND status='awaiting_payment'",
      order.id,
    );
    for (const item of all(
      db,
      "SELECT variant_id,quantity FROM order_items WHERE order_id=?",
      order.id,
    ))
      run(
        db,
        "UPDATE variants SET stock=stock+? WHERE id=?",
        item.quantity,
        item.variant_id,
      );
    run(
      db,
      "UPDATE payment_attempts SET status='expired' WHERE order_id=? AND status='pending'",
      order.id,
    );
  }
}
