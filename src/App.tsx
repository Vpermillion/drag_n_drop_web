import {
  isPages,
  appHref,
  editorHref,
  siteHref,
  previewHref,
  assetUrl,
} from "./paths";
import React, { useEffect, useState, useRef } from "react";
import { api } from "./api";
import Editor from "./Editor";
import { money, type RecordData } from "./shared/schema";
const navigation = [
  ["today", "◷", "Өнөөдөр", "Today"],
  ["website", "▣", "Вебсайт", "Website"],
  ["business", "▦", "Бизнес", "Business"],
  ["messages", "☷", "Мессеж", "Messages"],
  ["promotions", "↗", "Пост ба сурталчилгаа", "Promotions"],
  ["reports", "▥", "Тайлан", "Reports"],
  ["settings", "⚙", "Тохиргоо", "Settings"],
];
type Workspace = { id: string; name: string; role: string; demo: number };
const date = (v: string | number) =>
  new Date(
    typeof v === "string" ? (v.includes("T") ? v : v + "Z") : v,
  ).toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
function Auth({
  onDone,
  en,
  setEn,
}: {
  onDone: () => void;
  en: boolean;
  setEn: (v: boolean) => void;
}) {
  const [register, setRegister] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand" href={appHref()}>
          ү<span>үрү</span>
          <small>BUSINESS STUDIO</small>
        </a>
        <div>
          <span className="pill">ТАНЫ САНАА. ТАНЫ ОРОН ЗАЙ.</span>
          <h1>
            Бизнесээ
            <br />
            өөрийнхөөрөө
            <br />
            <em>бүтээ.</em>
          </h1>
          <p>
            Нэг мэдээлэл. Олон боломж.
            <br />
            Вебсайт, захиалга, харилцагч — нэг дор.
          </p>
        </div>
        <div className="auth-art">
          <img
            src={assetUrl("/art/editorial.svg")}
            alt="Монгол ноолуурын дүрслэл"
          />
          <div className="floating-label">▣ Төсөөллөөс бодит бизнес рүү</div>
        </div>
        <small>Монголд зориулсан, таны өөрийн студи.</small>
      </section>
      <section className="auth-form-wrap">
        <button className="language" onClick={() => setEn(!en)}>
          {en ? "МН" : "EN"} ↗
        </button>
        <div className="auth-form">
          <div className="studio-mark">✳</div>
          <small className="eyebrow">YOUR NEXT CHAPTER</small>
          <h2>
            {register
              ? en
                ? "Make room for your business."
                : "Бизнесийнхээ шинэ хуудсыг нээ."
              : en
                ? "Welcome back."
                : "Тавтай морил."}
          </h2>
          <p className="muted">
            {en
              ? "Start with a real editor and three editable demo sites."
              : "Бодит редактор, засаж болох гурван туршилтын сайтаас эхлээрэй."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const body = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api(
                  "/auth/" + (register ? "register" : "login"),
                  "POST",
                  body,
                );
                onDone();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {register && (
              <label>
                {en ? "Your name" : "Таны нэр"}
                <input
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Болор"
                />
              </label>
            )}
            <label>
              {en ? "Email" : "Имэйл"}
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@business.mn"
              />
            </label>
            <label>
              {en ? "Password" : "Нууц үг"}
              <input
                name="password"
                type="password"
                minLength={register ? 10 : 1}
                maxLength={128}
                required
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={
                  en ? "At least 10 characters" : "Хамгийн багадаа 10 тэмдэгт"
                }
              />
            </label>
            {register && (
              <label>
                {en ? "Business name" : "Бизнесийн нэр"}
                <input
                  name="workspaceName"
                  required
                  placeholder="Миний бизнес"
                />
              </label>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? "…"
                : register
                  ? en
                    ? "Create my studio →"
                    : "Студи үүсгэх →"
                  : en
                    ? "Sign in →"
                    : "Нэвтрэх →"}
            </button>
          </form>
          <button
            className="switch-auth"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? en
                ? "Already have an account? Sign in"
                : "Бүртгэлтэй юу? Нэвтрэх"
              : en
                ? "New here? Create an account"
                : "Шинээр бүртгүүлэх"}
          </button>
          <p className="auth-disclaimer">
            {en
              ? "Local pilot · Sample businesses and transactions are clearly marked as test. No money is moved."
              : "Локал туршилт · Жишээ бизнес ба гүйлгээ нь тест горимтой. Бодит мөнгө шилжихгүй."}
          </p>
        </div>
      </section>
    </main>
  );
}
export default function App() {
  const replyRequests = useRef<
    Record<string, { body: string; key: string; pending: boolean }>
  >({});
  const [en, setEn] = useState(localStorage.getItem("uru-language") === "en");
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [view, setView] = useState("today");
  const [editing, setEditing] = useState(
    new URLSearchParams(location.search).get("editor"),
  );
  const [data, setData] = useState<any>(null);
  const [catalog, setCatalog] = useState<
    (RecordData & { siteId: string; archived?: number })[]
  >([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [businessTab, setBusinessTab] = useState("catalog");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [newRecord, setNewRecord] = useState(false);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const t = (mn: string, eng: string) => (en ? eng : mn);
  useEffect(() => {
    localStorage.setItem("uru-language", en ? "en" : "mn");
    document.documentElement.lang = en ? "en" : "mn";
  }, [en]);
  async function authenticate() {
    setLoading(true);
    try {
      const result = await api("/session");
      if (!result.user) {
        setMe(null);
        setWs(null);
        return;
      }
      setMe(result);
      const id = localStorage.getItem("uru-workspace");
      setWs(
        result.workspaces.find((w: Workspace) => w.id === id) ??
          result.workspaces[0],
      );
    } catch {
      setMe(null);
      setWs(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void authenticate();
  }, []);
  async function refresh() {
    if (!ws) return;
    setError("");
    try {
      const results = await Promise.all([
        api(`/w/${ws.id}/dashboard`),
        api(`/w/${ws.id}/catalog`),
        api(`/w/${ws.id}/messages`),
        api(`/w/${ws.id}/promotions`),
        api(`/w/${ws.id}/integrations`),
        api(`/w/${ws.id}/team`),
      ]);
      setData(results[0]);
      setCatalog(results[1]);
      setMessages(results[2]);
      setPromotions(results[3]);
      setIntegrations(results[4]);
      setTeam(results[5]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (ws) {
      localStorage.setItem("uru-workspace", ws.id);
      void refresh();
    }
  }, [ws?.id]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timeout);
  }, [notice]);
  async function mutate(
    path: string,
    method: string,
    body: unknown,
    success?: string,
  ) {
    if (!ws) return;
    try {
      const result = await api(`/w/${ws.id}${path}`, method, body);
      if (success) setNotice(success);
      await refresh();
      return result;
    } catch (e) {
      setNotice((e as Error).message);
      return null;
    }
  }
  function openEditor(id: string, creative = false) {
    setEditing(id);
    history.replaceState(
      null,
      "",
      editorHref(id) + (creative ? "&studio=1" : ""),
    );
  }
  const nav = (v: string) => {
    setView(v);
    setEditing(null);
    history.replaceState(null, "", appHref());
  };
  if (loading) return <div className="loading">✳ Үрү студи…</div>;
  if (!me)
    return <Auth onDone={() => void authenticate()} en={en} setEn={setEn} />;
  if (editing && ws)
    return (
      <>
        <Editor
          ws={ws.id}
          siteId={editing}
          en={en}
          notify={setNotice}
          onBack={() => {
            setEditing(null);
            history.replaceState(null, "", appHref());
            setView("website");
            void refresh();
          }}
        />
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button aria-label="Хаах" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
      </>
    );
  const pending =
    data?.inquiries.filter((i: any) => i.status === "new").length ?? 0;
  const unpaid =
    data?.orders.filter((o: any) => o.status === "awaiting_payment").length ??
    0;
  const activeBookings =
    data?.bookings.filter((b: any) => b.status === "reserved_test").length ?? 0;
  const paid =
    data?.orders.filter((o: any) =>
      ["paid_test", "fulfilled_test"].includes(o.status),
    ) ?? [];
  const label = navigation.find((n) => n[0] === view);
  const siteCards = (
    <div className="site-grid">
      {data?.sites.map((s: any) => (
        <article className={"site-card theme-card-" + s.theme} key={s.id}>
          <button
            className="site-thumbnail"
            aria-label={s.name + " засах"}
            onClick={() => openEditor(s.id)}
          >
            <span className="mini-browser">
              <i />
              <i />
              <i />
              <span>{s.slug}.localhost</span>
            </span>
            <div className="thumbnail-content">
              <div>
                <small>{s.preview?.brand ?? s.name}</small>
                <h3 style={{ whiteSpace: "pre-line" }}>
                  {s.preview?.heading ?? s.name}
                </h3>
                {s.theme === "shop" && <span>Шинэ цуглуулга →</span>}
              </div>
              {s.preview?.image && (
                <img src={assetUrl(s.preview.image)} alt="" />
              )}
            </div>
          </button>
          <div className="site-card-info">
            <div>
              <h3>{s.name}</h3>
              <span className={"status-dot " + (s.published_id ? "live" : "")}>
                {s.published_id
                  ? t("Туршилтаар нийтэлсэн", "Published test site")
                  : t("Ноорог", "Draft")}{" "}
                · {t("Туршилтын орчин", "Demo workspace")}
              </span>
            </div>
            <button
              className="icon-btn"
              aria-label={s.name + " нээх"}
              onClick={() => openEditor(s.id)}
            >
              ↗
            </button>
          </div>
          <div className="site-card-actions">
            <button onClick={() => openEditor(s.id)}>
              {t("Редактор нээх", "Open editor")} ↗
            </button>
            <a
              href={s.published_id ? siteHref(s.slug) : previewHref(s.id)}
              target="_blank"
              rel="noreferrer"
            >
              {t("Харах", "View")} ↗
            </a>
          </div>
        </article>
      ))}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href={appHref()}
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            nav("today");
          }}
        >
          ү<span>үрү</span>
          <small>BUSINESS STUDIO</small>
        </a>
        <label className="workspace-select">
          <span className="workspace-monogram">{ws?.name.slice(0, 1)}</span>
          <select
            aria-label="Ажлын орчин"
            value={ws?.id ?? ""}
            onChange={(e) => {
              setEditing(null);
              setWs(
                me.workspaces.find((w: Workspace) => w.id === e.target.value),
              );
            }}
          >
            {me.workspaces.map((w: Workspace) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <small className="sidebar-label">
          {t("ТАНЫ АЖЛЫН ОРОН ЗАЙ", "YOUR WORKSPACE")}
        </small>
        <nav>
          {navigation.map(([key, icon, mn, eng]) => (
            <button
              key={key}
              onClick={() => nav(key)}
              className={view === key ? "active" : ""}
            >
              <span>{icon}</span>
              {en ? eng : mn}
              {key === "today" && pending > 0 && <b>{pending}</b>}
              {key === "messages" &&
                messages.some((m) => m.state === "unanswered") && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="demo-card">
            <span>✳</span>
            <strong>{t("Туршилтын орчин", "Demo workspace")}</strong>
            <p>
              {t(
                "Төсөөл. Эвлүүл. Турш. Бодит мөнгө, пост илгээхгүй.",
                "Compose and test. No money movement or live social posts.",
              )}
            </p>
            <button onClick={() => nav("settings")}>
              {t("Холболтуудыг харах", "View integrations")} ↗
            </button>
          </div>
          <button className="profile" onClick={() => nav("settings")}>
            <span>{me.user.name.slice(0, 1)}</span>
            <div>
              <strong>{me.user.name}</strong>
              <small>{ws?.role}</small>
            </div>
            <b>⌄</b>
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div>
            <span className="breadcrumb-home">⌂</span>
            <span>/</span>
            <strong>{en ? label?.[3] : label?.[2]}</strong>
          </div>
          <div>
            <span className="local-state">
              ● {t("Локал пилот", "Local pilot")}
            </span>
            <button className="language" onClick={() => setEn(!en)}>
              {en ? "EN" : "МН"} ⌄
            </button>
            <button
              className="avatar"
              aria-label="Профайл"
              onClick={() => nav("settings")}
            >
              {me.user.name.slice(0, 1)}
            </button>
          </div>
        </header>
        <main className="dashboard-content">
          {error && (
            <div className="form-error" role="alert">
              {error}
              <button onClick={() => void refresh()}>Дахин оролдох</button>
            </div>
          )}
          {!data ? (
            <div className="loading">Мэдээлэл ачаалж байна…</div>
          ) : (
            <>
              {(view === "today" || view === "website") && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        {view === "today"
                          ? t(
                              "БИЗНЕСИЙН ТАНЬ ШИНЭ ӨДӨР",
                              "A NEW DAY FOR YOUR BUSINESS",
                            )
                          : t(
                              "ТАНЫ БИЗНЕСИЙН ЦАХИМ ОРОН ЗАЙ",
                              "YOUR SPACE ON THE WEB",
                            )}
                      </div>
                      <h1>
                        {view === "today"
                          ? t(
                              "Сайн байна уу, " +
                                me.user.name.split(" ")[0] +
                                ".",
                              "Hello, " + me.user.name.split(" ")[0] + ".",
                            )
                          : t("Өөрийнхөөрөө бүтээ.", "Make it your own.")}
                      </h1>
                      <p>
                        {view === "today"
                          ? t(
                              "Том санаа жижиг алхмаас эхэлдэг. Өнөөдөр юуг бүтээх вэ?",
                              "Big ideas start with small steps. What will you create today?",
                            )
                          : t(
                              "Загвараас эхэл. Элементүүдээ эвлүүл. Бизнесээ холбо.",
                              "Start with a composition. Arrange your elements. Connect your business.",
                            )}
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setCreating(true)}
                    >
                      ＋ {t("Сайт үүсгэх", "Create a site")}
                    </button>
                  </div>
                  {view === "today" && (
                    <>
                      <div className="metric-grid">
                        {[
                          [
                            pending,
                            t("Шинэ хүсэлт", "New inquiries"),
                            "↗",
                            "inquiries",
                          ],
                          [
                            unpaid,
                            t("Төлбөр хүлээж буй", "Awaiting payment"),
                            "◷",
                            "orders",
                          ],
                          [
                            activeBookings,
                            t("Туршилтын цаг захиалга", "Test reservations"),
                            "▣",
                            "bookings",
                          ],
                        ].map(([count, title, icon, tab]) => (
                          <button
                            className="metric-card"
                            key={title}
                            onClick={() => {
                              setView("business");
                              setBusinessTab(String(tab));
                            }}
                          >
                            <span className="metric-icon">{icon}</span>
                            <span>
                              <small>{title}</small>
                              <strong>{count}</strong>
                            </span>
                            <b>↗</b>
                          </button>
                        ))}
                      </div>
                      <section className="build-banner">
                        <div>
                          <span className="pill">
                            {t(
                              "САНААНААС БОДИТ БҮТЭЭЛ РҮҮ",
                              "FROM AN IDEA TO SOMETHING REAL",
                            )}
                          </span>
                          <h2>
                            {t("Таны бизнес.", "Your business.")}
                            <br />
                            {t(
                              "Таны өөрийн өнгө төрх.",
                              "Your own point of view.",
                            )}
                          </h2>
                          <p>
                            {t(
                              "Хэдхэн энгийн элементээс таны төсөөлсөн вебсайтыг.",
                              "Build the website you imagine from a few simple elements.",
                            )}
                          </p>
                          <button
                            onClick={() => openEditor(data.sites[0]?.id, true)}
                          >
                            {t("Бүтээж эхлэх", "Start creating")} <span>↗</span>
                          </button>
                        </div>
                        <div className="banner-art" aria-hidden="true">
                          <div className="banner-grid" />
                          <div className="shape-card shape-a">
                            <span>▧</span>
                            <img src={assetUrl("/art/knit.svg")} alt="" />
                            <small>Зураг</small>
                          </div>
                          <div className="shape-card shape-b">
                            <span>T</span>
                            <strong>Өөрийнхөөрөө.</strong>
                            <small>Текст</small>
                          </div>
                          <div className="shape-card shape-c">
                            Дэлгэрэнгүй <span>↗</span>
                          </div>
                          <span className="art-handle h1" />
                          <span className="art-handle h2" />
                          <span className="art-handle h3" />
                          <span className="art-handle h4" />
                          <div className="cursor-label">↖ Таны санаа</div>
                        </div>
                      </section>
                    </>
                  )}
                  <div className="section-heading">
                    <div>
                      <h2>
                        {t("Таны вебсайтууд", "Your websites")}{" "}
                        <span>{data.sites.length}</span>
                      </h2>
                      <p>
                        {t(
                          "Ижил элементүүд. Өөр өөр түүхүүд.",
                          "Shared elements. Different stories.",
                        )}
                      </p>
                    </div>
                    <span className="subtle-text">
                      {t("Бүх өөрчлөлт таны гарт", "Every detail is yours")} ↗
                    </span>
                  </div>
                  {siteCards}
                  {view === "today" && (
                    <div className="below-grid">
                      <section className="activity-card">
                        <div className="section-heading">
                          <h2>{t("Сүүлийн үйлдлүүд", "Recent activity")}</h2>
                          <span>↗</span>
                        </div>
                        {data.audit.length ? (
                          data.audit.slice(0, 5).map((a: any, i: number) => (
                            <div className="activity-row" key={i}>
                              <span>↗</span>
                              <div>
                                <strong>{a.action}</strong>
                                <small>
                                  {a.entity_id.slice(0, 8)} ·{" "}
                                  {date(a.created_at)}
                                </small>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="empty-state">
                            <span>↗</span>
                            <h3>
                              {t(
                                "Эхний алхмаа хийгээрэй.",
                                "Take the first step.",
                              )}
                            </h3>
                            <p>
                              {t(
                                "Хуудас хадгалах, нийтлэх, хүсэлт илгээхэд энд харагдана.",
                                "Saved pages, publications and customer actions appear here.",
                              )}
                            </p>
                          </div>
                        )}
                      </section>
                      <section className="connection-card">
                        <span className="eyebrow">CONNECTED BUSINESS</span>
                        <h2>
                          {t("Нэг мэдээлэл.", "One source.")}
                          <br />
                          {t("Олон боломж.", "More possibilities.")}
                        </h2>
                        <p>
                          {t(
                            "Бүтээгдэхүүнээс сайт, сайтаас захиалга, захиалгаас харилцаа.",
                            "From product to website, from website to order and conversation.",
                          )}
                        </p>
                        <div>
                          <span>▦</span>
                          <i>—</i>
                          <span>▣</span>
                          <i>—</i>
                          <span>☷</span>
                        </div>
                        <button onClick={() => nav("business")}>
                          {t("Бизнесээ удирдах", "Manage your business")} ↗
                        </button>
                      </section>
                    </div>
                  )}
                </>
              )}
              {view === "business" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">CONNECTED BUSINESS</div>
                      <h1>
                        {t("Бизнесийн өдөр тутам.", "Business, day to day.")}
                      </h1>
                      <p>
                        {t(
                          "Нэг мэдээлэл вебсайт, захиалга, сурталчилгаанд дахин ашиглагдана.",
                          "Your catalog connects your website, transactions and promotions.",
                        )}
                      </p>
                    </div>
                    {businessTab === "catalog" && (
                      <button
                        className="primary"
                        onClick={() => setNewRecord(true)}
                      >
                        ＋ {t("Мэдээлэл нэмэх", "Add a record")}
                      </button>
                    )}
                  </div>
                  <div className="content-tabs">
                    {[
                      ["catalog", "Каталог", "Catalog"],
                      ["inquiries", "Хүсэлт", "Inquiries"],
                      ["orders", "Захиалга", "Orders"],
                      ["bookings", "Цаг захиалга", "Bookings"],
                      ["customers", "Харилцагч", "Customers"],
                    ].map(([k, mn, eng]) => (
                      <button
                        key={k}
                        className={businessTab === k ? "active" : ""}
                        onClick={() => setBusinessTab(k)}
                      >
                        {en ? eng : mn}
                      </button>
                    ))}
                  </div>
                  <div className="test-strip">
                    {t(
                      "ТУРШИЛТ · Бүх захиалга, цаг, төлбөр туршилтын бүртгэл. Бодит үйлчилгээ амлагдахгүй.",
                      "TEST · All orders, reservations and payments are test records. No real service availability is implied.",
                    )}
                  </div>
                  {businessTab === "catalog" ? (
                    <div className="catalog-grid">
                      {catalog.map((r) => (
                        <article className="catalog-card" key={r.id}>
                          <img src={assetUrl(r.image)} alt={r.name} />
                          <div>
                            <small className="eyebrow">
                              {r.category} · {r.kind}
                            </small>
                            <h3>{r.name}</h3>
                            <p>{r.description}</p>
                            <strong>{money(r.price)}</strong>
                            {r.variants.map((v) => (
                              <div className="stock-row" key={v.id}>
                                <small>
                                  {v.name} · {v.stock} ш
                                </small>
                                <button
                                  onClick={() =>
                                    void mutate(
                                      "/variants/" + v.id + "/stock",
                                      "POST",
                                      { quantity: 5 },
                                      "Үлдэгдэл +5",
                                    )
                                  }
                                >
                                  ＋5
                                </button>
                              </div>
                            ))}
                            <div className="card-button-row">
                              <button
                                className="subtle"
                                onClick={() => setEditRecord(r)}
                              >
                                Засах
                              </button>
                              <button
                                className="subtle"
                                onClick={() =>
                                  void mutate(
                                    "/catalog/" + r.id + "/archive",
                                    "POST",
                                    { archived: !r.archived },
                                    r.archived
                                      ? "Каталог сэргээгдлээ"
                                      : "Архивлагдлаа. Худалдан авалтын түүх хэвээр.",
                                  )
                                }
                              >
                                {r.archived ? "Сэргээх" : "Архивлах"}
                              </button>
                              <button
                                className="subtle"
                                onClick={async () => {
                                  const result = await mutate(
                                    "/promotions",
                                    "POST",
                                    { recordId: r.id },
                                    t(
                                      "Саналын хуудас ба постын ноорог үүслээ.",
                                      "Offer page and social draft created.",
                                    ),
                                  );
                                  if (result) setView("promotions");
                                }}
                              >
                                ↗ {t("Санал үүсгэх", "Promote")}
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : businessTab === "inquiries" ? (
                    <section className="records-panel">
                      {data.inquiries.length ? (
                        data.inquiries.map((i: any) => (
                          <article className="inquiry-card" key={i.id}>
                            <div>
                              <small className="eyebrow">
                                TEST · {date(i.created_at)}
                              </small>
                              <h3>{i.name}</h3>
                              <p>{i.contact}</p>
                            </div>
                            <div className="inquiry-data">
                              {Object.entries(JSON.parse(i.data))
                                .filter(
                                  ([k]) => !["name", "contact"].includes(k),
                                )
                                .map(([k, v]) => (
                                  <p key={k}>
                                    <small>{k}</small> {String(v)}
                                  </p>
                                ))}
                            </div>
                            <select
                              aria-label={i.name + " хүсэлтийн төлөв"}
                              value={i.status}
                              onChange={(e) =>
                                void mutate(
                                  "/inquiries/" + i.id,
                                  "PATCH",
                                  { status: e.target.value },
                                  "Төлөв хадгалагдлаа",
                                )
                              }
                            >
                              <option value="new">Шинэ</option>
                              <option value="contacted">Холбогдсон</option>
                              <option value="closed">Хаасан</option>
                            </select>
                          </article>
                        ))
                      ) : (
                        <Empty
                          text={t(
                            "Одоогоор хүсэлт алга. Ором сайтыг нийтэлж хүсэлт илгээгээрэй.",
                            "No inquiries yet. Publish the Orom site and submit a request.",
                          )}
                        />
                      )}
                    </section>
                  ) : businessTab === "orders" ? (
                    <section className="records-panel">
                      {data.orders.length ? (
                        data.orders.map((o: any) => (
                          <article className="record-row" key={o.id}>
                            <div>
                              <small>TEST · {o.id.slice(0, 8)}</small>
                              <h3>{o.name}</h3>
                              <p>{o.contact}</p>
                            </div>
                            <strong>{money(o.total)}</strong>
                            <span className="badge">{o.status}</span>
                            {o.status === "paid_test" && (
                              <button
                                className="subtle"
                                onClick={() =>
                                  void mutate(
                                    "/orders/" + o.id + "/fulfill",
                                    "POST",
                                    {},
                                    "Тест гүйцэтгэл хадгалагдлаа",
                                  )
                                }
                              >
                                Гүйцэтгэсэн
                              </button>
                            )}
                          </article>
                        ))
                      ) : (
                        <Empty
                          text={t(
                            "Захиалга алга. Эрдэнэ сайтыг нийтэлж тест худалдан авалт хийгээрэй.",
                            "No orders. Publish Erdene and try a test purchase.",
                          )}
                        />
                      )}
                    </section>
                  ) : businessTab === "bookings" ? (
                    <section className="records-panel">
                      {data.bookings.length ? (
                        data.bookings.map((b: any) => (
                          <article className="record-row" key={b.id}>
                            <div>
                              <small>TEST · {b.service_name}</small>
                              <h3>{b.name}</h3>
                              <p>{b.contact}</p>
                            </div>
                            <strong>{date(b.starts)}</strong>
                            <span className="badge">{b.status}</span>
                            {b.status === "reserved_test" && (
                              <button
                                className="subtle"
                                onClick={() =>
                                  void mutate(
                                    "/bookings/" + b.id + "/cancel",
                                    "POST",
                                    {},
                                    "Туршилтын цаг цуцлагдлаа",
                                  )
                                }
                              >
                                Цуцлах
                              </button>
                            )}
                          </article>
                        ))
                      ) : (
                        <Empty
                          text={t(
                            "Цаг захиалга алга. Нами сайтаас туршина уу.",
                            "No reservations. Try the Nami site.",
                          )}
                        />
                      )}
                      <p className="muted panel-foot">
                        Цагийн бүс: Улаанбаатар (UTC+8). Туршилтын студи нэг
                        зэрэг нэг үйлчлүүлэгч авна.
                      </p>
                    </section>
                  ) : (
                    <section className="records-panel">
                      {data.customers.length ? (
                        data.customers.map((c: any) => (
                          <article className="record-row" key={c.id}>
                            <div>
                              <h3>{c.name}</h3>
                              <p>{c.contact}</p>
                            </div>
                            <span className="badge">{c.channel}</span>
                            <small>{c.id.slice(0, 8)}</small>
                          </article>
                        ))
                      ) : (
                        <Empty text="Хүсэлт, захиалга үүсэхэд харилцагч бүртгэгдэнэ." />
                      )}
                      <p className="muted panel-foot">
                        Ижил нэртэй харилцагчийг автоматаар нэгтгэдэггүй.
                      </p>
                    </section>
                  )}
                </>
              )}
              {view === "messages" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">HUMAN FIRST</div>
                      <h1>
                        {t(
                          "Харилцаа эндээс эхэлнэ.",
                          "A conversation starts here.",
                        )}
                      </h1>
                      <p>
                        {t(
                          "Синтетик тест мессежүүд. Бодит Facebook холболт биш.",
                          "Synthetic test messages. No live Facebook connection.",
                        )}
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() =>
                        void mutate(
                          "/messages/fixture",
                          "POST",
                          {},
                          "Тест эвент боловсруулагдлаа. Давхардал автоматаар шүүгдэнэ.",
                        )
                      }
                    >
                      ＋ Тест мессеж
                    </button>
                  </div>
                  <div className="integration-notice">
                    <span>f</span>
                    <div>
                      <strong>Meta · {integrations?.meta.state}</strong>
                      <p>
                        Холболт хийхийн тулд Тохиргоо хэсгээс тест Page-г
                        холбоно уу. Бодит OAuth идэвхжээгүй.
                      </p>
                    </div>
                    <button className="subtle" onClick={() => nav("settings")}>
                      Тохиргоо ↗
                    </button>
                  </div>
                  <section className="message-list">
                    {messages.length ? (
                      messages.map((m) => (
                        <article
                          className={"message-card " + m.direction}
                          key={m.id}
                        >
                          <div className="message-avatar">
                            {m.direction === "inbound" ? "З" : "Ү"}
                          </div>
                          <div className="message-body">
                            <small>
                              TEST · {m.sender} · {date(m.created_at)} ·{" "}
                              {m.state}
                            </small>
                            <p>{m.body}</p>
                            {m.direction === "inbound" && (
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (replyRequests.current[m.id]?.pending)
                                    return;
                                  const content = reply[m.id] ?? "";
                                  const previous = replyRequests.current[m.id];
                                  const key =
                                    previous?.body === content
                                      ? previous.key
                                      : crypto.randomUUID();
                                  replyRequests.current[m.id] = {
                                    body: content,
                                    key,
                                    pending: true,
                                  };
                                  const result = await mutate(
                                    "/messages/" + m.id + "/reply",
                                    "POST",
                                    { body: content, idempotencyKey: key },
                                    "Тест хариу хадгалагдлаа. Facebook рүү илгээгээгүй.",
                                  );
                                  replyRequests.current[m.id].pending = false;
                                  if (result)
                                    setReply((v) => ({ ...v, [m.id]: "" }));
                                }}
                              >
                                <input
                                  aria-label="Хариу"
                                  placeholder="Хүний хариу бичих…"
                                  value={reply[m.id] ?? ""}
                                  required
                                  onChange={(e) =>
                                    setReply((v) => ({
                                      ...v,
                                      [m.id]: e.target.value,
                                    }))
                                  }
                                />
                                <button className="primary">
                                  Тест хариу ↗
                                </button>
                              </form>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <Empty text="Тест Page холбож, синтетик мессеж нэмнэ үү." />
                    )}
                  </section>
                </>
              )}
              {view === "promotions" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        ONE RECORD, MORE POSSIBILITIES
                      </div>
                      <h1>
                        {t("Сайн саналаа түгээ.", "Give your offer a place.")}
                      </h1>
                      <p>
                        {t(
                          "Каталогоос саналын хуудас ба постын ноорог үүсгэ. Автоматаар нийтлэхгүй.",
                          "Create an offer page and social draft from your catalog. Nothing publishes automatically.",
                        )}
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => {
                        nav("business");
                        setBusinessTab("catalog");
                      }}
                    >
                      Каталогоос эхлэх ↗
                    </button>
                  </div>
                  <div className="promotion-list">
                    {promotions.length ? (
                      promotions.map((p) => (
                        <article className="promotion-card" key={p.id}>
                          <div className="promotion-heading">
                            <span className="icon-tile">↗</span>
                            <div>
                              <h3>{p.record_name}</h3>
                              <small>
                                TEST · {p.state}{" "}
                                {p.external_id ? "· " + p.external_id : ""}
                              </small>
                            </div>
                          </div>
                          <label>
                            Постын ноорог
                            <textarea
                              rows={5}
                              disabled={p.state === "published_test"}
                              value={captions[p.id] ?? p.caption}
                              onChange={(e) =>
                                setCaptions((v) => ({
                                  ...v,
                                  [p.id]: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <div className="channel-states">
                            <span>
                              Вебсайт:{" "}
                              {data.sites.find(
                                (s: any) => s.id === p.offer_site_id,
                              )?.published_id
                                ? "Нийтэлсэн"
                                : "Ноорог"}
                            </span>
                            <span>Social: {p.state}</span>
                          </div>
                          {p.error && (
                            <div className="form-error">{p.error}</div>
                          )}
                          <div className="card-button-row">
                            <button
                              className="subtle"
                              onClick={() => openEditor(p.offer_site_id)}
                            >
                              Хуудас засах ↗
                            </button>
                            <button
                              className="subtle"
                              disabled={p.state === "published_test"}
                              onClick={() =>
                                void mutate(
                                  "/promotions/" + p.id,
                                  "PATCH",
                                  { caption: captions[p.id] ?? p.caption },
                                  "Ноорог хадгалагдлаа",
                                )
                              }
                            >
                              Хадгалах
                            </button>
                            <button
                              className="primary"
                              disabled={p.state === "published_test"}
                              onClick={async () => {
                                if (
                                  captions[p.id] !== undefined &&
                                  !(await mutate(
                                    "/promotions/" + p.id,
                                    "PATCH",
                                    { caption: captions[p.id] },
                                  ))
                                )
                                  return;
                                await mutate(
                                  "/promotions/" + p.id + "/publish-test",
                                  "POST",
                                  {},
                                  "Тест пост хадгалагдлаа. Бодит Page рүү нийтлээгүй.",
                                );
                              }}
                            >
                              Тест нийтлэл
                            </button>
                          </div>
                          <button
                            className="text-link"
                            disabled={p.state === "published_test"}
                            onClick={() =>
                              void mutate(
                                "/promotions/" + p.id + "/publish-test",
                                "POST",
                                { simulateFailure: true },
                                "Тест timeout үүсгэлээ. Дахин нийтлэхэд аюулгүй.",
                              )
                            }
                          >
                            Алдаа ба дахин оролдохыг турших
                          </button>
                        </article>
                      ))
                    ) : (
                      <Empty text="Каталогийн бүтээгдэхүүн эсвэл үйлчилгээнээс эхний саналаа үүсгээрэй." />
                    )}
                  </div>
                  <section className="blocked-card">
                    <span>▥</span>
                    <div>
                      <h3>Meta advertising · Идэвхжээгүй</h3>
                      <p>
                        Ad account тусдаа зөвшөөрөл шаарддаг. Бодит тайлан,
                        кампанит ажил, төсөв зарцуулах үйлдэл байхгүй. Account,
                        objective, creative, budget, currency, schedule, end
                        conditions-ийг хянах урсгал нь live API баталгаажсаны
                        дараах ажил.
                      </p>
                    </div>
                    <button className="subtle" onClick={() => nav("settings")}>
                      Шаардлагууд ↗
                    </button>
                  </section>
                </>
              )}
              {view === "reports" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">RECORDED, NOT ASSUMED</div>
                      <h1>
                        {t("Бизнесээ бодитоор хар.", "See what is recorded.")}
                      </h1>
                      <p>
                        Зөвхөн энэ ажлын орчны хадгалсан туршилтын үр дүн. Meta
                        attribution ороогүй.
                      </p>
                    </div>
                  </div>
                  <div className="metric-grid">
                    {[
                      [
                        money(
                          paid.reduce((s: number, o: any) => s + o.total, 0),
                        ),
                        "Тест төлбөрийн нийлбэр",
                      ],
                      [data.inquiries.length, "Нийт хүсэлт"],
                      [data.bookings.length, "Нийт тест цаг"],
                    ].map(([v, l]) => (
                      <div className="metric-card" key={l}>
                        <span>
                          <small>{l}</small>
                          <strong>{v}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="below-grid">
                    <section className="activity-card">
                      <h2>Бүртгэгдсэн үйлдлүүд</h2>
                      {[
                        ["Хүсэлт", data.inquiries.length],
                        ["Захиалга", data.orders.length],
                        ["Тест төлбөр", paid.length],
                        ["Цаг захиалга", data.bookings.length],
                      ].map(([name, count]) => (
                        <div className="report-bar" key={name}>
                          <span>{name}</span>
                          <div>
                            <i
                              style={{
                                width: `${Math.max(2, (Number(count) / Math.max(1, data.inquiries.length, data.orders.length, data.bookings.length)) * 100)}%`,
                              }}
                            />
                          </div>
                          <strong>{count}</strong>
                        </div>
                      ))}
                      <p className="muted">
                        Бүх хугацаа · хадгалсан бүртгэл. Conversion rate
                        тооцоход хангалттай үзэлтийн өгөгдөл алга.
                      </p>
                    </section>
                    <section className="activity-card">
                      <h2>Хэрэглээ ба зөвлөмж</h2>
                      <p className="muted">
                        AI provider холбогдоогүй. Энгийн хуудас үзэхэд LLM
                        дуудахгүй. Төлбөртэй subscription үнэ тогтоогоогүй.
                      </p>
                      {data.usage.map((u: any) => (
                        <div className="record-row" key={u.capability}>
                          <span>{u.capability}</span>
                          <strong>{u.units}</strong>
                        </div>
                      ))}
                      <h3 className="spaced">Туршилтын санал</h3>
                      <p>
                        Үлдэгдэлтэй бүтээгдэхүүнээс саналын ноорог эхлүүлж
                        болно. Борлуулалтын өсөлтийн баталгаа биш; margin болон
                        улирлын өгөгдөл байхгүй.
                      </p>
                      <button
                        className="subtle"
                        onClick={() => {
                          nav("business");
                          setBusinessTab("catalog");
                        }}
                      >
                        Каталог үзэх ↗
                      </button>
                    </section>
                  </div>
                </>
              )}
              {view === "settings" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">YOUR BUSINESS, YOUR CONTROL</div>
                      <h1>
                        {t(
                          "Өөрийн орон зайг удирд.",
                          "Your workspace, in your hands.",
                        )}
                      </h1>
                      <p>
                        {t(
                          "Баг, холболт, домэйн ба ажиллагааны бодит төлөв.",
                          "Team, integrations, domains and their actual setup state.",
                        )}
                      </p>
                    </div>
                    <button
                      className="subtle"
                      onClick={async () => {
                        if (isPages) {
                          window.location.assign(appHref());
                          return;
                        }
                        await api("/auth/logout", "POST", {});
                        setMe(null);
                        setWs(null);
                        setData(null);
                      }}
                    >
                      Гарах ↗
                    </button>
                  </div>
                  <div className="settings-grid">
                    <section className="settings-card">
                      <div className="settings-card-title">
                        <span className="meta-icon">f</span>
                        <div>
                          <h2>Facebook & Instagram</h2>
                          <span className="badge">
                            {integrations?.meta.state}
                          </span>
                        </div>
                      </div>
                      <p>
                        Зөвхөн синтетик тест Page. Бодит OAuth, approved
                        permission, Page token, webhook болон API version
                        баталгаажуулах шаардлагатай.
                      </p>
                      <button
                        className="primary"
                        disabled={ws?.role !== "owner"}
                        onClick={() =>
                          void mutate(
                            "/integrations/meta-test",
                            "POST",
                            {
                              connect:
                                integrations?.meta.state !== "connected_test",
                            },
                            "Тест Page төлөв шинэчлэгдлээ.",
                          )
                        }
                      >
                        {integrations?.meta.state === "connected_test"
                          ? "Тест Page салгах"
                          : "Синтетик Page холбох"}
                      </button>
                      <small>
                        Instagram, ads болон live Page нийтлэл идэвхжээгүй.
                      </small>
                    </section>
                    <section className="settings-card">
                      <div className="settings-card-title">
                        <span className="icon-tile">₮</span>
                        <div>
                          <h2>QPay & төлбөр</h2>
                          <span className="badge">Test adapter only</span>
                        </div>
                      </div>
                      <p>
                        Тест нэхэмжлэл → серверийн тест шалгалт → захиалгын
                        төлөв. Бодит мөнгө шилжихгүй. Merchant гэрээ,
                        credential, одоогийн API documentation шаардлагатай.
                      </p>
                      <div className="muted">
                        SocialPay · MonPay · eBarimt · хүргэлт: холбогдоогүй.
                        Баримт, татварын шаардлагыг paid pilot-оос өмнө
                        тогтооно.
                      </div>
                    </section>
                    <section className="settings-card">
                      <h2>Баг ба эрх</h2>
                      {team.map((m) => (
                        <div className="team-row" key={m.email}>
                          <div>
                            <strong>{m.name}</strong>
                            <small>{m.email}</small>
                          </div>
                          <span className="badge">{m.role}</span>
                        </div>
                      ))}
                      {ws?.role === "owner" && (
                        <form
                          className="stack-form"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = e.currentTarget;
                            const result = await mutate(
                              "/team",
                              "POST",
                              Object.fromEntries(new FormData(f)),
                              "Багийн эрх хадгалагдлаа. Имэйл илгээгээгүй.",
                            );
                            if (result) f.reset();
                          }}
                        >
                          <label>
                            Бүртгэлтэй хүний имэйл
                            <input name="email" type="email" required />
                          </label>
                          <select name="role" aria-label="Эрх">
                            <option value="staff">
                              Staff · бүртгэл удирдах
                            </option>
                            <option value="manager">
                              Manager · сайт, каталог нийтлэх
                            </option>
                          </select>
                          <button className="subtle">Багт нэмэх</button>
                        </form>
                      )}
                    </section>
                    <section className="settings-card">
                      <h2>Домэйн</h2>
                      <p>
                        Локал resolver: /s/site-id эсвэл site-slug.localhost.
                        Бодит DNS ба TLS provisioning идэвхжээгүй.
                      </p>
                      <form
                        className="stack-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const b = Object.fromEntries(
                            new FormData(e.currentTarget),
                          );
                          const result = await mutate(
                            "/sites/" + b.site + "/domain",
                            "POST",
                            { domain: b.domain },
                          );
                          if (result)
                            setNotice(
                              `${result.state} · TXT ${result.txtName}: ${result.txtValue}. Домэйн идэвхжээгүй.`,
                            );
                        }}
                      >
                        <select name="site" aria-label="Домэйны сайт">
                          {data.sites.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name="domain"
                          placeholder="business.mn"
                          required
                          aria-label="Домэйн"
                        />
                        <button className="subtle">
                          Холболтын хүсэлт хадгалах
                        </button>
                      </form>
                      {integrations?.domains
                        .filter((s: any) => s.domain)
                        .map((s: any) => (
                          <p key={s.id}>
                            {s.domain} · <strong>{s.domain_state}</strong>
                          </p>
                        ))}
                    </section>
                    <section className="settings-card">
                      <h2>Өөр ажлын орчин</h2>
                      <p>
                        Ажлын орчин бүр тусдаа каталог, сайт, гүйлгээтэй.
                        Browser-оос ирсэн workspace ID дангаараа эрх олгохгүй.
                      </p>
                      <form
                        className="stack-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const name = new FormData(e.currentTarget).get(
                            "name",
                          );
                          try {
                            await api("/workspaces", "POST", { name });
                            await authenticate();
                            setNotice("Шинэ туршилтын ажлын орчин үүслээ.");
                          } catch (e) {
                            setNotice((e as Error).message);
                          }
                        }}
                      >
                        <input
                          name="name"
                          required
                          placeholder="Шинэ бизнесийн нэр"
                          aria-label="Шинэ ажлын орчин"
                        />
                        <button className="subtle">Ажлын орчин үүсгэх</button>
                      </form>
                    </section>
                    <section className="settings-card">
                      <h2>AI & ажиллагаа</h2>
                      <p>
                        AI optional · provider холбогдоогүй · live budget: 0.
                        Редакторын текстийн өөрчлөлтийг тест diff-ээр зөвшөөрч
                        эсвэл татгалзаж болно.
                      </p>
                      <p>
                        {isPages ? (
                          "IndexedDB · Device-local demo profile · no secure accounts or shared backend. Clearing browser site data removes this demo workspace."
                        ) : (
                          <>
                            SQLite WAL · audit log · session auth · rate limits.
                            Backup: <code>npm run backup</code>
                          </>
                        )}
                      </p>
                      <small>
                        Node single-host пилот. Production deployment ба
                        provider activation-ийг docs/INTEGRATIONS.md,
                        docs/PILOT.md-оос харна уу.
                      </small>
                    </section>
                  </div>
                </>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            үрү /{" "}
            {t(
              "Таны бизнесийн дараагийн хуудас.",
              "The next chapter of your business.",
            )}
          </span>
          <span>LOCAL PILOT · v0.1</span>
        </footer>
      </div>
      {creating && (
        <div className="modal-backdrop centered">
          <section className="dialog">
            <button
              className="close-button"
              aria-label="Хаах"
              onClick={() => setCreating(false)}
            >
              ×
            </button>
            <small className="eyebrow">START WITH AN IDEA</small>
            <h2>{t("Юуг бүтээх вэ?", "What will you create?")}</h2>
            <p>
              Хоосон canvas-аас эхэл. Эсвэл одоо байгаа 3 жишээ сайтаа чөлөөтэй
              зас.
            </p>
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await mutate(
                  "/sites",
                  "POST",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                if (result) {
                  setCreating(false);
                  openEditor(result.id);
                }
              }}
            >
              <label>
                Бизнес / сайтын нэр
                <input name="name" required />
              </label>
              <label>
                Бизнесийн төрөл
                <select name="businessType">
                  <option value="products">Бүтээгдэхүүн борлуулах</option>
                  <option value="services">Үйлчилгээ / хүсэлт авах</option>
                  <option value="bookings">Цаг захиалга</option>
                  <option value="portfolio">Портфолио</option>
                </select>
              </label>
              <label>
                Гол зорилго
                <select name="goal">
                  <option>Борлуулалт</option>
                  <option>Хүсэлт цуглуулах</option>
                  <option>Цаг захиалах</option>
                  <option>Ажлаа танилцуулах</option>
                </select>
              </label>
              <button className="primary">Хоосон canvas үүсгэх ↗</button>
            </form>
          </section>
        </div>
      )}
      {(editRecord || newRecord) && (
        <div className="modal-backdrop centered">
          <section className="dialog">
            <button
              className="close-button"
              aria-label="Хаах"
              onClick={() => {
                setEditRecord(null);
                setNewRecord(false);
              }}
            >
              ×
            </button>
            <h2>{newRecord ? "Каталогт нэмэх" : "Мэдээлэл засах"}</h2>
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                const body = newRecord
                  ? {
                      ...values,
                      price: Number(values.price),
                      stock: Number(values.stock),
                      duration: 60,
                      image:
                        values.kind === "product"
                          ? "/art/knit.svg"
                          : "/art/interior.svg",
                    }
                  : { ...values, price: Number(values.price) };
                const result = await mutate(
                  newRecord ? "/catalog" : "/catalog/" + editRecord.id,
                  newRecord ? "POST" : "PATCH",
                  body,
                  "Каталог хадгалагдлаа",
                );
                if (result) {
                  setEditRecord(null);
                  setNewRecord(false);
                }
              }}
            >
              {newRecord && (
                <>
                  <label>
                    Сайт
                    <select name="siteId">
                      {data.sites.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Төрөл
                    <select name="kind">
                      <option value="product">Бүтээгдэхүүн</option>
                      <option value="service">Үйлчилгээ</option>
                      <option value="project">Төсөл</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                Нэр
                <input name="name" required defaultValue={editRecord?.name} />
              </label>
              <label>
                Тайлбар
                <textarea
                  name="description"
                  required
                  defaultValue={editRecord?.description}
                />
              </label>
              <label>
                Үнэ (MNT)
                <input
                  name="price"
                  type="number"
                  min={0}
                  step={1}
                  max={1000000000}
                  required
                  defaultValue={editRecord?.price ?? 0}
                />
              </label>
              <label>
                Ангилал
                <input
                  name="category"
                  required
                  defaultValue={editRecord?.category}
                />
              </label>
              {newRecord && (
                <label>
                  Эхний үлдэгдэл
                  <input
                    name="stock"
                    type="number"
                    min={0}
                    required
                    defaultValue={10}
                  />
                </label>
              )}
              <button className="primary">Хадгалах</button>
            </form>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Хаах" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span>↗</span>
      <h3>Шинэ боломжийн эхлэл.</h3>
      <p>{text}</p>
    </div>
  );
}
