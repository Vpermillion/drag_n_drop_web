# Creative Studio

Open an editor and select **✳ Бүтээлч студи / Creative studio**, or use the inspiration card in the block library. Changes use the existing document, undo history, save/version checks and publishing path. They work in both the Node application and the device-local GitHub Pages demo.

## Friendly visual tools

Four original looks—Soft wonder, Slow living, After hours and Quiet confidence—apply color, gradient, radius and shadow to the selected element without replacing its text, actions or bindings. Motion presets add a gentle entrance, slow float or soft pulse. Hover/focus presets add lift, glow or tilt. Motion is disabled while editing and follows the visitor's reduced-motion preference; preview/public rendering uses the same persisted properties.

The four starting compositions—Aurora story, Bento moments, Quiet editorial and A little surprise—are editable containers, text, images, buttons and conditional blocks. They can be taken apart or recombined. Their reveal interaction is browser-local, not a business mutation. Inside a collection, local reveal/input state is scoped to the current record; opening one card does not open every repeated card. Collection filters remain page-wide. Duplicating a composition assigns new node IDs and remaps node-scoped local-state references so one copy does not open another copy's disclosure.

## Tailwind

The application uses Tailwind CSS 4 through its maintained Vite plugin, without a CDN or preflight reset. The supported utility manifest is `src/shared/utility-tokens.json`. Owners enter ordinary class names such as:

```text
p-8 rounded-2xl bg-violet-50 hover:shadow-xl md:p-12
```

Rendering prefixes them with `tw:` so they do not conflict with the dashboard's styles. Supported spacing, layout, typography, palette, borders, radii, shadows and transitions are compiled ahead of time, including `sm:`, `md:`, `hover:` and `focus-visible:` variants. Unsupported classes and arbitrary bracket/URL values produce validation errors; this is a curated Tailwind library, not runtime compilation of every possible Tailwind expression. Extend the manifest to add more compiled utilities.

Tailwind utilities override the visual sliders. Explicit scoped CSS has final priority. Both the editor and published runtime use the same styles. The 360px editor preview excludes desktop-only `sm:`/`md:` utilities even when the owner uses a wide monitor; published pages use the actual browser breakpoints.

## Scoped CSS

The CSS tab accepts declarations for the selected element, for example:

```css
--accent: #72508b;
color: var(--accent);
background: linear-gradient(135deg, #eee8ff, #ffe9df);
border-radius: 28px;
letter-spacing: -0.03em;
```

`css-tree` parses and validates the declarations on both the browser and server. The renderer generates an element-specific selector from the validated node ID; owners cannot provide a selector. Supported properties cover typography, colors/gradients, flex/grid layout, spacing/sizing, borders, shadows, filters, transforms and transitions. Selectors, @rules, resource URLs, HTML markup, unknown functions/properties and invalid values are rejected. Positioning outside the existing bounded layout controls is deliberately excluded from this field.

Declarations affect all breakpoints, so prefer responsive sizes such as `max-width:100%` and `clamp(...)`. For breakpoint-specific styling, use the visual mobile overrides or compiled responsive utilities. Additional CSS features can be explored inside an isolated code widget.

## HTML / CSS / JavaScript widgets

The **HTML / JS** tab contains an editable spark counter, mood switcher and native accordion. Preview a snippet, then insert it as a new **HTML / JS** element or update the selected code widget. Each widget has its own HTML, CSS and JavaScript and a configurable outer size. It does not accept record bindings or host business actions. Tailwind styles the outer block; the iframe's content uses its own CSS.

The widget runs in an iframe with `sandbox="allow-scripts"` and without `allow-same-origin`, popups, forms or top-navigation permission. Its origin is opaque, so it cannot read the parent DOM, parent storage or cookies. A restrictive child CSP disables fetch/XHR/WebSocket connections, external scripts, nested frames, form submission and external assets. No business/session objects or credentials are passed to it. Never paste secrets into a snippet.

On GitHub Pages, the isolated document uses `srcdoc`. On the Node server, a separate `/creative-sandbox` loader serves its own restrictive CSP. The host application's strict script policy remains intact. The parent sends only the snippet document to the known frame; no message from a snippet is accepted as a business command. Editing uses a non-scripted representation; interactive code runs in explicit preview/public rendering.

A frame can still attempt to navigate its own document to a URL; the sandbox prevents it from navigating the parent or gaining a trusted origin. It is not a general network air gap. Publish only snippets you trust.

This boundary does not make arbitrary JavaScript resource-safe: a bad infinite loop or excessive DOM work can still impair the visitor's tab. Do not describe the widget as an arbitrary application backend, a trusted checkout extension or unrestricted third-party integration. Production multi-tenant code publishing requires independent security/abuse/resource testing.

## Verification

```sh
npm test
npm run build:pages
npm run build
npm run test:creative
npm run test:pages
npm run test:browser
```

Creative tests cover supported/rejected CSS and utilities, editable starter validity, duplicate-state isolation, widget schema boundaries, production style precedence, preserved cart behavior, sandbox parent/cookie isolation, blocked network requests, reduced motion, persistence, desktop/mobile rendering and keyboard dismissal. The test uses actual pointer clicks inside the sandbox; synthetic DOM clicks are not substituted for interaction checks.
