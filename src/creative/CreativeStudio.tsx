import React, { useEffect, useRef, useState } from "react";
import type { PageNode } from "../shared/schema";
import { cssStyle } from "../shared/renderer";
import {
  parseScopedCSS,
  validateUtilities,
  utilitySuggestions,
  utilityClasses,
  appearanceGradients,
  appearanceShadows,
} from "../shared/creative";
import {
  compositionOptions,
  codePresets,
  createComposition,
  createCodeNode,
} from "./compositions";
import SandboxWidget from "./SandboxWidget";
const looks = [
  {
    id: "aurora",
    name: "Soft wonder",
    caption: "Lilac, peach & a fresh perspective.",
    background: "#f0ebff",
    color: "#423357",
    gradient: "aurora",
    radius: 28,
    shadow: "soft",
    font: "sans",
  },
  {
    id: "botanical",
    name: "Slow living",
    caption: "Fresh greens. A little room to breathe.",
    background: "#e6f1e4",
    color: "#294532",
    gradient: "mint",
    radius: 24,
    shadow: "soft",
    font: "sans",
  },
  {
    id: "midnight",
    name: "After hours",
    caption: "Deep ink. A confident, luminous edge.",
    background: "#212939",
    color: "#ffffff",
    gradient: "midnight",
    radius: 24,
    shadow: "glow",
    font: "sans",
  },
  {
    id: "paper",
    name: "Quiet confidence",
    caption: "Warm paper, sculptural type, less noise.",
    background: "#f8f1e5",
    color: "#403a30",
    gradient: "none",
    radius: 8,
    shadow: "none",
    font: "serif",
  },
] as const;
export default function CreativeStudio({
  node,
  en,
  onChange,
  onInsert,
  onClose,
  initialTab = "looks",
}: {
  initialTab?: string;
  node: PageNode;
  en: boolean;
  onChange: (fn: (n: PageNode) => void) => void;
  onInsert: (n: PageNode) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [css, setCSS] = useState(node.props.customCSS ?? "");
  const [utilities, setUtilities] = useState(node.props.utilities ?? "");
  const [codeTab, setCodeTab] = useState<"html" | "css" | "js">("html");
  const [code, setCode] = useState(node.props.code ?? codePresets.spark);
  const [feedback, setFeedback] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(
    () => setCSS(node.props.customCSS ?? ""),
    [node.id, node.props.customCSS],
  );
  useEffect(
    () => setUtilities(node.props.utilities ?? ""),
    [node.id, node.props.utilities],
  );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const focus = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,textarea,select,[tabindex="0"]',
          ) ?? [],
        );
        if (!focus.length) return;
        const first = focus[0],
          last = focus[focus.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    ref.current?.querySelector<HTMLButtonElement>(".studio-close")?.focus();
    return () => {
      document.removeEventListener("keydown", key, true);
      previous?.focus();
    };
  }, []);
  const t = (mn: string, english: string) => (en ? english : mn);
  const cssErrors = parseScopedCSS(css).errors;
  const utilityErrors = validateUtilities(utilities);
  const appearance = node.props.appearance ?? {};
  const sampleCSS = parseScopedCSS(node.props.customCSS ?? "").css;
  const previewStyle = cssStyle({
    ...node.style,
    padding: 32,
    minHeight: "320px",
    width: "100%",
    height: "auto",
    maxWidth: "100%",
    fontSize: 18,
  });
  function applyLook(look: (typeof looks)[number]) {
    onChange((n) => {
      n.style = {
        ...n.style,
        background: look.background,
        color: look.color,
        radius: look.radius,
      };
      n.props.appearance = {
        ...n.props.appearance,
        gradient: look.gradient,
        shadow: look.shadow,
      };
      if (look.font === "serif")
        n.props.customCSS =
          (n.props.customCSS ?? "") + ";font-family: Georgia, serif;";
    });
    setFeedback(
      t(
        "Өнгө төрх шинэчлэгдлээ. Canvas дээр таны өөрчлөлт хадгалагдана.",
        "Look applied to this element. Save the page to keep it.",
      ),
    );
  }
  return (
    <div className="creative-backdrop" onClick={onClose}>
      <section
        className="creative-studio"
        role="dialog"
        aria-modal="true"
        aria-labelledby="creative-studio-title"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
      >
        <header className="studio-header">
          <div className="studio-logo" aria-hidden="true">
            ✳
          </div>
          <div>
            <span>THE LITTLE EXTRAS THAT MAKE IT YOURS</span>
            <h2 id="creative-studio-title">
              {t("Өөрийн өнгийг нэм.", "Make it feel like you.")}
            </h2>
          </div>
          <button
            className="studio-close"
            aria-label="Close creative studio"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="studio-layout">
          <div className="studio-preview">
            <div className="studio-preview-label">
              <span>● LIVE STYLE SAMPLE</span>
              <span>{node.name}</span>
            </div>
            <div className="studio-preview-stage">
              <div
                data-hover={appearance.hover ?? "none"}
                className={`studio-sample ${utilityClasses(node.props.utilities)}`}
                style={{
                  ...(appearance.motion && appearance.motion !== "none"
                    ? {
                        animation: `uru-${appearance.motion} ${appearance.motion === "reveal" ? "800ms" : "2800ms"} ease-in-out ${appearance.motion === "reveal" ? "both" : "infinite"}`,
                      }
                    : {}),
                  ...previewStyle,
                  ...(appearance.gradient &&
                  appearanceGradients[appearance.gradient]
                    ? { background: appearanceGradients[appearance.gradient] }
                    : {}),
                  ...(appearance.shadow && appearanceShadows[appearance.shadow]
                    ? { boxShadow: appearanceShadows[appearance.shadow] }
                    : {}),
                }}
              >
                <style>{`.creative-studio .studio-sample{${sampleCSS}}`}</style>
                <span className="studio-sample-kicker">
                  ✦ A LITTLE POSSIBILITY
                </span>
                <div className="sample-orbit" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <h3>
                  Өөрийнхөөрөө.
                  <br />
                  <em>Unmistakably you.</em>
                </h3>
                <p>
                  {t(
                    "Багахан өнгө. Зөөлөн хөдөлгөөн. Таных гэдгийг мэдрүүлэх жижиг деталь.",
                    "A touch of color. A gentle movement. A detail that makes it yours.",
                  )}
                </p>
                <span className="sample-button">
                  {t("Дараагийн сайхан зүйл", "Something good starts here")} ↗
                </span>
              </div>
            </div>
            <div className="studio-preview-note">
              <span>↗</span>
              <p>
                {t(
                  "Сонгосон элементийг өөрчилнө. Таны текст ба бизнесийн холболтууд хэвээр.",
                  "Changes apply to your selected element. Your content and business connections stay in place.",
                )}
              </p>
            </div>
            <div className="studio-promise">
              <span>✓ Undo-friendly</span>
              <span>✓ Mobile-aware</span>
              <span>✓ Yours to change</span>
            </div>
          </div>
          <div className="studio-controls">
            <nav className="studio-tabs" aria-label="Creative tools">
              {[
                ["looks", "✳", t("Өнгө төрх", "Looks")],
                ["pieces", "▦", t("Эхлэх бүтэц", "Starters")],
                ["tailwind", "◈", "Tailwind"],
                ["css", "{ }", "CSS"],
                ["code", "</>", "HTML / JS"],
              ].map(([key, icon, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => {
                    setTab(key);
                    setFeedback("");
                  }}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </button>
              ))}
            </nav>
            <div className="studio-tool-body">
              {tab === "looks" && (
                <>
                  <div className="studio-section-heading">
                    <span>01 / PICK A FEELING</span>
                    <h3>
                      {t("Өөрийн хэмнэлийг ол.", "Find your kind of energy.")}
                    </h3>
                    <p>
                      {t(
                        "Энэ бол эхлэл. Деталь бүрийг дараа нь өөрчилж болно.",
                        "A starting point, never a limit. Every detail is editable.",
                      )}
                    </p>
                  </div>
                  <div className="look-grid">
                    {looks.map((look) => (
                      <button
                        key={look.id}
                        className={"look-option look-" + look.id}
                        onClick={() => applyLook(look)}
                        style={{
                          background: look.background,
                          color: look.color,
                        }}
                      >
                        <span className="look-swatch">
                          <i />
                          <i />
                          <i />
                        </span>
                        <strong>{look.name}</strong>
                        <small>{look.caption}</small>
                        <span className="look-arrow">↗</span>
                      </button>
                    ))}
                  </div>
                  <div className="studio-section-heading compact">
                    <span>02 / A LITTLE LIFE</span>
                    <h3>
                      {t(
                        "Мэдрэмжийг хөдөлгөөнөөр.",
                        "A little movement. A lot of character.",
                      )}
                    </h3>
                  </div>
                  <div className="studio-control-pair">
                    <label>
                      {t("Хөдөлгөөн", "Motion")}
                      <select
                        aria-label="Motion preset"
                        value={appearance.motion ?? "none"}
                        onChange={(e) =>
                          onChange((n) => {
                            n.props.appearance = {
                              ...n.props.appearance,
                              motion: e.target.value as any,
                            };
                          })
                        }
                      >
                        <option value="none">Still · none</option>
                        <option value="reveal">Gentle entrance</option>
                        <option value="float">Slow float</option>
                        <option value="pulse">Soft pulse</option>
                      </select>
                    </label>
                    <label>
                      {t("Hover / фокус", "Hover / focus")}
                      <select
                        aria-label="Hover effect"
                        value={appearance.hover ?? "none"}
                        onChange={(e) =>
                          onChange((n) => {
                            n.props.appearance = {
                              ...n.props.appearance,
                              hover: e.target.value as any,
                            };
                          })
                        }
                      >
                        <option value="none">None</option>
                        <option value="lift">Lift a little</option>
                        <option value="glow">A soft glow</option>
                        <option value="tilt">Playful tilt</option>
                      </select>
                    </label>
                  </div>
                  <p className="studio-hint">
                    {t(
                      "Хөдөлгөөн preview болон нийтэлсэн хуудсанд ажиллана. Reduced motion тохиргоог хүндэтгэнэ.",
                      "Motion runs in preview and published pages, and respects reduced-motion preferences.",
                    )}
                  </p>
                </>
              )}
              {tab === "pieces" && (
                <>
                  <div className="studio-section-heading">
                    <span>SMALL PIECES, BIG POSSIBILITIES</span>
                    <h3>
                      {t(
                        "Эхлэлийг нь эндээс.",
                        "Skip the blank-canvas moment.",
                      )}
                    </h3>
                    <p>
                      {t(
                        "Эдгээр нь ижил энгийн элементүүдээс бүтсэн. Задлаад, өөрчлөөд, дахин ашигла.",
                        "Each starter is built from your regular blocks. Take it apart. Make it yours.",
                      )}
                    </p>
                  </div>
                  <div className="starter-grid">
                    {compositionOptions.map((c) => (
                      <button
                        className={"starter-card starter-" + c.tone}
                        key={c.id}
                        onClick={() => {
                          onInsert(createComposition(c.id));
                          onClose();
                        }}
                      >
                        <div className="starter-art" aria-hidden="true">
                          <b>{c.symbol}</b>
                          <i />
                          <i />
                        </div>
                        <strong>{en ? c.name : c.mn}</strong>
                        <small>{c.description}</small>
                        <span>＋ {t("Canvas-д нэмэх", "Add to canvas")}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {tab === "tailwind" && (
                <>
                  <div className="studio-section-heading">
                    <span>REAL TAILWIND, NO CDN</span>
                    <h3>
                      {t(
                        "Жижиг class. Том өөрчлөлт.",
                        "Small classes. Expressive possibilities.",
                      )}
                    </h3>
                    <p>
                      {t(
                        "Дэмжигдсэн Tailwind utilities нь build-д багтсан. Responsive болон hover хувилбар ашигла.",
                        "Supported Tailwind utilities are compiled into your site. Responsive and hover variants work too.",
                      )}
                    </p>
                  </div>
                  <label>
                    Tailwind classes
                    <textarea
                      className="creative-code-input"
                      rows={4}
                      value={utilities}
                      onChange={(e) => setUtilities(e.target.value)}
                      spellCheck={false}
                      placeholder="p-6 rounded-2xl bg-violet-50 shadow-lg md:p-12"
                    />
                  </label>
                  <div className="utility-chips">
                    {utilitySuggestions.map((u) => (
                      <button
                        key={u}
                        onClick={() =>
                          setUtilities((v) =>
                            [
                              ...new Set([
                                ...v.trim().split(/\s+/).filter(Boolean),
                                u,
                              ]),
                            ].join(" "),
                          )
                        }
                      >
                        {u} ＋
                      </button>
                    ))}
                  </div>
                  {utilityErrors.length > 0 && (
                    <div className="studio-error" role="alert">
                      {utilityErrors.slice(0, 3).map((e) => (
                        <p key={e}>{e}</p>
                      ))}
                    </div>
                  )}
                  <button
                    className="studio-apply"
                    disabled={utilityErrors.length > 0}
                    onClick={() => {
                      onChange((n) => {
                        n.props.utilities = utilities.trim();
                      });
                      setFeedback(
                        t(
                          "Tailwind classes хэрэгжлээ.",
                          "Tailwind classes applied.",
                        ),
                      );
                    }}
                  >
                    Apply Tailwind ↗
                  </button>
                  <p className="studio-hint">
                    {t(
                      "Хувилбарууд: sm:, md:, hover:, focus-visible:. Дэмжигдээгүй class-д scoped CSS ашигла.",
                      "Variants: sm:, md:, hover:, focus-visible:. For other values, use scoped CSS.",
                    )}{" "}
                    Tailwind overrides visual sliders; scoped CSS has final
                    priority.
                  </p>
                </>
              )}
              {tab === "css" && (
                <>
                  <div className="studio-section-heading">
                    <span>YOUR DETAILS, YOUR RULES</span>
                    <h3>
                      {t("Тэр жижиг ялгааг нэм.", "Make the detail yours.")}
                    </h3>
                    <p>
                      {t(
                        "CSS зөвхөн энэ элементэд үйлчилнэ. Selector эсвэл @rule бичих шаардлагагүй.",
                        "These declarations affect only this element. No selectors or @rules needed.",
                      )}
                    </p>
                  </div>
                  <label>
                    Scoped CSS
                    <textarea
                      className="creative-code-input"
                      rows={11}
                      spellCheck={false}
                      value={css}
                      onChange={(e) => setCSS(e.target.value)}
                      placeholder={
                        "background: linear-gradient(135deg, #eee8ff, #ffe9df);\nborder-radius: 28px;\nletter-spacing: -0.03em;"
                      }
                    />
                  </label>
                  {cssErrors.length > 0 && (
                    <div className="studio-error" role="alert">
                      {cssErrors.map((e) => (
                        <p key={e}>{e}</p>
                      ))}
                    </div>
                  )}
                  <button
                    className="studio-apply"
                    disabled={cssErrors.length > 0}
                    onClick={() => {
                      onChange((n) => {
                        n.props.customCSS = css.trim();
                      });
                      setFeedback(
                        t(
                          "CSS зөвхөн сонгосон элементэд хэрэгжлээ.",
                          "CSS applied to this element only.",
                        ),
                      );
                    }}
                  >
                    Apply CSS ↗
                  </button>
                  <div className="studio-code-note">
                    <strong>Scoped, by design.</strong>
                    <p>
                      {t(
                        "Typography, gradients, flex/grid, shadows, filters, transforms болон transitions. URL, import болон глобал дүрэм хүлээн авахгүй.",
                        "Typography, gradients, flex/grid, shadows, filters, transforms and transitions. External URLs, imports and global rules are rejected.",
                      )}
                    </p>
                  </div>
                </>
              )}
              {tab === "code" && (
                <>
                  <div className="studio-section-heading">
                    <span>A LITTLE EXTRA, IN ITS OWN SPACE</span>
                    <h3>
                      {t(
                        "Өөрийн интерактив хэсэг.",
                        "Your own interactive little world.",
                      )}
                    </h3>
                    <p>
                      {t(
                        "HTML, CSS, JavaScript нь тусгаарлагдсан iframe дотор ажиллана.",
                        "HTML, CSS and JavaScript run inside an isolated iframe.",
                      )}
                    </p>
                  </div>
                  <div className="code-presets">
                    {Object.entries(codePresets).map(([key, p]) => (
                      <button key={key} onClick={() => setCode({ ...p })}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="code-language-tabs">
                    {(["html", "css", "js"] as const).map((key) => (
                      <button
                        key={key}
                        className={codeTab === key ? "active" : ""}
                        onClick={() => setCodeTab(key)}
                      >
                        {key.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <label className="sr-only" htmlFor="creative-code-editor">
                    {codeTab.toUpperCase()} code
                  </label>
                  <textarea
                    id="creative-code-editor"
                    aria-label={codeTab.toUpperCase() + " code"}
                    className="creative-code-input"
                    rows={9}
                    spellCheck={false}
                    value={code[codeTab]}
                    onChange={(e) =>
                      setCode({ ...code, [codeTab]: e.target.value })
                    }
                  />
                  <div className="widget-preview">
                    <span>ISOLATED WIDGET PREVIEW</span>
                    <SandboxWidget
                      code={code}
                      title="Creative code preview"
                      height={500}
                    />
                  </div>
                  <button
                    className="studio-apply"
                    onClick={() => {
                      if (node.type === "embed") {
                        onChange((n) => {
                          n.props.code = {
                            html: code.html,
                            css: code.css,
                            js: code.js,
                          };
                        });
                        setFeedback(
                          "Widget updated. Save the page to keep it.",
                        );
                      } else {
                        const widget = createCodeNode();
                        widget.props.code = {
                          html: code.html,
                          css: code.css,
                          js: code.js,
                        };
                        onInsert(widget);
                        onClose();
                      }
                    }}
                  >
                    {node.type === "embed"
                      ? "Update this widget"
                      : "＋ Add creative widget"}
                  </button>
                  <p className="studio-hint">
                    No parent-page access, business records, cookies, requests,
                    popups or external scripts. Never place secrets in a
                    snippet. This frame uses its own CSS; Tailwind styles its
                    outer block.
                  </p>
                </>
              )}
              {feedback && (
                <div className="studio-feedback" role="status">
                  ✓ {feedback}
                </div>
              )}
            </div>
            <footer className="studio-footer">
              <span>✳ YOUR IDEAS BELONG HERE</span>
              <button onClick={onClose}>
                {t("Canvas руу буцах", "Back to canvas")} ↗
              </button>
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}
