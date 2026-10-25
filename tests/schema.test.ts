import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSeeds } from "../src/shared/seeds";
import {
  validateDocument,
  migrateDocument,
  moveNode,
  findNode,
  walk,
  cloneNode,
} from "../src/shared/schema";
import { renderToString } from "react-dom/server";
import React from "react";
import { PageRenderer } from "../src/shared/renderer";
test("all three compositions validate and render useful SSR content with the same registry", () => {
  for (const seed of makeSeeds()) {
    assert.deepEqual(validateDocument(seed.document), []);
    const html = renderToString(
      React.createElement(PageRenderer, {
        site: { ...seed, id: "test", demo: true },
      }),
    );
    assert.ok(
      html.includes(seed.document.root.children[0].children[0].props.text!),
    );
    assert.ok(html.length > 5000);
    assert.ok(!html.includes("private_notes"));
  }
});
test("moving a bound button between containers in its collection keeps record identity and its action", () => {
  const doc = makeSeeds()[0].document;
  let card: any, button: any;
  walk(doc.root, (n) => {
    if (n.name === "Бүтээгдэхүүний карт") card = n;
    if (n.props.actions?.some((a) => a.type === "addToCart")) button = n;
  });
  const copy = structuredClone(doc);
  const container = {
    id: "owner-container",
    type: "container" as const,
    name: "Owner layout",
    props: {},
    style: {},
    children: [],
  };
  findNode(copy, card.id)!.children.push(container);
  const moved = moveNode(copy, button.id, container.id, 0);
  assert.equal(findNode(moved, button.id)!.props.actions![0].type, "addToCart");
  assert.deepEqual(validateDocument(moved), []);
  const outside = moveNode(moved, button.id, moved.root.id, 0);
  assert.ok(validateDocument(outside).some((e) => e.includes("record")));
  assert.throws(() => moveNode(moved, card.id, container.id, 0), /itself/);
  assert.equal(findNode(doc, button.id)!.props.actions![0].type, "addToCart");
});
test("versioning, duplicate IDs, arbitrary code, unsafe URLs and unsupported styles are rejected", () => {
  const doc = makeSeeds()[0].document;
  assert.throws(() => migrateDocument({ ...doc, version: 2 }));
  const duplicate = structuredClone(doc);
  duplicate.root.children.push(structuredClone(duplicate.root.children[0]));
  assert.ok(validateDocument(duplicate).some((s) => s.includes("Duplicate")));
  const malicious = structuredClone(doc);
  malicious.root.props.actions = [
    { type: "navigate", target: "javascript:alert(1)" },
  ];
  assert.ok(validateDocument(malicious).length);
  (malicious.root.style as any).backgroundImage = "url(https://evil.example)";
  assert.ok(validateDocument(malicious).length);
});
test("composition reuse creates fresh IDs and documents migrate without losing IDs", () => {
  const doc = makeSeeds()[1].document;
  const migrated = migrateDocument(JSON.parse(JSON.stringify(doc)));
  assert.equal(migrated.root.id, doc.root.id);
  const copy = cloneNode(doc.root);
  const ids = new Set<string>();
  walk(doc.root, (n) => ids.add(n.id));
  walk(copy, (n) => assert.ok(!ids.has(n.id)));
});
