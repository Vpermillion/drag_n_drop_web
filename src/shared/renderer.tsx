import { apiFetch } from "../transport";
import { assetUrl, localHref, isPages } from "../paths";
import React, {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PageNode, SiteData, RecordData, Styles, Action } from "./schema";
import { money, walk } from "./schema";
export function cssStyle(s: Styles): CSSProperties {
  const {
    direction,
    wrap,
    columns,
    align,
    justify,
    borderWidth,
    borderColor,
    radius,
    ...rest
  } = s;
  return {
    ...rest,
    flexDirection: direction,
    flexWrap: wrap === undefined ? undefined : wrap ? "wrap" : "nowrap",
    gridTemplateColumns: columns
      ? `repeat(${columns}, minmax(0,1fr))`
      : undefined,
    alignItems: align,
    justifyContent: justify,
    borderWidth,
    borderColor,
    borderRadius: radius,
    borderStyle: borderWidth ? "solid" : undefined,
    whiteSpace: "pre-wrap",
    boxSizing: "border-box",
  } as CSSProperties;
}
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
function declarations(s: Styles) {
  return Object.entries(cssStyle(s))
    .filter(([, v]) => v !== undefined)
    .map(
      ([k, v]) =>
        `${kebab(k)}:${typeof v === "number" && !["fontWeight", "zIndex", "opacity"].includes(k) ? v + "px" : v}`,
    )
    .join(";");
}
export function pageCSS(site: SiteData) {
  let css = "";
  walk(site.document.root, (n) => {
    css += `.pn-${n.id}{${declarations(n.style)}}`;
    const fallback: Styles = {
      ...(n.style.columns && n.style.columns > 1 ? { columns: 1 } : {}),
      ...(n.style.fontSize && n.style.fontSize > 44 ? { fontSize: 40 } : {}),
      ...(n.style.padding && n.style.padding > 28 ? { padding: 22 } : {}),
    };
    const responsive = `.pn-${n.id}{${declarations({ ...fallback, ...n.mobile })}}`;
    css += `@media(max-width:600px){${responsive}}@container site (max-width:600px){${responsive}}`;
  });
  return css;
}
export function PageRenderer({
  site,
  editing = false,
  wrap,
  onText,
}: {
  site: SiteData;
  editing?: boolean;
  wrap?: (node: PageNode, content: ReactNode, scope?: RecordData) => ReactNode;
  onText?: (id: string, text: string) => void;
}) {
  const [state, setState] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<string | null>(null);
  const [product, setProduct] = useState<RecordData | null>(null);
  const [cart, setCart] = useState<{ variantId: string; quantity: number }[]>(
    [],
  );
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{
    id: string;
    accessToken: string;
    total: number;
    status: string;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (editing) return;
    try {
      setCart(JSON.parse(localStorage.getItem("uru-cart-" + site.id) ?? "[]"));
      setOrder(
        JSON.parse(localStorage.getItem("uru-order-" + site.id) ?? "null"),
      );
    } catch {}
    setLoaded(true);
  }, [site.id, editing]);
  useEffect(() => {
    if (!editing && loaded) {
      localStorage.setItem("uru-cart-" + site.id, JSON.stringify(cart));
      localStorage.setItem("uru-order-" + site.id, JSON.stringify(order));
    }
  }, [cart, order, site.id, loaded, editing]);
  const cartLines = cart
    .map((item) => {
      const record = site.records.find((r) =>
        r.variants.some((v) => v.id === item.variantId),
      );
      return record
        ? {
            ...item,
            record,
            variant: record.variants.find((v) => v.id === item.variantId)!,
          }
        : null;
    })
    .filter((v): v is NonNullable<typeof v> => !!v);
  async function request(path: string, data: unknown) {
    if (site.preview)
      throw new Error("Урьдчилан харах горим. Нийтэлсэн сайтаас туршина уу.");
    const r = await apiFetch(`/public/${site.slug}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    return result;
  }
  function add(record?: RecordData) {
    if (!record) throw new Error("Choose a product record.");
    const variant =
      record.variants.find((v) => v.id === variants[record.id]) ??
      record.variants.find((v) => v.stock > 0);
    if (!variant || variant.stock < 1) throw new Error("Түр дууссан байна.");
    const current = cart.find((i) => i.variantId === variant.id);
    if ((current?.quantity ?? 0) >= variant.stock)
      throw new Error("Боломжит үлдэгдэлд хүрлээ.");
    setCart((c) =>
      current
        ? c.map((i) =>
            i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [...c, { variantId: variant.id, quantity: 1 }],
    );
    setNotice("Сагсанд нэмэгдлээ · " + record.name);
  }
  async function action(
    actions: Action[] | undefined,
    record?: RecordData,
    form?: HTMLFormElement,
  ) {
    try {
      for (const a of actions ?? []) {
        if (a.when && state[a.when.field] !== a.when.equals) continue;
        const selected = a.recordId
          ? site.records.find((r) => r.id === a.recordId)
          : record;
        switch (a.type) {
          case "navigate":
            if (a.target?.startsWith("#"))
              document
                .querySelector(a.target)
                ?.scrollIntoView({ behavior: "smooth" });
            else if (a.target?.startsWith("/") && !a.target.startsWith("//"))
              window.location.assign(localHref(a.target));
            break;
          case "openPanel":
            if (["cart", "product"].includes(a.target ?? "cart")) {
              setProduct(selected ?? null);
              setPanel(a.target ?? "cart");
            } else setState((s) => ({ ...s, [a.target!]: "open" }));
            break;
          case "closePanel":
            if (["cart", "product"].includes(a.target ?? "cart"))
              setPanel(null);
            else setState((s) => ({ ...s, [a.target!]: "closed" }));
            break;
          case "setState":
          case "filter":
            setState((s) => ({ ...s, [a.target!]: a.value ?? "" }));
            break;
          case "addToCart":
            add(selected);
            break;
          case "checkout":
            setPanel("cart");
            break;
          case "inquiry":
          case "booking": {
            if (!form) throw new Error("Place this action on a form.");
            const data = Object.fromEntries(new FormData(form));
            if (!form.reportValidity()) return;
            setBusy(true);
            const result = await request(
              a.type === "inquiry" ? "inquiries" : "bookings",
              a.type === "booking"
                ? { ...data, serviceId: selected?.id }
                : data,
            );
            setNotice(
              `ТУРШИЛТ · ${a.type === "inquiry" ? "Хүсэлт хүлээн авлаа" : "Цаг захиалагдлаа"} · ${result.id.slice(0, 8)}`,
            );
            form.reset();
            break;
          }
        }
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function render(n: PageNode, record?: RecordData, inForm = false): ReactNode {
    const p = n.props;
    let value = p.text ?? "";
    if (p.binding) {
      const source = p.binding.source === "record" ? record : site.business;
      value = String(
        (source as any)?.[p.binding.field] ?? "⚠ Холболт шалгана уу",
      );
      if (p.binding.field === "price" && record) value = money(record.price);
    }
    const child = () =>
      n.children.map((c) => (
        <React.Fragment key={c.id}>
          {render(c, record, inForm || n.type === "form")}
        </React.Fragment>
      ));
    const className = `page-node pn-${n.id} node-${n.type}`;
    let content: ReactNode;
    switch (n.type) {
      case "container":
        content = (
          <div
            id={n.name === "Каталог" ? "catalog" : undefined}
            className={className}
          >
            {child()}
          </div>
        );
        break;
      case "text": {
        const Tag = p.tag ?? "p";
        content = (
          <Tag
            className={className}
            contentEditable={editing && !p.binding}
            suppressContentEditableWarning
            onBlur={(e) => {
              if (editing && !p.binding)
                onText?.(n.id, e.currentTarget.textContent ?? "");
            }}
          >
            {value}
          </Tag>
        );
        break;
      }
      case "image":
        content = (
          <img
            className={className}
            src={assetUrl(
              p.binding?.field === "image"
                ? record?.image
                : (p.src ?? "/art/editorial.svg"),
            )}
            alt={p.alt ?? record?.name ?? ""}
            loading="lazy"
          />
        );
        break;
      case "button":
        content = (
          <button
            className={className}
            type={inForm && !p.actions?.length ? "submit" : "button"}
            disabled={busy && !editing}
            onClick={(e) => {
              if (editing) {
                e.preventDefault();
                return;
              }
              if (p.actions?.length)
                void action(
                  p.actions,
                  record,
                  e.currentTarget.closest("form") ?? undefined,
                );
            }}
          >
            {value || "Товч"}
          </button>
        );
        break;
      case "input": {
        const id = `${site.id}-${n.id}-${record?.id ?? "page"}`;
        const type = p.inputType ?? "text";
        const shared = {
          id,
          name: p.name ?? n.id,
          required: p.required,
          disabled: editing,
          "aria-label": p.label ?? n.name,
          onChange: (
            e: React.ChangeEvent<
              HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >,
          ) => setState((s) => ({ ...s, [p.name ?? n.id]: e.target.value })),
        };
        content = (
          <label className={className} htmlFor={id}>
            <span>
              {p.label ?? n.name}
              {p.required ? " *" : ""}
            </span>
            {type === "select" ? (
              <select {...shared} defaultValue="">
                <option value="" disabled>
                  Сонгох
                </option>
                {p.options?.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : type === "textarea" ? (
              <textarea {...shared} rows={3} />
            ) : (
              <input
                {...shared}
                type={type}
                min={
                  type === "date"
                    ? new Date().toLocaleDateString("en-CA", {
                        timeZone: "Asia/Ulaanbaatar",
                      })
                    : type === "number"
                      ? 1
                      : undefined
                }
              />
            )}
          </label>
        );
        break;
      }
      case "form":
        content = (
          <form
            className={className}
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing) void action(p.actions, record, e.currentTarget);
            }}
          >
            {child()}
          </form>
        );
        break;
      case "collection": {
        const kind =
          p.collection === "products"
            ? "product"
            : p.collection === "projects"
              ? "project"
              : "service";
        const records = site.records.filter(
          (r) =>
            r.kind === kind &&
            (!state[p.collection ?? ""] || r.category === state[p.collection!]),
        );
        content = (
          <div className={className}>
            {records.length ? (
              records.map((r) => (
                <div className="record-scope" key={r.id}>
                  {n.children.map((c) => (
                    <React.Fragment key={c.id}>
                      {render(c, r, false)}
                    </React.Fragment>
                  ))}
                </div>
              ))
            ) : (
              <p className="empty-hint">Энэ цуглуулгад мэдээлэл алга.</p>
            )}
          </div>
        );
        break;
      }
      case "conditional":
        content =
          editing ||
          !p.condition ||
          state[p.condition.field] === p.condition.equals ? (
            <div className={className}>
              {editing && (
                <small className="condition-label">
                  Хэрэв {p.condition?.field} = {p.condition?.equals}
                </small>
              )}
              {child()}
            </div>
          ) : null;
        break;
    }
    return wrap ? wrap(n, content, record) : content;
  }
  return (
    <div
      className={`published-site theme-${site.theme} ${editing ? "editing-site" : ""}`}
    >
      <style>{pageCSS(site)}</style>
      {!editing && (
        <div className="test-banner">
          {isPages
            ? "GITHUB PAGES DEMO · Зөвхөн энэ төхөөрөмжид хадгална · No server, no live transactions"
            : "ТУРШИЛТЫН САЙТ · Бодит төлбөр, үйлчилгээ, Facebook холболт биш"}
          {site.preview ? " · ХУВИЙН УРЬДЧИЛАН ХАРАХ" : ""}
        </div>
      )}
      {render(site.document.root)}
      {!editing && (
        <>
          <div
            role="status"
            className={`site-notice ${notice ? "visible" : ""}`}
          >
            {notice}
            {notice && (
              <button aria-label="Мэдэгдэл хаах" onClick={() => setNotice("")}>
                ×
              </button>
            )}
          </div>
          {panel && (
            <div className="modal-backdrop" onClick={() => setPanel(null)}>
              <section
                role="dialog"
                aria-modal="true"
                aria-label={panel === "product" ? "Бүтээгдэхүүн" : "Таны сагс"}
                className="visitor-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  autoFocus
                  className="close-button"
                  aria-label="Хаах"
                  onClick={() => setPanel(null)}
                >
                  ×
                </button>
                <small className="eyebrow">ТУРШИЛТЫН ДЭЛГҮҮР</small>
                {panel === "product" && product ? (
                  <>
                    <img src={assetUrl(product.image)} alt={product.name} />
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                    <strong>{money(product.price)}</strong>
                    <label>
                      Сонголт
                      <select
                        value={
                          variants[product.id] ??
                          product.variants.find((v) => v.stock > 0)?.id ??
                          ""
                        }
                        onChange={(e) =>
                          setVariants((v) => ({
                            ...v,
                            [product.id]: e.target.value,
                          }))
                        }
                      >
                        {product.variants.map((v) => (
                          <option value={v.id} key={v.id} disabled={!v.stock}>
                            {v.name} · {v.stock} ширхэг
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="primary"
                      onClick={() => {
                        try {
                          add(product);
                        } catch (e) {
                          setNotice((e as Error).message);
                        }
                      }}
                    >
                      Сагсанд нэмэх
                    </button>
                  </>
                ) : (
                  <>
                    <h2>Таны сагс</h2>
                    {order && order.status === "awaiting_payment" ? (
                      <div className="payment-card">
                        <h3>Тест нэхэмжлэл · {money(order.total)}</h3>
                        <p>
                          {isPages
                            ? "Device-local test invoice. No server or payment provider is involved; no money is moved."
                            : "Бодит мөнгө шилжихгүй. Сервер захиалгын дүнг тооцож, үлдэгдлийг нөөцөлсөн."}
                        </p>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const result = await request(
                                `orders/${order.id}/payment-test`,
                                {
                                  accessToken: order.accessToken,
                                  outcome: "paid",
                                },
                              );
                              setOrder({ ...order, status: result.status });
                              setCart([]);
                              setNotice(
                                "ТУРШИЛТ · Төлбөр баталгаажлаа. Захиалга хадгалагдсан.",
                              );
                            } catch (e) {
                              setNotice((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Тест төлбөр баталгаажуулах
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await request(`orders/${order.id}/payment-test`, {
                                accessToken: order.accessToken,
                                outcome: "cancelled",
                              });
                              setOrder(null);
                            } catch (e) {
                              setNotice((e as Error).message);
                            }
                          }}
                        >
                          Цуцлах, үлдэгдлийг буцаах
                        </button>
                      </div>
                    ) : order && order.status === "paid_test" ? (
                      <div className="payment-card">
                        <h3>Туршилтын захиалга амжилттай</h3>
                        <p>
                          Дугаар: {order.id.slice(0, 8)} · {money(order.total)}
                        </p>
                        <button onClick={() => setOrder(null)}>
                          Үргэлжлүүлэх
                        </button>
                      </div>
                    ) : (
                      <>
                        {cartLines.map((l) => (
                          <div className="cart-line" key={l.variantId}>
                            <img src={assetUrl(l.record.image)} alt="" />
                            <div>
                              <strong>{l.record.name}</strong>
                              <p>{l.variant.name}</p>
                              <small>{money(l.record.price)}</small>
                            </div>
                            <input
                              aria-label={l.record.name + " тоо"}
                              type="number"
                              min={1}
                              max={l.variant.stock}
                              value={l.quantity}
                              onChange={(e) =>
                                setCart((c) =>
                                  c.map((i) =>
                                    i.variantId === l.variantId
                                      ? {
                                          ...i,
                                          quantity: Math.max(
                                            1,
                                            Math.min(
                                              20,
                                              Number(e.target.value),
                                            ),
                                          ),
                                        }
                                      : i,
                                  ),
                                )
                              }
                            />
                            <button
                              aria-label={l.record.name + " хасах"}
                              onClick={() =>
                                setCart((c) =>
                                  c.filter((i) => i.variantId !== l.variantId),
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {cartLines.length ? (
                          <form
                            className="checkout-form"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const f = e.currentTarget;
                              setBusy(true);
                              const key = "uru-checkout-" + site.id;
                              let saved;
                              try {
                                saved = JSON.parse(
                                  sessionStorage.getItem(key) ?? "null",
                                );
                              } catch {}
                              const payload = {
                                ...Object.fromEntries(new FormData(f)),
                                items: cartLines.map((l) => ({
                                  variantId: l.variantId,
                                  quantity: l.quantity,
                                })),
                                idempotencyKey:
                                  saved?.idempotencyKey ?? crypto.randomUUID(),
                                accessToken:
                                  saved?.accessToken ?? crypto.randomUUID(),
                              };
                              sessionStorage.setItem(
                                key,
                                JSON.stringify(payload),
                              );
                              try {
                                const result = await request("orders", payload);
                                setOrder({
                                  ...result,
                                  accessToken: payload.accessToken,
                                });
                                sessionStorage.removeItem(key);
                              } catch (e) {
                                setNotice((e as Error).message);
                                if (
                                  (e as Error).message.includes("request key")
                                )
                                  sessionStorage.removeItem(key);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <h3>
                              Нийт{" "}
                              {money(
                                cartLines.reduce(
                                  (s, l) => s + l.record.price * l.quantity,
                                  0,
                                ),
                              )}
                            </h3>
                            <p>
                              Хүргэлтийн төлбөр ороогүй. Зөвхөн тест захиалга.
                            </p>
                            <label>
                              Таны нэр
                              <input name="name" required autoComplete="name" />
                            </label>
                            <label>
                              Утас эсвэл имэйл
                              <input name="contact" required />
                            </label>
                            <button className="primary" disabled={busy}>
                              Тест захиалга үүсгэх
                            </button>
                          </form>
                        ) : (
                          <p>Сагс хоосон байна.</p>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
