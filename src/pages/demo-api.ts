/** GitHub Pages adapter. DEVICE-LOCAL DEMO ONLY: no authentication or live services. */
import { makeSeeds, blankDocument } from "../shared/seeds";
import { validateDocument, findNode, walk } from "../shared/schema";
type State = {
  user: any;
  workspaces: any[];
  sites: any[];
  catalog: any[];
  inquiries: any[];
  orders: any[];
  bookings: any[];
  customers: any[];
  messages: any[];
  promotions: any[];
  integrations: Record<string, boolean>;
  audit: any[];
  usage: any[];
};
class DemoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const reject = (message: string, status = 422): never => {
  throw new DemoError(status, message);
};
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
function addWorkspace(s: State, name: string) {
  const ws = { id: id(), name, role: "owner", demo: 1 };
  s.workspaces.push(ws);
  for (const seed of makeSeeds()) {
    const siteId = id();
    const revision = id();
    const records = seed.records.map((r) => ({
      ...r,
      id: id(),
      siteId,
      workspace_id: ws.id,
      variants: r.variants.map((v) => ({ ...v, id: id() })),
    }));
    const document = structuredClone(seed.document);
    s.catalog.push(...records);
    s.sites.push({
      id: siteId,
      workspace_id: ws.id,
      slug:
        seed.slug + (s.workspaces.length === 1 ? "" : "-" + ws.id.slice(0, 6)),
      name: seed.name,
      theme: seed.theme,
      business: seed.business,
      document,
      draftVersion: 1,
      publishedId: revision,
      revisions: [
        {
          id: revision,
          created_at: now(),
          document: structuredClone(document),
        },
      ],
      domain: null,
      domain_state: "unconfigured",
    });
  }
  return ws;
}
function initial(): State {
  const s: State = {
    user: { id: id(), name: "Тест зочин", email: "device-only@example.test" },
    workspaces: [],
    sites: [],
    catalog: [],
    inquiries: [],
    orders: [],
    bookings: [],
    customers: [],
    messages: [],
    promotions: [],
    integrations: {},
    audit: [],
    usage: [],
  };
  addWorkspace(s, "GitHub Pages · Demo");
  return s;
}
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("uru-github-pages-demo-v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("state");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
async function transact<T>(fn: (state: State) => T): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    const req = store.get("workspace");
    let result: T;
    req.onsuccess = () => {
      try {
        const state: State = req.result ?? initial();
        expire(state);
        result = fn(state);
        store.put(state, "workspace");
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}
function expire(s: State) {
  for (const order of s.orders)
    if (order.status === "awaiting_payment" && order.expires < Date.now()) {
      order.status = "expired";
      release(s, order);
    }
}
function release(s: State, o: any) {
  for (const line of o.items) {
    const variant = s.catalog
      .flatMap((r) => r.variants)
      .find((v) => v.id === line.variantId);
    if (variant) variant.stock += line.quantity;
  }
}
function siteData(s: State, site: any, preview = true) {
  const revision = site.revisions.find((r: any) => r.id === site.publishedId);
  if (!preview && !revision)
    reject("This local demo page is not published.", 404);
  return {
    ...site,
    document: preview ? site.document : revision.document,
    records: s.catalog.filter((r) => r.siteId === site.id && !r.archived),
    preview,
    demo: true,
    role: "owner",
  };
}
function checkDoc(doc: any) {
  const errors = validateDocument(doc);
  if (errors.length) reject(errors.join("\n"));
}
function customer(s: State, workspace: string, data: any) {
  if (!data.name?.trim() || !data.contact?.trim())
    reject("Name and contact are required.");
  const c = {
    id: id(),
    workspace_id: workspace,
    name: data.name,
    contact: data.contact,
    channel: "website",
  };
  s.customers.push(c);
  return c;
}
function event(s: State, ws: string, action: string, entity: string) {
  s.audit.unshift({
    workspace_id: ws,
    action,
    entity_id: entity,
    created_at: now(),
  });
}
function handle(s: State, path: string, method: string, b: any): any {
  const a = path.split("/").filter(Boolean);
  if (path === "/session" || path === "/me")
    return { user: s.user, workspaces: s.workspaces };
  if (path === "/health")
    return {
      status: "ok",
      database: "IndexedDB demo",
      paymentMode: "test",
      socialMode: "test",
    };
  if (path === "/auth/logout") return { ok: true };
  if (path === "/workspaces" && method === "POST")
    return addWorkspace(s, b.name ?? "Demo workspace");
  if (a[0] === "public") {
    const site = s.sites.find((site) => site.slug === a[1]);
    if (!site || !site.publishedId) reject("Local demo site not found.", 404);
    const ws = site.workspace_id;
    if (a.length === 2) return siteData(s, site, false);
    if (a[2] === "inquiries") {
      if (b.projectType === "Оффис" && !Number(b.teamSize))
        reject("Оффисын багийн хүний тоог оруулна уу.");
      const c = customer(s, ws, b);
      const inquiry = {
        ...c,
        site_id: site.id,
        customer_id: c.id,
        data: JSON.stringify(b),
        status: "new",
        demo: 1,
        created_at: now(),
      };
      inquiry.id = id();
      s.inquiries.unshift(inquiry);
      event(s, ws, "inquiry.created_demo", inquiry.id);
      return inquiry;
    }
    if (a[2] === "bookings") {
      const service = s.catalog.find(
        (r) =>
          r.id === b.serviceId &&
          r.siteId === site.id &&
          !r.archived &&
          r.kind === "service",
      );
      if (!service) reject("Choose a service.");
      const starts = Date.parse(`${b.date}T${b.time}:00+08:00`);
      const ends = starts + (service.duration ?? 60) * 60000;
      if (
        !Number.isFinite(starts) ||
        starts < Date.now() ||
        starts > Date.now() + 90 * 86400000
      )
        reject("Choose a date within 90 days.");
      if (
        s.bookings.some(
          (r) =>
            r.site_id === site.id &&
            r.status === "reserved_test" &&
            r.starts < ends &&
            r.ends > starts,
        )
      )
        reject("Энэ цаг захиалагдсан байна. Өөр цаг сонгоно уу.", 409);
      const c = customer(s, ws, b);
      const booking = {
        id: id(),
        workspace_id: ws,
        site_id: site.id,
        service_id: service.id,
        service_name: service.name,
        name: c.name,
        contact: c.contact,
        starts,
        ends,
        status: "reserved_test",
        demo: 1,
        created_at: now(),
      };
      s.bookings.push(booking);
      event(s, ws, "booking.reserved_demo", booking.id);
      return booking;
    }
    if (a[2] === "orders" && a.length === 3) {
      if (!Array.isArray(b.items) || !b.items.length)
        reject("Your cart is empty.");
      const previous = s.orders.find(
        (o) => o.idempotencyKey === b.idempotencyKey,
      );
      if (previous) {
        if (previous.accessToken !== b.accessToken)
          reject("Request key is already used.", 409);
        return previous;
      }
      const seen = new Set();
      const items = b.items.map((item: any) => {
        if (seen.has(item.variantId)) reject("Combine duplicate variants.");
        seen.add(item.variantId);
        const record = s.catalog.find(
          (r) =>
            r.siteId === site.id &&
            !r.archived &&
            r.variants.some((v: any) => v.id === item.variantId),
        );
        const variant = record?.variants.find(
          (v: any) => v.id === item.variantId,
        );
        if (
          !variant ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 20
        )
          reject("Invalid cart item.");
        if (variant.stock < item.quantity) reject("Insufficient stock.", 409);
        return {
          ...item,
          name: record.name,
          unit_price: record.price,
          variant_name: variant.name,
        };
      });
      const c = customer(s, ws, b);
      const order = {
        id: id(),
        workspace_id: ws,
        site_id: site.id,
        name: c.name,
        contact: c.contact,
        items,
        total: items.reduce(
          (sum: number, item: any) => sum + item.unit_price * item.quantity,
          0,
        ),
        status: "awaiting_payment",
        idempotencyKey: b.idempotencyKey,
        accessToken: b.accessToken,
        expires: Date.now() + 900000,
        currency: "MNT",
        demo: 1,
        created_at: now(),
      };
      for (const item of items)
        s.catalog
          .flatMap((r) => r.variants)
          .find((v) => v.id === item.variantId).stock -= item.quantity;
      s.orders.unshift(order);
      event(s, ws, "order.reserved_demo", order.id);
      return order;
    }
    if (a[2] === "orders" && a[4] === "payment-test") {
      const o = s.orders.find(
        (o) =>
          o.id === a[3] &&
          o.site_id === site.id &&
          o.accessToken === b.accessToken,
      );
      if (!o) reject("Order not found.", 404);
      if (o.status === "paid_test" && b.outcome === "paid") return o;
      if (o.status !== "awaiting_payment") reject("Order is " + o.status, 409);
      o.status = b.outcome === "paid" ? "paid_test" : "cancelled";
      if (b.outcome !== "paid") release(s, o);
      event(s, ws, "payment." + o.status + "_demo", o.id);
      return o;
    }
  }
  if (a[0] !== "w")
    reject("This operation needs the server-backed version.", 501);
  const ws = a[1];
  if (!s.workspaces.some((w) => w.id === ws))
    reject("Local workspace not found.", 404);
  const site =
    a[2] === "sites" && a[3]
      ? s.sites.find((site) => site.id === a[3] && site.workspace_id === ws)
      : undefined;
  if (a[2] === "dashboard")
    return {
      sites: s.sites
        .filter((r) => r.workspace_id === ws)
        .map((r) => {
          let heading = "",
            image = "";
          walk(r.document.root, (n) => {
            if (!heading && n.type === "text" && n.props.tag === "h1")
              heading = n.props.text ?? "";
            if (!image && n.type === "image") image = n.props.src ?? "";
          });
          return {
            ...r,
            published_id: r.publishedId,
            draft_version: r.draftVersion,
            preview: {
              heading: heading || r.document.title,
              image,
              brand: r.business.name,
            },
          };
        }),
      inquiries: s.inquiries.filter((r) => r.workspace_id === ws),
      orders: s.orders.filter((r) => r.workspace_id === ws),
      bookings: s.bookings.filter((r) => r.workspace_id === ws),
      customers: s.customers.filter((r) => r.workspace_id === ws),
      audit: s.audit.filter((r) => r.workspace_id === ws).slice(0, 30),
      usage: s.usage.filter((r) => r.workspace_id === ws),
    };
  if (a[2] === "sites") {
    if (a.length === 3 && method === "POST") {
      const site = {
        id: id(),
        workspace_id: ws,
        slug: "site-" + id().slice(0, 8),
        name: b.name,
        theme: "studio",
        business: { name: b.name, phone: "", address: "" },
        document: blankDocument(b.name),
        draftVersion: 1,
        revisions: [],
        publishedId: null,
        businessType: b.businessType,
        goal: b.goal,
      };
      s.sites.push(site);
      event(s, ws, "site.created_demo", site.id);
      return site;
    }
    if (!site) reject("Site not found.", 404);
    if (a.length === 4 && method === "GET") return siteData(s, site);
    if (a.length === 4 && method === "PUT") {
      if (site.draftVersion !== b.baseVersion)
        reject("A newer draft exists. Reload before saving.", 409);
      checkDoc(b.document);
      site.document = b.document;
      site.business = b.business ?? site.business;
      site.draftVersion++;
      event(s, ws, "page.saved_demo", site.id);
      return { draftVersion: site.draftVersion };
    }
    if (a[4] === "publish") {
      if (b.baseVersion !== site.draftVersion)
        reject("Save the current draft first.", 409);
      checkDoc(site.document);
      walk(site.document.root, (n) => {
        for (const action of n.props.actions ?? [])
          if (
            action.recordId &&
            !s.catalog.some(
              (r) =>
                r.id === action.recordId && r.siteId === site.id && !r.archived,
            )
          )
            reject(n.name + ": record is unavailable.");
      });
      const revision = {
        id: id(),
        created_at: now(),
        document: structuredClone(site.document),
      };
      site.revisions.unshift(revision);
      site.publishedId = revision.id;
      event(s, ws, "page.published_demo", revision.id);
      return { id: revision.id, url: "?site=" + site.slug };
    }
    if (a[4] === "rollback") {
      if (!site.revisions.some((r: any) => r.id === b.revisionId))
        reject("Revision not found.", 404);
      site.publishedId = b.revisionId;
      event(s, ws, "page.rolled_back_demo", b.revisionId);
      return { ok: true };
    }
    if (a[4] === "domain") {
      site.domain = b.domain;
      site.domain_state = "pending";
      return {
        state: "pending",
        txtName: "_uru." + b.domain,
        txtValue: "demo-only-not-a-real-verification",
        message: "No DNS verification on GitHub Pages demo.",
      };
    }
    if (a[4] === "ai-fixture") {
      const n = findNode(site.document, b.nodeId);
      if (!n || n.type !== "text" || n.props.binding)
        reject("Select unbound text.");
      return {
        mode: "fixture",
        baseVersion: site.draftVersion,
        before: n!.props.text,
        patch: { op: "replaceText", nodeId: b.nodeId, text: b.text },
      };
    }
    if (a[4] === "ai-accept") {
      if (b.baseVersion !== site.draftVersion)
        reject("Draft changed. Request a new preview.", 409);
      const n = findNode(site.document, b.patch.nodeId);
      if (
        !n ||
        n.type !== "text" ||
        n.props.binding ||
        b.patch.op !== "replaceText"
      )
        reject("Unsupported patch.");
      n!.props.text = b.patch.text;
      checkDoc(site.document);
      site.draftVersion++;
      event(s, ws, "patch.accepted_demo", site.id);
      return { document: site.document, draftVersion: site.draftVersion };
    }
  }
  if (a[2] === "catalog") {
    if (a.length === 3 && method === "GET")
      return s.catalog.filter((r) => r.workspace_id === ws);
    if (a.length === 3 && method === "POST") {
      if (!s.sites.some((r) => r.id === b.siteId && r.workspace_id === ws))
        reject("Site not found.", 404);
      const record = {
        ...b,
        id: id(),
        workspace_id: ws,
        variants:
          b.kind === "product"
            ? [{ id: id(), name: "Стандарт", stock: b.stock }]
            : [],
      };
      s.catalog.push(record);
      return record;
    }
    const record = s.catalog.find(
      (r) => r.id === a[3] && r.workspace_id === ws,
    );
    if (!record) reject("Record not found.", 404);
    if (a[4] === "archive") record.archived = b.archived ? 1 : 0;
    else
      for (const key of ["name", "description", "price", "category"])
        if (b[key] !== undefined) record[key] = b[key];
    return { ok: true };
  }
  if (a[2] === "variants") {
    const v = s.catalog
      .filter((r) => r.workspace_id === ws)
      .flatMap((r) => r.variants)
      .find((v) => v.id === a[3]);
    if (!v) reject("Variant not found.", 404);
    v.stock += b.quantity;
    return { ok: true };
  }
  if (a[2] === "inquiries") {
    const r = s.inquiries.find((r) => r.id === a[3] && r.workspace_id === ws);
    if (!r) reject("Inquiry not found.", 404);
    r.status = b.status;
    return { ok: true };
  }
  if (a[2] === "orders") {
    const r = s.orders.find((r) => r.id === a[3] && r.workspace_id === ws);
    if (!r || r.status !== "paid_test")
      reject("Only test-paid orders can be fulfilled.", 409);
    r.status = "fulfilled_test";
    return { ok: true };
  }
  if (a[2] === "bookings") {
    const r = s.bookings.find((r) => r.id === a[3] && r.workspace_id === ws);
    if (!r) reject("Booking not found.", 404);
    r.status = "cancelled";
    return { ok: true };
  }
  if (a[2] === "team") {
    if (method === "GET") return [{ ...s.user, role: "owner" }];
    reject(
      "Team accounts require the server-backed deployment. This browser demo has one local profile.",
      501,
    );
  }
  if (a[2] === "integrations") {
    if (a[3] === "meta-test") {
      s.integrations[ws] = b.connect;
      return { state: b.connect ? "connected_test" : "disconnected" };
    }
    return {
      meta: {
        mode: "test",
        state: s.integrations[ws] ? "connected_test" : "disconnected",
      },
      payments: { mode: "test" },
      ai: { mode: "fixture", budget: 0 },
      domains: s.sites.filter((r) => r.workspace_id === ws),
    };
  }
  if (a[2] === "messages") {
    if (method === "GET")
      return s.messages.filter((r) => r.workspace_id === ws);
    if (!s.integrations[ws])
      reject("Connect the synthetic test Page first.", 409);
    if (a[3] === "fixture") {
      const exists = s.messages.some((r) => r.fixture && r.workspace_id === ws);
      if (!exists)
        s.messages.unshift({
          id: id(),
          workspace_id: ws,
          channel_id: "synthetic-person-001",
          sender: "Туршилтын зочин",
          body: "Сайн байна уу? Ноолууран цамцны M размер байгаа юу?",
          direction: "inbound",
          state: "unanswered",
          demo: 1,
          fixture: true,
          created_at: now(),
        });
      return { duplicate: exists, demo: true };
    }
    const m = s.messages.find((r) => r.id === a[3] && r.workspace_id === ws);
    if (!m) reject("Message not found.", 404);
    const previous = s.messages.find((r) => r.requestKey === b.idempotencyKey);
    if (previous) return { externalId: previous.id, demo: true };
    const reply = {
      id: "test_reply_" + id(),
      workspace_id: ws,
      channel_id: m.channel_id,
      sender: "Танай баг",
      body: b.body,
      direction: "outbound",
      state: "sent_test",
      demo: 1,
      requestKey: b.idempotencyKey,
      created_at: now(),
    };
    s.messages.unshift(reply);
    m.state = "answered";
    return { externalId: reply.id, demo: true };
  }
  if (a[2] === "promotions") {
    if (method === "GET")
      return s.promotions.filter((r) => r.workspace_id === ws);
    if (a.length === 3) {
      const r = s.catalog.find(
        (r) => r.id === b.recordId && r.workspace_id === ws && !r.archived,
      );
      if (!r) reject("Record unavailable.", 404);
      const source = s.sites.find((site) => site.id === r.siteId);
      const offerId = id();
      const doc = blankDocument(r.name + " · Санал");
      doc.root.children = [
        {
          id: id(),
          type: "text",
          name: "Санал",
          props: { text: r.name, tag: "h1" },
          style: { fontSize: 48 },
          children: [],
        },
        {
          id: id(),
          type: "text",
          name: "Тайлбар",
          props: { text: r.description },
          style: { padding: 18, fontSize: 20 },
          children: [],
        },
        {
          id: id(),
          type: "image",
          name: "Зураг",
          props: { src: r.image, alt: r.name },
          style: {
            width: "100%",
            height: "360px",
            objectFit: "cover",
            radius: 14,
          },
          children: [],
        },
        {
          id: id(),
          type: "button",
          name: "Дэлгэрэнгүй",
          props: {
            text: "Дэлгэрэнгүй үзэх",
            actions: [{ type: "navigate", target: "/s/" + source.slug }],
          },
          style: { padding: 18 },
          children: [],
        },
      ];
      s.sites.push({
        id: offerId,
        workspace_id: ws,
        slug: "offer-" + offerId.slice(0, 8),
        name: r.name + " · Санал",
        theme: source.theme,
        business: source.business,
        document: doc,
        draftVersion: 1,
        publishedId: null,
        revisions: [],
      });
      const promotion = {
        id: id(),
        workspace_id: ws,
        record_id: r.id,
        record_name: r.name,
        site_id: source.id,
        offer_site_id: offerId,
        caption: `${r.name}\n${r.description}\n${r.price} ₮`,
        state: "draft",
        created_at: now(),
      };
      s.promotions.unshift(promotion);
      return { id: promotion.id, offerSiteId: offerId };
    }
    const p = s.promotions.find((p) => p.id === a[3] && p.workspace_id === ws);
    if (!p) reject("Draft not found.", 404);
    if (a[4] === "publish-test") {
      if (!s.integrations[ws])
        reject("Connect the synthetic test Page first.", 409);
      if (p.state === "published_test") return p;
      p.state = b.simulateFailure ? "failed_test" : "published_test";
      p.error = b.simulateFailure
        ? "Synthetic provider timeout. Website publication is unchanged."
        : null;
      p.external_id = b.simulateFailure ? null : "test_post_" + p.id;
      return p;
    }
    if (p.state === "published_test") reject("Already published.", 409);
    p.caption = b.caption;
    return { ok: true };
  }
  if (a[2] === "media") {
    const mediaId = id();
    try {
      localStorage.setItem("uru-pages-image-" + mediaId, b.dataUrl);
    } catch {
      reject("Device image storage is full. Choose a smaller image.");
    }
    return { src: "/api/media/" + mediaId };
  }
  reject("This operation is available in the server-backed version.", 501);
}
export async function demoRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    const method = init?.method ?? "GET";
    let body: any = {};
    if (typeof init?.body === "string") body = JSON.parse(init.body);
    else if (init?.body instanceof Blob) {
      const blob = init.body;
      if (
        blob.size > 2 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(blob.type)
      )
        reject("Upload PNG, JPEG or WebP up to 2 MB.");
      body = {
        dataUrl: await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
      };
    }
    const result = await transact((s) => handle(s, path, method, body));
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: error instanceof DemoError ? error.status : 500 },
    );
  }
}
