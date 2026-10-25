import { test, after } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/db";
import { createApp } from "../server/app";
const db = openDatabase(":memory:");
const { app } = createApp(db);
const server = app.listen(0, "127.0.0.1");
const base = () => `http://127.0.0.1:${(server.address() as any).port}`;
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  db.close();
});
test("persistent auth request buckets reject repeated attempts", async () => {
  if (!server.listening)
    await new Promise<void>((r) => server.once("listening", () => r()));
  for (let i = 0; i < 20; i++) {
    const res = await fetch(base() + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "missing@example.test",
        password: "invalid",
      }),
    });
    assert.equal(res.status, 401);
  }
  const limited = await fetch(base() + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "missing@example.test",
      password: "invalid",
    }),
  });
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).error, /one minute/);
});
test("oversized JSON is rejected and public GET data does not require a session", async () => {
  const res = await fetch(base() + "/api/public/unknown/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "x".repeat(1024 * 1024 + 1) }),
  });
  assert.equal(res.status, 413);
  const session = await fetch(base() + "/api/session");
  assert.deepEqual(await session.json(), { user: null, workspaces: [] });
});
