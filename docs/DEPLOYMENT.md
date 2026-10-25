# GitHub Pages demo deployment

Target repository: `Vpermillion/drag_n_drop_web`.
Target address: `https://vpermillion.github.io/drag_n_drop_web/`.

## What is deployed

The `pages` Vite build is an explicitly labeled interactive browser demo. It shares the editor, page schema, seeds and rendering primitives with the Node application. A separate adapter persists simulated business operations in IndexedDB. It does not publish the SQLite database, `.env`, secrets, customer data, backups, tests or server source to Pages.

A demo profile opens automatically. There is no real authentication. Site editing, local revisions, inquiries, cart/test payments, bookings and synthetic social/promotional actions work within the visitor's browser. These records do not synchronize between devices. A published example link opens the original sample in a different browser, not another visitor's private edits. This is not a live payment or booking deployment.

The Node/SQLite application remains available with `npm run dev` / `npm start`. GitHub Pages does not execute it. Its production security and transaction-integrity tests are separate from the browser adapter; do not cite those as proof of server guarantees on Pages.

## Automatic deployment

`.github/workflows/pages.yml` runs on pushes to `main` and on manual dispatch. It installs Node 24, runs the server/schema tests, builds the Pages variant, uploads only `dist-pages`, and deploys through the official Pages actions. The workflow's deploy job requests only Pages write and OIDC permissions, with read-only source access.

GitHub repository **Settings → Pages → Build and deployment → Source** must be **GitHub Actions**. This setting requires repository administration. The default workflow token cannot enable Pages for a new repository, as documented by `actions/configure-pages` input `enablement`; an authorized GitHub API connection or repository owner must enable it first. The workflow never requests or embeds a personal token.

After enabling Pages, run **Actions → Deploy interactive GitHub Pages demo → Run workflow**, or push a new main commit. Verify the deployment output and open the target address before describing it as live. Pages availability also depends on repository visibility and the account's plan.

If a prebuilt `gh-pages` branch has been published, an alternative is **Deploy from a branch → gh-pages → /(root)**. Use one deployment source, not both simultaneously. The build branch contains the same static Pages artifacts and `.nojekyll`, not the Node server.

## Local verification

```sh
npm ci
npm run build:pages
npm run test:pages
```

The browser test serves only the generated static directory under `/drag_n_drop_web/`; no API backend is started. It exercises editing/reload/local publication, visitor inquiry and owner record, product variant/cart/test payment, booking, synthetic messages/replies, promotion failure/retry, mobile/desktop assets and browser isolation. Use `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`.

`PAGES_BASE_PATH` can override the project path during the build. The public `.env.pages` contains only `VITE_PAGES_DEMO=true`; never put credentials there because Vite build variables are public. Static navigation uses query parameters so Pages does not need an application routing server.

## Verification sources

The implementation checked the official action sources on 2026-10-25:

- `https://raw.githubusercontent.com/actions/starter-workflows/main/pages/static.yml`
- `https://raw.githubusercontent.com/actions/configure-pages/v5/action.yml`
- `https://raw.githubusercontent.com/actions/deploy-pages/v4/README.md`

An environment that blocks `api.github.com` can still push through its configured HTTPS Git proxy, but cannot use the GitHub REST API to enable Pages or inspect deployment runs. Grant API access through environment settings or complete the single Pages source setting in GitHub. Never bypass a blocked network destination or extract proxy credentials.
