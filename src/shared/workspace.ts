import {
  findNode,
  moveNode,
  walk,
  type PageDocument,
  type PageNode,
} from "./schema";

export type Placement = "before" | "inside" | "after";
export const canContain = (node: PageNode) =>
  ["container", "form", "collection", "conditional"].includes(node.type);

export function nodePath(doc: PageDocument, id: string): PageNode[] {
  const search = (node: PageNode, path: PageNode[]): PageNode[] => {
    if (node.id === id) return [...path, node];
    for (const child of node.children) {
      const found = search(child, [...path, node]);
      if (found.length) return found;
    }
    return [];
  };
  return search(doc.root, []);
}

export function uniqueName(doc: PageDocument, base: string) {
  base = base.trim().slice(0, 90) || "Element";
  const names = new Set<string>();
  walk(doc.root, (node) => names.add(node.name));
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(`${base} ${index}`)) index++;
  return `${base} ${index}`.slice(0, 100);
}

export function destination(
  doc: PageDocument,
  targetId: string,
  placement: Placement,
) {
  const path = nodePath(doc, targetId);
  const target = path.at(-1);
  if (!target) throw new Error("Choose an element in the workspace.");
  if (placement === "inside") {
    if (canContain(target))
      return { parent: target, index: target.children.length };
    // Inserting while a leaf is selected places the new sibling immediately after it.
    placement = "after";
  }
  const parent = path.at(-2);
  if (!parent) throw new Error("The page root has no siblings. Choose Inside.");
  return {
    parent,
    index: parent.children.indexOf(target) + (placement === "after" ? 1 : 0),
  };
}

export function insertAt(
  doc: PageDocument,
  node: PageNode,
  targetId: string,
  placement: Placement,
) {
  const next = structuredClone(doc);
  const { parent, index } = destination(next, targetId, placement);
  parent.children.splice(index, 0, structuredClone(node));
  return next;
}

export function moveRelative(
  doc: PageDocument,
  id: string,
  targetId: string,
  placement: Placement,
) {
  if (id === targetId)
    throw new Error("Choose another element as the destination.");
  const { parent, index } = destination(doc, targetId, placement);
  const oldParent = nodePath(doc, id).at(-2);
  const oldIndex =
    oldParent?.children.findIndex((node) => node.id === id) ?? -1;
  // moveNode removes the item first, so adjust a destination expressed in the old list.
  return moveNode(
    doc,
    id,
    parent.id,
    index - (oldParent?.id === parent.id && oldIndex < index ? 1 : 0),
  );
}

export function groupNode(doc: PageDocument, id: string, group: PageNode) {
  const next = structuredClone(doc);
  const target = findNode(next, id);
  const parent = nodePath(next, id).at(-2);
  if (!target || !parent)
    throw new Error("Select an element below the page to group.");
  const index = parent.children.indexOf(target);
  const folder = structuredClone(group);
  folder.children = [target];
  // Move free-position geometry onto the new folder; its child then uses flow.
  const absolute = target.style.position === "absolute";
  const mobileAbsolute =
    (target.mobile?.position ?? target.style.position) === "absolute";
  if (absolute || mobileAbsolute) {
    for (const key of [
      "position",
      "anchor",
      "top",
      "left",
      "width",
      "height",
      "zIndex",
    ] as const) {
      if (absolute && target.style[key] !== undefined)
        (folder.style as Record<string, unknown>)[key] = target.style[key];
      const mobileGeometry = mobileAbsolute
        ? { ...target.style, ...target.mobile }
        : target.mobile;
      if (target.mobile && mobileGeometry?.[key] !== undefined) {
        folder.mobile ??= {};
        (folder.mobile as Record<string, unknown>)[key] = mobileGeometry[key];
      }
    }
    delete folder.style.minHeight;
  }
  if (absolute)
    Object.assign(target.style, {
      position: "relative",
      anchor: "top-left",
      top: 0,
      left: 0,
      width: "100%",
    });
  if ((absolute || mobileAbsolute) && target.mobile)
    Object.assign(target.mobile, {
      position: "relative",
      anchor: "top-left",
      top: 0,
      left: 0,
      width: "100%",
    });
  parent.children.splice(index, 1, folder);
  return next;
}
