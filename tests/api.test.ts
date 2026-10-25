import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { backup } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { createApp } from "../server/app";
import { openDatabase, one, all, run, hash } from "../server/db";
import { findNode, walk, moveNode } from "../src/shared/schema";
const directory = mkdtempSync(join(tmpdir(), "uru-test-"));
const dbPath = join(directory, "test.sqlite");
const db = openDatabase(dbPath);
const { app } = createApp(db);
const server = app.listen(0, "127.0.0.1");
let base = "";
let alice = "",
  bob = "",
  ws = "",
  otherWs = "";
let sites: any[] = [];
async function req(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = alice,
  headers: Record<string, string> = {},
) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return {
    status: res.status,
    data,
    cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
before(async () => {
  await new Promise<void>((resolve) =>
    server.listening ? resolve() : server.once("listening", () => resolve()),
  );
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  const a = await req(
    "/auth/register",
    "POST",
    {
      email: "alice@example.test",
      password: "correct horse battery",
      name: "Alice",
      workspaceName: "Alice demo",
    },
    "",
  );
  assert.equal(a.status, 201);
  alice = a.cookie;
  const b = await req(
    "/auth/register",
    "POST",
    {
      email: "bob@example.test",
      password: "correct horse battery",
      name: "Bob",
      workspaceName: "Bob demo",
    },
    "",
  );
  bob = b.cookie;
  ws = (await req("/me")).data.workspaces[0].id;
  otherWs = (await req("/me", "GET", undefined, bob)).data.workspaces[0].id;
  sites = (await req(`/w/${ws}/dashboard`)).data.sites;
  for (const site of sites) {
    const p = await req(`/w/${ws}/sites/${site.id}/publish`, "POST", {
      baseVersion: 1,
    });
    assert.equal(p.status, 201, p.data.error);
  }
});
after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  db.close();
  const restored = openDatabase(dbPath);
  assert.ok(one(restored, "SELECT COUNT(*) count FROM inquiries").count > 0);
  assert.equal(one(restored, "PRAGMA integrity_check").integrity_check, "ok");
  restored.close();
  rmSync(directory, { recursive: true, force: true });
});
test("real sessions, workspace boundaries, staff permissions and CSRF checks", async () => {
  assert.equal((await req("/me", "GET", undefined, "")).status, 401);
  assert.equal(
    (await req(`/w/${ws}/dashboard`, "GET", undefined, bob)).status,
    404,
  );
  assert.equal(
    (await req(`/w/${ws}/sites/${sites[0].id}`, "GET", undefined, bob)).status,
    404,
  );
  assert.equal(
    (
      await req(`/w/${ws}/team`, "POST", {
        email: "bob@example.test",
        role: "staff",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(
        `/w/${ws}/sites/${sites[0].id}/publish`,
        "POST",
        { baseVersion: 1 },
        bob,
      )
    ).status,
    403,
  );
  assert.equal((await req(`/w/${ws}/catalog`, "POST", {}, bob)).status, 403);
  assert.equal((await req(`/w/${otherWs}/dashboard`)).status, 404);
  assert.equal(
    (
      await req(
        `/w/${ws}/integrations/meta-test`,
        "POST",
        { connect: true },
        alice,
        { Origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        "/auth/login",
        "POST",
        { email: "alice@example.test", password: "wrong" },
        "",
      )
    ).status,
    401,
  );
});
test("editor save conflicts, draft isolation, immutable publication, rollback and persisted inquiries", async () => {
  const site = sites.find((s) => s.theme === "studio");
  const draft = (await req(`/w/${ws}/sites/${site.id}`)).data;
  const first = draft.document.root.children[0].children[0];
  first.props.text = "Owner edited studio";
  const save = await req(`/w/${ws}/sites/${site.id}`, "PUT", {
    document: draft.document,
    baseVersion: draft.draftVersion,
  });
  assert.equal(save.status, 200);
  assert.equal(
    (
      await req(`/w/${ws}/sites/${site.id}`, "PUT", {
        document: draft.document,
        baseVersion: 1,
      })
    ).status,
    409,
  );
  const publicBefore = (await req("/public/" + site.slug)).data;
  assert.notEqual(
    publicBefore.document.root.children[0].children[0].props.text,
    "Owner edited studio",
  );
  const firstRevision = one(
    db,
    "SELECT published_id FROM sites WHERE id=?",
    site.id,
  ).published_id;
  const published = await req(`/w/${ws}/sites/${site.id}/publish`, "POST", {
    baseVersion: 2,
  });
  assert.equal(published.status, 201);
  assert.equal(
    (await req("/public/" + site.slug)).data.document.root.children[0]
      .children[0].props.text,
    "Owner edited studio",
  );
  const result = await req(
    "/public/" + site.slug + "/inquiries",
    "POST",
    {
      name: "Зочин Болор",
      contact: "99112233",
      message: "86 м² орон сууцны интерьер",
      projectType: "Орон сууц",
    },
    "",
  );
  assert.equal(result.status, 201);
  assert.equal(
    (await req(`/w/${ws}/dashboard`)).data.inquiries[0].name,
    "Зочин Болор",
  );
  const missingConditional = await req(
    "/public/" + site.slug + "/inquiries",
    "POST",
    { name: "Office", contact: "a", projectType: "Оффис" },
    "",
  );
  assert.equal(missingConditional.status, 422);
  await req(`/w/${ws}/sites/${site.id}/rollback`, "POST", {
    revisionId: firstRevision,
  });
  assert.notEqual(
    (await req("/public/" + site.slug)).data.document.root.children[0]
      .children[0].props.text,
    "Owner edited studio",
  );
  assert.equal(
    one(db, "SELECT COUNT(*) count FROM inquiries WHERE workspace_id=?", ws)
      .count,
    1,
  );
  assert.equal(
    (
      await req(
        `/w/${otherWs}/inquiries/${result.data.id}`,
        "PATCH",
        { status: "closed" },
        bob,
      )
    ).status,
    404,
  );
});
test("owner-created nested layout preserves checkout; server totals, snapshots and idempotent test verification", async () => {
  const site = sites.find((s) => s.theme === "shop");
  const draft = (await req(`/w/${ws}/sites/${site.id}`)).data;
  let card: any, button: any;
  walk(draft.document.root, (n: any) => {
    if (n.name === "Бүтээгдэхүүний карт") card = n;
    if (n.props.actions?.some((a: any) => a.type === "addToCart")) button = n;
  });
  card.children.push({
    id: "owner-nested",
    type: "container",
    name: "Owner custom CTA",
    props: {},
    style: { padding: 12, background: "#edf1e4" },
    children: [],
  });
  const moved = moveNode(draft.document, button.id, "owner-nested", 0);
  assert.equal(
    (
      await req(`/w/${ws}/sites/${site.id}`, "PUT", {
        document: moved,
        baseVersion: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (await req(`/w/${ws}/sites/${site.id}/publish`, "POST", { baseVersion: 2 }))
      .status,
    201,
  );
  const publicSite = (await req("/public/" + site.slug)).data;
  assert.equal(
    findNode(publicSite.document, button.id)!.props.actions![0].type,
    "addToCart",
  );
  const product = publicSite.records.find((r: any) => r.kind === "product");
  const variant = product.variants[0];
  const payload = {
    name: "Buyer",
    contact: "buyer@example.test",
    items: [{ variantId: variant.id, quantity: 2 }],
    idempotencyKey: crypto.randomUUID(),
    accessToken: crypto.randomUUID(),
  };
  assert.equal(
    (
      await req(
        "/public/" + site.slug + "/orders",
        "POST",
        { ...payload, total: 1 },
        "",
      )
    ).status,
    422,
  );
  const a = await req("/public/" + site.slug + "/orders", "POST", payload, "");
  assert.equal(a.status, 201, a.data.error);
  assert.equal(a.data.total, product.price * 2);
  const again = await req(
    "/public/" + site.slug + "/orders",
    "POST",
    payload,
    "",
  );
  assert.equal(again.data.id, a.data.id);
  assert.equal(
    one(db, "SELECT stock FROM variants WHERE id=?", variant.id).stock,
    variant.stock - 2,
  );
  const bad = await req(
    "/public/" + site.slug + "/orders/" + a.data.id + "/payment-test",
    "POST",
    { accessToken: crypto.randomUUID(), outcome: "paid" },
    "",
  );
  assert.equal(bad.status, 404);
  const forged = await req(
    "/public/" + site.slug + "/orders/" + a.data.id + "/payment-test",
    "POST",
    { accessToken: payload.accessToken, outcome: "paid", paid: true },
    "",
  );
  assert.equal(forged.status, 422);
  const paid = await req(
    "/public/" + site.slug + "/orders/" + a.data.id + "/payment-test",
    "POST",
    { accessToken: payload.accessToken, outcome: "paid" },
    "",
  );
  assert.equal(paid.data.status, "paid_test");
  const repeated = await req(
    "/public/" + site.slug + "/orders/" + a.data.id + "/payment-test",
    "POST",
    { accessToken: payload.accessToken, outcome: "paid" },
    "",
  );
  assert.equal(repeated.data.status, "paid_test");
  assert.equal(
    one(
      db,
      "SELECT COUNT(*) count FROM audit WHERE entity_id=? AND action='payment.paid_test'",
      a.data.id,
    ).count,
    1,
  );
  await req(`/w/${ws}/catalog/${product.id}`, "PATCH", {
    name: "Changed catalog",
    description: "New",
    price: 1,
    category: "New",
  });
  assert.equal(
    one(db, "SELECT unit_price FROM order_items WHERE order_id=?", a.data.id)
      .unit_price,
    product.price,
  );
  assert.equal(
    (await req(`/w/${ws}/orders/${a.data.id}/fulfill`, "POST", {})).status,
    200,
  );
});
test("concurrent requests cannot oversell; cancellation and expiry release stock once", async () => {
  const site = sites.find((s) => s.theme === "shop");
  const products = (await req("/public/" + site.slug)).data.records;
  const v = products[1].variants[0];
  run(db, "UPDATE variants SET stock=1 WHERE id=?", v.id);
  const payload = () => ({
    name: "Race",
    contact: "99110000",
    items: [{ variantId: v.id, quantity: 1 }],
    idempotencyKey: crypto.randomUUID(),
    accessToken: crypto.randomUUID(),
  });
  const p1 = payload(),
    p2 = payload();
  const both = await Promise.all([
    req("/public/" + site.slug + "/orders", "POST", p1, ""),
    req("/public/" + site.slug + "/orders", "POST", p2, ""),
  ]);
  assert.deepEqual(both.map((r) => r.status).sort(), [201, 409]);
  const index = both.findIndex((r) => r.status === 201);
  const order = both[index].data;
  const token = [p1, p2][index].accessToken;
  assert.equal(one(db, "SELECT stock FROM variants WHERE id=?", v.id).stock, 0);
  assert.equal(
    (
      await req(
        "/public/" + site.slug + "/orders/" + order.id + "/payment-test",
        "POST",
        { accessToken: token, outcome: "cancelled" },
        "",
      )
    ).status,
    200,
  );
  assert.equal(one(db, "SELECT stock FROM variants WHERE id=?", v.id).stock, 1);
  assert.equal(
    (
      await req(
        "/public/" + site.slug + "/orders/" + order.id + "/payment-test",
        "POST",
        { accessToken: token, outcome: "cancelled" },
        "",
      )
    ).status,
    409,
  );
  assert.equal(one(db, "SELECT stock FROM variants WHERE id=?", v.id).stock, 1);
  const p3 = payload();
  const exp = await req("/public/" + site.slug + "/orders", "POST", p3, "");
  run(db, "UPDATE orders SET expires=0 WHERE id=?", exp.data.id);
  const pay = await req(
    "/public/" + site.slug + "/orders/" + exp.data.id + "/payment-test",
    "POST",
    { accessToken: p3.accessToken, outcome: "paid" },
    "",
  );
  assert.equal(pay.status, 409);
  await req("/public/" + site.slug);
  assert.equal(one(db, "SELECT stock FROM variants WHERE id=?", v.id).stock, 1);
});
test("database trigger prevents overlapping bookings and failed reservation leaves no orphan customer", async () => {
  const site = sites.find((s) => s.theme === "salon");
  const service = (await req("/public/" + site.slug)).data.records[0];
  const day = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const payload = {
    name: "Зочин",
    contact: "99000000",
    serviceId: service.id,
    date: day,
    time: "10:00",
  };
  const count = one(db, "SELECT COUNT(*) count FROM customers").count;
  const results = await Promise.all([
    req("/public/" + site.slug + "/bookings", "POST", payload, ""),
    req("/public/" + site.slug + "/bookings", "POST", payload, ""),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    one(db, "SELECT COUNT(*) count FROM customers").count,
    count + 1,
  );
  const b = results.find((r) => r.status === 201)!.data;
  await req(`/w/${ws}/bookings/${b.id}/cancel`, "POST", {});
  assert.equal(
    (await req("/public/" + site.slug + "/bookings", "POST", payload, ""))
      .status,
    201,
  );
});
test("invalid publication cannot replace live revision and public records never contain private columns", async () => {
  const site = sites[0];
  const before = one(
    db,
    "SELECT published_id FROM sites WHERE id=?",
    site.id,
  ).published_id;
  const draft = (await req(`/w/${ws}/sites/${site.id}`)).data;
  draft.document.root.children[0].props.binding = {
    source: "record",
    field: "name",
  };
  assert.equal(
    (
      await req(`/w/${ws}/sites/${site.id}`, "PUT", {
        document: draft.document,
        baseVersion: draft.draftVersion,
      })
    ).status,
    422,
  );
  assert.equal(
    one(db, "SELECT published_id FROM sites WHERE id=?", site.id).published_id,
    before,
  );
  const publicText = JSON.stringify((await req("/public/" + site.slug)).data);
  for (const name of [
    "private_notes",
    "password_hash",
    "access_hash",
    "workspace_id",
  ])
    assert.ok(!publicText.includes(name));
});
test("synthetic webhook authenticity, replay deduplication, reply and disconnection", async () => {
  process.env.TEST_WEBHOOK_SECRET = "test-only-secret";
  await req(`/w/${ws}/integrations/meta-test`, "POST", { connect: true });
  const event = {
    eventId: "signed-event-001",
    channelId: "person-001",
    sender: "Fixture",
    body: "Sain baina uu?",
  };
  const signature =
    "sha256=" +
    createHmac("sha256", process.env.TEST_WEBHOOK_SECRET)
      .update(JSON.stringify(event))
      .digest("hex");
  assert.equal(
    (
      await req("/webhooks/test/" + ws, "POST", event, "", {
        "x-hub-signature-256": "sha256=forged",
      })
    ).status,
    401,
  );
  const first = await req("/webhooks/test/" + ws, "POST", event, "", {
    "x-hub-signature-256": signature,
  });
  assert.equal(first.status, 200);
  assert.equal(first.data.duplicate, false);
  assert.equal(
    (
      await req("/webhooks/test/" + ws, "POST", event, "", {
        "x-hub-signature-256": signature,
      })
    ).data.duplicate,
    true,
  );
  const msg = (await req(`/w/${ws}/messages`)).data.find(
    (m: any) => m.channel_id === "person-001",
  );
  assert.equal(
    (
      await req(`/w/${ws}/messages/${msg.id}/reply`, "POST", {
        body: "Сайн байна уу!",
        idempotencyKey: crypto.randomUUID(),
      })
    ).status,
    200,
  );
  const replyKey = crypto.randomUUID();
  const replyOnce = await req(`/w/${ws}/messages/${msg.id}/reply`, "POST", {
    body: "Safe retry",
    idempotencyKey: replyKey,
  });
  const replyTwice = await req(`/w/${ws}/messages/${msg.id}/reply`, "POST", {
    body: "Safe retry",
    idempotencyKey: replyKey,
  });
  assert.equal(replyOnce.data.externalId, replyTwice.data.externalId);
  assert.equal(
    one(
      db,
      "SELECT COUNT(*) count FROM messages WHERE body='Safe retry' AND workspace_id=?",
      ws,
    ).count,
    1,
  );
  await req(`/w/${ws}/integrations/meta-test`, "POST", { connect: false });
  assert.equal(
    (
      await req(`/w/${ws}/messages/${msg.id}/reply`, "POST", {
        body: "Blocked",
        idempotencyKey: crypto.randomUUID(),
      })
    ).status,
    409,
  );
});
test("record-to-offer workflow has separate delivery states and safe retries", async () => {
  await req(`/w/${ws}/integrations/meta-test`, "POST", { connect: true });
  const record = (await req(`/w/${ws}/catalog`)).data[0];
  const promotion = await req(`/w/${ws}/promotions`, "POST", {
    recordId: record.id,
  });
  assert.equal(promotion.status, 201);
  const offer = (await req(`/w/${ws}/sites/${promotion.data.offerSiteId}`))
    .data;
  assert.equal(offer.document.root.children[0].props.text, record.name);
  const published = await req(`/w/${ws}/sites/${offer.id}/publish`, "POST", {
    baseVersion: 1,
  });
  assert.equal(published.status, 201);
  assert.equal(
    (
      await req(
        `/w/${ws}/promotions/${promotion.data.id}/publish-test`,
        "POST",
        { simulateFailure: true },
      )
    ).data.state,
    "failed_test",
  );
  assert.equal(
    one(db, "SELECT published_id FROM sites WHERE id=?", offer.id).published_id,
    published.data.id,
  );
  const success = await req(
    `/w/${ws}/promotions/${promotion.data.id}/publish-test`,
    "POST",
    {},
  );
  assert.equal(success.data.state, "published_test");
  const retry = await req(
    `/w/${ws}/promotions/${promotion.data.id}/publish-test`,
    "POST",
    {},
  );
  assert.equal(retry.data.externalId, success.data.externalId);
  assert.equal(
    one(
      db,
      "SELECT COUNT(*) count FROM jobs WHERE draft_id=?",
      promotion.data.id,
    ).count,
    1,
  );
});
test("controlled fixture patches require existing text, authorization and matching draft version", async () => {
  const site = sites.find((s) => s.theme === "studio");
  const draft = (await req(`/w/${ws}/sites/${site.id}`)).data;
  const textNode = draft.document.root.children[0].children[0];
  const patch = await req(`/w/${ws}/sites/${site.id}/ai-fixture`, "POST", {
    nodeId: textNode.id,
    text: "Шинэ орон зай",
  });
  assert.equal(patch.status, 200);
  assert.equal(
    (
      await req(
        `/w/${ws}/sites/${site.id}/ai-accept`,
        "POST",
        { baseVersion: patch.data.baseVersion, patch: patch.data.patch },
        bob,
      )
    ).status,
    403,
  );
  const result = await req(`/w/${ws}/sites/${site.id}/ai-accept`, "POST", {
    baseVersion: patch.data.baseVersion,
    patch: patch.data.patch,
  });
  assert.equal(result.status, 200);
  assert.equal(
    (
      await req(`/w/${ws}/sites/${site.id}/ai-accept`, "POST", {
        baseVersion: patch.data.baseVersion,
        patch: patch.data.patch,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req(`/w/${ws}/sites/${site.id}/ai-fixture`, "POST", {
        nodeId: "missing",
        text: "x",
      })
    ).status,
    422,
  );
});

test("catalog archiving removes public sale availability without deleting snapshots", async () => {
  const shop = sites.find((s) => s.theme === "shop");
  const record = (await req("/public/" + shop.slug)).data.records[0];
  assert.equal(
    (
      await req(`/w/${ws}/catalog/${record.id}/archive`, "POST", {
        archived: true,
      })
    ).status,
    200,
  );
  assert.ok(
    !(await req("/public/" + shop.slug)).data.records.some(
      (r: any) => r.id === record.id,
    ),
  );
  assert.equal(
    (
      await req(
        "/public/" + shop.slug + "/orders",
        "POST",
        {
          name: "Buyer",
          contact: "Test",
          items: [{ variantId: record.variants[0].id, quantity: 1 }],
          idempotencyKey: crypto.randomUUID(),
          accessToken: crypto.randomUUID(),
        },
        "",
      )
    ).status,
    422,
  );
  assert.ok(one(db, "SELECT COUNT(*) count FROM order_items").count > 0);
  assert.equal(
    (
      await req(`/w/${ws}/catalog/${record.id}/archive`, "POST", {
        archived: false,
      })
    ).status,
    200,
  );
});
test("draft media is private, tenant media cannot be rebound, and publication makes referenced media public", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
    "base64",
  );
  const upload = async (workspace: string, cookie: string) => {
    const r = await fetch(base + `/api/w/${workspace}/media`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "image/png" },
      body: png,
    });
    assert.equal(r.status, 201);
    return (await r.json()).src;
  };
  const privateBob = await upload(otherWs, bob);
  assert.equal(
    (await fetch(base + privateBob, { headers: { Cookie: alice } })).status,
    404,
  );
  const media = await upload(ws, alice);
  assert.equal((await fetch(base + media)).status, 404);
  const site = sites.find((s) => s.theme === "studio");
  const d = (await req(`/w/${ws}/sites/${site.id}`)).data;
  let image: any;
  walk(d.document.root, (n) => {
    if (n.type === "image") image = n;
  });
  image.props.src = privateBob;
  assert.equal(
    (
      await req(`/w/${ws}/sites/${site.id}`, "PUT", {
        document: d.document,
        baseVersion: d.draftVersion,
      })
    ).status,
    422,
  );
  image.props.src = media;
  assert.equal(
    (
      await req(`/w/${ws}/sites/${site.id}`, "PUT", {
        document: d.document,
        baseVersion: d.draftVersion,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(`/w/${ws}/sites/${site.id}/publish`, "POST", {
        baseVersion: d.draftVersion + 1,
      })
    ).status,
    201,
  );
  assert.equal((await fetch(base + media)).status, 200);
});
test("WAL backup and restore preserve records; restore refuses overwriting an existing destination", async () => {
  const snapshot = join(directory, "snapshot.sqlite");
  await backup(db, snapshot);
  const target = join(directory, "restored.sqlite");
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "server/restore.ts", snapshot, target],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const restored = openDatabase(target);
  assert.equal(
    one(restored, "SELECT COUNT(*) count FROM inquiries").count,
    one(db, "SELECT COUNT(*) count FROM inquiries").count,
  );
  assert.equal(
    one(restored, "SELECT COUNT(*) count FROM orders").count,
    one(db, "SELECT COUNT(*) count FROM orders").count,
  );
  assert.equal(one(restored, "PRAGMA integrity_check").integrity_check, "ok");
  restored.close();
  const again = spawnSync(
    process.execPath,
    ["--import", "tsx", "server/restore.ts", snapshot, target],
    { encoding: "utf8" },
  );
  assert.notEqual(again.status, 0);
  assert.ok(again.stderr.includes("Destination already exists"));
});
