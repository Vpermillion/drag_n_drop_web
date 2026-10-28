import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSeeds, blankDocument } from "../src/shared/seeds";
import {
  findNode,
  validateDocument,
  walk,
  type PageNode,
} from "../src/shared/schema";
import {
  groupNode,
  insertAt,
  moveRelative,
  nodePath,
  uniqueName,
} from "../src/shared/workspace";
import { cssStyle, pageCSS } from "../src/shared/renderer";

const element = (
  id: string,
  type: PageNode["type"] = "container",
): PageNode => ({ id, name: id, type, props: {}, style: {}, children: [] });
test("workspace insertion and relative moves maintain exact sibling order in both directions", () => {
  const doc = blankDocument("Workspace");
  doc.root.children = [element("a"), element("b"), element("c")];
  const inserted = insertAt(doc, element("new", "button"), "b", "before");
  assert.deepEqual(
    inserted.root.children.map((n) => n.id),
    ["a", "new", "b", "c"],
  );
  const after = moveRelative(inserted, "a", "b", "after");
  assert.deepEqual(
    after.root.children.map((n) => n.id),
    ["new", "b", "a", "c"],
  );
  const before = moveRelative(after, "c", "new", "before");
  assert.deepEqual(
    before.root.children.map((n) => n.id),
    ["c", "new", "b", "a"],
  );
  const nested = moveRelative(before, "new", "b", "inside");
  assert.equal(findNode(nested, "b")!.children[0].id, "new");
  assert.equal(nodePath(nested, "new").at(-2)!.id, "b");
  assert.throws(() => moveRelative(nested, "b", "new", "inside"), /itself/);
  assert.throws(() => moveRelative(nested, doc.root.id, "a", "after"), /root/);
  assert.throws(
    () => insertAt(doc, element("x"), doc.root.id, "before"),
    /root/,
  );
  assert.deepEqual(
    doc.root.children.map((n) => n.id),
    ["a", "b", "c"],
  );
});
test("leaf insertion creates the next sibling and workspace naming avoids existing names", () => {
  const doc = blankDocument("Workspace");
  doc.root.children = [
    element("Button", "button"),
    element("Button 2", "button"),
  ];
  assert.equal(uniqueName(doc, "Button"), "Button 3");
  const next = insertAt(doc, element("Text", "text"), "Button", "inside");
  assert.deepEqual(
    next.root.children.map((n) => n.id),
    ["Button", "Text", "Button 2"],
  );
});
test("grouping a bound button preserves record scope, identity, actions and sibling position", () => {
  const doc = makeSeeds()[0].document;
  let id = "";
  walk(doc.root, (n) => {
    if (n.props.actions?.some((a) => a.type === "addToCart")) id = n.id;
  });
  const original = structuredClone(findNode(doc, id)!);
  const path = nodePath(doc, id);
  const index = path.at(-2)!.children.findIndex((n) => n.id === id);
  const grouped = groupNode(doc, id, element("folder"));
  assert.deepEqual(findNode(grouped, id), original);
  assert.equal(
    findNode(grouped, path.at(-2)!.id)!.children[index].id,
    "folder",
  );
  assert.deepEqual(validateDocument(grouped), []);
  assert.equal(findNode(doc, "folder"), undefined);
});
test("anchored free positioning validates, renders and has matching editor wrapper geometry", () => {
  const site = { ...makeSeeds()[0], id: "test", demo: true };
  const button = element("float-button", "button");
  button.style = {
    position: "absolute",
    anchor: "bottom-right",
    top: -20,
    left: -24,
    width: "180px",
  };
  button.mobile = { anchor: "top-left", top: 16, left: 12 };
  site.document.root.children.push(button);
  assert.deepEqual(validateDocument(site.document), []);
  const style = cssStyle(button.style);
  assert.equal(style.left, "calc(100% + -24px)");
  assert.equal(style.top, "calc(100% + -20px)");
  assert.equal(style.translate, "-100% -100%");
  assert.ok(
    pageCSS(site, true).includes('.canvas-node[data-node-id="float-button"]'),
  );
  assert.ok(!pageCSS(site).includes("canvas-node"));
  button.style.left = 5000;
  assert.ok(validateDocument(site.document).length);
});

test("mobile-only free positioning groups without scaling desktop widths twice", () => {
  const doc = blankDocument("Responsive grouping");
  const button = element("responsive-button", "button");
  button.style = { width: "50%", position: "relative" };
  button.mobile = {
    position: "absolute",
    anchor: "bottom-right",
    top: -16,
    left: -12,
  };
  doc.root.children = [button];
  const grouped = groupNode(doc, button.id, element("responsive-folder"));
  const folder = findNode(grouped, "responsive-folder")!;
  const child = findNode(grouped, button.id)!;
  assert.equal(folder.style.width, undefined);
  assert.equal(child.style.width, "50%");
  assert.deepEqual(folder.mobile, {
    position: "absolute",
    anchor: "bottom-right",
    top: -16,
    left: -12,
    width: "50%",
  });
  assert.deepEqual(child.mobile, {
    position: "relative",
    anchor: "top-left",
    top: 0,
    left: 0,
    width: "100%",
  });
  assert.deepEqual(validateDocument(grouped), []);
  assert.equal(cssStyle({ ...child.style, ...child.mobile }).translate, "none");
});
