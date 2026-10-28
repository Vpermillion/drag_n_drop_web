import { parseScopedCSS, validateUtilities } from "./creative";
import { z } from "zod";
export const primitives = [
  "container",
  "text",
  "image",
  "button",
  "input",
  "form",
  "collection",
  "conditional",
  "embed",
] as const;
const color = z
  .string()
  .regex(
    /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|transparent|inherit)$/,
  );
const size = z
  .string()
  .max(30)
  .regex(/^(auto|none|(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(px|rem|%|vh|vw))$/);
export const styleSchema = z
  .object({
    display: z.enum(["flex", "grid", "block"]).optional(),
    direction: z.enum(["row", "column"]).optional(),
    wrap: z.boolean().optional(),
    columns: z.number().int().min(1).max(6).optional(),
    gap: z.number().min(0).max(160).optional(),
    padding: z.number().min(0).max(160).optional(),
    width: size.optional(),
    minWidth: size.optional(),
    maxWidth: size.optional(),
    minHeight: size.optional(),
    height: size.optional(),
    fontSize: z.number().min(10).max(160).optional(),
    fontWeight: z.number().int().min(100).max(900).optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    justify: z.enum(["start", "center", "end", "space-between"]).optional(),
    background: color.optional(),
    color: color.optional(),
    borderColor: color.optional(),
    borderWidth: z.number().min(0).max(16).optional(),
    radius: z.number().min(0).max(400).optional(),
    objectFit: z.enum(["cover", "contain"]).optional(),
    position: z.enum(["relative", "absolute"]).optional(),
    anchor: z
      .enum([
        "top-left",
        "top-center",
        "top-right",
        "center-left",
        "center",
        "center-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ])
      .optional(),
    top: z.number().min(-4096).max(4096).optional(),
    left: z.number().min(-4096).max(4096).optional(),
    zIndex: z.number().int().min(0).max(10).optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();
export type Styles = z.infer<typeof styleSchema>;
export const actionSchema = z
  .object({
    type: z.enum([
      "navigate",
      "openPanel",
      "closePanel",
      "setState",
      "filter",
      "addToCart",
      "checkout",
      "inquiry",
      "booking",
    ]),
    target: z.string().max(200).optional(),
    value: z.string().max(200).optional(),
    recordId: z.string().max(80).optional(),
    when: z
      .object({ field: z.string().max(80), equals: z.string().max(200) })
      .optional(),
  })
  .strict();
export type Action = z.infer<typeof actionSchema>;
const propsSchema = z
  .object({
    text: z.string().max(4000).optional(),
    utilities: z
      .string()
      .max(2000)
      .refine((value) => validateUtilities(value).length === 0, {
        error:
          "Unsupported Tailwind classes. Use the supported utility library.",
      })
      .optional(),
    customCSS: z
      .string()
      .max(6000)
      .refine((value) => parseScopedCSS(value).errors.length === 0, {
        error:
          "Invalid scoped CSS. Remove selectors, URLs, @rules or unsupported declarations.",
      })
      .optional(),
    appearance: z
      .object({
        gradient: z
          .enum(["none", "aurora", "mint", "sunset", "midnight"])
          .optional(),
        shadow: z.enum(["none", "soft", "lift", "glow"]).optional(),
        motion: z.enum(["none", "reveal", "float", "pulse"]).optional(),
        hover: z.enum(["none", "lift", "glow", "tilt"]).optional(),
        duration: z.number().min(400).max(6000).optional(),
      })
      .strict()
      .optional(),
    code: z
      .object({
        html: z.string().max(16000),
        css: z.string().max(12000),
        js: z.string().max(12000),
      })
      .strict()
      .optional(),
    src: z
      .string()
      .regex(/^(\/art\/[-\w.]+\.svg|\/api\/media\/[-\w.]+)$/)
      .optional(),
    alt: z.string().max(200).optional(),
    tag: z.enum(["h1", "h2", "h3", "p", "span"]).optional(),
    name: z
      .string()
      .regex(/^[a-zA-Z][\w-]{0,60}$/)
      .optional(),
    label: z.string().max(120).optional(),
    inputType: z
      .enum([
        "text",
        "email",
        "tel",
        "number",
        "date",
        "time",
        "select",
        "textarea",
      ])
      .optional(),
    required: z.boolean().optional(),
    options: z.array(z.string().max(100)).max(40).optional(),
    collection: z.enum(["products", "services", "projects"]).optional(),
    binding: z
      .object({
        source: z.enum(["record", "business"]),
        field: z.enum([
          "name",
          "description",
          "price",
          "image",
          "category",
          "phone",
          "address",
        ]),
      })
      .strict()
      .optional(),
    condition: z
      .object({ field: z.string().max(80), equals: z.string().max(200) })
      .strict()
      .optional(),
    actions: z.array(actionSchema).max(5).optional(),
  })
  .strict();
export type PageNode = {
  id: string;
  type: (typeof primitives)[number];
  name: string;
  props: z.infer<typeof propsSchema>;
  style: Styles;
  mobile?: Styles;
  children: PageNode[];
};
export const nodeSchema: z.ZodType<PageNode> = z.lazy(() =>
  z
    .object({
      id: z.string().regex(/^[\w-]{1,100}$/),
      type: z.enum(primitives),
      name: z.string().max(100),
      props: propsSchema,
      style: styleSchema,
      mobile: styleSchema.optional(),
      children: z.array(nodeSchema).max(100),
    })
    .strict(),
);
export const documentSchema = z
  .object({
    version: z.literal(1),
    title: z.string().min(1).max(150),
    description: z.string().max(300),
    root: nodeSchema,
  })
  .strict();
export type PageDocument = z.infer<typeof documentSchema>;
export type RecordData = {
  id: string;
  kind: "product" | "service" | "project";
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  variants: { id: string; name: string; stock: number }[];
  duration?: number;
};
export type SiteData = {
  id: string;
  slug: string;
  name: string;
  theme: string;
  business: { name: string; phone: string; address: string };
  document: PageDocument;
  records: RecordData[];
  demo: boolean;
  preview?: boolean;
};
export function walk(
  node: PageNode,
  fn: (n: PageNode, parent?: PageNode) => void,
  parent?: PageNode,
) {
  fn(node, parent);
  node.children.forEach((n) => walk(n, fn, node));
}
export function findNode(doc: PageDocument, id: string) {
  let found: PageNode | undefined;
  walk(doc.root, (n) => {
    if (n.id === id) found = n;
  });
  return found;
}
export function validateDocument(input: unknown): string[] {
  const p = documentSchema.safeParse(input);
  if (!p.success)
    return p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const errors: string[] = [];
  const ids = new Set<string>();
  let count = 0;
  const visit = (n: PageNode, scope: string | undefined, depth: number) => {
    count++;
    if (depth > 15) errors.push("Nesting exceeds 15 levels.");
    if (ids.has(n.id)) errors.push(`Duplicate identifier: ${n.id}`);
    ids.add(n.id);
    if (n.type === "collection") scope = n.props.collection;
    if (n.props.binding?.source === "record" && !scope)
      errors.push(
        `${n.name}: connect this element to a collection before using its record.`,
      );
    if (
      !["container", "form", "collection", "conditional"].includes(n.type) &&
      n.children.length
    )
      errors.push(`${n.name}: this primitive cannot contain children.`);
    if (n.type === "collection" && !n.props.collection)
      errors.push(`${n.name}: choose a collection.`);
    if (n.props.code && n.type !== "embed")
      errors.push(`${n.name}: code belongs in an isolated embed element.`);
    if (n.type === "embed" && !n.props.code)
      errors.push(`${n.name}: add an HTML/CSS/JavaScript snippet.`);
    if (n.type === "embed" && (n.props.actions?.length || n.props.binding))
      errors.push(
        `${n.name}: an isolated code widget cannot access business actions or bindings.`,
      );
    const binding = n.props.binding;
    if (binding) {
      if (
        binding.source === "business" &&
        !["name", "phone", "address"].includes(binding.field)
      )
        errors.push(
          `${n.name}: business bindings expose name, phone and address.`,
        );
      if (
        binding.source === "record" &&
        ["phone", "address"].includes(binding.field)
      )
        errors.push(`${n.name}: this record does not expose ${binding.field}.`);
      if (n.type === "image" && binding.field !== "image")
        errors.push(`${n.name}: an image requires an image binding.`);
      if (n.type === "text" && binding.field === "image")
        errors.push(`${n.name}: use an image element for an image binding.`);
    }
    for (const a of n.props.actions ?? []) {
      if (
        a.type === "navigate" &&
        !/^(?:\/(?!\/)[\w/?=#&.%-]*|#[\w-]+)$/.test(a.target ?? "")
      )
        errors.push(`${n.name}: navigation must use a local path.`);
      if (
        ["setState", "filter", "openPanel", "closePanel"].includes(a.type) &&
        !a.target
      )
        errors.push(`${n.name}: choose an interaction target.`);
      if (
        !a.recordId &&
        scope &&
        ((a.type === "addToCart" && scope !== "products") ||
          (a.type === "booking" && scope !== "services"))
      )
        errors.push(
          `${n.name}: choose the correct collection for this business action.`,
        );
      if (["addToCart", "booking"].includes(a.type) && !scope && !a.recordId)
        errors.push(
          `${n.name}: choose a record or place this action in a collection.`,
        );
    }
    n.children.forEach((c) => visit(c, scope, depth + 1));
  };
  visit(p.data.root, undefined, 0);
  if (count > 500) errors.push("A page can contain at most 500 elements.");
  return errors;
}
export function migrateDocument(input: unknown): PageDocument {
  const p = documentSchema.parse(input);
  const errors = validateDocument(p);
  if (errors.length) throw new Error(errors.join("\n"));
  return p;
}
export function moveNode(
  doc: PageDocument,
  id: string,
  parentId: string,
  index: number,
): PageDocument {
  const next = structuredClone(doc);
  if (id === next.root.id) throw new Error("The page root cannot be moved.");
  let parent: PageNode | undefined;
  walk(next.root, (n, p) => {
    if (n.id === id) parent = p;
  });
  const node = findNode(next, id),
    target = findNode(next, parentId);
  if (
    !node ||
    !parent ||
    !target ||
    !["container", "collection", "conditional", "form"].includes(target.type)
  )
    throw new Error("Choose a container destination.");
  let cycle = false;
  walk(node, (n) => {
    if (n.id === parentId) cycle = true;
  });
  if (cycle) throw new Error("An element cannot contain itself.");
  parent.children = parent.children.filter((n) => n.id !== id);
  target.children.splice(
    Math.max(0, Math.min(index, target.children.length)),
    0,
    node,
  );
  return next;
}
export function cloneNode(node: PageNode): PageNode {
  const n = structuredClone(node);
  const ids = new Map<string, string>();
  walk(n, (c) => {
    const old = c.id;
    c.id = crypto.randomUUID();
    ids.set(old, c.id);
  });
  walk(n, (c) => {
    for (const action of c.props.actions ?? []) {
      if (action.target && ids.has(action.target))
        action.target = ids.get(action.target)!;
      if (action.when && ids.has(action.when.field))
        action.when.field = ids.get(action.when.field)!;
    }
    if (c.props.condition && ids.has(c.props.condition.field))
      c.props.condition.field = ids.get(c.props.condition.field)!;
  });
  return n;
}
export const money = (n: number) =>
  new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 0 }).format(n) + " ₮";
