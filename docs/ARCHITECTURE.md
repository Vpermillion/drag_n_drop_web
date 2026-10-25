# Architecture and contracts

## Assessment and decision

There were no application files or existing modules to retain. This is a modular TypeScript/React application, Vite frontend, Express API and Node 24 native SQLite. Node SQLite compatibility was checked against `https://nodejs.org/api/sqlite.html` and exercised locally. The installed versions and integrity hashes are in `package-lock.json`.

The default Cloudflare stack in the specification was a suggested starting point. Native SQLite makes atomic inventory and booking behavior directly testable in this environment without cloud provisioning. This implementation is **not** Worker/D1 compatible without an intentional persistence/runtime adaptation. Do not deploy this server as a Worker. A single process/host with a persistent volume is the supported local pilot topology; SQLite transactions/constraints, rather than JavaScript locks, enforce integrity.

## Modules

- `src/shared/schema.ts`: schema v1, fixed action vocabulary, safe style values, stable IDs, traversal, cloning, moves, semantic validation and version gate.
- `src/shared/renderer.tsx`: the registry for all eight primitives, explicit repeater record scope, responsive CSS, local interaction state, cart and visitor forms. Used by editor, SSR and client hydration.
- `src/shared/seeds.ts`: three original compositions with different structures and visual identities; no private users, credentials or fictitious live results.
- `src/Editor.tsx`: dnd-kit pointer/keyboard sensors, click insertion, accessible layers and move controls, history, inspector, scoped bindings, preview/publishing.
- `server/app.ts`: authenticated API, permissions and typed business services. Browser workspace selectors select context; every private operation checks session membership independently.
- `server/db.ts` and numbered SQL files: relational records, forward migrations, `BEGIN IMMEDIATE` transactions, public record projections and expiry.
- `server/adapters.ts`, `server/ai.ts`: explicit test contracts for payments, synthetic social operations and controlled text patches. They have no network side effects.
- `server/index.ts`: dashboard serving, shared SSR, private previews, local site resolver and process lifecycle.

## Schema and actions

A document contains `{version:1,title,description,root}`. Nodes have stable `id`, primitive `type`, editor name, typed properties, safe style object, mobile overrides and children. Documents reject unknown properties, duplicate IDs, unsupported versions, excess nesting/count, arbitrary code and external/script URLs. Schema v1 is loaded through a validated migration boundary; no older schema is invented. Future versions need explicit migration functions and fixtures before activation.

Container, form, collection and conditional primitives accept children. Collections choose products/services/projects, then resolve each child's `binding.source='record'` to the explicit current record. `business` bindings expose only business name/phone/address. Public projections never include cost/private notes, workspace membership, password/session fields or order access tokens. Collections cannot query customers, inquiries, orders or other private records.

Interactions run in a defined order, optionally gated by a simple field equality. Supported actions:

| Action                 | Parameters / behavior                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| navigate               | A validated local `/path` or `#anchor`; no external/script URLs                                                                 |
| openPanel / closePanel | `cart` or `product` opens built-in panels; another target sets its local state to `open`/`closed` for a conditional composition |
| setState               | target and string value; browser-local, never a server mutation                                                                 |
| filter                 | collection target (`products`, `services`, `projects`) and category value; empty means all                                      |
| addToCart              | Explicit site record ID or the current collection record; selected/default available variant                                    |
| checkout               | Open the cart/checkout panel                                                                                                    |
| inquiry                | Form submission; typed `name`, `contact`, optional `message`, `projectType`, `teamSize`                                         |
| booking                | Form submission; typed `name`, `contact`, `date`, `time`; service from scope/explicit ID                                        |

Inquiry/booking inputs must use the listed field keys. The editor explains these names. An inquiry for `projectType=Оффис` requires `teamSize`. Unknown server parameters are rejected. Booking times are the four synthetic slots exposed by the Nami composition, in Ulaanbaatar time. No arbitrary form endpoints, SQL or JavaScript are accepted.

