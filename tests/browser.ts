import { chromium, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "uru-browser-"));
mkdirSync("artifacts", { recursive: true });
const port = Number(process.env.BROWSER_TEST_PORT ?? 3101);
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DATABASE_PATH: join(dir, "browser.sqlite"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (b) => (output += b));
server.stderr.on("data", (b) => (output += b));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors: string[] = [];
const accessibility: any[] = [];
const track = (page: Page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
async function waitFor(fn: () => Promise<boolean>) {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Timed out waiting for application. " + output);
}
try {
  await waitFor(async () => {
    try {
      return (await fetch(base + "/api/health")).ok;
    } catch {
      return false;
    }
  });
  const owner = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await owner.newPage();
  track(page);
  await page.goto(base);
  await page.locator("input[name=name]").fill("Болор");
  await page.locator("input[name=email]").fill("browser@example.test");
  await page.locator("input[name=password]").fill("browser-test-password");
  await page.locator("input[name=workspaceName]").fill("Болорын студи");
  await page.getByRole("button", { name: "Студи үүсгэх" }).click();
  await page.locator(".build-banner").waitFor();
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  console.log("PASS register, authenticated dashboard and actual metrics");
  const me = await (await page.request.get(base + "/api/me")).json();
  const ws = me.workspaces[0].id;
  let data = await (
    await page.request.get(base + `/api/w/${ws}/dashboard`)
  ).json();
  const studio = data.sites.find((s: any) => s.theme === "studio");
  const shop = data.sites.find((s: any) => s.theme === "shop");
  const salon = data.sites.find((s: any) => s.theme === "salon");
  await page
    .getByRole("button", { name: "Ором · design & build засах" })
    .click();
  await page.locator(".editor-shell").waitFor();
  await page
    .locator(".canvas-page [contenteditable=true]")
    .first()
    .fill("Үүр студи /");
  await page.locator(".canvas-breadcrumb").click();
  await page.locator(".library-item").filter({ hasText: "Контейнер" }).click();
  await page
    .getByLabel("Элементийн нэр", { exact: true })
    .fill("Owner inquiry wrapper");
  await page.getByRole("button", { name: "Давхарга", exact: true }).click();
  await page
    .locator(".layer")
    .filter({ hasText: "Үнийн саналын хүсэлт" })
    .click();
  await page
    .getByLabel("Контейнер рүү зөөх")
    .selectOption({ label: "Owner inquiry wrapper" });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
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
    "Үүр студи /",
  );
  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Нийтлэх" }).click();
  await page.getByRole("status").filter({ hasText: "Нийтлэгдлээ" }).waitFor();
  console.log(
    "PASS direct text edit, insert, nest, undo/redo, save/reload and publish",
  );
  const preview = await page.request.get(base + "/preview/" + studio.id);
  assert.equal(preview.status(), 200);
  assert.ok((await preview.text()).includes("noindex,nofollow"));
  const guest = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const visitor = await guest.newPage();
  track(visitor);
  assert.equal(
    (await visitor.request.get(base + "/preview/" + studio.id)).status(),
    404,
  );
  await visitor.goto(base + "/s/" + studio.slug);
  const raw = await (
    await visitor.request.get(base + "/s/" + studio.slug)
  ).text();
  assert.ok(raw.includes("Үүр студи /") && raw.includes('rel="canonical"'));
  assert.ok((await visitor.content()).includes("Үүр студи /"));
  const form = visitor.locator(".node-form");
  await form.getByLabel("Таны нэр").fill("Browser Зочин");
  await form.getByLabel("Утас эсвэл имэйл").fill("99112233");
  await form.getByLabel("Төслийн төрөл").selectOption("Оффис");
  await form.getByLabel("Багийн хүний тоо").fill("12");
  await form.getByLabel("Төслийн тухай").fill("Интерьерийн үнийн санал авъя.");
  await form.getByRole("button", { name: "Хүсэлт илгээх" }).click();
  await visitor
    .getByRole("status")
    .filter({ hasText: "Хүсэлт хүлээн авлаа" })
    .waitFor();
  await page.getByRole("button", { name: "Буцах", exact: true }).click();
  await page.locator(".sidebar nav button").nth(2).click();
  await page.getByRole("button", { name: "Хүсэлт", exact: true }).click();
  await page.getByRole("heading", { name: "Browser Зочин" }).waitFor();
  await page.reload();
  await page.locator(".sidebar nav button").nth(2).click();
  await page.getByRole("button", { name: "Хүсэлт", exact: true }).click();
  await page.getByRole("heading", { name: "Browser Зочин" }).waitFor();
  console.log(
    "PASS visitor conditional form creates persisted owner inquiry after layout change",
  );
  for (const s of [shop, salon])
    assert.equal(
      (
        await page.request.post(base + `/api/w/${ws}/sites/${s.id}/publish`, {
          data: { baseVersion: 1 },
        })
      ).status(),
      201,
    );
  await visitor.goto(base + "/s/" + shop.slug);
  await visitor
    .getByRole("button", { name: "Дэлгэрэнгүй · Сонгох", exact: true })
    .first()
    .click();
  const detail = visitor.getByRole("dialog");
  await detail.locator("select").selectOption({ index: 1 });
  await detail
    .getByRole("button", { name: "Сагсанд нэмэх", exact: true })
    .click();
  await detail.getByRole("button", { name: "Хаах", exact: true }).click();
  await visitor.getByRole("button", { name: "Сагс", exact: true }).click();
  const cart = visitor.getByRole("dialog");
  await cart.getByLabel("Таны нэр").fill("Browser Buyer");
  await cart.getByLabel("Утас эсвэл имэйл").fill("buyer@example.test");
  await cart.getByRole("button", { name: "Тест захиалга үүсгэх" }).click();
  await cart
    .getByRole("button", { name: "Тест төлбөр баталгаажуулах" })
    .click();
  await cart
    .getByRole("heading", { name: "Туршилтын захиалга амжилттай" })
    .waitFor();
  console.log(
    "PASS product details, variants, cart, server order and test payment",
  );
  await visitor.goto(base + "/s/" + salon.slug);
  const booking = visitor.locator(".node-form").first();
  await booking.getByLabel("Таны нэр").fill("Browser Booking");
  await booking.getByLabel("Холбоо барих").fill("99001122");
  await booking
    .getByLabel("Өдөр")
    .fill(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  await booking.getByLabel("Цаг", { exact: false }).selectOption("12:00");
  await booking.getByRole("button", { name: "Туршилтын цаг захиалах" }).click();
  await visitor
    .getByRole("status")
    .filter({ hasText: "Цаг захиалагдлаа" })
    .waitFor();
  console.log("PASS database-backed test booking");
  await page.locator(".sidebar nav button").nth(6).click();
  await page
    .getByRole("button", { name: "Синтетик Page холбох", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Тест Page салгах", exact: true })
    .waitFor();
  await page.locator(".sidebar nav button").nth(3).click();
  await page.getByRole("button", { name: "Тест мессеж", exact: false }).click();
  const inbound = page.locator(".message-card.inbound").first();
  await inbound
    .getByRole("textbox", { name: "Хариу", exact: true })
    .fill("Баярлалаа, размер шалгаад эргээд холбогдоё.");
  await inbound
    .getByRole("button", { name: "Тест хариу", exact: false })
    .click();
  await page
    .locator(".message-card.outbound")
    .filter({ hasText: "Баярлалаа" })
    .waitFor();
  await page.screenshot({
    path: "artifacts/messages-desktop.png",
    fullPage: true,
  });
  await page.locator(".sidebar nav button").nth(2).click();
  await page.getByRole("button", { name: "Каталог", exact: true }).click();
  await page
    .locator(".catalog-card")
    .first()
    .getByRole("button", { name: "Санал үүсгэх", exact: false })
    .click();
  await page.locator(".promotion-card").waitFor();
  await page
    .locator(".promotion-card textarea")
    .fill("Монгол ноолуур · Танд зориулсан шинэ санал.");
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await page
    .getByRole("button", { name: "Хуудас засах", exact: false })
    .click();
  await page.locator(".editor-shell").waitFor();
  await page.getByRole("button", { name: "Нийтлэх", exact: false }).click();
  await page.getByRole("status").filter({ hasText: "Нийтлэгдлээ" }).waitFor();
  await page.getByRole("button", { name: "Буцах", exact: true }).click();
  await page.locator(".sidebar nav button").nth(4).click();
  await page
    .getByRole("button", {
      name: "Алдаа ба дахин оролдохыг турших",
      exact: true,
    })
    .click();
  await page.locator(".promotion-card .form-error").waitFor();
  await page.getByRole("button", { name: "Тест нийтлэл", exact: true }).click();
  await page
    .locator(".promotion-heading small")
    .filter({ hasText: "published_test" })
    .waitFor();
  await page.screenshot({
    path: "artifacts/promotion-desktop.png",
    fullPage: true,
  });
  console.log(
    "PASS synthetic Page, human reply, editable offer/caption, independent publication and retry",
  );
  // Exercise the pointer sensor, rather than only the pure tree operation.
  await page.goto(base);
  await page.locator(".build-banner").waitFor();
  await page.getByRole("button", { name: "Сайт үүсгэх" }).click();
  const create = page.locator(".dialog");
  await create.locator("input[name=name]").fill("Pointer composition");
  await create.getByRole("button", { name: "Хоосон canvas үүсгэх" }).click();
  await page.locator(".editor-shell").waitFor();
  const source = await page
    .locator(".library-item")
    .filter({ hasText: "Текст" })
    .boundingBox();
  const target = await page.locator(".canvas-page").boundingBox();
  assert.ok(source && target);
  await page.mouse.move(
    source!.x + source!.width / 2,
    source!.y + source!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    source!.x + source!.width / 2 + 12,
    source!.y + source!.height / 2,
    { steps: 3 },
  );
  await page.mouse.move(target!.x + 120, target!.y + 120, { steps: 20 });
  await page.mouse.up();
  await page.locator(".canvas-page [contenteditable=true]").waitFor();
  const text = page.locator(".canvas-page [contenteditable=true]");
  await text.fill("Pointer inserted text");
  await page.locator(".canvas-breadcrumb").click();
  await page.getByRole("button", { name: "Хуулбарлах", exact: false }).click();
  assert.equal(
    await page.locator(".canvas-page [contenteditable=true]").count(),
    2,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(
    await page.locator(".canvas-page [contenteditable=true]").count(),
    1,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.equal(
    await page.locator(".canvas-page [contenteditable=true]").count(),
    2,
  );
  await page.keyboard.press("Control+s");
  await page.waitForFunction(() =>
    document.querySelector(".save-state")?.textContent?.includes("✓"),
  );
  console.log(
    "PASS actual pointer drag insertion, duplicate, undo/redo and keyboard save",
  );
  for (const width of [1440, 360]) {
    await visitor.setViewportSize({ width, height: 1000 });
    for (const s of [shop, studio, salon]) {
      await visitor.goto(base + "/s/" + s.slug);
      await visitor.locator(".published-site").waitFor();
      const sizes = await visitor.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      assert.ok(
        sizes.scroll <= sizes.viewport + 1,
        `${s.theme} overflows at ${width}: ${JSON.stringify(sizes)}`,
      );
      await visitor.screenshot({
        path: `artifacts/${s.theme}-${width}.png`,
        fullPage: true,
      });
      const axe = await new AxeBuilder({ page: visitor })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      if (axe.violations.length)
        accessibility.push({
          target: s.theme,
          width,
          violations: axe.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        });
    }
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    await page.locator(".build-banner").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `artifacts/dashboard-${width}.png`,
      fullPage: true,
    });
    const dashAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    if (dashAxe.violations.length)
      accessibility.push({
        target: "dashboard",
        width,
        violations: dashAxe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      });
    await page.goto(base + "/?editor=" + studio.id);
    await page.locator(".editor-shell").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `artifacts/editor-${width}.png`,
      fullPage: true,
    });
    const editAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    if (editAxe.violations.length)
      accessibility.push({
        target: "editor",
        width,
        violations: editAxe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      });
  }
  console.log(
    "PASS all three public sites, dashboard and editor at 360 and 1440 pixels",
  );
  data = await (await page.request.get(base + `/api/w/${ws}/dashboard`)).json();
  assert.equal(data.inquiries.length, 1);
  assert.equal(data.orders[0].status, "paid_test");
  assert.equal(data.bookings[0].status, "reserved_test");
  assert.deepEqual(errors, [], "Browser console and hydration errors");
  const fs = await import("node:fs");
  fs.writeFileSync(
    "artifacts/accessibility.json",
    JSON.stringify(accessibility, null, 2),
  );
  assert.deepEqual(accessibility, [], "Accessibility violations");
  console.log(
    "PASS no browser errors or automated accessibility violations; business records persisted",
  );
  console.log("Browser journey completed. Screenshots: artifacts/");
} catch (error) {
  console.error(output);
  if (accessibility.length) {
    const fs = await import("node:fs");
    fs.writeFileSync(
      "artifacts/accessibility.json",
      JSON.stringify(accessibility, null, 2),
    );
    console.error("Accessibility details in artifacts/accessibility.json");
  }
  throw error;
} finally {
  await browser.close();
  server.kill("SIGTERM");
  await new Promise<void>((r) => server.once("exit", () => r()));
  rmSync(dir, { recursive: true, force: true });
}
