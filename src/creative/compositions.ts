import type { PageNode } from "../shared/schema";
const uid = () => crypto.randomUUID();
const node = (
  type: PageNode["type"],
  name: string,
  props: PageNode["props"] = {},
  style: PageNode["style"] = {},
  children: PageNode[] = [],
): PageNode => ({ id: uid(), type, name, props, style, children });
const text = (value: string, size: number, tag: "h1" | "h2" | "p" = "p") =>
  node("text", value.slice(0, 22), { text: value, tag }, { fontSize: size });
export const compositionOptions = [
  {
    id: "aurora",
    name: "Aurora story",
    mn: "Өнгөлөг эхлэл",
    description: "Soft gradients, big type, a little wonder.",
    tone: "aurora",
    symbol: "✦",
  },
  {
    id: "bento",
    name: "Bento moments",
    mn: "Картуудын эвлүүлэг",
    description: "Small pieces. An unexpectedly good together.",
    tone: "mint",
    symbol: "▦",
  },
  {
    id: "editorial",
    name: "Quiet editorial",
    mn: "Нам гүм түүх",
    description: "Room to breathe. A bold point of view.",
    tone: "paper",
    symbol: "Aa",
  },
  {
    id: "reveal",
    name: "A little surprise",
    mn: "Нээж үзэх мөч",
    description: "A playful reveal, made from native blocks.",
    tone: "sunset",
    symbol: "↗",
  },
];
export function createComposition(kind: string): PageNode {
  const key = uid();
  const reveal = node(
    "conditional",
    "Нээх мэдээлэл",
    { condition: { field: key, equals: "open" } },
    { padding: 20, background: "#ffffff", radius: 18 },
    [
      text("Том санаа жижиг алхмаас эхэлдэг.", 22),
      node(
        "button",
        "Хаах",
        { text: "Ойлголоо ✓", actions: [{ type: "closePanel", target: key }] },
        { padding: 12, radius: 12 },
      ),
    ],
  );
  const button = node(
    "button",
    "Урилга",
    { text: "Хамтдаа эхэлье ↗", actions: [{ type: "openPanel", target: key }] },
    { padding: 16, background: "#293e35", color: "#ffffff", radius: 14 },
  );
  let root: PageNode;
  if (kind === "bento") {
    root = node(
      "container",
      "Bento moments",
      {},
      { display: "grid", columns: 2, gap: 18, padding: 28 },
      [
        node(
          "container",
          "Санааны карт",
          {},
          {
            padding: 28,
            background: "#eef1ff",
            radius: 24,
            display: "flex",
            direction: "column",
            gap: 18,
          },
          [
            text("01 / ТАНЫ САНАА", 12),
            text("Жижиг хэсгүүд.\nТом боломж.", 34, "h2"),
            text("Нэг хэсгийг өөр контекстэд дахин ашигла.", 16),
          ],
        ),
        node(
          "container",
          "Холбоосын карт",
          {},
          {
            padding: 28,
            background: "#e9f3e8",
            radius: 24,
            display: "flex",
            direction: "column",
            gap: 18,
          },
          [text("↗", 46), text("Дараагийн алхам", 26, "h2"), button, reveal],
        ),
      ],
    );
  } else if (kind === "editorial") {
    root = node(
      "container",
      "Quiet editorial",
      {},
      {
        display: "grid",
        columns: 2,
        gap: 28,
        padding: 32,
        background: "#fbf6ed",
        radius: 26,
      },
      [
        node(
          "container",
          "Өөрийн түүх",
          {},
          { display: "flex", direction: "column", justify: "center", gap: 20 },
          [
            text("ӨӨРИЙН ХЭМНЭЛЭЭР", 12),
            node(
              "text",
              "Түүхийн гарчиг",
              {
                text: "Илүү энгийн.\nИлүү өөрийн.",
                tag: "h2",
                customCSS:
                  "font-family: Georgia, serif; letter-spacing: -0.05em;",
              },
              { fontSize: 46 },
            ),
            text("Танд зориулсан орон зай. Өөрийн үгээр түүхээ бич.", 17),
            button,
            reveal,
          ],
        ),
        node(
          "image",
          "Редакцийн зураг",
          {
            src: "/art/editorial.svg",
            alt: "Байгалийн өнгө бүхий бүтээлийн дүрслэл",
          },
          { width: "100%", height: "360px", objectFit: "cover", radius: 100 },
        ),
      ],
    );
  } else if (kind === "reveal") {
    root = node(
      "container",
      "A little surprise",
      { appearance: { gradient: "sunset", shadow: "soft" } },
      {
        padding: 36,
        radius: 28,
        display: "flex",
        direction: "column",
        gap: 20,
        align: "start",
      },
      [
        text("ЖИЖИГ ГАЙХАМШИГ", 12),
        text("Сониуч зангаас\nсайхан зүйл эхэлдэг.", 38, "h2"),
        text("Товч, нөхцөлт хэсэг, багахан санаа. Өөрийнхөөрөө эвлүүл.", 17),
        button,
        reveal,
      ],
    );
    button.props.text = "Нээж үзэх ↗";
  } else {
    root = node(
      "container",
      "Aurora story",
      { appearance: { gradient: "aurora", shadow: "soft" } },
      {
        padding: 40,
        radius: 28,
        display: "flex",
        direction: "column",
        gap: 22,
      },
      [
        text("✦ ТАНЫ ДАРААГИЙН БҮТЭЭЛ", 12),
        text("Таны санаа.\nӨөрийн өнгө.", 48, "h2"),
        text(
          "Элемент бүрийг сонго. Өнгө төрхийг өөрчил. Бизнесийнхээ түүхийг бүтээ.",
          18,
        ),
        button,
        reveal,
      ],
    );
  }
  // A local-state key follows this root when a saved composition is duplicated.
  root.id = key;
  root.mobile = { padding: 22 };
  return root;
}
export const codePresets = {
  spark: {
    name: "Spark counter",
    html: '<section class="spark"><span class="badge">✦ CREATIVE PLAYGROUND</span><h2>A little more<br><em>you.</em></h2><p>One small interaction. A different kind of hello.</p><button id="spark-button">Send a spark <span aria-hidden="true">↗</span></button><output id="spark-count" aria-live="polite">0 sparks collected</output></section>',
    css: ".spark{padding:34px;background:linear-gradient(135deg,#eef0ff,#ffe9e0);border-radius:24px;min-height:330px;color:#2c3150}.badge{font-size:10px;letter-spacing:.12em}h2{font-size:48px;line-height:1.05;margin:22px 0;letter-spacing:-.06em}em{font-family:Georgia,serif;color:#6844a2}p{font-size:13px;line-height:1.7}button{display:flex;gap:28px;justify-content:space-between;align-items:center;background:#302c45;color:white;border:0;border-radius:12px;padding:15px 20px;margin:22px 0 16px;min-height:46px}button:hover{background:#5c4380}output{font-size:12px;color:#594d6b}",
    js: 'let count = 0;\ndocument.getElementById("spark-button").addEventListener("click", () => {\n  count += 1;\n  document.getElementById("spark-count").textContent = `${count} ${count === 1 ? "spark" : "sparks"} collected`;\n});',
  },
  mood: {
    name: "Mood switcher",
    html: '<section id="mood-card"><span class="badge">PICK YOUR ENERGY</span><h2>Make room<br>for a new mood.</h2><p id="mood-label" aria-live="polite">Quiet morning</p><div class="choices"><button data-mood="mint">Mint</button><button data-mood="peach">Peach</button><button data-mood="lavender">Lavender</button></div></section>',
    css: "#mood-card{padding:34px;border-radius:24px;min-height:330px;background:#e4f2e6;transition:background .25s;color:#253b35}.badge{font-size:10px;letter-spacing:.12em}h2{font-size:40px;letter-spacing:-.05em;line-height:1.1;margin:30px 0}.choices{display:flex;gap:10px;flex-wrap:wrap;margin-top:25px}button{border:1px solid #253b3550;background:#ffffff80;padding:12px 16px;border-radius:24px;min-height:44px}button:hover{background:#fff}",
    js: 'const moods = { mint: ["#e4f2e6", "Quiet morning"], peach: ["#ffe4d6", "A warm hello"], lavender: ["#ece5ff", "Something unexpected"] };\ndocument.querySelectorAll("[data-mood]").forEach(button => {\n  button.addEventListener("click", () => {\n    const [color, label] = moods[button.dataset.mood];\n    document.getElementById("mood-card").style.background = color;\n    document.getElementById("mood-label").textContent = label;\n  });\n});',
  },
  faq: {
    name: "Gentle accordion",
    html: '<section><span class="badge">A FEW GOOD QUESTIONS</span><h2>A little clarity.</h2><details><summary>Can I make it my own?</summary><p>Every word, color and composition is yours to change.</p></details><details><summary>Do I need to write code?</summary><p>No. Start with the visual tools; use this block when you want a little extra.</p></details><details><summary>Does this access business data?</summary><p>No. This creative widget runs in its own isolated frame.</p></details></section>',
    css: "section{padding:32px;background:#f7f1e8;border-radius:24px;min-height:330px;color:#403b30}.badge{font-size:10px;letter-spacing:.13em}h2{font-family:Georgia,serif;font-size:42px;font-weight:400;letter-spacing:-.05em;margin:25px 0}details{border-top:1px solid #d8cebf;padding:16px 0}summary{cursor:pointer;font-size:15px;min-height:30px}p{font-size:13px;line-height:1.7;color:#61594b}",
    js: "",
  },
};
export function createCodeNode(
  preset: keyof typeof codePresets = "spark",
): PageNode {
  return node(
    "embed",
    "Creative widget",
    {
      code: {
        html: codePresets[preset].html,
        css: codePresets[preset].css,
        js: codePresets[preset].js,
      },
      alt: "Isolated creative widget",
    },
    { width: "100%", height: "500px" },
  );
}
