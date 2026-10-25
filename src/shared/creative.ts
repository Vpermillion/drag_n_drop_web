import { parse, walk, generate, lexer, type CssNode } from "css-tree";
import manifest from "./utility-tokens.json";
const supported = new Set(manifest.tokens);
export const utilitySuggestions = [
  "p-6",
  "p-8",
  "rounded-2xl",
  "rounded-full",
  "shadow-lg",
  "bg-violet-50",
  "bg-emerald-50",
  "bg-slate-900",
  "text-white",
  "text-center",
  "font-serif",
  "hover:shadow-xl",
  "hover:-translate-y-1",
  "transition",
  "md:p-12",
];
export function validateUtilities(input: string) {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !supported.has(token))
    .map(
      (token) =>
        `Unsupported Tailwind utility: ${token}. Choose a suggested class or use scoped CSS.`,
    );
}
export function utilityClasses(input = "", mobilePreview = false) {
  return input
    .trim()
    .split(/\s+/)
    .filter((t) => supported.has(t) && (!mobilePreview || !/^(sm|md):/.test(t)))
    .map((t) => "tw:" + t)
    .join(" ");
}
const properties = new Set(
  `background background-color background-image background-position background-size background-repeat background-blend-mode color opacity border border-width border-style border-color border-radius border-top border-bottom border-left border-right box-shadow outline outline-color outline-width outline-offset outline-style padding padding-top padding-right padding-bottom padding-left padding-inline padding-block margin margin-top margin-right margin-bottom margin-left margin-inline margin-block width min-width max-width height min-height max-height aspect-ratio display flex flex-direction flex-wrap flex-grow flex-shrink flex-basis gap row-gap column-gap align-items align-self align-content justify-content justify-items justify-self order grid grid-template-columns grid-template-rows grid-auto-flow grid-auto-columns grid-auto-rows grid-column grid-row place-items place-content font-family font-size font-style font-weight font-variant line-height letter-spacing word-spacing text-align text-decoration text-transform text-shadow text-wrap text-overflow white-space overflow-wrap word-break list-style-type object-fit object-position transform transform-origin transition transition-property transition-duration transition-timing-function filter backdrop-filter clip-path isolation`.split(
    " ",
  ),
);
const functions = new Set(
  `var calc min max clamp rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix linear-gradient radial-gradient conic-gradient repeating-linear-gradient repeating-radial-gradient repeating-conic-gradient cubic-bezier steps translate translateX translateY translateZ translate3d scale scaleX scaleY scale3d rotate rotateX rotateY rotateZ skew skewX skewY matrix matrix3d perspective blur brightness contrast drop-shadow grayscale hue-rotate invert opacity saturate sepia inset circle ellipse polygon path repeat minmax fit-content`
    .toLowerCase()
    .split(" "),
);
export function parseScopedCSS(input: string): {
  css: string;
  errors: string[];
} {
  if (!input.trim()) return { css: "", errors: [] };
  if (/[<>\u0000-\u0008]/.test(input) || input.length > 6000)
    return {
      css: "",
      errors: ["CSS contains unsupported markup or exceeds 6,000 characters."],
    };
  const errors: string[] = [];
  let ast: CssNode;
  try {
    ast = parse(input, {
      context: "declarationList",
      parseCustomProperty: true,
    });
  } catch {
    return {
      css: "",
      errors: [
        "Use CSS declarations such as padding: 24px; — without selectors or @rules.",
      ],
    };
  }
  walk(ast, (node) => {
    if (
      node.type === "Atrule" ||
      node.type === "Rule" ||
      node.type === "Raw" ||
      node.type === "Url"
    )
      errors.push(
        "Selectors, @rules, URLs and unsupported syntax are not allowed in scoped CSS.",
      );
    if (node.type === "Function" && !functions.has(node.name.toLowerCase()))
      errors.push(`Unsupported CSS function: ${node.name}.`);
    if (node.type === "Declaration") {
      const custom = /^--[a-z][a-z0-9-]{0,40}$/.test(node.property);
      if (!custom && !properties.has(node.property))
        errors.push(`Unsupported CSS property: ${node.property}.`);
      if (
        !custom &&
        properties.has(node.property) &&
        !generate(node.value).includes("var(") &&
        !lexer.matchProperty(node.property, node.value).matched
      )
        errors.push(`Invalid CSS value for ${node.property}.`);
      node.important = true;
    }
  });
  return {
    css: errors.length ? "" : generate(ast),
    errors: [...new Set(errors)],
  };
}
export const appearanceGradients = {
  none: "",
  aurora: "linear-gradient(135deg,#eef2ff 0%,#f5e9ff 48%,#ffece4 100%)",
  mint: "linear-gradient(135deg,#e1f4e7 0%,#f6f8d8 100%)",
  sunset: "linear-gradient(125deg,#fff0df 0%,#ffd8d0 50%,#f4d8fc 100%)",
  midnight: "linear-gradient(125deg,#15273e 0%,#3d2e69 65%,#604076 100%)",
};
export const appearanceShadows = {
  none: "",
  soft: "0 8px 30px #263d3412",
  lift: "0 18px 50px #263d3420",
  glow: "0 12px 45px #9d7dd52b",
};
export function sandboxDocument(
  code: { html: string; css: string; js: string },
  runScripts: boolean,
) {
  const css = code.css.replace(/<\/style/gi, "<\\/style");
  const js = code.js.replace(/<\/script/gi, "<\\/script");
  return `<!doctype html><html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>*{box-sizing:border-box}body{margin:0;font-family:"DejaVu Sans",system-ui,sans-serif;color:#253b35}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #a185df;outline-offset:3px}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}${css}</style></head><body>${code.html}${runScripts ? `<script>${js}</script>` : ""}</body></html>`;
}
