import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseScopedCSS,
  validateUtilities,
  utilityClasses,
  sandboxDocument,
} from "../src/shared/creative";
import {
  createComposition,
  createCodeNode,
} from "../src/creative/compositions";
import { validateDocument, cloneNode, walk } from "../src/shared/schema";
import { pageCSS } from "../src/shared/renderer";
const doc = (root: ReturnType<typeof createComposition>) => ({
  version: 1 as const,
  title: "Creative test",
  description: "",
  root,
});
test("all creative starters are editable primitives and local reveal references survive duplication", () => {
  for (const kind of ["aurora", "bento", "editorial", "reveal"]) {
    const source = createComposition(kind);
    assert.deepEqual(validateDocument(doc(source)), []);
    const copy = cloneNode(source);
    assert.notEqual(copy.id, source.id);
    let condition = false,
      action = false;
    walk(copy, (n) => {
      if (n.props.condition) {
        assert.equal(n.props.condition.field, copy.id);
        condition = true;
      }
      for (const a of n.props.actions ?? [])
        if (["openPanel", "closePanel"].includes(a.type)) {
          assert.equal(a.target, copy.id);
          action = true;
        }
    });
    assert.ok(condition && action);
    assert.deepEqual(validateDocument(doc(copy)), []);
  }
});
test("scoped CSS supports gradients, typography, variables and grid without escaping its element", () => {
  const input =
    "--accent:#72508b; color:var(--accent); background:linear-gradient(135deg,#eee8ff,#ffe9df); grid-template-columns:repeat(2,minmax(0,1fr)); border-radius:30px;";
  const parsed = parseScopedCSS(input);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.css.includes("border-radius:30px!important"));
  const root = createComposition("aurora");
  root.props.customCSS = input;
  assert.deepEqual(validateDocument(doc(root)), []);
  const css = pageCSS({
    id: "x",
    slug: "x",
    name: "x",
    theme: "studio",
    business: { name: "x", phone: "", address: "" },
    records: [],
    document: doc(root),
    demo: true,
  });
  assert.ok(css.includes(".published-site .pn-" + root.id));
});
test("CSS rejects external resources, global selectors, at-rules, markup and invalid values", () => {
  for (const input of [
    '@import "https://example.test/x.css";',
    "background:url(https://example.test/track);",
    "background:u\\72l(https://example.test/track);",
    "color:red;} body{display:none}",
    'content:"</style><script>alert(1)</script>";',
    "-moz-binding:url(x);",
    "position:fixed;",
    "padding:potato;",
    "background:paint(secret);",
  ])
    assert.ok(parseScopedCSS(input).errors.length, input);
});
test("Tailwind accepts only compiled utilities and rejects arbitrary URL values", () => {
  assert.deepEqual(
    validateUtilities("p-6 rounded-2xl bg-violet-50 md:p-12 hover:shadow-xl"),
    [],
  );
  assert.equal(utilityClasses("p-6 rounded-2xl"), "tw:p-6 tw:rounded-2xl");
  assert.ok(validateUtilities("bg-[url(https://example.test)]").length);
  const root = createComposition("bento");
  root.props.utilities = "not-compiled-class";
  assert.ok(validateDocument(doc(root)).length);
});
test("raw JavaScript is accepted only inside an isolated unbound code widget", () => {
  const widget = createCodeNode();
  assert.deepEqual(validateDocument(doc(widget)), []);
  widget.props.actions = [{ type: "checkout" }];
  assert.ok(validateDocument(doc(widget)).length);
  delete widget.props.actions;
  widget.type = "text";
  assert.ok(validateDocument(doc(widget)).length);
});
test("sandbox documents disable network, external scripts and form submission; editor omits preset scripts", () => {
  const widget = createCodeNode();
  const html = sandboxDocument(widget.props.code!, true);
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(html.includes("form-action 'none'"));
  assert.ok(html.includes("spark-button"));
  const editing = sandboxDocument(widget.props.code!, false);
  assert.ok(!editing.includes("addEventListener"));
  assert.ok(html.includes("prefers-reduced-motion"));
});
