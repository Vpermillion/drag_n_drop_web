import { chromium, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "uru-creative-"));
mkdirSync("artifacts", { recursive: true });
const port = Number(process.env.CREATIVE_TEST_PORT ?? 3113);
const processServer = spawn(
  process.execPath,
  ["--import", "tsx", "server/index.ts"],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_PATH: join(dir, "test.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
processServer.stdout.on("data", (b) => (logs += b));
processServer.stderr.on("data", (b) => (logs += b));
const root = resolve("dist-pages");
const prefix = "/drag_n_drop_web/";
const staticServer = createServer(async (req, res) => {
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
  staticServer.listening ? r() : staticServer.once("listening", () => r()),
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors: string[] = [];
let escapedNetwork = false;
const violations: any[] = [];
async function ready() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(logs);
}
function track(page: Page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("sandbox-probe.invalid"))
      errors.push(m.text());
  });
}
try {
  await ready();
  for (const mode of ["pages", "server"]) {
    const base =
      mode === "pages"
        ? `http://localhost:${(staticServer.address() as any).port}${prefix}`
        : `http://localhost:${port}/`;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.route("https://sandbox-probe.invalid/**", (route) => {
      escapedNetwork = true;
      return route.abort();
    });
    const page = await context.newPage();
    track(page);
    await page.goto(base);
    if (mode === "server") {
      await page.locator("input[name=name]").fill("Creative owner");
      await page.locator("input[name=email]").fill("creative@example.test");
      await page.locator("input[name=password]").fill("creative-test-password");
      await page.locator("input[name=workspaceName]").fill("Creative business");
      await page.getByRole("button", { name: "Студи үүсгэх" }).click();
    }
    await page.locator(".build-banner").waitFor();
    await page
      .getByRole("button", { name: "Эрдэнэ · concept store засах" })
      .click();
    await page.getByRole("button", { name: "Давхарга", exact: true }).click();
    await page
      .locator(".layer")
      .filter({ hasText: "Бүтээгдэхүүний карт" })
      .click();
    await page
      .getByRole("button", { name: "Open creative studio", exact: true })
      .click();
    const studio = page.getByRole("dialog");
    await studio
      .getByRole("button", { name: "Soft wonder", exact: false })
      .click();
    await studio.getByLabel("Motion preset").selectOption("reveal");
    await studio.getByLabel("Hover effect").selectOption("lift");
    await page.screenshot({
      path: `artifacts/creative-${mode}-looks.png`,
      fullPage: true,
    });
    const axe = await new AxeBuilder({ page })
      .include(".creative-studio")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    if (axe.violations.length)
      violations.push({
        mode,
        violations: axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      });
    await studio
      .getByRole("button", { name: "Tailwind", exact: false })
      .first()
      .click();
    await studio
      .getByLabel("Tailwind classes")
      .fill(
        "p-8 rounded-2xl bg-violet-50 hover:shadow-xl transition duration-300",
      );
    await studio.getByRole("button", { name: "Apply Tailwind" }).click();
    await studio.getByRole("button", { name: "CSS", exact: true }).click();
    await studio
      .getByLabel("Scoped CSS")
      .fill(
        "border-radius: 30px; outline: 2px solid #70508b; outline-offset: 4px;",
      );
    await studio.getByRole("button", { name: "Apply CSS" }).click();
    await studio
      .getByLabel("Scoped CSS")
      .fill("background:url(https://example.test/track);");
    assert.ok(
      await studio.getByRole("button", { name: "Apply CSS" }).isDisabled(),
    );
    await studio
      .getByRole("button", { name: "Эхлэх бүтэц", exact: false })
      .click();
    await studio.locator(".starter-card").last().click();
    await page.getByRole("button", { name: "Нийтлэх", exact: false }).click();
    await page.getByRole("status").filter({ hasText: "Нийтлэгдлээ" }).waitFor();
    const slug = (await page
      .locator(".browser-bar>span")
      .textContent())!.replace(".localhost", "");
    const visitor = await context.newPage();
    track(visitor);
    await visitor.goto(
      mode === "pages" ? base + "?site=" + slug : base + "s/" + slug,
    );
    const card = visitor.locator(".node-collection .node-container").first();
    const style = await card.evaluate((el) => ({
      padding: getComputedStyle(el).padding,
      borderRadius: getComputedStyle(el).borderRadius,
      animation: getComputedStyle(el).animationName,
      transition: getComputedStyle(el).transitionDuration,
    }));
    assert.equal(style.padding, "32px");
    assert.equal(style.borderRadius, "30px");
    assert.equal(style.animation, "none");
    assert.equal(style.transition, "0s");
    await visitor
      .getByRole("button", { name: "Нээж үзэх", exact: false })
      .first()
      .click();
    assert.equal(
      await visitor
        .getByText("Том санаа жижиг алхмаас эхэлдэг.", { exact: true })
        .count(),
      1,
      "Repeated cards keep independent local state",
    );
    await visitor
      .getByRole("button", { name: "Сагсанд нэмэх", exact: true })
      .first()
      .click();
    await visitor
      .getByRole("status")
      .filter({ hasText: "Сагсанд нэмэгдлээ" })
      .waitFor();
    console.log(
      `PASS ${mode}: compiled Tailwind, scoped CSS, reduced motion and preserved product action`,
    );
    await page.getByRole("button", { name: "Буцах", exact: true }).click();
    await page
      .getByRole("button", { name: "Сайт үүсгэх", exact: false })
      .click();
    const create = page.locator(".dialog");
    await create.locator("input[name=name]").fill("Creative playground");
    await create
      .getByRole("button", { name: "Хоосон canvas үүсгэх", exact: false })
      .click();
    await page
      .getByRole("button", { name: "Explore creative starters" })
      .click();
    await page.locator(".starter-card").first().click();
    await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector(".save-state")?.textContent?.includes("✓"),
    );
    await page
      .getByRole("button", { name: "Open creative studio", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "HTML / JS", exact: false })
      .click();
    const preview = page.frameLocator('iframe[title="Creative code preview"]');
    await page.bringToFront();
    await preview
      .getByRole("button", { name: "Send a spark", exact: false })
      .scrollIntoViewIfNeeded();
    // Let the scrolled opaque iframe reach the compositor before pointer input.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await preview
      .getByRole("button", { name: "Send a spark", exact: false })
      .click();
    await preview
      .getByRole("button", { name: "Send a spark", exact: false })
      .click();
    assert.equal(
      await preview.locator("#spark-count").textContent(),
      "2 sparks collected",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add creative widget", exact: false })
      .click();
    await page.getByRole("button", { name: "Нийтлэх", exact: false }).click();
    await page.getByRole("status").filter({ hasText: "Нийтлэгдлээ" }).waitFor();
    const creativeSlug = (await page
      .locator(".browser-bar>span")
      .textContent())!.replace(".localhost", "");
    await visitor.goto(
      mode === "pages"
        ? base + "?site=" + creativeSlug
        : base + "s/" + creativeSlug,
    );
    await visitor
      .getByRole("button", { name: "Хамтдаа эхэлье", exact: false })
      .click();
    await visitor
      .getByText("Том санаа жижиг алхмаас эхэлдэг.", { exact: true })
      .waitFor();
    await visitor.bringToFront();
    const widget = visitor.frameLocator("iframe.creative-embed");
    await widget
      .getByRole("button", { name: "Send a spark", exact: false })
      .click();
    await widget
      .locator("#spark-count")
      .filter({ hasText: "1 spark collected" })
      .waitFor();
    const frame = await visitor
      .locator("iframe.creative-embed")
      .elementHandle()
      .then((h) => h!.contentFrame());
    assert.ok(frame);
    const isolation = await frame!.evaluate(() => {
      let parentBlocked = false,
        cookiesBlocked = false;
      try {
        void parent.document.body;
      } catch {
        parentBlocked = true;
      }
      try {
        void document.cookie;
      } catch {
        cookiesBlocked = true;
      }
      return { parentBlocked, cookiesBlocked };
    });
    assert.deepEqual(isolation, { parentBlocked: true, cookiesBlocked: true });
    const network = await frame!.evaluate(async () => {
      try {
        await fetch("https://sandbox-probe.invalid/no-access");
        return "escaped";
      } catch {
        return "blocked";
      }
    });
    assert.equal(network, "blocked");
    assert.equal(escapedNetwork, false);
    if (mode === "server") {
      const top = await visitor.request.get(base + "s/" + creativeSlug);
      assert.ok(
        !(top.headers()["content-security-policy"] ?? "").includes(
          "script-src 'self' 'unsafe-inline'",
        ),
      );
      const loader = await visitor.request.get(base + "creative-sandbox");
      assert.ok(
        loader
          .headers()
          ["content-security-policy"].includes("sandbox allow-scripts"),
      );
    }
    console.log(
      `PASS ${mode}: editable starter reveal, widget JavaScript, parent/cookie isolation and blocked network`,
    );
    await page.bringToFront();
    await page.getByRole("button", { name: "Open creative studio" }).click();
    await page.setViewportSize({ width: 360, height: 1000 });
    await page.locator(".creative-studio").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `artifacts/creative-${mode}-mobile.png`,
      fullPage: true,
    });
    const mobileAxe = await new AxeBuilder({ page })
      .include(".creative-studio")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    if (mobileAxe.violations.length)
      violations.push({
        mode,
        width: 360,
        violations: mobileAxe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      });
    await page.keyboard.press("Escape");
    await page.reload();
    await page.locator(".editor-shell").waitFor();
    assert.ok((await page.locator(".creative-embed").count()) > 0);
    await context.close();
  }
  assert.deepEqual(errors, [], "Unexpected creative browser errors");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    "artifacts/creative-accessibility.json",
    JSON.stringify(violations, null, 2),
  );
  assert.deepEqual(violations, [], "Creative studio accessibility");
  console.log(
    "PASS both modes: persistence, desktop/mobile layouts, keyboard dismissal and accessibility",
  );
} catch (error) {
  console.error(logs);
  console.error("Browser errors:", errors);
  if (violations.length) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      "artifacts/creative-accessibility.json",
      JSON.stringify(violations, null, 2),
    );
  }
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => staticServer.close(() => r()));
  processServer.kill("SIGTERM");
  await new Promise<void>((r) => processServer.once("exit", () => r()));
  rmSync(dir, { recursive: true, force: true });
}
