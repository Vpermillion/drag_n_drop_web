import { chromium, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "uru-workspace-"));
mkdirSync("artifacts", { recursive: true });
const port = Number(process.env.WORKSPACE_TEST_PORT ?? 3115);
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
    if (m.type() === "error") errors.push(m.text());
  });
}
async function rename(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Rename element", exact: true })
    .click();
  const input = page.getByLabel("Rename workspace element", { exact: true });
  await input.fill(name);
  await input.press("Enter");
  assert.equal(
    await page.getByLabel("Элементийн нэр", { exact: true }).inputValue(),
    name,
  );
}
async function dragExplorer(
  page: Page,
  source: string,
  target: string,
  placement: string,
) {
  const grip = page
    .locator(`.explorer-row:has([data-explorer-id="${source}"])`)
    .getByRole("button", { name: /^Drag / });
  await grip.scrollIntoViewIfNeeded();
  const box = (await grip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2, {
    steps: 4,
  });
  const zone = page.locator(
    `[data-drop-node="${target}"][data-placement="${placement}"]`,
  );
  await zone.scrollIntoViewIfNeeded();
  const dest = (await zone.boundingBox())!;
  assert.ok(dest.height > 0);
  await page.mouse.move(dest.x + dest.width / 2, dest.y + dest.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
  // dnd-kit keeps its click-capture listener for 50ms after a pointer drag.
  await page.waitForTimeout(65);
}
try {
  await ready();
  for (const mode of ["pages", "server"]) {
    const base =
      mode === "pages"
        ? `http://localhost:${(staticServer.address() as any).port}${prefix}`
        : `http://localhost:${port}/`;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    track(page);
    await page.goto(base);
    if (mode === "server") {
      await page.locator("input[name=name]").fill("Workspace owner");
      await page.locator("input[name=email]").fill("workspace@example.test");
      await page
        .locator("input[name=password]")
        .fill("workspace-test-password");
      await page
        .locator("input[name=workspaceName]")
        .fill("Workspace business");
      await page.getByRole("button", { name: "Студи үүсгэх" }).click();
    }
    await page.locator(".build-banner").waitFor();
    await page
      .getByRole("button", { name: "Сайт үүсгэх", exact: false })
      .click();
    await page.locator(".dialog input[name=name]").fill("Workspace Playground");
    await page.getByRole("button", { name: "Хоосон canvas үүсгэх" }).click();
    await page.locator(".studio-workspace").waitFor();
    const editorUrl = page.url();
    const rootId = await page
      .locator(".layer")
      .first()
      .getAttribute("data-explorer-id");
    await page
      .getByRole("button", { name: "Insert container", exact: true })
      .click();
    await rename(page, "Hero Workspace");
    const folderId = await page
      .locator(".layer.active")
      .getAttribute("data-explorer-id");
    await page.getByLabel("minHeight", { exact: true }).fill("420px");
    await page
      .getByRole("button", { name: "Insert button", exact: true })
      .click();
    await rename(page, "Launch button");
    const buttonId = await page
      .locator(".layer.active")
      .getAttribute("data-explorer-id");
    await page
      .getByRole("button", { name: "Free position", exact: true })
      .click();
    await page.getByLabel("Position X", { exact: true }).fill("50");
    await page.getByLabel("Position Y", { exact: true }).fill("70");
    const wrapper = page.locator(`.canvas-node[data-node-id="${buttonId}"]`);
    await page
      .getByRole("button", { name: "Open creative studio", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "CSS", exact: true })
      .click();
    await page
      .getByLabel("Scoped CSS", { exact: true })
      .fill("--widget-width:210px; width:var(--widget-width);height:64px;");
    await page.getByRole("button", { name: "Apply CSS", exact: false }).click();
    await page.keyboard.press("Escape");
    assert.equal(Math.round((await wrapper.boundingBox())!.width), 210);
    assert.equal(
      Math.round((await wrapper.locator(".node-button").boundingBox())!.width),
      210,
    );

    let layout = await wrapper.evaluate((el) => {
      const c = getComputedStyle(el);
      return { position: c.position, left: c.left, top: c.top };
    });
    assert.deepEqual(layout, {
      position: "absolute",
      left: "50px",
      top: "70px",
    });
    const move = wrapper.getByRole("button", {
      name: "Move freely",
      exact: true,
    });
    await move.scrollIntoViewIfNeeded();
    const box = (await move.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 40,
      box.y + box.height / 2 + 30,
      { steps: 15 },
    );
    await page.mouse.up();
    assert.equal(
      await page.getByLabel("Position X", { exact: true }).inputValue(),
      "90",
    );
    assert.equal(
      await page.getByLabel("Position Y", { exact: true }).inputValue(),
      "100",
    );
    await page
      .getByRole("button", { name: "Mobile layout", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Anchor top-left", exact: true })
      .click();
    await page.getByLabel("Position X", { exact: true }).fill("20");
    await page.getByLabel("Position Y", { exact: true }).fill("25");
    assert.equal(
      await wrapper.evaluate((el) => getComputedStyle(el).left),
      "20px",
    );
    await page
      .getByRole("button", { name: "Desktop layout", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Position X", { exact: true }).inputValue(),
      "90",
    );
    await page
      .getByRole("button", { name: "Anchor bottom-right", exact: true })
      .click();
    assert.equal(
      await wrapper.evaluate((el) => getComputedStyle(el).translate),
      "-100% -100%",
    );
    await page.getByLabel("Position X", { exact: true }).fill("-24");
    await page.getByLabel("Position Y", { exact: true }).fill("-20");
    await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector(".save-state")?.textContent?.includes("✓"),
    );
    await page.getByRole("button", { name: "Нийтлэх", exact: false }).click();
    await page.getByRole("status").filter({ hasText: "Нийтлэгдлээ" }).waitFor();
    await page.getByRole("button", { name: "Үйлдэл", exact: true }).click();
    const href = await page
      .getByRole("link", { name: "Нийтлэгдсэн сайт", exact: false })
      .getAttribute("href");
    const visitor = await context.newPage();
    track(visitor);
    await visitor.goto(new URL(href!, base).href);
    const live = visitor.locator(`.pn-${buttonId}`);
    const desktopBox = (await live.boundingBox())!;
    const parentBox = (await visitor.locator(`.pn-${folderId}`).boundingBox())!;
    assert.ok(
      Math.abs(
        desktopBox.x + desktopBox.width - (parentBox.x + parentBox.width - 24),
      ) < 2,
    );
    assert.ok(
      Math.abs(
        desktopBox.y +
          desktopBox.height -
          (parentBox.y + parentBox.height - 20),
      ) < 2,
    );
    await visitor.setViewportSize({ width: 360, height: 900 });
    const mobileBox = (await live.boundingBox())!;
    const mobileParent = (await visitor
      .locator(`.pn-${folderId}`)
      .boundingBox())!;
    assert.ok(Math.abs(mobileBox.x - mobileParent.x - 20) < 2);
    assert.ok(Math.abs(mobileBox.y - mobileParent.y - 25) < 2);
    await visitor.close();
    console.log(
      `PASS ${mode}: real free-move pointer, anchors, mobile overrides and published geometry`,
    );
    await page.getByRole("button", { name: "Загвар", exact: true }).click();
    await page.locator(".layer.active").focus();
    await page.keyboard.press("Control+d");
    assert.equal(await page.locator(".canvas-page .node-button").count(), 2);
    const copyId = await page
      .locator(".layer.active")
      .getAttribute("data-explorer-id");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert.equal(await page.locator(".canvas-page .node-button").count(), 1);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await page.locator(`[data-explorer-id="${copyId}"]`).click();
    await page
      .getByRole("button", { name: "Group in folder", exact: true })
      .click();
    await rename(page, "Actions folder");
    const groupId = await page
      .locator(".layer.active")
      .getAttribute("data-explorer-id");
    await page
      .getByRole("button", { name: "Insert text", exact: true })
      .click();
    await rename(page, "Intro text");
    const textId = await page
      .locator(".layer.active")
      .getAttribute("data-explorer-id");
    await page
      .getByLabel("Insert placement", { exact: true })
      .selectOption("before");
    await page
      .getByRole("button", { name: "Insert button", exact: true })
      .click();
    await rename(page, "Before intro");
    const beforeId = await page
      .locator(".layer.active")
      .getAttribute("data-explorer-id");
    let order = await page
      .locator(
        `.canvas-node[data-node-id="${groupId}"] > .node-content > .node-container > .canvas-node`,
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-node-id")));
    assert.deepEqual(order, [copyId, beforeId, textId]);
    await page
      .getByRole("button", { name: "Move out of folder", exact: true })
      .click();
    assert.equal(
      await page.locator(`.workspace-breadcrumb button`).last().textContent(),
      "Before intro",
    );
    await dragExplorer(page, beforeId!, groupId!, "inside");
    order = await page
      .locator(
        `.canvas-node[data-node-id="${groupId}"] > .node-content > .node-container > .canvas-node`,
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-node-id")));
    assert.deepEqual(order, [copyId, textId, beforeId]);
    await dragExplorer(page, beforeId!, textId!, "before");
    order = await page
      .locator(
        `.canvas-node[data-node-id="${groupId}"] > .node-content > .node-container > .canvas-node`,
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-node-id")));
    assert.deepEqual(order, [copyId, beforeId, textId]);
    await dragExplorer(page, beforeId!, textId!, "after");
    order = await page
      .locator(
        `.canvas-node[data-node-id="${groupId}"] > .node-content > .node-container > .canvas-node`,
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-node-id")));
    assert.deepEqual(order, [copyId, textId, beforeId]);
    await page
      .getByRole("button", { name: "Collapse Actions folder", exact: true })
      .click();
    await page
      .locator(`[data-explorer-id="${textId}"]`)
      .waitFor({ state: "detached" });
    await page
      .getByRole("button", { name: "Expand Actions folder", exact: true })
      .click();
    await page.locator(`[data-explorer-id="${textId}"]`).focus();
    await page.keyboard.press("F2");
    await page
      .getByLabel("Rename workspace element", { exact: true })
      .fill("Intro renamed");
    await page
      .getByLabel("Rename workspace element", { exact: true })
      .press("Enter");
    await page
      .getByLabel("Search workspace", { exact: true })
      .fill("Intro renamed");
    await page
      .locator(`[data-explorer-id="${beforeId}"]`)
      .waitFor({ state: "detached" });
    await page.getByLabel("Search workspace", { exact: true }).fill("");
    await page.locator(`[data-explorer-id="${textId}"]`).focus();
    await page.keyboard.press("ArrowUp");
    assert.equal(
      await page.locator(".layer.active").getAttribute("data-explorer-id"),
      copyId,
    );
    await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector(".save-state")?.textContent?.includes("✓"),
    );
    await page.reload();
    await page.locator(`[data-explorer-id="${textId}"]`).waitFor();
    assert.equal(
      await page.locator(`[data-explorer-id="${textId}"]`).textContent(),
      "TIntro renamed",
    );
    console.log(
      `PASS ${mode}: insertion order, folder grouping, real Explorer drag above/inside/below, rename, search, collapse, history and persistence`,
    );
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `artifacts/workspace-${mode}-${width}.png`,
        fullPage: true,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      if (axe.violations.length)
        violations.push({
          mode,
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
    await page.goto(editorUrl);
    assert.ok(rootId);
    await context.close();
  }
  assert.deepEqual(errors, [], "Workspace browser errors");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    "artifacts/workspace-accessibility.json",
    JSON.stringify(violations, null, 2),
  );
  assert.deepEqual(violations, [], "Workspace accessibility");
  console.log(
    "PASS Studio desktop/mobile overflow and accessibility in both runtime modes",
  );
} catch (error) {
  console.error(logs);
  console.error("Browser errors:", errors);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    "artifacts/workspace-accessibility.json",
    JSON.stringify(violations, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((r) => staticServer.close(() => r()));
  processServer.kill("SIGTERM");
  await new Promise<void>((r) => processServer.once("exit", () => r()));
  rmSync(dir, { recursive: true, force: true });
}
