import { useEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { PageDocument, PageNode } from "../shared/schema";
import { canContain, nodePath, type Placement } from "../shared/workspace";

function ExplorerRow({
  node,
  depth,
  selected,
  collapsed,
  toggle,
  select,
  rename,
  renaming,
  beginRename,
  endRename,
  icons,
  en,
}: {
  node: PageNode;
  depth: number;
  selected: boolean;
  collapsed: boolean;
  toggle: () => void;
  select: () => void;
  rename: (value: string) => void;
  renaming: boolean;
  beginRename: () => void;
  endRename: () => void;
  icons: Record<string, string>;
  en: boolean;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: "explorer-drag-" + node.id,
    data: { nodeId: node.id },
  });
  const [draft, setDraft] = useState(node.name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) {
      setDraft(node.name);
      input.current?.focus();
      input.current?.select();
    }
  }, [renaming]);
  function finish() {
    if (draft.trim()) rename(draft.trim().slice(0, 100));
    endRename();
  }
  return (
    <div
      ref={setNodeRef}
      className={`explorer-row ${selected ? "is-selected" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={{ "--depth": depth } as React.CSSProperties}
    >
      <ExplorerDrop node={node} placement="before" />
      <div className="explorer-row-main">
        <button
          className="explorer-toggle"
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.name}`}
          disabled={!canContain(node)}
          aria-expanded={canContain(node) ? !collapsed : undefined}
          onClick={toggle}
        >
          {canContain(node) ? (collapsed ? "▸" : "▾") : "·"}
        </button>
        {renaming ? (
          <input
            ref={input}
            className="explorer-rename"
            aria-label="Rename workspace element"
            maxLength={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={finish}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") finish();
              if (e.key === "Escape") endRename();
            }}
          />
        ) : (
          <button
            className={`layer ${selected ? "active" : ""}`}
            data-explorer-id={node.id}
            onClick={select}
            onFocus={select}
            onDoubleClick={beginRename}
            title={`${node.name} · ${en ? "Double-click to rename" : "Хоёр дарж нэрлэх"}`}
          >
            <span className={canContain(node) ? "folder-icon" : ""}>
              {canContain(node) ? "▰" : icons[node.type]}
            </span>
            <span>{node.name}</span>
            {node.props.binding && <small title="Data binding">↗</small>}
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          className="explorer-grip"
          aria-label={`Drag ${node.name}`}
          title="Drag to reorder or nest"
        >
          ⠿
        </button>
      </div>
      {canContain(node) && <ExplorerDrop node={node} placement="inside" />}
      <ExplorerDrop node={node} placement="after" />
    </div>
  );
}
function ExplorerDrop({
  node,
  placement,
}: {
  node: PageNode;
  placement: Placement;
}) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `explorer-${placement}-${node.id}`,
    data: { nodeId: node.id, placement },
  });
  return (
    <div
      ref={setNodeRef}
      className={`explorer-drop drop-${placement} ${active ? "is-drag-active" : ""} ${isOver ? "is-over" : ""}`}
      data-drop-node={node.id}
      data-placement={placement}
    >
      {active && (
        <span>
          {placement === "inside"
            ? "↳ Inside / Дотор"
            : placement === "before"
              ? "↑ Above / Дээр"
              : "↓ Below / Доор"}
        </span>
      )}
    </div>
  );
}
export default function Explorer({
  doc,
  selected,
  select,
  rename,
  icons,
  en,
  renameRequest,
}: {
  doc: PageDocument;
  selected: string;
  select: (id: string) => void;
  rename: (id: string, value: string) => void;
  icons: Record<string, string>;
  en: boolean;
  renameRequest: number;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState("");
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (renameRequest) setRenaming(selected);
  }, [renameRequest]);
  useEffect(() => {
    const ancestors = nodePath(doc, selected)
      .slice(0, -1)
      .map((n) => n.id);
    setClosed(
      (old) => new Set([...old].filter((id) => !ancestors.includes(id))),
    );
  }, [selected, doc]);
  const matches = (node: PageNode): boolean =>
    node.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
    node.children.some(matches);
  const visible: { node: PageNode; depth: number }[] = [];
  const visit = (node: PageNode, depth: number) => {
    if (search && !matches(node)) return;
    visible.push({ node, depth });
    if (search || !closed.has(node.id))
      node.children.forEach((n) => visit(n, depth + 1));
  };
  visit(doc.root, 0);
  const focus = (id: string) => {
    select(id);
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-explorer-id="${id}"]`)
        ?.focus(),
    );
  };
  return (
    <div className="workspace-explorer" ref={root}>
      <div className="explorer-heading">
        <span>▰</span>
        <strong>Workspace</strong>
        <small>{visible.length}</small>
      </div>
      <label className="explorer-search">
        <span>{en ? "Find an element" : "Элемент хайх"}</span>
        <input
          aria-label="Search workspace"
          placeholder="⌕  Search / Хайх"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div
        className="layers explorer-tree"
        aria-label="Workspace folders"
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).matches("input")) return;
          const index = visible.findIndex(({ node }) => node.id === selected);
          const node = visible[index]?.node;
          if (!node) return;
          if (
            [
              "ArrowDown",
              "ArrowUp",
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
              "F2",
            ].includes(e.key)
          )
            e.preventDefault();
          if (e.key === "ArrowDown")
            focus(visible[Math.min(index + 1, visible.length - 1)].node.id);
          if (e.key === "ArrowUp")
            focus(visible[Math.max(index - 1, 0)].node.id);
          if (e.key === "Home") focus(doc.root.id);
          if (e.key === "End") focus(visible.at(-1)!.node.id);
          if (e.key === "F2") setRenaming(selected);
          if (e.key === "ArrowRight") {
            if (closed.has(selected))
              setClosed((old) => {
                const next = new Set(old);
                next.delete(selected);
                return next;
              });
            else if (node.children[0]) focus(node.children[0].id);
          }
          if (e.key === "ArrowLeft") {
            if (canContain(node) && !closed.has(selected))
              setClosed((old) => new Set(old).add(selected));
            else {
              const parent = nodePath(doc, selected).at(-2);
              if (parent) focus(parent.id);
            }
          }
        }}
      >
        {visible.map(({ node, depth }) => (
          <ExplorerRow
            key={node.id}
            node={node}
            depth={depth}
            selected={selected === node.id}
            collapsed={closed.has(node.id)}
            toggle={() =>
              setClosed((old) => {
                const next = new Set(old);
                next.has(node.id) ? next.delete(node.id) : next.add(node.id);
                return next;
              })
            }
            select={() => select(node.id)}
            rename={(value) => rename(node.id, value)}
            renaming={renaming === node.id}
            beginRename={() => setRenaming(node.id)}
            endRename={() => setRenaming("")}
            icons={icons}
            en={en}
          />
        ))}
        {!visible.length && (
          <p className="explorer-empty">No matching elements / Олдсонгүй</p>
        )}
      </div>
      <p className="explorer-hint">
        F2 · {en ? "Rename" : "Нэрлэх"}{" "}
        <span>↑ ↓ · {en ? "Navigate" : "Сонгох"}</span>
      </p>
    </div>
  );
}
