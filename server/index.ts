import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import express from "express";
import React from "react";
import { renderToString } from "react-dom/server";
import { createApp } from "./app";
import { openDatabase, one, run, transaction, expireOrders } from "./db";
import { PageRenderer } from "../src/shared/renderer";
const db = openDatabase(process.env.DATABASE_PATH ?? ".data/uru.sqlite");
const { app, readSession, publicData } = createApp(db);
const production = process.env.NODE_ENV === "production";
const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({ server: { middlewareMode: true }, appType: "custom" });
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
async function serveSite(
  req: express.Request,
  res: express.Response,
  preview = false,
  localSlug?: string,
) {
  const s = one(
    db,
    "SELECT * FROM sites WHERE " + (preview ? "id=?" : "slug=?"),
    preview ? req.params.site : (localSlug ?? req.params.slug),
  );
  if (!s) return res.status(404).send("Site not found.");
  if (preview) {
    const u = readSession(req);
    if (
      !u ||
      !one(
        db,
        "SELECT 1 FROM memberships WHERE user_id=? AND workspace_id=?",
        u.id,
        s.workspace_id,
      )
    )
      return res.status(404).send("Preview not found.");
  } else if (!s.published_id)
    return res.status(404).send("This site has not been published.");
  const doc = preview
    ? JSON.parse(s.draft)
    : JSON.parse(
        one(db, "SELECT document FROM revisions WHERE id=?", s.published_id)
          .document,
      );
  const data = publicData(s, doc, preview);
  let html = await readFile(
    resolve(production ? "dist/site.html" : "site.html"),
    "utf8",
  );
  if (vite) html = await vite.transformIndexHtml(req.originalUrl, html);
  const base =
    process.env.PUBLIC_ORIGIN ?? `${req.protocol}://${req.get("host")}`;
  const meta = `<title>${escape(doc.title)}</title><meta name="description" content="${escape(doc.description)}"/><meta name="robots" content="${preview ? "noindex,nofollow" : "index,follow"}"/><link rel="canonical" href="${escape(base + "/s/" + s.slug)}"/>`;
  html = html
    .replace("<!--META-->", meta)
    .replace(
      "<!--SITE-->",
      renderToString(React.createElement(PageRenderer, { site: data })),
    )
    .replace("<!--DATA-->", JSON.stringify(data).replace(/</g, "\\u003c"));
  res.set("Cache-Control", preview ? "private,no-store" : "no-cache");
  res.type("html").send(html);
}
// Serve a privilege-free loader with its own CSP; do not loosen the app's CSP.
app.get("/creative-sandbox", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.set(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts",
  );
  res
    .type("html")
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Isolated creative widget</title></head><body><script>window.addEventListener('message',function(event){if(event.source!==parent||event.data?.type!=='uru:creative-document'||typeof event.data.document!=='string'||event.data.document.length>80000)return;document.open();document.write(event.data.document);document.close();});</script></body></html>`,
    );
});
app.get("/s/:slug", (req, res) => serveSite(req, res));
app.get("/preview/:site", (req, res) => serveSite(req, res, true));
app.get("/", async (req, res, next) => {
  const host = req.hostname;
  const suffix = ".localhost";
  if (host.endsWith(suffix) && host !== "localhost")
    return serveSite(req, res, false, host.slice(0, -suffix.length));
  next();
});
app.use("/art", express.static(resolve("public/art"), { maxAge: "1d" }));
if (production) app.use(express.static(resolve("dist"), { index: false }));
else app.use(vite!.middlewares);
app.get("/{*path}", async (req, res) => {
  let html = await readFile(
    resolve(production ? "dist/index.html" : "index.html"),
    "utf8",
  );
  if (vite) html = await vite.transformIndexHtml(req.originalUrl, html);
  res.set("Cache-Control", "private,no-store").type("html").send(html);
});
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).send("Unable to render this page. Check the server log.");
  },
);
const maintenance = setInterval(() => {
  try {
    transaction(db, () => {
      expireOrders(db);
      run(db, "DELETE FROM sessions WHERE expires<?", Date.now());
      run(db, "DELETE FROM rate_limits WHERE expires<?", Date.now() - 3600000);
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "maintenance.error",
        message: (error as Error).message,
      }),
    );
  }
}, 60000);
maintenance.unref();
const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, "0.0.0.0", () =>
  console.log(
    JSON.stringify({
      event: "server.ready",
      port,
      paymentMode: "test",
      socialMode: "test",
    }),
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(maintenance);
    server.close(async () => {
      await vite?.close();
      db.close();
      process.exit(0);
    });
  });