Document history concerns editing only. It cannot undo or replay business calls. Saved reusable compositions are scoped to the workspace in browser storage, get fresh node IDs on insertion, and strip explicit record IDs; they do not contain a cart, session, customer record or other mutable runtime state. A composition with record bindings must be placed inside a suitable collection or corrected before saving. Cross-device composition libraries and multi-page navigation are future work; each current site has one editable page.

## Authentication and authorization

Passwords use salted Node `scrypt`; raw session tokens exist only in HttpOnly/SameSite=Strict cookies, while SQLite holds SHA-256 session hashes with seven-day expiry. Production defaults to Secure cookies. JSON mutations reject a mismatched Origin; requests use JSON/content types that cannot be silently forged by a cross-origin HTML form. There is no permissive CORS policy. Helmet provides browser security headers and a production CSP without executable inline script. No default account or password is installed.

Owner: team roles and test integration connection, all manager operations. Manager: page/media/catalog mutations, publication, promotions and fulfillment. Staff: read workspace records, handle inquiries, test message replies and cancel bookings. Staff cannot change the catalog, publish pages, run assistant changes or connect an integration. Owner roles cannot be assigned or downgraded through the team form.

Private asset reads require membership until an active published revision references the asset. Cross-workspace image references are rejected before saving/publishing. Uploaded files accept PNG/JPEG/WebP, maximum 2 MB, with basic signature checks and fixed MIME types; no SVG/HTML upload is accepted. Production needs image re-encoding/scanning and storage quotas.

## Transactions and ownership

- Checkout trusts variant IDs/quantities only; name, unit price, variant name and quantity are snapshotted into order lines. Currency is MNT; shipping/tax/discount calculation is not implemented and is not silently added.
- `BEGIN IMMEDIATE` plus conditional `stock>=quantity` writes prevents overselling. Failed orders roll back customer creation and every stock write. Stock cannot go negative at the database layer.
- Fifteen-minute order reservations become expired on subsequent API activity and the single-host maintenance timer (every minute). Cancellation/expiry restores stock once. Production needs monitoring and reconciliation of this maintenance task.
- Idempotency keys are unique per workspace and checked against the site, payload fingerprint and order access capability. Replaying a different checkout under the same key is rejected.
- A random visitor-generated access capability, hashed in storage, is required for test invoice verification/cancellation. No generic `paid=true` parameter is accepted. The only supported verification endpoint clearly identifies itself as a test operation.
- Payments go `pending -> verified_test` independently of `awaiting_payment -> paid_test -> fulfilled_test`; duplicate verification does not duplicate audit events/stock mutation. The adapter cannot move money.
- Booking overlap is rejected by a SQLite trigger across the whole synthetic salon site (one resource/capacity). Cancellation permits a new booking. This is a constrained local booking model, not a production multi-staff availability engine.
- Catalog archival hides records from public data/checkout without destroying variants, order snapshots or historical promotions. Explicit references to unavailable records fail publication validation.
- Website customers are separate submissions, never automatically merged by display name. Synthetic channel users retain their independent channel IDs.

## Publishing and connected work

Save uses a draft version comparison; stale tabs get HTTP 409. Publication validates an immutable revision and atomically changes the live pointer. Rollback selects a revision belonging to the same site, never transaction history. Published HTML includes content, metadata, canonical URL and robots policy; preview is authenticated and `noindex`. Private draft files are not served as static source.

Promotions reference a stable catalog ID, create an editable offer-page draft and caption, and link back to the source site for transactions. Posting is explicit. Website and social states are independent. Synthetic jobs persist attempts, errors and one stable external ID, making retries idempotent. Reply requests also persist a per-workspace idempotency key and payload fingerprint so a transport retry cannot send another synthetic reply. The test adapter completes jobs synchronously for reproducible local testing; there is no claim of a production queue or scheduled social delivery.

The assistant contract only proposes `replaceText` for an existing unbound text node. Preview/accept/reject is explicit, stale versions fail, permissions are rechecked and accepted changes are validated/audited. Usage tracks fixture calls; no billable model runs and live budget remains zero. A future live provider must enforce workspace budgets before making requests and verify model/pricing separately.
