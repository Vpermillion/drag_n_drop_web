# Implementation status

Current direction: **composable website and business platform**, superseding a chatbot-first application. The repository began empty. No previous working code was removed.

## Milestones

| Milestone             | Concrete result                                                                                                                                                                                                                                                                     | Boundary                                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Foundation        | React/TypeScript, shared versioned schema/renderer, Express/SQLite, migrations and runnable local path                                                                                                                                                                              | Deliberate single-host Node architecture; not a Cloudflare deployment                                                                                                                              |
| B — Builder           | Eight primitives, pointer/keyboard-assisted editing, nesting/reordering, styles/mobile overrides, direct text, duplicate/delete, undo/redo, reusable compositions, bindings, interactions, persistent drafts, private preview, immutable publication/rollback; three distinct sites | One page per site; compositions stored per workspace in browser storage; richer navigation, cross-device composition libraries and advanced design tooling remain future work                      |
| C — Backend           | Real password/session auth, owner/manager/staff checks, workspace isolation, catalog create/edit/archive/restock, private media, customers/inquiries, transactional orders, line snapshots, test payment verification, database booking exclusion                                   | All workspaces and payment/booking workflows explicitly test; live merchant, refunds, multi-resource scheduling and production identity lifecycle remain unfinished                                |
| D — Social            | Synthetic Page status, signed test ingress, deduplication, inbound fixtures, human test replies, test publishing, disconnect recovery                                                                                                                                               | Official docs/network access, real app/permissions/credentials and test assets unavailable. No live OAuth/webhook or Meta connection claimed. Comment management and Instagram remain blocked work |
| E — Promotions        | Catalog record creates editable offer page and caption draft; source transaction link; independent website/social delivery states, persisted retry attempts and stable synthetic post ID; controlled patch preview/accept/reject and usage                                          | Ads and live AI provider not activated. No advertising reports fabricated, campaign submitted, spend incurred or model-quality claim made                                                          |
| F — Pilot preparation | Critical tests, production-mode browser journeys, responsive screenshots, security checks, DB backup/restore, initial rate limits/audit/logs and deployment/runbooks                                                                                                                | Local demonstration readiness only. Paid pilot gates in PILOT.md remain open                                                                                                                       |

## Verification evidence

Run the scripts in README to regenerate evidence. Tests use temporary files/databases, no provider credentials, no public deployment, no real posts and no ad spend.

- `npm test`: schema, explicit scope after layout changes, authorization/role denial, draft isolation/rollback, persisted inquiry, server-priced checkout, order history, stock races, cancellation/expiry, booking collision, synthetic webhook authenticity/replay/disconnect, social partial failure/retry, accepted/rejected patch versions, private/cross-tenant media and database backup/restore.
- `npm run build`: TypeScript checking and Vite production bundle.
- `npm run test:browser`: production server, registration, real editor changes, actual pointer insertion, nested inquiry layout, history/keyboard save, reload persistence, publication, guest inquiry, owner record, variants/cart/test payment, booking, all three sites plus dashboard/editor at 360 and 1440px, overflow checks, browser-console/hydration checks, and automated accessibility checks.
- Generated screenshots and accessibility diagnostics are written to ignored `artifacts/`, not shipped as fake product data.

For implementation-session final counts/outcomes, consult the final verification output. An unexecuted command is not a pass, and a local pass does not establish a live provider, published environment snapshot or deployed service.

## Latest local verification — 2026-10-25

Clean locked installation, TypeScript/production build and formatting checks passed. All **18** unit/integration tests passed with no skips. The production browser journey passed for editor changes, guest inquiry, test checkout/booking, synthetic human reply and promotion failure/retry. Ten WCAG A/AA automated scans (three public sites, dashboard and editor, each at 360 and 1440 pixels) reported zero violations; browser console/hydration and horizontal-overflow checks also passed. Desktop/mobile screenshots were inspected. The development-mode registration screen and database health were checked separately, and the backup CLI produced a consistent snapshot. Live external providers and public deployment were not tested.

## Resume next

Complete any failing local checks first. Then obtain current official provider documentation and secure test credentials through environment settings, implement the QPay and Meta live adapters in the documented order, and verify with provider-controlled test assets. Keep all existing synthetic modes labeled and keep customer data isolated. Do not switch labels to live to make a milestone appear complete.

## GitHub Pages variant

A separate, explicitly labeled browser demo is implemented for the repository subpath. `npm run build:pages` and `npm run test:pages` passed: editor persistence/publication, inquiry/order/booking, synthetic social replies and promotion retries, responsive assets and isolated browser state. The Node build and all 18 server/schema tests also pass after the shared path/transport changes. No Node API or SQLite data is included in the Pages artifact. Deployment requires GitHub Pages enablement; actual remote publication must be checked separately. See DEPLOYMENT.md.

## Creative Studio expansion

The editor now includes four original visual looks and four editable starting compositions, compiled Tailwind CSS utilities, scoped CSS declarations, reduced-motion-aware effects and an isolated HTML/CSS/JS widget with counter/mood/accordion examples. Existing document storage, business bindings and publication paths are preserved. The Pages adapter remains device-local. See CREATIVE_STUDIO.md for supported capabilities, restrictions and verification commands.

Creative verification: all **24** unit/integration tests passed. The new creative browser suite passed in both Pages and server modes, including actual iframe pointer interactions, CSS/Tailwind precedence, reduced motion, preserved product actions, parent/cookie isolation and CSP-blocked networking. Four new Studio accessibility scans (desktop/mobile in both modes) reported zero violations. The original Pages and server browser suites also passed after these changes. Creative screenshots were inspected; code and studio controls remain responsive at 360px.
