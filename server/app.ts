import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  all,
  one,
  run,
  transaction,
  uid,
  hash,
  audit,
  createWorkspace,
  publicRecords,
  expireOrders,
  type DB,
} from "./db";
import {
  documentSchema,
  validateDocument,
  findNode,
  walk,
  type PageDocument,
} from "../src/shared/schema";
import { blankDocument } from "../src/shared/seeds";
import {
  TestPayments,
  TestSocial,
  verifySignature,
  syntheticMessage,
} from "./adapters";
import { FixtureAssistant } from "./ai";
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
const email = z
  .email()
  .max(200)
  .transform((v) => v.toLowerCase());
const text = z.string().trim().min(1).max(200);
const inquiry = z
  .object({
    name: text,
    contact: text,
    message: z.string().max(3000).default(""),
    projectType: z.string().max(100).optional(),
    teamSize: z.coerce.number().int().min(1).max(100000).optional(),
  })
  .strict();
const readSession = (db: DB, req: Request) => {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("uru_session="))
    ?.slice(12);
  return cookie
    ? one(
        db,
        "SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?",
        hash(cookie),
        Date.now(),
      )
    : undefined;
};
function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function passwordMatches(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    scryptSync(password, salt, 64),
  );
}
export function createApp(db: DB) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ...(process.env.NODE_ENV === "production"
              ? []
              : ["'unsafe-inline'"]),
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: [
            "'self'",
            ...(process.env.NODE_ENV === "production" ? [] : ["ws:"]),
          ],
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if (origin) {
        try {
          if (new URL(origin).host !== req.get("host"))
            return res
              .status(403)
              .json({ error: "Cross-origin mutation rejected." });
        } catch {
          return res.status(403).json({ error: "Invalid origin." });
        }
      }
      const key = `${req.ip}:${req.path.startsWith("/auth") ? "auth" : req.path.startsWith("/public") ? "public" : "private"}`;
      const now = Date.now();
      run(
        db,
        "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END",
        key,
        now + 60000,
        now,
        now,
      );
      const limit = one(db, "SELECT count FROM rate_limits WHERE key=?", key);
      if (limit.count > (req.path.startsWith("/auth") ? 20 : 180))
        return res
          .status(429)
          .json({ error: "Too many requests. Try again in one minute." });
    }
    next();
  });
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    }),
  );
  app.use("/api/public", (_req, _res, next) => {
    transaction(db, () => expireOrders(db));
    next();
  });
  const user = (req: Request) =>
    readSession(db, req) ?? fail(401, "Нэвтэрнэ үү / Sign in required.");
  const member = (req: Request, operation = "read") => {
    const u = user(req);
    const m = one(
      db,
      "SELECT m.role,w.* FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.workspace_id=?",
      u.id,
      req.params.ws,
    );
    if (!m) fail(404, "Workspace not found.");
    if (operation === "owner" && m.role !== "owner")
      fail(403, "Owner permission required.");
    if (operation === "publish" && m.role === "staff")
      fail(403, "Manager permission required.");
    return { ...m, user: u };
  };
  const siteFor = (req: Request, operation = "read") => {
    const m = member(req, operation);
    const s = one(
      db,
      "SELECT * FROM sites WHERE id=? AND workspace_id=?",
      req.params.site,
      m.id,
    );
    return { m, s: s ?? fail(404, "Site not found.") };
  };
  const currentSite = (slug: string) => {
    const s = one(
      db,
      "SELECT s.*,w.demo FROM sites s JOIN workspaces w ON w.id=s.workspace_id WHERE s.slug=? AND s.published_id IS NOT NULL",
      slug,
    );
    return s ?? fail(404, "This site has not been published.");
  };
  const customer = (ws: string, name: string, contact: string) => {
    const id = uid();
    run(
      db,
      "INSERT INTO customers(id,workspace_id,name,contact,channel) VALUES(?,?,?,?,?)",
      id,
      ws,
      name,
      contact,
      "website",
    );
    return id;
  };
  const publicData = (s: any, doc: PageDocument, preview = false) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    theme: s.theme,
    business: JSON.parse(s.business),
    document: doc,
    records: publicRecords(db, s.id),
    demo: true,
    preview,
  });
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      database: one(db, "PRAGMA quick_check").quick_check,
      paymentMode: "test",
      socialMode: "test",
    }),
  );
  app.post("/api/auth/register", (req, res) => {
    const body = z
      .object({
        email,
        password: z.string().min(10).max(128),
        name: text,
        workspaceName: text,
      })
      .strict()
      .parse(req.body);
    if (one(db, "SELECT id FROM users WHERE email=?", body.email))
      fail(409, "This email is already registered.");
    const id = uid();
    transaction(db, () => {
      run(
        db,
        "INSERT INTO users VALUES(?,?,?,?)",
        id,
        body.email,
        passwordHash(body.password),
        body.name,
      );
      createWorkspace(db, id, body.workspaceName);
    });
    createSession(id, res);
    res.status(201).json({ id });
  });
  const createSession = (id: string, res: Response) => {
    run(db, "DELETE FROM sessions WHERE expires<?", Date.now());
    const token = randomBytes(32).toString("hex");
    run(
      db,
      "INSERT INTO sessions VALUES(?,?,?)",
      hash(token),
      id,
      Date.now() + 7 * 86400000,
    );
    res.cookie("uru_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure:
        process.env.COOKIE_SECURE === "true" ||
        (process.env.NODE_ENV === "production" &&
          process.env.COOKIE_SECURE !== "false"),
      maxAge: 7 * 86400000,
      path: "/",
    });
  };
  app.post("/api/auth/login", (req, res) => {
    const body = z
      .object({ email, password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    const u = one(db, "SELECT * FROM users WHERE email=?", body.email);
    if (!u || !passwordMatches(body.password, u.password_hash))
      fail(401, "Имэйл эсвэл нууц үг буруу.");
    createSession(u.id, res);
    res.json({ id: u.id });
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("uru_session="))
      ?.slice(12);
    if (token) run(db, "DELETE FROM sessions WHERE token_hash=?", hash(token));
    res.clearCookie("uru_session");
    res.json({ ok: true });
  });
  app.get("/api/session", (req, res) => {
    const u = readSession(db, req);
    res.json({
      user: u ?? null,
      workspaces: u
        ? all(
            db,
            "SELECT w.*,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=?",
            u.id,
          )
        : [],
    });
  });
  app.get("/api/me", (req, res) => {
    const u = user(req);
    res.json({
      user: u,
      workspaces: all(
        db,
        "SELECT w.*,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=?",
        u.id,
      ),
    });
  });
  app.post("/api/workspaces", (req, res) => {
    const u = user(req);
    const { name } = z.object({ name: text }).parse(req.body);
    const id = transaction(db, () => createWorkspace(db, u.id, name));
    res.status(201).json({ id });
  });
  app.get("/api/w/:ws/dashboard", (req, res) => {
    const m = member(req);
    transaction(db, () => expireOrders(db));
    res.json({
      sites: all(
        db,
        "SELECT id,slug,name,theme,published_id,draft_version,domain,domain_state,draft,business FROM sites WHERE workspace_id=? ORDER BY created_at",
        m.id,
      ).map(({ draft, business, ...site }) => {
        const doc = JSON.parse(draft);
        let heading = "",
          image = "";
        walk(doc.root, (n) => {
          if (!heading && n.type === "text" && n.props.tag === "h1")
            heading = n.props.text ?? "";
          if (!image && n.type === "image" && n.props.src) image = n.props.src;
        });
        return {
          ...site,
          preview: {
            heading: heading || doc.title,
            image,
            brand: JSON.parse(business).name,
          },
        };
      }),
      inquiries: all(
        db,
        "SELECT i.*,c.name,c.contact FROM inquiries i JOIN customers c ON i.customer_id=c.id WHERE i.workspace_id=? ORDER BY i.created_at DESC",
        m.id,
      ),
      orders: all(
        db,
        "SELECT o.id,o.site_id,o.status,o.total,o.demo,o.created_at,c.name,c.contact FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.workspace_id=? ORDER BY o.created_at DESC",
        m.id,
      ),
      bookings: all(
        db,
        "SELECT b.*,c.name,c.contact,p.name service_name FROM bookings b JOIN customers c ON c.id=b.customer_id JOIN catalog p ON p.id=b.service_id WHERE b.workspace_id=? ORDER BY starts",
        m.id,
      ),
      customers: all(
        db,
        "SELECT id,name,contact,channel FROM customers WHERE workspace_id=?",
        m.id,
      ),
      audit: all(
        db,
        "SELECT action,entity_id,created_at FROM audit WHERE workspace_id=? ORDER BY rowid DESC LIMIT 30",
        m.id,
      ),
      usage: all(
        db,
        "SELECT capability,SUM(units) units FROM usage WHERE workspace_id=? GROUP BY capability",
        m.id,
      ),
    });
  });
  app.post("/api/w/:ws/team", (req, res) => {
    const m = member(req, "owner");
    const body = z
      .object({ email, role: z.enum(["manager", "staff"]) })
      .strict()
      .parse(req.body);
    const u = one(db, "SELECT id FROM users WHERE email=?", body.email);
    if (!u)
      fail(404, "Ask this person to register first. No email has been sent.");
    if (u.id === m.user.id) fail(400, "You cannot change your own owner role.");
    run(
      db,
      "INSERT INTO memberships VALUES(?,?,?) ON CONFLICT(user_id,workspace_id) DO UPDATE SET role=excluded.role",
      u.id,
      m.id,
      body.role,
    );
    audit(db, m.id, m.user.id, "team.role_changed", u.id);
    res.json({ ok: true });
  });
  app.get("/api/w/:ws/team", (req, res) => {
    const m = member(req);
    res.json(
      all(
        db,
        "SELECT u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?",
        m.id,
      ),
    );
  });
  app.get("/api/w/:ws/sites/:site", (req, res) => {
    const { m, s } = siteFor(req);
    res.json({
      ...publicData(s, JSON.parse(s.draft), true),
      draftVersion: s.draft_version,
      publishedId: s.published_id,
      revisions: all(
        db,
        "SELECT id,created_at FROM revisions WHERE site_id=? ORDER BY rowid DESC",
        s.id,
      ),
      role: m.role,
      businessType: s.business_type,
      goal: s.goal,
    });
  });
  app.post("/api/w/:ws/sites", (req, res) => {
    const m = member(req, "publish");
    const body = z
      .object({
        name: text,
        businessType: z.enum(["products", "services", "bookings", "portfolio"]),
        goal: text,
      })
      .strict()
      .parse(req.body);
    const id = uid(),
      slug = "site-" + id.slice(0, 8);
    const doc = blankDocument(body.name);
    run(
      db,
      "INSERT INTO sites(id,workspace_id,slug,name,theme,business,draft) VALUES(?,?,?,?,?,?,?)",
      id,
      m.id,
      slug,
      body.name,
      "studio",
      JSON.stringify({ name: body.name, phone: "", address: "" }),
      JSON.stringify(doc),
    );
    run(
      db,
      "UPDATE sites SET business_type=?,goal=? WHERE id=?",
      body.businessType,
      body.goal,
      id,
    );
    audit(db, m.id, m.user.id, "site.created", id);
    res.status(201).json({ id, slug });
  });
  app.put("/api/w/:ws/sites/:site", (req, res) => {
    const { m, s } = siteFor(req, "publish");
    const body = z
      .object({
        document: documentSchema,
        baseVersion: z.number().int(),
        business: z
          .object({
            name: text,
            phone: z.string().max(100),
            address: z.string().max(200),
          })
          .optional(),
      })
      .strict()
      .parse(req.body);
    const errors = validateDocument(body.document);
    if (errors.length) fail(422, errors.join("\n"));
    validateReferences(body.document, s.id);
    const result = run(
      db,
      "UPDATE sites SET draft=?,business=?,draft_version=draft_version+1 WHERE id=? AND draft_version=?",
      JSON.stringify(body.document),
      body.business ? JSON.stringify(body.business) : s.business,
      s.id,
      body.baseVersion,
    );
    if (!result.changes)
      fail(409, "A newer draft exists. Reload before saving.");
    audit(db, m.id, m.user.id, "page.saved", s.id);
    res.json({ draftVersion: body.baseVersion + 1 });
  });
  app.post("/api/w/:ws/sites/:site/publish", (req, res) => {
    const { m, s } = siteFor(req, "publish");
    const body = z
      .object({ baseVersion: z.number().int() })
      .strict()
      .parse(req.body);
    if (body.baseVersion !== s.draft_version)
      fail(409, "Save and reload the current draft before publishing.");
    const doc = JSON.parse(s.draft);
    const errors = validateDocument(doc);
    if (errors.length) fail(422, errors.join("\n"));
    validateReferences(doc, s.id);
    const id = uid();
    transaction(db, () => {
      run(
        db,
        "INSERT INTO revisions(id,site_id,document) VALUES(?,?,?)",
        id,
        s.id,
        s.draft,
      );
      run(db, "UPDATE sites SET published_id=? WHERE id=?", id, s.id);
      audit(db, m.id, m.user.id, "page.published", id);
    });
    res.status(201).json({ id, url: `/s/${s.slug}` });
  });
  function validateReferences(doc: PageDocument, siteId: string) {
    const owner = one(db, "SELECT workspace_id FROM sites WHERE id=?", siteId);
    walk(doc.root, (n) => {
      if (
        n.props.src?.startsWith("/api/media/") &&
        !one(
          db,
          "SELECT id FROM media WHERE id=? AND workspace_id=?",
          n.props.src.slice(11),
          owner.workspace_id,
        )
      )
        fail(
          422,
          `${n.name}: image is missing or belongs to another workspace.`,
        );
      for (const a of n.props.actions ?? []) {
        if (a.recordId) {
          const record = one(
            db,
            "SELECT kind FROM catalog WHERE id=? AND site_id=? AND archived=0",
            a.recordId,
            siteId,
          );
          if (!record)
            fail(
              422,
              `${n.name}: selected business record was deleted or belongs to another site.`,
            );
          if (
            (a.type === "addToCart" && record.kind !== "product") ||
            (a.type === "booking" && record.kind !== "service")
          )
            fail(
              422,
              `${n.name}: choose a matching product/service for this action.`,
            );
        }
      }
    });
  }
  app.post("/api/w/:ws/sites/:site/rollback", (req, res) => {
    const { m, s } = siteFor(req, "publish");
    const { revisionId } = z
      .object({ revisionId: z.uuid() })
      .strict()
      .parse(req.body);
    const rev = one(
      db,
      "SELECT * FROM revisions WHERE id=? AND site_id=?",
      revisionId,
      s.id,
    );
    if (!rev) fail(404, "Revision not found.");
    run(db, "UPDATE sites SET published_id=? WHERE id=?", rev.id, s.id);
    audit(db, m.id, m.user.id, "page.rolled_back", rev.id);
    res.json({ ok: true });
  });
  app.get("/api/w/:ws/catalog", (req, res) => {
    const m = member(req);
    res.json(
      all(db, "SELECT id FROM sites WHERE workspace_id=?", m.id).flatMap((s) =>
        publicRecords(db, s.id, true).map((r) => ({ ...r, siteId: s.id })),
      ),
    );
  });
  app.post("/api/w/:ws/catalog", (req, res) => {
    const m = member(req, "publish");
    const body = z
      .object({
        siteId: z.uuid(),
        kind: z.enum(["product", "service", "project"]),
        name: text,
        description: z.string().max(2000),
        price: z.number().int().min(0).max(1000000000),
        category: text,
        image: z.string().regex(/^\/art\/[\w-]+\.svg$/),
        duration: z.number().int().min(15).max(480).optional(),
        stock: z.number().int().min(0).max(100000).default(0),
      })
      .strict()
      .parse(req.body);
    if (
      !one(
        db,
        "SELECT id FROM sites WHERE id=? AND workspace_id=?",
        body.siteId,
        m.id,
      )
    )
      fail(404, "Site not found.");
    const id = uid();
    transaction(db, () => {
      run(
        db,
        "INSERT INTO catalog(id,workspace_id,site_id,kind,name,description,price,image,category,duration) VALUES(?,?,?,?,?,?,?,?,?,?)",
        id,
        m.id,
        body.siteId,
        body.kind,
        body.name,
        body.description,
        body.price,
        body.image,
        body.category,
        body.duration ?? 60,
      );
      if (body.kind === "product")
        run(
          db,
          "INSERT INTO variants VALUES(?,?,?,?)",
          uid(),
          id,
          "Стандарт",
          body.stock,
        );
      audit(db, m.id, m.user.id, "catalog.created", id);
    });
    res.status(201).json({ id });
  });
  app.patch("/api/w/:ws/catalog/:record", (req, res) => {
    const m = member(req, "publish");
    const body = z
      .object({
        name: text,
        description: z.string().max(2000),
        price: z.number().int().min(0).max(1000000000),
        category: text,
      })
      .strict()
      .parse(req.body);
    if (
      !run(
        db,
        "UPDATE catalog SET name=?,description=?,price=?,category=? WHERE id=? AND workspace_id=?",
        body.name,
        body.description,
        body.price,
        body.category,
        req.params.record,
        m.id,
      ).changes
    )
      fail(404, "Record not found.");
    audit(db, m.id, m.user.id, "catalog.updated", req.params.record as string);
    res.json({ ok: true });
  });
  app.post("/api/w/:ws/catalog/:record/archive", (req, res) => {
    const m = member(req, "publish");
    const { archived } = z
      .object({ archived: z.boolean() })
      .strict()
      .parse(req.body);
    if (
      !run(
        db,
        "UPDATE catalog SET archived=? WHERE id=? AND workspace_id=?",
        archived ? 1 : 0,
        req.params.record,
        m.id,
      ).changes
    )
      fail(404, "Record not found.");
    audit(
      db,
      m.id,
      m.user.id,
      archived ? "catalog.archived" : "catalog.restored",
      req.params.record as string,
    );
    res.json({ ok: true });
  });
  app.post("/api/w/:ws/variants/:variant/stock", (req, res) => {
    const m = member(req, "publish");
    const { quantity } = z
      .object({ quantity: z.number().int().min(1).max(10000) })
      .strict()
      .parse(req.body);
    const variant = one(
      db,
      "SELECT v.id FROM variants v JOIN catalog p ON p.id=v.record_id WHERE v.id=? AND p.workspace_id=?",
      req.params.variant,
      m.id,
    );
    if (!variant) fail(404, "Variant not found.");
    run(
      db,
      "UPDATE variants SET stock=stock+? WHERE id=?",
      quantity,
      variant.id,
    );
    audit(db, m.id, m.user.id, "inventory.restocked", variant.id);
    res.json({ ok: true });
  });
  app.patch("/api/w/:ws/inquiries/:id", (req, res) => {
    const m = member(req);
    const { status } = z
      .object({ status: z.enum(["new", "contacted", "closed"]) })
      .strict()
      .parse(req.body);
    if (
      !run(
        db,
        "UPDATE inquiries SET status=? WHERE id=? AND workspace_id=?",
        status,
        req.params.id,
        m.id,
      ).changes
    )
      fail(404, "Inquiry not found.");
    audit(db, m.id, m.user.id, "inquiry." + status, req.params.id as string);
    res.json({ ok: true });
  });
  app.post("/api/w/:ws/orders/:id/fulfill", (req, res) => {
    const m = member(req, "publish");
    if (
      !run(
        db,
        "UPDATE orders SET status='fulfilled_test' WHERE id=? AND workspace_id=? AND status='paid_test'",
        req.params.id,
        m.id,
      ).changes
    )
      fail(409, "Only verified test-paid orders can be fulfilled.");
    audit(db, m.id, m.user.id, "order.fulfilled_test", req.params.id as string);
    res.json({ ok: true });
  });
  app.post("/api/w/:ws/bookings/:id/cancel", (req, res) => {
    const m = member(req);
    if (
      !run(
        db,
        "UPDATE bookings SET status='cancelled' WHERE id=? AND workspace_id=? AND status='reserved_test'",
        req.params.id,
        m.id,
      ).changes
    )
      fail(404, "Active booking not found.");
    audit(db, m.id, m.user.id, "booking.cancelled", req.params.id as string);
    res.json({ ok: true });
  });
  app.get("/api/public/:slug", (req, res) => {
    transaction(db, () => expireOrders(db));
    const s = currentSite(req.params.slug as string);
    const rev = one(
      db,
      "SELECT document FROM revisions WHERE id=?",
      s.published_id,
    );
    res.json(publicData(s, JSON.parse(rev.document)));
  });
  app.post("/api/public/:slug/inquiries", (req, res) => {
    const s = currentSite(req.params.slug as string);
    const body = inquiry.parse(req.body);
    if (body.projectType === "Оффис" && !body.teamSize)
      fail(422, "Оффисын багийн хүний тоог оруулна уу.");
    const id = uid();
    transaction(db, () => {
      run(
        db,
        "INSERT INTO inquiries(id,workspace_id,site_id,customer_id,data,demo) VALUES(?,?,?,?,?,1)",
        id,
        s.workspace_id,
        s.id,
        customer(s.workspace_id, body.name, body.contact),
        JSON.stringify(body),
      );
      audit(db, s.workspace_id, null, "inquiry.created", id);
    });
    res.status(201).json({ id, status: "new", demo: true });
  });
  app.post("/api/public/:slug/orders", (req, res) => {
    const s = currentSite(req.params.slug as string);
    const body = z
      .object({
        name: text,
        contact: text,
        items: z
          .array(
            z
              .object({
                variantId: z.uuid(),
                quantity: z.number().int().min(1).max(20),
              })
              .strict(),
          )
          .min(1)
          .max(30),
        idempotencyKey: z.uuid(),
        accessToken: z.uuid(),
      })
      .strict()
      .parse(req.body);
    const fingerprint = hash(
      JSON.stringify({
        name: body.name,
        contact: body.contact,
        items: body.items,
      }),
    );
    const result = transaction(db, () => {
      expireOrders(db);
      const existing = one(
        db,
        "SELECT * FROM orders WHERE workspace_id=? AND idempotency_key=?",
        s.workspace_id,
        body.idempotencyKey,
      );
      if (existing) {
        if (
          existing.site_id !== s.id ||
          existing.fingerprint !== fingerprint ||
          existing.access_hash !== hash(body.accessToken)
        )
          fail(409, "This request key is already used for another checkout.");
        return existing;
      }
      if (
        new Set(body.items.map((i) => i.variantId)).size !== body.items.length
      )
        fail(422, "Combine duplicate variants before checkout.");
      const lines = body.items.map((item) => {
        const p = one(
          db,
          "SELECT v.id,v.name variant_name,v.stock,p.name,p.price FROM variants v JOIN catalog p ON p.id=v.record_id WHERE v.id=? AND p.site_id=? AND p.archived=0 AND p.kind=?",
          item.variantId,
          s.id,
          "product",
        );
        if (!p) fail(422, "Product variant not available on this site.");
        if (p.stock < item.quantity)
          fail(409, `${p.name}: insufficient stock.`);
        return { ...p, quantity: item.quantity };
      });
      const total = lines.reduce((sum, p) => sum + p.price * p.quantity, 0);
      if (!Number.isSafeInteger(total))
        fail(422, "Order total exceeds supported amount.");
      const id = uid();
      run(
        db,
        "INSERT INTO orders(id,workspace_id,site_id,customer_id,status,total,idempotency_key,fingerprint,access_hash,expires) VALUES(?,?,?,?,'awaiting_payment',?,?,?,?,?)",
        id,
        s.workspace_id,
        s.id,
        customer(s.workspace_id, body.name, body.contact),
        total,
        body.idempotencyKey,
        fingerprint,
        hash(body.accessToken),
        Date.now() + 15 * 60000,
      );
      for (const l of lines) {
        if (
          !run(
            db,
            "UPDATE variants SET stock=stock-? WHERE id=? AND stock>=?",
            l.quantity,
            l.id,
            l.quantity,
          ).changes
        )
          fail(409, "Stock changed. Please try again.");
        run(
          db,
          "INSERT INTO order_items VALUES(?,?,?,?,?,?,?)",
          uid(),
          id,
          l.id,
          l.name,
          l.variant_name,
          l.price,
          l.quantity,
        );
      }
      const invoice = new TestPayments().createInvoice({ id, total });
      run(
        db,
        "INSERT INTO payment_attempts(id,order_id,provider,status,provider_reference) VALUES(?,?,'test','pending',?)",
        uid(),
        id,
        invoice.reference,
      );
      audit(db, s.workspace_id, null, "order.reserved_test", id);
      return one(db, "SELECT * FROM orders WHERE id=?", id);
    });
    res.status(201).json({
      id: result.id,
      total: result.total,
      status: result.status,
      currency: "MNT",
      demo: true,
      expires: result.expires,
    });
  });
  app.post("/api/public/:slug/orders/:id/payment-test", (req, res) => {
    const s = currentSite(req.params.slug as string);
    const { accessToken, outcome } = z
      .object({ accessToken: z.uuid(), outcome: z.enum(["paid", "cancelled"]) })
      .strict()
      .parse(req.body);
    const result = transaction(db, () => {
      expireOrders(db);
      const o = one(
        db,
        "SELECT * FROM orders WHERE id=? AND site_id=? AND access_hash=?",
        req.params.id,
        s.id,
        hash(accessToken),
      );
      if (!o) fail(404, "Order not found.");
      if (
        ["paid_test", "fulfilled_test"].includes(o.status) &&
        outcome === "paid"
      )
        return o;
      if (o.status !== "awaiting_payment") fail(409, `Order is ${o.status}.`);
      const attempt = one(
        db,
        "SELECT * FROM payment_attempts WHERE order_id=?",
        o.id,
      );
      if (outcome === "paid") {
        const verified = new TestPayments().verify(attempt.provider_reference);
        if (!verified.paid || !verified.test)
          fail(409, "Test verification failed.");
        run(db, "UPDATE orders SET status='paid_test' WHERE id=?", o.id);
        run(
          db,
          "UPDATE payment_attempts SET status='verified_test' WHERE id=?",
          attempt.id,
        );
      } else {
        run(db, "UPDATE orders SET status='cancelled' WHERE id=?", o.id);
        run(
          db,
          "UPDATE payment_attempts SET status='cancelled' WHERE id=?",
          attempt.id,
        );
        for (const item of all(
          db,
          "SELECT * FROM order_items WHERE order_id=?",
          o.id,
        ))
          run(
            db,
            "UPDATE variants SET stock=stock+? WHERE id=?",
            item.quantity,
            item.variant_id,
          );
      }
      audit(db, s.workspace_id, null, `payment.${outcome}_test`, o.id);
      return one(db, "SELECT * FROM orders WHERE id=?", o.id);
    });
    res.json({
      id: result.id,
      status: result.status,
      total: result.total,
      demo: true,
    });
  });
  app.post("/api/public/:slug/bookings", (req, res) => {
    const s = currentSite(req.params.slug as string);
    const body = z
      .object({
        name: text,
        contact: text,
        serviceId: z.uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.enum(["10:00", "12:00", "14:00", "16:00"]),
      })
      .strict()
      .parse(req.body);
    const service = one(
      db,
      "SELECT * FROM catalog WHERE id=? AND site_id=? AND archived=0 AND kind='service'",
      body.serviceId,
      s.id,
    );
    if (!service) fail(422, "Choose a service on this site.");
    const starts = Date.parse(`${body.date}T${body.time}:00+08:00`);
    if (
      !Number.isFinite(starts) ||
      starts < Date.now() ||
      starts > Date.now() + 90 * 86400000
    )
      fail(422, "Choose a date within the next 90 days (Ulaanbaatar time).");
    const id = uid();
    try {
      transaction(db, () => {
        run(
          db,
          "INSERT INTO bookings(id,workspace_id,site_id,service_id,customer_id,starts,ends) VALUES(?,?,?,?,?,?,?)",
          id,
          s.workspace_id,
          s.id,
          service.id,
          customer(s.workspace_id, body.name, body.contact),
          starts,
          starts + (service.duration ?? 60) * 60000,
        );
        audit(db, s.workspace_id, null, "booking.reserved_test", id);
      });
    } catch (e) {
      if (String(e).includes("booking_conflict"))
        fail(409, "Энэ цаг захиалагдсан байна. Өөр цаг сонгоно уу.");
      throw e;
    }
    res.status(201).json({ id, status: "reserved_test", demo: true });
  });
  app.get("/api/w/:ws/integrations", (req, res) => {
    const m = member(req);
    res.json({
      meta: {
        mode: "test",
        state:
          one(
            db,
            "SELECT state FROM integrations WHERE workspace_id=? AND provider='meta-test'",
            m.id,
          )?.state ?? "disconnected",
        asset: "Synthetic test Page",
        liveBlocked:
          "Meta app credentials, approved access and current API documentation are required.",
      },
      payments: {
        mode: "test",
        liveBlocked:
          "QPay merchant credentials and current official API documentation are required.",
      },
      domains: all(
        db,
        "SELECT id,slug,domain,domain_state FROM sites WHERE workspace_id=?",
        m.id,
      ),
      ai: {
        mode: "fixture",
        liveBlocked:
          "No model provider configured. Core workflows work without AI.",
        budget: 0,
      },
    });
  });
  app.post("/api/w/:ws/integrations/meta-test", (req, res) => {
    const m = member(req, "owner");
    const { connect } = z
      .object({ connect: z.boolean() })
      .strict()
      .parse(req.body);
    run(
      db,
      "INSERT INTO integrations(id,workspace_id,provider,state,asset_id) VALUES(?,?,'meta-test',?,'synthetic-page') ON CONFLICT(workspace_id,provider) DO UPDATE SET state=excluded.state",
      uid(),
      m.id,
      connect ? "connected_test" : "disconnected",
    );
    audit(
      db,
      m.id,
      m.user.id,
      connect ? "social.connected_test" : "social.disconnected",
      m.id,
    );
    res.json({
      state: connect ? "connected_test" : "disconnected",
      demo: true,
    });
  });
  const socialConnected = (ws: string) => {
    if (
      one(
        db,
        "SELECT state FROM integrations WHERE workspace_id=? AND provider='meta-test'",
        ws,
      )?.state !== "connected_test"
    )
      fail(
        409,
        "Connect the synthetic test Page first. No live Page is connected.",
      );
  };
  function ingestFixture(ws: string, event: typeof syntheticMessage) {
    socialConnected(ws);
    const inserted = run(
      db,
      "INSERT OR IGNORE INTO webhook_events VALUES(?,?,?)",
      uid(),
      ws,
      event.eventId,
    );
    if (inserted.changes)
      run(
        db,
        "INSERT INTO messages(id,workspace_id,channel_id,sender,body,direction,state) VALUES(?,?,?,?,?,'inbound','unanswered')",
        uid(),
        ws,
        event.channelId,
        event.sender,
        event.body,
      );
    return { duplicate: !inserted.changes, demo: true };
  }
  app.post("/api/w/:ws/messages/fixture", (req, res) => {
    const m = member(req, "publish");
    res.json(transaction(db, () => ingestFixture(m.id, syntheticMessage)));
  });
  app.post("/api/webhooks/test/:ws", (req, res) => {
    const secret = process.env.TEST_WEBHOOK_SECRET;
    if (!secret)
      fail(
        503,
        "Configure TEST_WEBHOOK_SECRET to test signed synthetic webhook ingress. This is not a live Meta endpoint.",
      );
    if (
      !verifySignature(
        (req as any).rawBody,
        req.get("x-hub-signature-256"),
        secret!,
      )
    )
      fail(401, "Invalid webhook signature.");
    if (!one(db, "SELECT id FROM workspaces WHERE id=?", req.params.ws))
      fail(404, "Workspace not found.");
    const event = z
      .object({
        eventId: text,
        channelId: text,
        sender: text,
        body: z.string().min(1).max(3000),
      })
      .strict()
      .parse(req.body);
    res.json(
      transaction(db, () => ingestFixture(req.params.ws as string, event)),
    );
  });
  app.get("/api/w/:ws/messages", (req, res) => {
    const m = member(req);
    res.json(
      all(
        db,
        "SELECT * FROM messages WHERE workspace_id=? ORDER BY rowid DESC",
        m.id,
      ),
    );
  });
  app.post("/api/w/:ws/messages/:id/reply", (req, res) => {
    const m = member(req);
    socialConnected(m.id);
    const { body, idempotencyKey } = z
      .object({
        body: z.string().trim().min(1).max(2000),
        idempotencyKey: z.uuid(),
      })
      .strict()
      .parse(req.body);
    const msg = one(
      db,
      "SELECT * FROM messages WHERE id=? AND workspace_id=? AND direction='inbound'",
      req.params.id,
      m.id,
    );
    if (!msg) fail(404, "Message not found.");
    const result = transaction(db, () => {
      const fingerprint = hash(msg.id + ":" + body);
      const previous = one(
        db,
        "SELECT * FROM reply_requests WHERE workspace_id=? AND request_key=?",
        m.id,
        idempotencyKey,
      );
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          fail(409, "Reply key is already used for a different message.");
        return JSON.parse(previous.response);
      }
      const posted = new TestSocial().reply(msg.channel_id, body);
      run(
        db,
        "INSERT INTO messages(id,workspace_id,channel_id,sender,body,direction,state) VALUES(?,?,?,'Танай баг',?,'outbound','sent_test')",
        uid(),
        m.id,
        msg.channel_id,
        body,
      );
      run(db, "UPDATE messages SET state='answered' WHERE id=?", msg.id);
      audit(db, m.id, m.user.id, "message.replied_test", posted.externalId);
      run(
        db,
        "INSERT INTO reply_requests VALUES(?,?,?,?)",
        m.id,
        idempotencyKey,
        fingerprint,
        JSON.stringify(posted),
      );
      return posted;
    });
    res.json({ ...result, demo: true });
  });
  app.get("/api/w/:ws/promotions", (req, res) => {
    const m = member(req);
    res.json(
      all(
        db,
        "SELECT d.*,c.name record_name,j.state job_state,j.error FROM social_drafts d JOIN catalog c ON c.id=d.record_id LEFT JOIN jobs j ON j.draft_id=d.id WHERE d.workspace_id=? ORDER BY d.rowid DESC",
        m.id,
      ),
    );
  });
  app.post("/api/w/:ws/promotions", (req, res) => {
    const m = member(req, "publish");
    const { recordId } = z
      .object({ recordId: z.uuid() })
      .strict()
      .parse(req.body);
    const r = one(
      db,
      "SELECT c.*,s.draft,s.business,s.theme FROM catalog c JOIN sites s ON s.id=c.site_id WHERE c.id=? AND c.workspace_id=?",
      recordId,
      m.id,
    );
    if (!r) fail(404, "Record not found.");
    const id = uid(),
      offerId = uid();
    const doc = blankDocument(r.name + " · Санал");
    doc.root.children = [
      {
        id: uid(),
        type: "text",
        name: "Саналын гарчиг",
        props: { text: r.name, tag: "h1" },
        style: { fontSize: 48 },
        children: [],
      },
      {
        id: uid(),
        type: "text",
        name: "Тайлбар",
        props: { text: r.description },
        style: { fontSize: 20, padding: 18 },
        children: [],
      },
      {
        id: uid(),
        type: "image",
        name: "Саналын зураг",
        props: { src: r.image, alt: r.name },
        style: {
          width: "100%",
          maxWidth: "700px",
          height: "360px",
          objectFit: "cover",
          radius: 14,
        },
        children: [],
      },
      {
        id: uid(),
        type: "button",
        name: "Бүтээгдэхүүн / үйлчилгээ үзэх",
        props: {
          text: "Дэлгэрэнгүй үзэх",
          actions: [
            {
              type: "navigate",
              target:
                "/s/" +
                one(db, "SELECT slug FROM sites WHERE id=?", r.site_id).slug,
            },
          ],
        },
        style: { padding: 18, radius: 10 },
        children: [],
      },
    ];
    // Transactional actions remain on the original site, preserving stable catalog IDs.
    transaction(db, () => {
      run(
        db,
        "INSERT INTO sites(id,workspace_id,slug,name,theme,business,draft) VALUES(?,?,?,?,?,?,?)",
        offerId,
        m.id,
        "offer-" + offerId.slice(0, 8),
        r.name + " · Санал",
        r.theme,
        r.business,
        JSON.stringify(doc),
      );
      run(
        db,
        "INSERT INTO social_drafts(id,workspace_id,site_id,record_id,caption,offer_site_id) VALUES(?,?,?,?,?,?)",
        id,
        m.id,
        r.site_id,
        r.id,
        `${r.name}\n${r.description}\n${r.price.toLocaleString("mn-MN")} ₮\n/s/offer-${offerId.slice(0, 8)}`,
        offerId,
      );
      audit(db, m.id, m.user.id, "promotion.drafted", id);
    });
    res.status(201).json({ id, offerSiteId: offerId });
  });
  app.patch("/api/w/:ws/promotions/:id", (req, res) => {
    const m = member(req, "publish");
    const { caption } = z
      .object({ caption: z.string().min(1).max(4000) })
      .strict()
      .parse(req.body);
    if (
      !run(
        db,
        "UPDATE social_drafts SET caption=? WHERE id=? AND workspace_id=? AND state NOT IN ('published_test')",
        caption,
        req.params.id,
        m.id,
      ).changes
    )
      fail(409, "Draft unavailable or already published.");
    res.json({ ok: true });
  });
  app.post("/api/w/:ws/promotions/:id/publish-test", (req, res) => {
    const m = member(req, "publish");
    socialConnected(m.id);
    const draft = one(
      db,
      "SELECT * FROM social_drafts WHERE id=? AND workspace_id=?",
      req.params.id,
      m.id,
    );
    if (!draft) fail(404, "Draft not found.");
    if (draft.state === "published_test")
      return res.json({
        externalId: draft.external_id,
        demo: true,
        duplicate: true,
      });
    const body = z
      .object({ simulateFailure: z.boolean().default(false) })
      .strict()
      .parse(req.body);
    const result = transaction(db, () => {
      run(
        db,
        "INSERT INTO jobs(id,workspace_id,draft_id,state) VALUES(?,?,?,'queued') ON CONFLICT(draft_id) DO UPDATE SET state='queued'",
        uid(),
        m.id,
        draft.id,
      );
      if (body.simulateFailure) {
        run(
          db,
          "UPDATE jobs SET state='failed',attempts=attempts+1,error='Synthetic provider timeout. Website publication is unchanged.' WHERE draft_id=?",
          draft.id,
        );
        run(
          db,
          "UPDATE social_drafts SET state='failed_test' WHERE id=?",
          draft.id,
        );
        return { state: "failed_test", demo: true };
      }
      const posted = new TestSocial().publish(draft.id, draft.caption);
      run(
        db,
        "UPDATE jobs SET state='complete',attempts=attempts+1,error=NULL WHERE draft_id=?",
        draft.id,
      );
      run(
        db,
        "UPDATE social_drafts SET state='published_test',external_id=? WHERE id=?",
        posted.externalId,
        draft.id,
      );
      audit(db, m.id, m.user.id, "promotion.published_test", draft.id);
      return { ...posted, state: "published_test", demo: true };
    });
    res.json(result);
  });
  app.post("/api/w/:ws/sites/:site/domain", (req, res) => {
    const { m, s } = siteFor(req, "owner");
    const { domain } = z
      .object({
        domain: z
          .string()
          .max(200)
          .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
      })
      .strict()
      .parse(req.body);
    run(
      db,
      "UPDATE sites SET domain=?,domain_state='pending' WHERE id=?",
      domain,
      s.id,
    );
    audit(db, m.id, m.user.id, "domain.requested", s.id);
    res.json({
      state: "pending",
      txtName: `_uru.${domain}`,
      txtValue: `uru-verify=${s.id}`,
      message:
        "DNS verification and certificate provisioning are not configured. The domain is not active.",
    });
  });
  app.post("/api/w/:ws/sites/:site/ai-fixture", (req, res) => {
    const { m, s } = siteFor(req, "publish");
    const { nodeId, text: replacement } = z
      .object({ nodeId: z.string(), text: z.string().min(1).max(500) })
      .strict()
      .parse(req.body);
    const doc = JSON.parse(s.draft);
    const node = findNode(doc, nodeId);
    if (!node || node.type !== "text" || node.props.binding)
      fail(422, "Select unbound text to preview a fixture patch.");
    run(
      db,
      "INSERT INTO usage VALUES(?,?,?,?,CURRENT_TIMESTAMP)",
      uid(),
      m.id,
      "ai_fixture",
      1,
    );
    res.json({
      mode: "fixture",
      baseVersion: s.draft_version,
      patch: new FixtureAssistant().proposeText(nodeId, replacement),
      before: node!.props.text,
      notice:
        "Deterministic patch preview. No AI model was called; no usage charge.",
    });
  });
  app.post("/api/w/:ws/sites/:site/ai-accept", (req, res) => {
    const { m, s } = siteFor(req, "publish");
    const { baseVersion, patch } = z
      .object({
        baseVersion: z.number().int(),
        patch: z
          .object({
            op: z.literal("replaceText"),
            nodeId: z.string(),
            text: z.string().min(1).max(500),
          })
          .strict(),
      })
      .strict()
      .parse(req.body);
    if (s.draft_version !== baseVersion)
      fail(409, "Draft changed. Request a new preview.");
    const doc = JSON.parse(s.draft);
    const node = findNode(doc, patch.nodeId);
    if (!node || node.type !== "text" || node.props.binding)
      fail(422, "Only existing unbound text can be changed.");
    node!.props.text = patch.text;
    const errors = validateDocument(doc);
    if (errors.length) fail(422, errors.join("\n"));
    run(
      db,
      "UPDATE sites SET draft=?,draft_version=draft_version+1 WHERE id=?",
      JSON.stringify(doc),
      s.id,
    );
    audit(db, m.id, m.user.id, "ai.fixture_patch_accepted", s.id);
    res.json({ draftVersion: baseVersion + 1, document: doc });
  });
  app.post(
    "/api/w/:ws/media",
    express.raw({
      type: ["image/png", "image/jpeg", "image/webp"],
      limit: "2mb",
    }),
    (req, res) => {
      const m = member(req, "publish");
      const b = req.body as Buffer;
      const mime = req.get("content-type")?.split(";")[0];
      if (!Buffer.isBuffer(b) || !b.length)
        fail(422, "Upload a PNG, JPEG or WebP file (max 2 MB).");
      const valid =
        mime === "image/png"
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : mime === "image/jpeg"
            ? b[0] === 255 && b[1] === 216
            : mime === "image/webp"
              ? b.toString("ascii", 0, 4) === "RIFF" &&
                b.toString("ascii", 8, 12) === "WEBP"
              : false;
      if (!valid) fail(422, "Image signature does not match its content type.");
      const id = uid();
      run(db, "INSERT INTO media VALUES(?,?,?,?)", id, m.id, mime!, b);
      res.status(201).json({ src: "/api/media/" + id });
    },
  );
  app.get("/api/media/:id", (req, res) => {
    const item = one(
      db,
      "SELECT mime,bytes,workspace_id FROM media WHERE id=?",
      req.params.id,
    );
    if (!item) fail(404, "Image not found.");
    const u = readSession(db, req);
    const permitted =
      u &&
      one(
        db,
        "SELECT 1 FROM memberships WHERE user_id=? AND workspace_id=?",
        u.id,
        item.workspace_id,
      );
    const publicAsset = all(
      db,
      "SELECT r.document FROM sites s JOIN revisions r ON r.id=s.published_id WHERE s.workspace_id=?",
      item.workspace_id,
    ).some((r) => {
      let found = false;
      walk(JSON.parse(r.document).root, (n) => {
        if (n.props.src === "/api/media/" + req.params.id) found = true;
      });
      return found;
    });
    if (!permitted && !publicAsset) fail(404, "Image not found.");
    res
      .type(item.mime)
      .setHeader(
        "Cache-Control",
        publicAsset ? "public,max-age=86400" : "private,no-store",
      );
    res.send(Buffer.from(item.bytes));
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      err instanceof HttpError
        ? err.status
        : err instanceof z.ZodError
          ? 422
          : err.type === "entity.too.large"
            ? 413
            : err instanceof SyntaxError
              ? 400
              : 500;
    if (status === 500)
      console.error(
        JSON.stringify({ event: "request.error", message: err.message }),
      );
    res.status(status).json({
      error:
        status === 500
          ? "Unexpected server error. See server diagnostics."
          : err instanceof z.ZodError
            ? err.issues
                .map((i: any) => `${i.path.join(".")}: ${i.message}`)
                .join("\n")
            : err.message,
    });
  });
  return {
    app,
    readSession: (req: Request) => readSession(db, req),
    publicData,
  };
}
