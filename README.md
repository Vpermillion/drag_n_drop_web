# Үрү · composable business studio

A Mongolian-first website editor and connected business workspace. This implements the composable-platform direction; a chatbot is not the product foundation.

The repository was empty. The application now has a shared page schema/renderer, an actual editor, SQLite-backed business workflows and three distinct editable sample sites. Everything runs locally without payment, AI or Meta credentials.

## GitHub Pages interactive demo

The repository also includes a **device-local browser demo** for `https://vpermillion.github.io/drag_n_drop_web/`. Build it with `npm run build:pages`. This URL is a deployment target, not a claim of a successful deployment; see the deployment guide and actual GitHub Pages status.

The Pages build uses IndexedDB, an automatic demo profile and the same editor/renderer. You can edit/save locally, publish a local revision, submit sample inquiries, run test checkout/booking and try synthetic messages/promotions. There is **no backend, secure login, shared workspace, live integration or server-rendered SEO** in that mode. Customizations and transactions stay in the current browser; clearing site data removes them. It does not replace the server-backed application below. See [deployment](docs/DEPLOYMENT.md).

## Run

Requires Node **24+** (tested with 24.19.0); SQLite is provided by Node. No Docker or database service is needed.

```sh
npm ci --cache /tmp/uru-npm-cache
npm run dev
```

The server listens on port 3000. Create an account in the application; there are **no default passwords or seeded users**. Registration creates your own isolated **demo workspace** with three draft sites:

- **Эрдэнэ**: catalog, category filters, variants, product detail panel, cart, stock reservation, order snapshots and test payment.
- **Ором**: services/projects and a conditional quotation form that creates a persisted inquiry.
- **Нами**: service bookings backed by a database overlap constraint. Availability is explicitly synthetic; this is not a live salon booking service.

Open a site in the editor, change its layout/text, save and publish. Open its local public route, submit a request or make a test purchase, then find the result under **Бизнес**. All examples use the same editable primitives and runtime.

Optional `.env` configuration is loaded by the run scripts. See [.env.example](.env.example). Never commit actual credentials. English can be selected in the interface; primary navigation, onboarding and dashboard text are translated. Detailed inspector/business terminology and seed content are currently Mongolian and need a complete localization pass before an English-language pilot.

```sh
npm run build
npm start
```

Production mode serves the built frontend and server-rendered published pages. It is still a **single-host Node pilot**, not a deployed SaaS or Cloudflare Worker. Use persistent storage and HTTPS before hosting it. Production cookies default to `Secure`; `COOKIE_SECURE=false` is only for local HTTP testing.

## Workspace Studio

The builder has a Roblox Studio-inspired toolbar, folder Explorer and properties panel. Insert elements above, inside or below a selection; rename, group, reorder and nest them. Free-position mode adds nine anchors, X/Y controls and a drag handle with independent mobile overrides. See [Workspace Studio](docs/WORKSPACE_STUDIO.md).

## Creative Studio

Select an element, then open **✳ Бүтээлч студи / Creative studio** for four visual looks, four editable starting compositions, gradients/shadows, motion/hover effects, compiled Tailwind utilities and scoped CSS. The HTML / JS tab previews and inserts an isolated interactive widget; code cannot access parent business data or checkout. See [Creative Studio](docs/CREATIVE_STUDIO.md) for supported CSS/Tailwind capabilities and the sandbox boundary.

## Editor

Insert or drag containers, text, images, buttons, inputs, forms, collections, conditional views and isolated HTML / JS widgets. Select elements on the canvas or in layers. Nest/move using drag handles or the destination selector; reorder with the arrow controls. The resize handle changes width. Duplicate/delete, undo/redo, direct text editing, reusable compositions, binding scope, mobile overrides, style controls, preview, save, publication history and rollback are implemented. `Ctrl/Cmd+S` saves; `Ctrl/Cmd+Z` and `Ctrl/Cmd+Shift+Z` undo/redo editor changes only.

A collection explicitly defines the current record. A product button continues to use that record when its layout changes inside the collection. Invalid scope, cycle, unsafe navigation and deleted record references produce validation errors. Form action fields are a defined contract, not arbitrary server code; see [architecture](docs/ARCHITECTURE.md).

Drafts persist in SQLite with optimistic concurrency checks. Publish creates an immutable revision; saving later drafts does not change the live site. Rollback switches the public revision without changing orders, payments or inquiries. Private previews require workspace membership and carry `noindex` and `private,no-store`. Published HTML already contains page content and metadata before JavaScript runs. Local URLs use `/s/<slug>` or `<slug>.localhost`.

## Verify

```sh
npm test
npm run build
npm run test:browser
npm run test:creative
npm run test:workspace
```

Browser tests require Chromium (`/usr/bin/chromium` by default; set `CHROMIUM_PATH` for a different installation). The test starts/stops its own production server with a temporary SQLite database and uses real UI actions. Screenshots go to ignored `artifacts/`. It does not modify your development database or connect to external providers.

Tests cover tree operations/schema validation, membership boundaries and roles, private media, draft/publication isolation, inquiry persistence, server totals, immutable order snapshots, competing stock reservations, booking conflicts, duplicate payment verification, webhook signatures/replay handling, promotion partial failure/retry, controlled patch acceptance, and backup/restore. Browser coverage includes editing/nesting, actual pointer insertion, undo/redo, save/reload, publication, visitor inquiry, test purchase and booking, responsive checks and automated accessibility scans.

## Data and recovery

The default database is `.data/uru.sqlite`, including media, revisions, sessions, audit events and business records. Migrations in `server/` apply on startup and are tracked in `schema_migrations`. Existing data is preserved. **Do not delete `.data` to refresh dependencies.**

```sh
npm run backup
npm run restore -- .data/backups/<backup>.sqlite .data/restored.sqlite
```

Restore checks integrity and refuses an existing destination. Stop the server before switching `DATABASE_PATH` to the verified restored file. Back up to separate persistent storage, protect access to backups, and practice recovery before a real pilot. See [pilot operations](docs/PILOT.md).

For a fresh demo, create another workspace in Settings. There is no destructive seed reset disguised as a normal business action.

## Current boundaries

**Implemented locally:** editor, authentication, workspace roles, catalog CRUD via archival, image upload, inquiry/order/booking persistence, publication/rollback, inventory integrity, test payments, signed synthetic social fixtures/replies, record-to-offer/social drafts, independent website/social delivery states, retryable synthetic jobs, audit events, observed business reports, rate limits and recovery tools.

**Explicitly simulated:** payments, salon availability, Meta messages/replies/posts and assistant patch generation. None moves money, contacts Facebook, calls a model or proves provider approval.

**Externally blocked / unfinished for paid production:** verified QPay merchant integration/refunds, official Meta OAuth/permissions/webhooks and test Page validation, real Instagram/ads, verified domains/TLS, production asset storage, live AI/model/pricing configuration, receipts/tax/courier requirements, email verification/recovery/MFA, public bot/abuse controls and full localization. See [integration activation](docs/INTEGRATIONS.md), [milestone status](docs/STATUS.md) and [pilot checklist](docs/PILOT.md).
