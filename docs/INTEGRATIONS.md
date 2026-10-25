# Integration activation guide

All existing workspaces are demo/test. Local business flows need no external credentials. Do not paste credentials into chat, source, page documents or browser bundles.

## Actual state

| Capability        | Implemented now                                                                                                                | External prerequisite / unfinished work                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payments          | Server-priced orders, inventory reservation, explicit test invoice verification, idempotency, cancellation/expiry              | QPay merchant onboarding, current official developer contract, credentials, implemented and provider-tested live adapter; refunds and reconciliation                      |
| Facebook          | Synthetic connect/disconnect state, signed synthetic event ingress, deduplication, test messages/replies/posts, retry recovery | Current official API/policy verification, app/business setup, official OAuth and secure per-workspace token storage, approved access, test Page and real end-to-end proof |
| Instagram         | Clearly marked inactive                                                                                                        | Confirm supported professional-account login/API path, correct account assets and approved access; implementation and testing                                             |
| Advertising       | Explicitly unavailable; no fabricated reports, campaign submission or spend                                                    | Independently authorized ad account, verified current Marketing API and currency/billing rules, reviewed campaign flow, idempotency, test execution                       |
| Domains           | Local site resolver, stored domain requests and pending TXT instructions                                                       | Real DNS ownership lookup adapter, provider provisioning, certificate issuance and renewal; active/failed lifecycle tests                                                 |
| AI                | Provider interface, deterministic fixture patch/diff, accept/reject, usage records, no billable model                          | Select provider; verify current models/prices, server-side credentials, limits/budget enforcement and Mongolian quality evaluation                                        |
| Receipts/delivery | No live claims                                                                                                                 | Establish tax/receipt and physical fulfillment requirements with merchant and providers; implement separately                                                             |

## Documentation access evidence

At implementation on **2026-10-25**, the configured network policy allowed package registries and Node documentation. `https://nodejs.org/api/sqlite.html` returned HTTP 200. Requests to the Meta Pages and Messenger documentation below, and the QPay merchant site, were denied by the network proxy (403). No provider endpoints, permission scopes, API versions or token formats were invented to fill that gap. The QPay merchant site is not treated as a verified developer API specification.

For subsequent work, enable access to `developers.facebook.com` and the merchant-confirmed official QPay documentation destination in environment settings. Documentation access alone does not supply credentials or approval. Re-read the current official material before implementing live adapters:

- [Meta Pages API](https://developers.facebook.com/documentation/pages-api)
- [Messenger Platform](https://developers.facebook.com/documentation/business-messaging/messenger-platform)
- [Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business)
- [Instagram Platform](https://developers.facebook.com/documentation/instagram-platform)
- [Marketing API](https://developers.facebook.com/documentation/ads-commerce/marketing-api)

## QPay activation sequence

1. Obtain the merchant's approved contract, test account and current official developer docs through its merchant representative. Confirm environment URLs, authentication, invoice currency/rounding, expiry/cancellation, status verification, callback authenticity, idempotency and refund support from that source.
2. Implement a live `PaymentProvider` beside `TestPayments`. Keep credentials server-only and scoped to the correct merchant/workspace; the current global test implementation must not be switched to live by changing a label.
3. Persist provider invoice IDs and reconciliation evidence. A callback/browser return must trigger provider verification, not mark an order paid. Add duplicate/out-of-order callback, timeout/retry, expiry, cancellation, partial payment if supported, refunds and reconciliation tests against the actual contract.
4. Verify amounts/currency/merchant/order association, fulfillment gates and the merchant's receipt/tax obligations before enabling real payments. Keep test and live records unambiguously separate.

There is currently no live invoice creation URL, QR code, money transfer or refund endpoint in this application. SocialPay/MonPay/delivery/eBarimt remain extension work, not live integrations.

## Meta activation sequence

1. Verify the current official business-login path, API versions, permissions, app-review/business-verification conditions and messaging restrictions for the exact assets/capabilities. Do not copy a scope list from an outdated tutorial.
2. Configure the app and verified HTTPS callback/webhook URLs. Implement state-bound OAuth, secure per-workspace token encryption, token lifecycle/revocation handling and explicit asset selection. A Page is not an ad account and creating a website does not create a Page.
3. Implement official webhook handshake and signature verification from the verified contract. Resolve workspace by the trusted connected asset, not a public workspace ID supplied by a callback. The synthetic `/api/webhooks/test/:ws` route is **not** a production Meta endpoint or OAuth proof.
4. With an authorized test Page, verify an inbound event, deduplication, human reply within permitted use, connection expiry and disconnect/revoke recovery. Add per-conversation assignment/automation routing only after preventing duplicate bot/staff sends. Internal workflow states are not claimed to synchronize with Business Suite.
5. Verify supported Page publication and comment operations before implementing them. Current synthetic post IDs are fixtures. Implement read-only ad reporting with a separately authorized ad account, then explicit campaign review and idempotent submission. Never enable spend as a verification side effect.
6. Only add Instagram through its supported professional-account/API path after independent permission and asset checks.

## Reproducible synthetic social ingress

In Settings, connect the **synthetic test Page**. The Messages screen's test button ingests a fixed event and safely ignores repeats. It does not require a network service or send a real message.

For HMAC ingress tests, configure `TEST_WEBHOOK_SECRET` securely, restart the local server, and POST the JSON fixture below to `/api/webhooks/test/<workspace-id>`. Supply `x-hub-signature-256: sha256=<hex HMAC-SHA256 of exact request bytes>`. This is a local fixture contract; its signature behavior is tested, but its payload/URL does not pretend to be Meta's production protocol.

```json
{
  "eventId": "fixture-002",
  "channelId": "synthetic-person-002",
  "sender": "Тест зочин",
  "body": "Sain baina uu?"
}
```

`npm test` reproduces accepted/rejected signatures, replay deduplication, reply, disconnection and promotion delivery failure/retry without secrets or external requests. The committed fixture contains Cyrillic and Latin-transliterated text for rendering/input coverage; it does **not** establish live AI language quality.

## Domain and AI activation

Domain settings retain a pending request and a TXT instruction. They never claim DNS ownership/certificates are verified. Implement a real DNS/provisioning adapter with pending/failed/active outcomes and verified routing before admitting customer hostnames.

For AI, implement the provider interface only after model availability and pricing are verified. Add secret management, workspace budgets, token/request accounting, per-request limits, untrusted-content defenses and realistic Mongolian/transliteration evaluations. Keep proposed patches restricted to known node IDs; never allow model text to execute code or change payment/permission facts. No page view should invoke a model. The local fixture is deliberately zero-cost and not described as AI-generated output.
