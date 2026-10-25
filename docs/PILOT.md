# Supported pilot and operations

## Supported now

A local, single-host demonstration for owners/managers/staff using synthetic catalog businesses, real document/database persistence, public test forms, test checkout and constrained synthetic booking. No live merchant/provider, real salon availability, real ad spend or paid subscription billing has been validated. The platform is not ready to accept paid production customers.

## Install and deploy to a controlled test host

1. Install Node 24+, use the existing checkout, and run `npm ci` using the committed lockfile. Each cloud task already has an isolated checkout; do not create a Git worktree unless explicitly requested.
2. Set `DATABASE_PATH` to a persistent local filesystem volume, not an ephemeral container layer or shared NFS volume. The current topology is a single Node host with SQLite WAL. Do not scale replicas across independent SQLite copies.
3. Run `npm run build`. Configure `PUBLIC_ORIGIN` to the real canonical HTTPS origin. Terminate HTTPS at a configured reverse proxy, preserve the intended Host and Origin, and restrict untrusted forwarded headers. Cookies default to `Secure` in production. Leave `COOKIE_SECURE=false` only on deliberate local HTTP test hosts.
4. Run `npm start`, supervise process restarts, restrict filesystem permissions and check `/api/health` (database quick check plus explicit adapter modes). There is no automatic public deployment step in this repository.
5. Create accounts and explicitly assign team roles. Published test sites are publicly readable under the test host; previews require membership. Do not put real customer/private data into demo site text or public media.
6. Run the automated suites and manually verify the intended business workflow on the actual host. A successful local build or snapshot does not prove a live integration/deployment.

The run scripts load `.env` if present. Environment settings should supply credentials securely; do not put real values in `.env.example`. The example contains no secrets. No service worker, external font/CDN, analytics collector or LLM is needed for ordinary page views.

## Migrations and recovery

Numbered SQL migrations are applied once, recorded in `schema_migrations`, and preserve current records. Migration 1 creates the schema; 2 adds catalog archival; 3 stores business type/goal; 4 adds indexes for business access and expiry; 5 adds durable social reply idempotency. Back up before any future schema change; introduce new numbered migrations rather than editing applied migrations to alter existing data.

`npm run backup` uses the SQLite backup API to produce a consistent copy including committed WAL content. The application database includes uploaded media, revisions, catalogs, customers, messages, audit records and session hashes. Treat the entire backup as sensitive. Current recovery is a database-file restore; external live providers would need independent reconciliation.

```sh
npm run backup
# Stop the application before switching databases.
npm run restore -- .data/backups/<backup>.sqlite .data/restored.sqlite
DATABASE_PATH=.data/restored.sqlite npm start
```

Restore validates integrity and app metadata and refuses to overwrite an existing file or WAL/SHM destination. Verify counts and critical business records in the restored instance before switching the production service. Keep encrypted/off-host backup copies with a defined retention policy and perform recovery drills. Database restore is an operator action; page rollback only changes public content.

## Existing safeguards and limits

- Server membership/role checks, salted password hashes, expiring hashed sessions, SameSite cookies, Origin validation, CSP and fixed public data projections.
- Persistent request rate buckets: 20 auth mutations/minute/IP; 180 public or private mutations/minute/IP/category. These are initial local limits; configure a trusted client-IP policy and edge/bot controls before a shared production host. Behind an unconfigured proxy, users may share its rate bucket.
- One-megabyte JSON limit; 500 page elements and 15 nesting levels; fixed styles/action vocabulary; images limited to PNG/JPEG/WebP and 2 MB. Production needs decoding/re-encoding, malware/abuse controls, per-workspace storage quotas, asset deletion and retention rules.
- Transactional stock reservation with fifteen-minute expiry and database-level booking exclusion. Expiry is evaluated during API traffic and every minute by the single-host maintenance timer. Production needs scheduler monitoring and provider reconciliation.
- Persisted audit events distinguish page saves/publications, role changes, reservations, payment tests, fulfillment, social test posts and accepted patches. Logs report startup mode and unexpected server errors; credentials are not logged. Production needs structured request correlation, monitoring/alerts, redaction review, audit retention and export.
- Synthetic social jobs persist retry state/attempt count, but run synchronously. Production queue/outbox delivery, backoff, provider reconciliation, scheduling and dead-letter operations need implementation.
- `noindex`/private cache policy and authenticated private previews; anonymous media reads only for images in an active published revision. Public pages contain rendered content/canonical metadata before hydration.
- Responsive composition, focus styles, layer/move controls, keyboard shortcuts, 44px visitor form controls and reduced-motion support. Automated accessibility scans are evidence for the tested screens, not a full independent accessibility certification. Mobile editor uses vertically stacked tools/inspector and a 360px canvas.

## Gates before a paid production pilot

- [ ] Choose the exact merchant segment and receipt/tax/eBarimt obligations; document shipping/courier charges, returns, refunds and support responsibility.
- [ ] Implement and provider-test live QPay invoice/status/callback/refund/reconciliation with secure merchant credentials and explicit live/test separation.
- [ ] Verify current Meta policy/docs and complete real OAuth, token storage/lifecycle, approved assets, webhook proof and allowed message/post operations with a test Page. Ads/Instagram need their own access and tests.
- [ ] Implement real DNS ownership checks, custom-domain routing, TLS issuance/renewal and domain failure recovery.
- [ ] Adopt a maintained identity provider or complete verified email, recovery, MFA/session-management and abuse protections; conduct an independent security review.
- [ ] Test multi-user editing/concurrency, quotas, load, real backup restoration, disaster recovery and monitoring on the chosen deployment topology.
- [ ] Add privacy/retention policies, operator support procedures, consent/anti-spam controls and customer-data deletion/export.
- [ ] Complete Mongolian/English localization, content review, keyboard/screen-reader/manual touch testing and live media processing.
- [ ] Confirm real staff/resource/availability rules before claiming production booking support. Current four-slot one-resource calendar is synthetic.
- [ ] If AI is enabled, verify models/prices, enforce per-workspace budgets before requests, evaluate Mongolian and transliterations, and preserve controlled patch acceptance.
- [ ] Define subscription/usage/managed-service boundaries and real billing separately. No plan prices, guaranteed returns or operational staffing promises are made here.
