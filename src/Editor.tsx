import Explorer from "./editor/Explorer";
import { geometryUtilityClasses } from "./shared/creative";
import {
  canContain,
  nodePath,
  insertAt,
  moveRelative,
  groupNode,
  uniqueName,
  type Placement,
} from "./shared/workspace";
import { createCodeNode } from "./creative/compositions";
import { previewHref, siteHref } from "./paths";
import { apiFetch } from "./transport";
import React, {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  useDndContext,
  pointerWithin,
  rectIntersection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { api } from "./api";
import { PageRenderer } from "./shared/renderer";
import {
  primitives,
  findNode,
  walk,
  moveNode,
  cloneNode,
  validateDocument,
  type PageNode,
  type PageDocument,
  type SiteData,
  type Styles,
  type Action,
} from "./shared/schema";
const CreativeStudio = lazy(() => import("./creative/CreativeStudio"));
const names: Record<string, string> = {
  container: "Контейнер",
  text: "Текст",
  image: "Зураг",
  button: "Товч",
  input: "Талбар",
  form: "Форм",
  collection: "Цуглуулга",
  conditional: "Нөхцөл",
  embed: "HTML / JS",
};
const icons: Record<string, string> = {
  container: "▣",
  text: "T",
  image: "▧",
  button: "↗",
  input: "▭",
  form: "☷",
  collection: "▦",
  conditional: "◇",
  embed: "</>",
};
function primitive(type: PageNode["type"]): PageNode {
  if (type === "embed") return createCodeNode();
  return {
    id: crypto.randomUUID(),
    type,
    name: names[type],
    props:
      type === "text"
        ? { text: "Өөрийн түүхийг энд бичээрэй", tag: "p" }
        : type === "button"
          ? {
              text: "Дэлгэрэнгүй",
              actions: [{ type: "openPanel", target: "cart" }],
            }
          : type === "image"
            ? { src: "/art/editorial.svg", alt: "Зургийн тайлбар" }
            : type === "input"
              ? { name: "message", label: "Мэдээлэл", inputType: "text" }
              : type === "collection"
                ? { collection: "products" }
                : type === "conditional"
                  ? { condition: { field: "projectType", equals: "Оффис" } }
                  : type === "form"
                    ? { actions: [{ type: "inquiry" }] }
                    : {},
    style:
      type === "container" || type === "form"
        ? {
            display: "flex",
            direction: "column",
            gap: 16,
            padding: 24,
            minHeight: "80px",
          }
        : type === "image"
          ? { width: "100%", height: "240px", objectFit: "cover" }
          : type === "collection"
            ? { display: "grid", columns: 3, gap: 24 }
            : type === "button"
              ? { padding: 14, radius: 8 }
              : type === "text"
                ? { fontSize: 20 }
                : {},
    children: [],
  };
}
function LibraryItem({
  type,
  insert,
  compact = false,
}: {
  compact?: boolean;
  type: PageNode["type"];
  insert: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "library-" + type,
    data: { type },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={compact ? "ribbon-insert" : "library-item"}
      onClick={insert}
      aria-label={compact ? `Insert ${type}` : undefined}
      title={names[type]}
      style={
        transform
          ? {
              transform: `translate(${transform.x}px,${transform.y}px)`,
              zIndex: 50,
            }
          : undefined
      }
    >
      <span>{icons[type]}</span>
      <small>{names[type]}</small>
    </button>
  );
}
function CanvasDrop({
  node,
  placement,
}: {
  node: PageNode;
  placement: Placement;
}) {
  const { active } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({
    id: `canvas-${placement}-${node.id}`,
    data: { nodeId: node.id, placement },
  });
  return (
    <div
      ref={setNodeRef}
      data-canvas-drop={placement}
      className={`canvas-drop canvas-drop-${placement} ${active ? "is-drag-active" : ""} ${isOver ? "is-over" : ""}`}
    >
      <span>
        {placement === "before" ? "↑ Above / Дээр" : "↓ Below / Доор"}
      </span>
    </div>
  );
}
function CanvasNode({
  node,
  selected,
  select,
  children,
  scope,
  resize,
  reposition,
  style,
  root,
  mobilePreview,
}: {
  node: PageNode;
  selected: boolean;
  select: () => void;
  children: ReactNode;
  scope?: string;
  resize: (width: number) => void;
  reposition: (left: number, top: number) => void;
  style: Styles;
  root: boolean;
  mobilePreview: boolean;
}) {
  const isContainer = [
    "container",
    "form",
    "collection",
    "conditional",
  ].includes(node.type);
  const key = node.id + "-" + (scope ?? "page");
  const {
    setNodeRef: dragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id: "drag-" + key, data: { nodeId: node.id } });
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: "drop-" + key,
    data: { nodeId: node.id },
    disabled: !isContainer,
  });
  return (
    <div
      ref={(el) => {
        dragRef(el);
        dropRef(el);
      }}
      className={`canvas-node ${geometryUtilityClasses(node.props.utilities, mobilePreview)} ${selected ? "selected" : ""} ${isOver ? "drop-over" : ""} ${isDragging ? "dragging" : ""}`}
      data-node-id={node.id}
      onClick={(e) => {
        e.stopPropagation();
        select();
      }}
    >
      {!root && <CanvasDrop node={node} placement="before" />}
      <div className="node-content">{children}</div>
      {!root && <CanvasDrop node={node} placement="after" />}
      {selected && (
        <>
          <div className="node-tag">
            <button {...listeners} {...attributes} aria-label="Элемент чирэх">
              ⠿
            </button>
            <span>{node.name}</span>
            {style.position === "absolute" && (
              <button
                aria-label="Move freely"
                title="Drag to position inside this container"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const handle = e.currentTarget;
                  const el = handle.closest<HTMLElement>(".canvas-node")!;
                  const startX = e.clientX,
                    startY = e.clientY;
                  const startLeft = el.offsetLeft,
                    startTop = el.offsetTop;
                  const move = (event: PointerEvent) => {
                    el.style.left = `${startLeft + event.clientX - startX}px`;
                    el.style.top = `${startTop + event.clientY - startY}px`;
                  };
                  const cleanup = () => {
                    el.style.removeProperty("left");
                    el.style.removeProperty("top");
                    handle.removeEventListener("pointermove", move);
                    handle.removeEventListener("pointerup", up);
                    handle.removeEventListener("pointercancel", cancel);
                  };
                  const up = (event: PointerEvent) => {
                    cleanup();
                    reposition(
                      Math.max(
                        -4096,
                        Math.min(
                          4096,
                          Math.round(
                            (style.left ?? 0) + event.clientX - startX,
                          ),
                        ),
                      ),
                      Math.max(
                        -4096,
                        Math.min(
                          4096,
                          Math.round((style.top ?? 0) + event.clientY - startY),
                        ),
                      ),
                    );
                  };
                  const cancel = () => cleanup();
                  handle.setPointerCapture(e.pointerId);
                  handle.addEventListener("pointermove", move);
                  handle.addEventListener("pointerup", up);
                  handle.addEventListener("pointercancel", cancel);
                }}
              >
                ✥
              </button>
            )}
          </div>
          <button
            className="resize-handle"
            aria-label="Өргөн өөрчлөх"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const el = e.currentTarget.parentElement!;
              const start = e.clientX,
                width = el.getBoundingClientRect().width;
              const up = (event: PointerEvent) => {
                resize(
                  Math.max(
                    60,
                    Math.min(1440, Math.round(width + event.clientX - start)),
                  ),
                );
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointerup", up, { once: true });
            }}
          />{" "}
        </>
      )}
      {isContainer && !node.children.length && (
        <span className="empty-drop">+ Элемент оруулах эсвэл энд чирэх</span>
      )}
    </div>
  );
}
export default function Editor({
  ws,
  siteId,
  onBack,
  notify,
  en,
}: {
  ws: string;
  siteId: string;
  onBack: () => void;
  notify: (s: string) => void;
  en: boolean;
}) {
  const [site, setSite] = useState<
    | (SiteData & {
        draftVersion: number;
        publishedId?: string;
        revisions: { id: string; created_at: string }[];
        role: string;
      })
    | null
  >(null);
  const [doc, setDoc] = useState<PageDocument | null>(null);
  const [selected, setSelected] = useState("");
  const [creativeOpen, setCreativeOpen] = useState(
    new URLSearchParams(location.search).get("studio") === "1",
  );
  const [creativeTab, setCreativeTab] = useState("looks");
  const [leftTab, setLeftTab] = useState("library");
  const [placement, setPlacement] = useState<Placement>("inside");
  const [renameRequest, setRenameRequest] = useState(0);
  const [rightTab, setRightTab] = useState("design");
  const [mobile, setMobile] = useState(false);
  const [history, setHistory] = useState<PageDocument[]>([]);
  const [future, setFuture] = useState<PageDocument[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [compositions, setCompositions] = useState<PageNode[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("uru-compositions-" + ws) ?? "[]");
    } catch {
      return [];
    }
  });
  const [patch, setPatch] = useState<any>(null);
  const [patchText, setPatchText] = useState("");
  const [business, setBusiness] = useState<SiteData["business"] | null>(null);
  const load = () =>
    api(`/w/${ws}/sites/${siteId}`)
      .then((data) => {
        setSite(data);
        setDoc(data.document);
        setBusiness(data.business);
        setSelected(data.document.root.id);
        setDirty(false);
        setHistory([]);
        setFuture([]);
      })
      .catch((e) => notify(e.message));
  useEffect(() => {
    void load();
  }, [siteId]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  function commit(next: PageDocument) {
    if (!doc || JSON.stringify(doc) === JSON.stringify(next)) return;
    setHistory((h) => [...h.slice(-49), doc]);
    setFuture([]);
    setDoc(next);
    setDirty(true);
    setErrors([]);
  }
  function update(fn: (copy: PageDocument) => void) {
    if (!doc) return;
    const next = structuredClone(doc);
    fn(next);
    commit(next);
  }
  const node = doc ? findNode(doc, selected) : undefined;
  const parent = () => {
    let p: PageNode | undefined;
    if (doc)
      walk(doc.root, (n, par) => {
        if (n.id === selected) p = par;
      });
    return p;
  };
  const scope = () => {
    if (!doc || !node) return "";
    let path: PageNode[] = [];
    const search = (n: PageNode, anc: PageNode[]) => {
      if (n.id === node.id) path = anc;
      n.children.forEach((c) => search(c, [...anc, n]));
    };
    search(doc.root, []);
    return (
      path.reverse().find((n) => n.type === "collection")?.props.collection ??
      (node.type === "collection" ? node.props.collection : "") ??
      ""
    );
  };
  function insert(
    type: PageNode["type"],
    targetId = selected,
    where = placement,
  ) {
    if (!doc) return;
    const newNode = primitive(type);
    newNode.name = uniqueName(doc, newNode.name);
    try {
      commit(insertAt(doc, newNode, targetId, where));
      setSelected(newNode.id);
    } catch (error) {
      notify((error as Error).message);
      return;
    }
    if (type === "embed") {
      setCreativeTab("code");
      setCreativeOpen(true);
    }
  }
  function insertComposition(newNode: PageNode) {
    if (!doc) return;
    newNode.name = uniqueName(doc, newNode.name);
    try {
      commit(insertAt(doc, newNode, selected, placement));
      setSelected(newNode.id);
    } catch (error) {
      notify((error as Error).message);
    }
  }
  function duplicate() {
    if (!doc || !node || selected === doc.root.id) return;
    const copy = cloneNode(node);
    copy.name = uniqueName(doc, node.name + " copy");
    commit(insertAt(doc, copy, selected, "after"));
    setSelected(copy.id);
  }
  function group() {
    if (!doc || !node || selected === doc.root.id) return;
    const folder = primitive("container");
    folder.name = uniqueName(doc, en ? "Folder" : "Хавтас");
    folder.style = {
      display: "flex",
      direction: "column",
      gap: 0,
      position: "relative",
    };
    commit(groupNode(doc, selected, folder));
    setSelected(folder.id);
  }
  function remove() {
    if (!doc || selected === doc.root.id) return;
    const p = parent();
    if (!p) return;
    update((d) => {
      const dest = findNode(d, p.id)!;
      dest.children = dest.children.filter((n) => n.id !== selected);
    });
    setSelected(p.id);
  }
  function moveOut() {
    if (!doc) return;
    const p = parent();
    if (p && p.id !== doc.root.id)
      commit(moveRelative(doc, selected, p.id, "after"));
  }
  function undo() {
    if (!doc || !history.length) return;
    setFuture((f) => [doc, ...f]);
    setDoc(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setDirty(true);
  }
  function redo() {
    if (!doc || !future.length) return;
    setHistory((h) => [...h, doc]);
    setDoc(future[0]);
    setFuture((f) => f.slice(1));
    setDirty(true);
  }
  async function save() {
    if (!doc || !site) return false;
    const invalid = validateDocument(doc);
    if (invalid.length) {
      setErrors(invalid);
      return false;
    }
    setSaving(true);
    try {
      const result = await api(`/w/${ws}/sites/${siteId}`, "PUT", {
        document: doc,
        baseVersion: site.draftVersion,
        business,
      });
      setSite((s) => (s ? { ...s, draftVersion: result.draftVersion } : s));
      setDirty(false);
      setSavedAt(
        new Date().toLocaleTimeString("mn-MN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      notify(en ? "Draft saved" : "Ноорог хадгалагдлаа");
      return result.draftVersion as number;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function publish() {
    const version = dirty ? await save() : site?.draftVersion;
    if (!version) return;
    try {
      const result = await api(`/w/${ws}/sites/${siteId}/publish`, "POST", {
        baseVersion: version,
      });
      setSite((s) =>
        s
          ? {
              ...s,
              publishedId: result.id,
              revisions: [
                { id: result.id, created_at: new Date().toISOString() },
                ...s.revisions,
              ],
            }
          : s,
      );
      notify(
        en
          ? "Published. The live revision is now available."
          : "Нийтлэгдлээ. Зочны урсгалыг сайтаас туршина уу.",
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const stateRef = useRef({
    undo,
    redo,
    save,
    dirty,
    duplicate,
    group,
    remove,
  });
  stateRef.current = { undo, redo, save, dirty, duplicate, group, remove };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const editable = (e.target as HTMLElement).matches(
        "input,textarea,select,[contenteditable=true]",
      );
      if (
        !editable &&
        (e.ctrlKey || e.metaKey) &&
        ["d", "g"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        e.key.toLowerCase() === "d"
          ? stateRef.current.duplicate()
          : stateRef.current.group();
      }
      if (!editable && e.key === "F2") {
        e.preventDefault();
        setLeftTab("layers");
        setRenameRequest((value) => value + 1);
      }
      if (!editable && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        stateRef.current.remove();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void stateRef.current.save();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !editable) {
        e.preventDefault();
        e.shiftKey ? stateRef.current.redo() : stateRef.current.undo();
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (stateRef.current.dirty) e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("beforeunload", leave);
    };
  }, []);
  function setProps(props: Partial<PageNode["props"]>) {
    update((d) => {
      Object.assign(findNode(d, selected)!.props, props);
    });
  }
  function setStyle(props: Partial<Styles>) {
    update((d) => {
      const n = findNode(d, selected)!;
      if (mobile) n.mobile = { ...n.mobile, ...props };
      else n.style = { ...n.style, ...props };
    });
  }
  function dragEnd(e: DragEndEvent) {
    if (!e.over || !doc) return;
    const target = e.over.data.current?.nodeId as string;
    if (!target) return;
    const where: Placement = e.over.data.current?.placement ?? "inside";
    if (e.active.data.current?.type) {
      insert(e.active.data.current.type, target, where);
      return;
    }
    const id = e.active.data.current?.nodeId as string;
    if (id && id !== target) {
      try {
        commit(moveRelative(doc, id, target, where));
        setSelected(id);
      } catch (error) {
        notify((error as Error).message);
      }
    }
  }
  function shift(delta: number) {
    const p = parent();
    if (!p || !doc) return;
    const idx = p.children.findIndex((n) => n.id === selected);
    try {
      commit(moveNode(doc, selected, p.id, Math.max(0, idx + delta)));
    } catch (e) {
      notify((e as Error).message);
    }
  }
  useEffect(() => {
    if (doc && !findNode(doc, selected)) setSelected(doc.root.id);
    if (doc?.root.id === selected) setPlacement("inside");
  }, [doc, selected]);
  if (!site || !doc) return <div className="loading">Студи нээгдэж байна…</div>;
  const style = mobile ? { ...node?.style, ...node?.mobile } : node?.style;
  return (
    <div className="editor-shell studio-workspace">
      {creativeOpen && node && (
        <Suspense
          fallback={
            <div className="loading creative-loading" role="status">
              Opening creative studio…
            </div>
          }
        >
          <CreativeStudio
            key={selected + creativeTab}
            initialTab={creativeTab}
            node={node}
            en={en}
            onChange={(fn) => update((d) => fn(findNode(d, selected)!))}
            onInsert={insertComposition}
            onClose={() => setCreativeOpen(false)}
          />
        </Suspense>
      )}
      <header className="editor-top">
        <button
          className="icon-btn"
          aria-label="Буцах"
          onClick={() => {
            if (dirty && !window.confirm("Хадгалаагүй өөрчлөлтийг орхих уу?"))
              return;
            onBack();
          }}
        >
          ←
        </button>
        <div className="editor-site">
          <span className="studio-mark" aria-hidden="true">
            ▰
          </span>
          <strong>
            {site.business.name}
            <small>URU / WEBSITE STUDIO</small>
          </strong>
          <span>
            Нүүр хуудас <b>⌄</b>
          </span>
        </div>
        <span className={`save-state ${dirty ? "unsaved" : ""}`}>
          {dirty ? "● Хадгалаагүй" : savedAt ? "✓ " + savedAt : "✓ Хадгалсан"}
        </span>
        <div className="editor-devices">
          <button
            className={!mobile ? "active" : ""}
            onClick={() => setMobile(false)}
            aria-label="Desktop layout"
          >
            ▰
          </button>
          <button
            className={mobile ? "active" : ""}
            onClick={() => setMobile(true)}
            aria-label="Mobile layout"
          >
            ▯
          </button>
        </div>
        <button
          className="creative-launch"
          aria-label="Open creative studio"
          onClick={() => {
            setCreativeTab("looks");
            setCreativeOpen(true);
          }}
        >
          <span>✳</span> {en ? "Creative studio" : "Бүтээлч студи"} <i>↗</i>
        </button>
        <div className="editor-actions">
          <button
            className="icon-btn"
            disabled={!history.length}
            onClick={undo}
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            className="icon-btn"
            disabled={!future.length}
            onClick={redo}
            aria-label="Redo"
          >
            ↷
          </button>
          <button
            className="subtle"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "…" : en ? "Save" : "Хадгалах"}
          </button>
          <button
            className="subtle"
            onClick={async () => {
              if (dirty && !(await save())) return;
              window.open(previewHref(siteId), "_blank", "noopener");
            }}
          >
            {en ? "Preview" : "Урьдчилан харах"} ↗
          </button>
          <button
            className="primary"
            disabled={saving || site.role === "staff"}
            onClick={() => void publish()}
          >
            {en ? "Publish" : "Нийтлэх"} ↗
          </button>
        </div>
      </header>
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const hits = pointerWithin(args);
          return hits.length
            ? hits.sort((a, b) => {
                const ra = args.droppableRects.get(a.id),
                  rb = args.droppableRects.get(b.id);
                return (
                  (ra ? ra.width * ra.height : 0) -
                  (rb ? rb.width * rb.height : 0)
                );
              })
            : rectIntersection(args);
        }}
        onDragEnd={dragEnd}
      >
        <div className="studio-ribbon" aria-label="Workspace tools">
          <div className="ribbon-group ribbon-palette">
            <span className="ribbon-label">{en ? "INSERT" : "НЭМЭХ"}</span>
            <div className="ribbon-tools">
              {primitives.map((type) => (
                <LibraryItem
                  key={type}
                  compact
                  type={type}
                  insert={() => insert(type)}
                />
              ))}
            </div>
          </div>
          <div className="ribbon-group">
            <label className="ribbon-label" htmlFor="insert-placement">
              {en ? "PLACE NEW ELEMENT" : "ШИНЭ ЭЛЕМЕНТИЙН БАЙРЛАЛ"}
            </label>
            <select
              id="insert-placement"
              aria-label="Insert placement"
              value={placement}
              onChange={(e) => setPlacement(e.target.value as Placement)}
            >
              <option value="before" disabled={selected === doc.root.id}>
                ↑ Above / Дээр
              </option>
              <option value="inside">↳ Inside / Дотор</option>
              <option value="after" disabled={selected === doc.root.id}>
                ↓ Below / Доор
              </option>
            </select>
          </div>
          <div className="ribbon-group">
            <span className="ribbon-label">{en ? "ORGANIZE" : "ЦЭГЦЛЭХ"}</span>
            <div className="ribbon-tools">
              <button
                className="ribbon-command"
                aria-label="Group in folder"
                title="Ctrl / ⌘ G"
                disabled={selected === doc.root.id}
                onClick={group}
              >
                <span>▰＋</span>
                <small>Folder</small>
              </button>
              <button
                className="ribbon-command"
                aria-label="Rename element"
                title="F2"
                onClick={() => {
                  setLeftTab("layers");
                  setRenameRequest((value) => value + 1);
                }}
              >
                <span>Ab</span>
                <small>Rename</small>
              </button>
              <button
                className="ribbon-command"
                aria-label="Duplicate element"
                title="Ctrl / ⌘ D"
                disabled={selected === doc.root.id}
                onClick={duplicate}
              >
                <span>⧉</span>
                <small>Duplicate</small>
              </button>
            </div>
          </div>
          <div className="ribbon-group ribbon-arrange">
            <span className="ribbon-label">{en ? "ARRANGE" : "ДАРААЛАЛ"}</span>
            <div className="ribbon-tools">
              <button
                aria-label="Move up"
                disabled={!parent() || parent()!.children[0]?.id === selected}
                onClick={() => shift(-1)}
              >
                ↑
              </button>
              <button
                aria-label="Move down"
                disabled={
                  !parent() || parent()!.children.at(-1)?.id === selected
                }
                onClick={() => shift(1)}
              >
                ↓
              </button>
              <button
                aria-label="Move out of folder"
                disabled={!parent() || parent()?.id === doc.root.id}
                onClick={moveOut}
              >
                ↰
              </button>
              <button
                aria-label="Delete element"
                disabled={selected === doc.root.id}
                onClick={remove}
              >
                ×
              </button>
            </div>
          </div>
        </div>
        <div className="editor-body">
          <aside className="editor-library">
            <div className="panel-tabs">
              <button
                className={leftTab === "library" ? "active" : ""}
                onClick={() => setLeftTab("library")}
              >
                {en ? "Toolbox" : "Элемент"}
              </button>
              <button
                aria-label="Давхарга"
                className={leftTab === "layers" ? "active" : ""}
                onClick={() => setLeftTab("layers")}
              >
                Explorer
              </button>
            </div>
            {leftTab === "library" ? (
              <>
                <div className="panel-heading">
                  <small>ТАНЫ БҮТЭЭХ ХЭСГҮҮД</small>
                  <h3>Энгийнээс эхэл.</h3>
                  <p>Сонгосон хэсэгт нэмэх эсвэл хуудсанд чирж байрлуул.</p>
                </div>
                <button
                  className="builder-welcome"
                  aria-label="Explore creative starters"
                  onClick={() => {
                    setCreativeTab("pieces");
                    setCreativeOpen(true);
                  }}
                >
                  <span className="welcome-spark">✦</span>
                  <strong>
                    {en
                      ? "An idea is a lovely start."
                      : "Сайхан санаанаас эхэл."}
                  </strong>
                  <small>
                    {en
                      ? "Try a starter. Make it yours."
                      : "Эхлэх бүтцээ сонгоод өөрийн болго."}
                  </small>
                  <span className="welcome-link">
                    {en ? "Find a little inspiration" : "Урам авах санаанууд"} ↗
                  </span>
                </button>
                <div className="block-library">
                  {primitives.map((type) => (
                    <LibraryItem
                      key={type}
                      type={type}
                      insert={() => insert(type)}
                    />
                  ))}
                </div>
                <div className="library-note">
                  <span>↗</span>
                  <strong>Нэг хэсэг. Олон боломж.</strong>
                  <p>Контейнер + зураг + текст + товч = таны өөрийн карт.</p>
                </div>
                <div className="panel-heading">
                  <small>МИНИЙ БҮТЭЭЦ</small>
                  {compositions.map((c, i) => (
                    <button
                      key={i}
                      className="composition"
                      onClick={() => {
                        const copy = cloneNode(c);
                        insertComposition(copy);
                      }}
                    >
                      {icons[c.type]} {c.name} ＋
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <Explorer
              doc={doc}
              selected={selected}
              select={setSelected}
              rename={(id, value) =>
                update((d) => {
                  findNode(d, id)!.name = value;
                })
              }
              icons={icons}
              en={en}
              renameRequest={renameRequest}
            />
            <div className="editor-bottom-note">
              Өөрчлөлт бизнесийн мэдээлэлд нөлөөлөхгүй.
            </div>
          </aside>
          <main className="canvas-workspace">
            <div className="canvas-breadcrumb">
              <span className="viewport-tab">
                ▧ {en ? "Viewport" : "Хуудас"}
              </span>
              <div className="workspace-breadcrumb">
                {nodePath(doc, selected).map((part, i) => (
                  <React.Fragment key={part.id}>
                    {i > 0 && <span>/</span>}
                    <button onClick={() => setSelected(part.id)}>
                      {part.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              <span className="canvas-size">
                {mobile ? "360 px · Утас" : "Desktop · Уян байрлал"}
              </span>
            </div>
            {errors.length > 0 && (
              <div className="validation-errors" role="alert">
                {errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            <div className={`canvas-scroll ${mobile ? "mobile-view" : ""}`}>
              <div className="canvas-browser">
                <div className="browser-bar">
                  <i />
                  <i />
                  <i />
                  <span>{site.slug}.localhost</span>
                  <b>▣</b>
                </div>
                <div
                  className="canvas-page"
                  style={{ width: mobile ? 360 : "100%" }}
                >
                  <PageRenderer
                    site={{ ...site, document: doc }}
                    editing
                    mobilePreview={mobile}
                    onText={(id, text) =>
                      update((d) => {
                        findNode(d, id)!.props.text = text;
                      })
                    }
                    wrap={(n, content, record) => (
                      <CanvasNode
                        key={n.id + "-" + (record?.id ?? "")}
                        node={n}
                        selected={selected === n.id}
                        select={() => setSelected(n.id)}
                        scope={record?.id}
                        root={n.id === doc.root.id}
                        mobilePreview={mobile}
                        style={mobile ? { ...n.style, ...n.mobile } : n.style}
                        reposition={(left, top) => {
                          setSelected(n.id);
                          update((d) => {
                            const el = findNode(d, n.id)!;
                            if (mobile) el.mobile = { ...el.mobile, left, top };
                            else Object.assign(el.style, { left, top });
                          });
                        }}
                        resize={(width) => {
                          setSelected(n.id);
                          update((d) => {
                            const el = findNode(d, n.id)!;
                            if (mobile)
                              el.mobile = { ...el.mobile, width: width + "px" };
                            else el.style.width = width + "px";
                          });
                        }}
                      >
                        {content}
                      </CanvasNode>
                    )}
                  />
                </div>
              </div>
              <div className="canvas-footer">
                <span>＋</span> Хэсгүүдээ өөрийнхөөрөө эвлүүл.
              </div>
            </div>
            <div className="canvas-help">
              <span>⠿ Чирж байрлуулах</span>
              <span>⌘ Z Буцаах</span>
              <span>⌘ S Хадгалах</span>
              <span>F2 Нэрлэх · ⌘ G Хавтас · ⌘ D Хуулбар</span>
            </div>
          </main>
          <aside className="inspector">
            <div className="inspector-title">
              <span>{node ? icons[node.type] : "▣"}</span>
              <div>
                <small>PROPERTIES / ШИНЖ ЧАНАР</small>
                <strong>{node?.name}</strong>
              </div>
            </div>
            <div className="panel-tabs inspector-tabs">
              {[
                ["design", "Загвар"],
                ["content", "Утга"],
                ["actions", "Үйлдэл"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={rightTab === key ? "active" : ""}
                  onClick={() => setRightTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {node && (
              <div className="inspector-content">
                <label>
                  Элементийн нэр
                  <input
                    value={node.name}
                    maxLength={100}
                    onChange={(e) =>
                      update((d) => {
                        findNode(d, selected)!.name = e.target.value;
                      })
                    }
                  />
                </label>
                <button
                  className="inspector-creative"
                  onClick={() => {
                    setCreativeTab(node.type === "embed" ? "code" : "looks");
                    setCreativeOpen(true);
                  }}
                >
                  ✳{" "}
                  {node.type === "embed"
                    ? "Edit HTML / CSS / JS"
                    : en
                      ? "Styles, Tailwind & CSS"
                      : "Загвар, Tailwind ба CSS"}{" "}
                  ↗
                </button>
                {rightTab === "design" ? (
                  <>
                    <div className="position-panel">
                      <div className="inspector-section-title">
                        {en ? "POSITION" : "БАЙРЛАЛ"}
                        <span>{mobile ? "Mobile" : "Desktop"}</span>
                      </div>
                      <div className="position-modes">
                        <button
                          className={
                            style?.position !== "absolute" ? "active" : ""
                          }
                          aria-pressed={style?.position !== "absolute"}
                          onClick={() =>
                            setStyle({
                              position: "relative",
                              anchor: "top-left",
                              left: 0,
                              top: 0,
                            })
                          }
                        >
                          ☷ {en ? "Flow" : "Дараалал"}
                        </button>
                        <button
                          className={
                            style?.position === "absolute" ? "active" : ""
                          }
                          aria-pressed={style?.position === "absolute"}
                          aria-label="Free position"
                          disabled={node.id === doc.root.id}
                          onClick={() =>
                            setStyle({
                              position: "absolute",
                              anchor: "top-left",
                              top: 24,
                              left: 24,
                              width:
                                style?.width === "100%" || !style?.width
                                  ? "180px"
                                  : style.width,
                            })
                          }
                        >
                          ✥ {en ? "Free" : "Чөлөөтэй"}
                        </button>
                      </div>
                      {style?.position === "absolute" ? (
                        <>
                          <div className="anchor-controls">
                            <div
                              className="anchor-grid"
                              aria-label="Position anchor"
                            >
                              {[
                                "top-left",
                                "top-center",
                                "top-right",
                                "center-left",
                                "center",
                                "center-right",
                                "bottom-left",
                                "bottom-center",
                                "bottom-right",
                              ].map((anchor) => (
                                <button
                                  key={anchor}
                                  aria-label={`Anchor ${anchor}`}
                                  aria-pressed={
                                    (style.anchor ?? "top-left") === anchor
                                  }
                                  className={
                                    (style.anchor ?? "top-left") === anchor
                                      ? "active"
                                      : ""
                                  }
                                  onClick={() =>
                                    setStyle({
                                      anchor: anchor as Styles["anchor"],
                                      left: 0,
                                      top: 0,
                                    })
                                  }
                                >
                                  ·
                                </button>
                              ))}
                            </div>
                            <p>
                              {en
                                ? "Anchor to the parent. Drag ✥ on the canvas to move."
                                : "Хавтас дотор байрлана. ✥ бариулаас чирж зөөнө."}
                            </p>
                          </div>
                          <div className="field-pair">
                            {(["left", "top"] as const).map((key, i) => (
                              <label key={key}>
                                {i ? "Y / Босоо" : "X / Хэвтээ"}
                                <input
                                  aria-label={i ? "Position Y" : "Position X"}
                                  type="number"
                                  min={-4096}
                                  max={4096}
                                  value={style[key] ?? 0}
                                  onChange={(e) =>
                                    setStyle({
                                      [key]: Math.max(
                                        -4096,
                                        Math.min(4096, Number(e.target.value)),
                                      ),
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          <label>
                            {en ? "Layer order" : "Давхаргын дараалал"}
                            <input
                              aria-label="Layer order"
                              type="number"
                              min={0}
                              max={10}
                              value={style.zIndex ?? 0}
                              onChange={(e) =>
                                setStyle({
                                  zIndex: Math.max(
                                    0,
                                    Math.min(10, Number(e.target.value)),
                                  ),
                                })
                              }
                            />
                          </label>
                        </>
                      ) : (
                        <p className="position-tip">
                          {en
                            ? "Use ↑ ↓ to reorder. Drop into a folder to nest."
                            : "↑ ↓ товчоор эрэмбэл. Хавтас руу чирж дотор нь байрлуул."}
                        </p>
                      )}
                    </div>
                    <div className="inspector-section-title">
                      ЗОХИОН БАЙГУУЛАЛТ{" "}
                      <span>{mobile ? "Утасны тохиргоо" : "Үндсэн"}</span>
                    </div>
                    <div className="field-pair">
                      <label>
                        Хэлбэр
                        <select
                          value={style?.display ?? "block"}
                          onChange={(e) =>
                            setStyle({
                              display: e.target.value as Styles["display"],
                            })
                          }
                        >
                          <option value="block">Энгийн</option>
                          <option value="flex">Flex</option>
                          <option value="grid">Grid</option>
                        </select>
                      </label>
                      <label>
                        Чиглэл
                        <select
                          value={style?.direction ?? "column"}
                          onChange={(e) =>
                            setStyle({
                              direction: e.target.value as "row" | "column",
                            })
                          }
                        >
                          <option value="column">Босоо ↓</option>
                          <option value="row">Хэвтээ →</option>
                        </select>
                      </label>
                    </div>
                    <div className="field-pair">
                      {(["padding", "gap"] as const).map((k) => (
                        <label key={k}>
                          {k === "padding" ? "Дотор зай" : "Хоорондын зай"}
                          <input
                            type="number"
                            min={0}
                            max={160}
                            value={style?.[k] ?? 0}
                            onChange={(e) =>
                              setStyle({ [k]: Number(e.target.value) })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="field-pair">
                      <label>
                        Багана
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={style?.columns ?? 1}
                          onChange={(e) =>
                            setStyle({ columns: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Мөр шилжих
                        <select
                          value={style?.wrap ? "yes" : "no"}
                          onChange={(e) =>
                            setStyle({ wrap: e.target.value === "yes" })
                          }
                        >
                          <option value="no">Үгүй</option>
                          <option value="yes">Тийм</option>
                        </select>
                      </label>
                    </div>
                    <div className="field-pair">
                      <label>
                        Зэрэгцүүлэх
                        <select
                          value={style?.align ?? "stretch"}
                          onChange={(e) =>
                            setStyle({
                              align: e.target.value as Styles["align"],
                            })
                          }
                        >
                          {["start", "center", "end", "stretch"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Тархалт
                        <select
                          value={style?.justify ?? "start"}
                          onChange={(e) =>
                            setStyle({
                              justify: e.target.value as Styles["justify"],
                            })
                          }
                        >
                          {["start", "center", "end", "space-between"].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                    <div className="inspector-section-title">
                      ХЭМЖЭЭ · px / % / rem
                    </div>
                    <div className="field-pair">
                      {(
                        [
                          "width",
                          "minWidth",
                          "maxWidth",
                          "height",
                          "minHeight",
                        ] as const
                      ).map((k) => (
                        <label key={k}>
                          {k}
                          <input
                            placeholder="auto"
                            value={style?.[k] ?? ""}
                            onChange={(e) =>
                              setStyle({ [k]: e.target.value || "auto" })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="inspector-section-title">
                      ӨНГӨ БА ХЭЛБЭР
                    </div>
                    {(["background", "color", "borderColor"] as const).map(
                      (k) => (
                        <label className="color-field" key={k}>
                          {k === "background"
                            ? "Дэвсгэр"
                            : k === "color"
                              ? "Текст"
                              : "Хүрээ"}
                          <span>
                            <input
                              type="color"
                              aria-label={k}
                              value={
                                style?.[k]?.startsWith("#")
                                  ? style[k]
                                  : "#ffffff"
                              }
                              onChange={(e) =>
                                setStyle({ [k]: e.target.value })
                              }
                            />
                            <input
                              aria-label={k + " hex"}
                              value={style?.[k] ?? "inherit"}
                              onChange={(e) =>
                                setStyle({ [k]: e.target.value })
                              }
                            />
                          </span>
                        </label>
                      ),
                    )}
                    <div className="field-pair">
                      {(
                        [
                          "radius",
                          "borderWidth",
                          "fontSize",
                          "fontWeight",
                        ] as const
                      ).map((k) => (
                        <label key={k}>
                          {k}
                          <input
                            type="number"
                            value={
                              style?.[k] ??
                              (k === "fontWeight"
                                ? 400
                                : k === "fontSize"
                                  ? 18
                                  : 0)
                            }
                            onChange={(e) =>
                              setStyle({ [k]: Number(e.target.value) })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Текст зэрэгцүүлэх
                      <select
                        value={style?.textAlign ?? "left"}
                        onChange={(e) =>
                          setStyle({
                            textAlign: e.target.value as Styles["textAlign"],
                          })
                        }
                      >
                        {["left", "center", "right"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <p className="muted">
                      Хэт өргөн элемент байвал min/max width болон утасны
                      тохиргоог шалгаарай.
                    </p>
                  </>
                ) : rightTab === "content" ? (
                  <>
                    {["text", "button"].includes(node.type) && (
                      <label>
                        Текст
                        <textarea
                          rows={5}
                          value={node.props.text ?? ""}
                          onChange={(e) => setProps({ text: e.target.value })}
                        />
                      </label>
                    )}
                    {node.type === "text" && (
                      <label>
                        Төрөл
                        <select
                          value={node.props.tag ?? "p"}
                          onChange={(e) =>
                            setProps({ tag: e.target.value as any })
                          }
                        >
                          {["h1", "h2", "h3", "p", "span"].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {["image", "text"].includes(node.type) && (
                      <>
                        <label>
                          Мэдээлэл холбох
                          <select
                            value={
                              node.props.binding
                                ? node.props.binding.source +
                                  ":" +
                                  node.props.binding.field
                                : ""
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                update((d) => {
                                  delete findNode(d, selected)!.props.binding;
                                });
                                return;
                              }
                              const [source, field] = val.split(":");
                              setProps({ binding: { source, field } as any });
                            }}
                          >
                            <option value="">Гараар оруулах</option>
                            {(node.type === "image"
                              ? ["image"]
                              : ["name", "description", "price", "category"]
                            ).map((f) => (
                              <option key={f} value={"record:" + f}>
                                Энэ бичлэг · {f}
                              </option>
                            ))}
                            {node.type === "text" &&
                              ["name", "phone", "address"].map((f) => (
                                <option key={f} value={"business:" + f}>
                                  Бизнес · {f}
                                </option>
                              ))}
                          </select>
                        </label>
                        <div className="binding-note">
                          ↗{" "}
                          {scope()
                            ? `Энэ элемент ${scope()} цуглуулгын одоогийн бичлэгийг ашиглана.`
                            : "Бичлэг холбохын тулд цуглуулга дотор байрлуул."}
                        </div>
                      </>
                    )}
                    {node.type === "image" && (
                      <>
                        <label>
                          Зураг
                          <select
                            value={node.props.src ?? "/art/editorial.svg"}
                            onChange={(e) => setProps({ src: e.target.value })}
                          >
                            {[
                              "editorial",
                              "knit",
                              "bag",
                              "coat",
                              "interior",
                              "salon",
                              "skin",
                              "build",
                            ].map((f) => (
                              <option value={"/art/" + f + ".svg"} key={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Зураг оруулах
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              try {
                                const r = await apiFetch(`/w/${ws}/media`, {
                                  method: "POST",
                                  headers: { "Content-Type": f.type },
                                  body: f,
                                });
                                const result = await r.json();
                                if (!r.ok) throw new Error(result.error);
                                setProps({ src: result.src });
                                notify("Зураг хадгалагдлаа");
                              } catch (e) {
                                notify((e as Error).message);
                              }
                            }}
                          />
                        </label>
                        <label>
                          Alt тайлбар
                          <input
                            value={node.props.alt ?? ""}
                            onChange={(e) => setProps({ alt: e.target.value })}
                          />
                        </label>
                        <label>
                          Зураг багтаах
                          <select
                            value={style?.objectFit ?? "cover"}
                            onChange={(e) =>
                              setStyle({
                                objectFit: e.target.value as
                                  "cover" | "contain",
                              })
                            }
                          >
                            <option>cover</option>
                            <option>contain</option>
                          </select>
                        </label>
                      </>
                    )}
                    {node.type === "collection" && (
                      <label>
                        Цуглуулга
                        <select
                          value={node.props.collection ?? "products"}
                          onChange={(e) =>
                            setProps({ collection: e.target.value as any })
                          }
                        >
                          {["products", "services", "projects"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {node.type === "input" && (
                      <>
                        <label>
                          Талбарын түлхүүр
                          <input
                            value={node.props.name ?? ""}
                            onChange={(e) => setProps({ name: e.target.value })}
                          />
                        </label>
                        <label>
                          Шошго
                          <input
                            value={node.props.label ?? ""}
                            onChange={(e) =>
                              setProps({ label: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Төрөл
                          <select
                            value={node.props.inputType ?? "text"}
                            onChange={(e) =>
                              setProps({ inputType: e.target.value as any })
                            }
                          >
                            {[
                              "text",
                              "email",
                              "tel",
                              "number",
                              "date",
                              "time",
                              "select",
                              "textarea",
                            ].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Сонголтууд (таслалаар)
                          <input
                            value={node.props.options?.join(",") ?? ""}
                            onChange={(e) =>
                              setProps({ options: e.target.value.split(",") })
                            }
                          />
                        </label>
                        <label>
                          Заавал бөглөх
                          <input
                            type="checkbox"
                            checked={!!node.props.required}
                            onChange={(e) =>
                              setProps({ required: e.target.checked })
                            }
                          />
                        </label>
                      </>
                    )}
                    {node.type === "conditional" && (
                      <>
                        <label>
                          Нөхцөлийн талбар
                          <input
                            value={node.props.condition?.field ?? ""}
                            onChange={(e) =>
                              setProps({
                                condition: {
                                  field: e.target.value,
                                  equals: node.props.condition?.equals ?? "",
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          Утга нь тэнцүү
                          <input
                            value={node.props.condition?.equals ?? ""}
                            onChange={(e) =>
                              setProps({
                                condition: {
                                  field: node.props.condition?.field ?? "",
                                  equals: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                    {node.type === "text" && !node.props.binding && (
                      <div className="ai-box">
                        <strong>✧ Өөрчлөлтийн урьдчилсан харагдац</strong>
                        <p>Тест адаптер · AI загвар холбогдоогүй.</p>
                        <textarea
                          placeholder="Шинэ текст"
                          value={patchText}
                          onChange={(e) => setPatchText(e.target.value)}
                        />
                        <button
                          className="subtle"
                          disabled={!patchText || dirty}
                          onClick={async () => {
                            try {
                              setPatch(
                                await api(
                                  `/w/${ws}/sites/${siteId}/ai-fixture`,
                                  "POST",
                                  { nodeId: selected, text: patchText },
                                ),
                              );
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          Өөрчлөлт харах
                        </button>
                        {dirty && <small>Эхлээд нооргоо хадгална уу.</small>}
                        {patch && (
                          <>
                            <del>{patch.before}</del>
                            <ins>{patch.patch.text}</ins>
                            <div className="field-pair">
                              <button onClick={() => setPatch(null)}>
                                Татгалзах
                              </button>
                              <button
                                className="primary"
                                onClick={async () => {
                                  try {
                                    const result = await api(
                                      `/w/${ws}/sites/${siteId}/ai-accept`,
                                      "POST",
                                      {
                                        baseVersion: patch.baseVersion,
                                        patch: patch.patch,
                                      },
                                    );
                                    commit(result.document);
                                    setSite((s) =>
                                      s
                                        ? {
                                            ...s,
                                            draftVersion: result.draftVersion,
                                          }
                                        : s,
                                    );
                                    setDirty(false);
                                    setPatch(null);
                                    notify("Тест өөрчлөлт хадгалагдлаа");
                                  } catch (e) {
                                    notify((e as Error).message);
                                  }
                                }}
                              >
                                Зөвшөөрөх
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="muted">
                      Хэрэглэгч үйлдэл хийхэд дарааллаар гүйцэтгэнэ. Бизнесийн
                      үйлдлийг сервер шалгана.
                    </p>
                    <div className="binding-note">
                      {scope()
                        ? `↗ Энэ товч ${scope()} цуглуулгын бичлэгийг ашиглана.`
                        : "Холболт: хуудасны түвшин"}
                    </div>
                    {(node.props.actions ?? []).map((a, i) => (
                      <div className="action-card" key={i}>
                        <small>ҮЙЛДЭЛ {i + 1}</small>
                        {["inquiry", "booking"].includes(a.type) && (
                          <p className="muted">
                            Формын талбар: name, contact
                            {a.type === "inquiry"
                              ? ", message, projectType, teamSize"
                              : ", date, time"}
                            . Бусад нэртэй талбарыг сервер хүлээн авахгүй.
                          </p>
                        )}
                        {["openPanel", "closePanel"].includes(a.type) && (
                          <p className="muted">
                            cart / product нь бэлэн цонх. Бусад нэр нь нөхцөлт
                            элементийн төлөвийг open / closed болгоно.
                          </p>
                        )}
                        <label>
                          Ингэхэд →
                          <select
                            value={a.type}
                            onChange={(e) => {
                              const actions = structuredClone(
                                node.props.actions ?? [],
                              );
                              actions[i] = {
                                type: e.target.value as Action["type"],
                                target:
                                  e.target.value === "navigate" ? "/" : "cart",
                              };
                              setProps({ actions });
                            }}
                          >
                            {[
                              "navigate",
                              "openPanel",
                              "closePanel",
                              "setState",
                              "filter",
                              "addToCart",
                              "checkout",
                              "inquiry",
                              "booking",
                            ].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                        {[
                          "navigate",
                          "openPanel",
                          "closePanel",
                          "setState",
                          "filter",
                        ].includes(a.type) && (
                          <label>
                            Зорилтот хэсэг
                            <input
                              value={a.target ?? ""}
                              onChange={(e) => {
                                const actions = structuredClone(
                                  node.props.actions!,
                                );
                                actions[i].target = e.target.value;
                                setProps({ actions });
                              }}
                            />
                          </label>
                        )}
                        {["setState", "filter"].includes(a.type) && (
                          <label>
                            Утга
                            <input
                              value={a.value ?? ""}
                              onChange={(e) => {
                                const actions = structuredClone(
                                  node.props.actions!,
                                );
                                actions[i].value = e.target.value;
                                setProps({ actions });
                              }}
                            />
                          </label>
                        )}
                        {["addToCart", "booking"].includes(a.type) && (
                          <label>
                            Бичлэг
                            <select
                              value={a.recordId ?? ""}
                              onChange={(e) => {
                                const actions = structuredClone(
                                  node.props.actions!,
                                );
                                if (e.target.value)
                                  actions[i].recordId = e.target.value;
                                else delete actions[i].recordId;
                                setProps({ actions });
                              }}
                            >
                              <option value="">
                                Цуглуулгын одоогийн бичлэг
                              </option>
                              {site.records.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label>
                          Зөвхөн нөхцөлд (талбар=утга)
                          <input
                            value={
                              a.when ? a.when.field + "=" + a.when.equals : ""
                            }
                            onChange={(e) => {
                              const actions = structuredClone(
                                node.props.actions!,
                              );
                              const [field, ...rest] =
                                e.target.value.split("=");
                              if (field)
                                actions[i].when = {
                                  field,
                                  equals: rest.join("="),
                                };
                              else delete actions[i].when;
                              setProps({ actions });
                            }}
                          />
                        </label>
                        <button
                          className="text-danger"
                          onClick={() =>
                            setProps({
                              actions: node.props.actions?.filter(
                                (_, idx) => idx !== i,
                              ),
                            })
                          }
                        >
                          Үйлдэл хасах
                        </button>
                      </div>
                    ))}
                    {["button", "form"].includes(node.type) && (
                      <button
                        className="subtle full"
                        onClick={() =>
                          setProps({
                            actions: [
                              ...(node.props.actions ?? []),
                              { type: "openPanel", target: "cart" },
                            ],
                          })
                        }
                      >
                        ＋ Үйлдэл нэмэх
                      </button>
                    )}
                    <div className="inspector-section-title">
                      ХУУДАСНЫ МЭДЭЭЛЭЛ
                    </div>
                    <label>
                      Гарчиг
                      <input
                        value={doc.title}
                        onChange={(e) =>
                          update((d) => {
                            d.title = e.target.value;
                          })
                        }
                      />
                    </label>
                    <label>
                      Хайлтын тайлбар
                      <textarea
                        value={doc.description}
                        onChange={(e) =>
                          update((d) => {
                            d.description = e.target.value;
                          })
                        }
                      />
                    </label>
                    {business &&
                      (["name", "phone", "address"] as const).map((k) => (
                        <label key={k}>
                          {k}
                          <input
                            value={business[k]}
                            onChange={(e) => {
                              setBusiness({ ...business, [k]: e.target.value });
                              setDirty(true);
                            }}
                          />
                        </label>
                      ))}
                    <div className="inspector-section-title">
                      НИЙТЛЭЛИЙН ТҮҮХ
                    </div>
                    {site.revisions.map((r) => (
                      <div className="revision" key={r.id}>
                        <span>
                          {r.id === site.publishedId ? "● " : ""}
                          {r.created_at.slice(0, 16)}
                        </span>
                        <button
                          disabled={r.id === site.publishedId}
                          onClick={async () => {
                            try {
                              await api(
                                `/w/${ws}/sites/${siteId}/rollback`,
                                "POST",
                                { revisionId: r.id },
                              );
                              setSite((s) =>
                                s ? { ...s, publishedId: r.id } : s,
                              );
                              notify(
                                "Сайтын хувилбар сэргээгдлээ. Гүйлгээнүүд өөрчлөгдөөгүй.",
                              );
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          Сэргээх
                        </button>
                      </div>
                    ))}
                    {site.publishedId && (
                      <a
                        href={siteHref(site.slug)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Нийтлэгдсэн сайт ↗
                      </a>
                    )}
                  </>
                )}
                {selected !== doc.root.id && (
                  <>
                    <div className="inspector-section-title">БҮТЭЦ</div>
                    <label>
                      Контейнер рүү зөөх
                      <select
                        value={parent()?.id ?? ""}
                        onChange={(e) => {
                          try {
                            commit(
                              moveNode(doc, selected, e.target.value, 999),
                            );
                          } catch (e) {
                            notify((e as Error).message);
                          }
                        }}
                      >
                        {(() => {
                          const list: PageNode[] = [];
                          walk(doc.root, (n) => {
                            if (
                              [
                                "container",
                                "form",
                                "collection",
                                "conditional",
                              ].includes(n.type) &&
                              n.id !== selected
                            )
                              list.push(n);
                          });
                          return list.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name}
                            </option>
                          ));
                        })()}
                      </select>
                    </label>
                    <div className="field-pair">
                      <button className="subtle" onClick={() => shift(-1)}>
                        ↑ Дээш
                      </button>
                      <button className="subtle" onClick={() => shift(1)}>
                        ↓ Доош
                      </button>
                    </div>
                    <button className="subtle full" onClick={duplicate}>
                      ⧉ Хуулбарлах
                    </button>
                    <button
                      className="subtle full"
                      onClick={() => {
                        const copy = cloneNode(node);
                        walk(copy, (n) => {
                          for (const a of n.props.actions ?? [])
                            delete a.recordId;
                        });
                        const next = [...compositions, copy];
                        setCompositions(next);
                        localStorage.setItem(
                          "uru-compositions-" + ws,
                          JSON.stringify(next),
                        );
                        notify(
                          "Бүтэц хадгалагдлаа. Тусгай бичлэгийн холбоосууд цэвэрлэгдсэн.",
                        );
                      }}
                    >
                      ▧ Дахин ашиглах бүтэц
                    </button>
                    <button className="text-danger full" onClick={remove}>
                      Элемент устгах
                    </button>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      </DndContext>
    </div>
  );
}
