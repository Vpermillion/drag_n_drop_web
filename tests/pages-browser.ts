import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
const root = resolve("dist-pages");
const prefix = "/drag_n_drop_web/";
const server = createServer(async (req, res) => {
  const path = new URL(req.url!, "http://localhost").pathname;
  if (!path.startsWith(prefix)) {
    res.writeHead(404).end();
    return;
  }
  const file = resolve(root, path.slice(prefix.length) || "index.html");
  if (!file.startsWith(root + "/")) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type":
          (
            {
              ".html": "text/html",
              ".js": "application/javascript",
              ".css": "text/css",
              ".svg": "image/svg+xml",
            } as any
          )[extname(file)] ?? "application/octet-stream",
      })
      .end(data);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0, "127.0.0.1");
await new Promise<void>((r) =>
  server.listening ? r() : server.once("listening", () => r()),
);
const base = `http://localhost:${(server.address() as any).port}${prefix}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors: string[] = [];
const failed: string[] = [];
for (const p of [page]) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  p.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
}
await mkdir("artifacts", { recursive: true });
try {
  await page.goto(base);
  await page.locator(".build-banner").waitFor();
  assert.ok(await page.locator(".pages-demo-banner").textContent());
  assert.equal(await page.locator(".site-card").count(), 3);
  await page.screenshot({
    path: "artifacts/pages-dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ором · design & build засах" })
    .click();
  await page.locator(".editor-shell").waitFor();
  await page
    .locator(".canvas-page [contenteditable=true]")
    .first()
    .fill("Pages owner customization");
  await page.locator(".canvas-breadcrumb").click();
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector(".save-state")?.textContent?.includes("✓"),
  );
  await page.reload();
  await page.locator(".editor-shell").waitFor();
  assert.equal(
    await page
      .locator(".canvas-page [contenteditable=true]")
      .first()
      .textContent(),
    "Pages owner customization",
  );
  await page.getByRole("button", { name: "Нийтлэх" }).click();
  await page.getByRole("status").filter({ hasText: "Нийтлэгдлээ" }).waitFor();
  const visitor = await context.newPage();
  visitor.on("pageerror", (e) => errors.push(e.message));
  visitor.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await visitor.goto(base + "?site=orom");
  const form = visitor.locator(".node-form");
  await form.getByLabel("Таны нэр").fill("Pages Зочин");
  await form.getByLabel("Утас эсвэл имэйл").fill("99112233");
  await form.getByLabel("Төслийн төрөл").selectOption("Оффис");
  await form.getByLabel("Багийн хүний тоо").fill("6");
  await form.getByLabel("Төслийн тухай").fill("Interactive GitHub Pages demo");
  await form.getByRole("button", { name: "Хүсэлт илгээх" }).click();
  await visitor
    .getByRole("status")
    .filter({ hasText: "Хүсэлт хүлээн авлаа" })
    .waitFor();
  await page.getByRole("button", { name: "Буцах", exact: true }).click();
  await page.locator(".sidebar nav button").nth(2).click();
  await page.getByRole("button", { name: "Хүсэлт", exact: true }).click();
  await page.getByRole("heading", { name: "Pages Зочин" }).waitFor();
  console.log(
    "PASS Pages editing, IndexedDB reload, local publication and connected inquiry",
  );
  await visitor.goto(base + "?site=erdene");
  await visitor
    .getByRole("button", { name: "Дэлгэрэнгүй · Сонгох", exact: true })
    .first()
    .click();
  let dialog = visitor.getByRole("dialog");
  await dialog.locator("select").selectOption({ index: 1 });
  await dialog
    .getByRole("button", { name: "Сагсанд нэмэх", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Хаах", exact: true }).click();
  await visitor.getByRole("button", { name: "Сагс", exact: true }).click();
  dialog = visitor.getByRole("dialog");
  await dialog.getByLabel("Таны нэр").fill("Pages Buyer");
  await dialog.getByLabel("Утас эсвэл имэйл").fill("demo@example.test");
  await dialog.getByRole("button", { name: "Тест захиалга үүсгэх" }).click();
  await dialog
    .getByRole("button", { name: "Тест төлбөр баталгаажуулах" })
    .click();
  await dialog
    .getByRole("heading", { name: "Туршилтын захиалга амжилттай" })
    .waitFor();
  await visitor.goto(base + "?site=nami");
  const booking = visitor.locator(".node-form").first();
  await booking.getByLabel("Таны нэр").fill("Pages Booking");
  await booking.getByLabel("Холбоо барих").fill("99001122");
  await booking
    .getByLabel("Өдөр")
    .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await booking.getByLabel("Цаг", { exact: false }).selectOption("12:00");
  await booking.getByRole("button", { name: "Туршилтын цаг захиалах" }).click();
  await visitor
    .getByRole("status")
    .filter({ hasText: "Цаг захиалагдлаа" })
    .waitFor();
  console.log(
    "PASS Pages variants, cart, test payment and test booking without a backend",
  );
  await page.locator(".sidebar nav button").nth(6).click();
  await page
    .getByRole("button", { name: "Синтетик Page холбох", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Тест Page салгах", exact: true })
    .waitFor();
  await page.locator(".sidebar nav button").nth(3).click();
  await page.getByRole("button", { name: "Тест мессеж", exact: false }).click();
  const inbound = page.locator(".message-card.inbound");
  await inbound
    .getByRole("textbox", { name: "Хариу", exact: true })
    .fill("Pages test reply");
  await inbound
    .getByRole("button", { name: "Тест хариу", exact: false })
    .click();
  await page
    .locator(".message-card.outbound")
    .filter({ hasText: "Pages test reply" })
    .waitFor();
  await page.locator(".sidebar nav button").nth(2).click();
  await page.getByRole("button", { name: "Каталог", exact: true }).click();
  await page
    .locator(".catalog-card")
    .first()
    .getByRole("button", { name: "Санал үүсгэх", exact: false })
    .click();
  await page.locator(".promotion-card").waitFor();
  await page
    .getByRole("button", { name: "Алдаа ба дахин оролдохыг турших" })
    .click();
  await page.locator(".promotion-card .form-error").waitFor();
  await page.getByRole("button", { name: "Тест нийтлэл", exact: true }).click();
  await page
    .locator(".promotion-heading small")
    .filter({ hasText: "published_test" })
    .waitFor();
  console.log(
    "PASS Pages synthetic messages, replies and promotion failure/retry",
  );
  for (const width of [1440, 360]) {
    await visitor.setViewportSize({ width, height: 1000 });
    for (const slug of ["erdene", "orom", "nami"]) {
      await visitor.goto(base + "?site=" + slug);
      await visitor.locator(".published-site").waitFor();
      assert.ok(
        await visitor.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await visitor
        .locator(".published-site img")
        .evaluateAll((images) =>
          images.forEach(
            (image) => ((image as HTMLImageElement).loading = "eager"),
          ),
        );
      await visitor.waitForFunction(() =>
        Array.from(document.querySelectorAll(".published-site img")).every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      );
      await visitor.screenshot({
        path: `artifacts/pages-${slug}-${width}.png`,
        fullPage: true,
      });
    }
  }
  const isolated = await browser.newContext();
  const other = await isolated.newPage();
  await other.goto(base);
  await other.locator(".build-banner").waitFor();
  await other.locator(".sidebar nav button").nth(2).click();
  await other.getByRole("button", { name: "Хүсэлт", exact: true }).click();
  assert.equal(
    await other.getByRole("heading", { name: "Pages Зочин" }).count(),
    0,
  );
  await isolated.close();
  assert.deepEqual(failed, [], "Missing Pages assets");
  assert.deepEqual(errors, [], "Pages browser errors");
  console.log(
    "PASS repository subpath assets, all three responsive examples, device-local isolation and no errors",
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}
