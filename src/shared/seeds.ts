import type { PageNode, PageDocument, RecordData, Styles } from "./schema";
let seq = 0;
const n = (
  type: PageNode["type"],
  name: string,
  props: PageNode["props"] = {},
  style: Styles = {},
  children: PageNode[] = [],
): PageNode => ({ id: `seed-${++seq}`, type, name, props, style, children });
const text = (value: string, size = 18, style: Styles = {}) =>
  n(
    "text",
    value.slice(0, 24),
    { text: value, tag: size > 46 ? "h1" : size > 25 ? "h2" : "p" },
    { fontSize: size, ...style },
  );
const bound = (field: "name" | "description" | "price", size: number) =>
  n(
    "text",
    `Record ${field}`,
    {
      binding: { source: "record", field },
      tag: field === "name" ? "h3" : "p",
    },
    { fontSize: size },
  );
const button = (label: string, actions: PageNode["props"]["actions"]) =>
  n("button", label, { text: label, actions }, { padding: 14, radius: 8 });
const input = (
  name: string,
  label: string,
  type: NonNullable<PageNode["props"]["inputType"]> = "text",
  options?: string[],
) =>
  n(
    "input",
    label,
    {
      name,
      label,
      inputType: type,
      required: true,
      ...(options ? { options } : {}),
    },
    { width: "100%" },
  );
export type Seed = {
  slug: string;
  name: string;
  theme: string;
  business: { name: string; phone: string; address: string };
  document: PageDocument;
  records: RecordData[];
};
export function makeSeeds(): Seed[] {
  seq = 0;
  const shopRecords: RecordData[] = [
    {
      id: "cashmere",
      kind: "product",
      name: "Ноолууран цамц",
      description: "Монгол ноолуур. Өдөр бүрийн нам гүм тансаглал.",
      price: 189000,
      image: "/art/knit.svg",
      category: "Ноолуур",
      variants: [
        { id: "cashmere-s", name: "Элсэн · S", stock: 8 },
        { id: "cashmere-m", name: "Элсэн · M", stock: 4 },
      ],
    },
    {
      id: "bag",
      kind: "product",
      name: "Өдөр тутмын цүнх",
      description: "Байгалийн өнгө, бодож хийсэн жижиг деталь.",
      price: 129000,
      image: "/art/bag.svg",
      category: "Аксессуар",
      variants: [{ id: "bag-one", name: "Стандарт", stock: 6 }],
    },
    {
      id: "coat",
      kind: "product",
      name: "Ноосон хүрэм",
      description: "Улаанбаатарын сэрүүн өглөөд зориулсан.",
      price: 349000,
      image: "/art/coat.svg",
      category: "Ноолуур",
      variants: [
        { id: "coat-m", name: "M", stock: 2 },
        { id: "coat-l", name: "L", stock: 3 },
      ],
    },
  ];
  const productCard = n(
    "container",
    "Бүтээгдэхүүний карт",
    {},
    { display: "flex", direction: "column", gap: 14 },
    [
      n(
        "image",
        "Бүтээгдэхүүний зураг",
        { binding: { source: "record", field: "image" }, alt: "Бүтээгдэхүүн" },
        { width: "100%", height: "280px", objectFit: "cover", radius: 12 },
      ),
      bound("name", 22),
      bound("description", 14),
      bound("price", 18),
      button("Дэлгэрэнгүй · Сонгох", [
        { type: "openPanel", target: "product" },
      ]),
      button("Сагсанд нэмэх", [{ type: "addToCart" }]),
    ],
  );
  const shop: Seed = {
    slug: "erdene",
    name: "Эрдэнэ · concept store",
    theme: "shop",
    business: {
      name: "Эрдэнэ",
      phone: "7700 1200",
      address: "Улаанбаатар · Сүхбаатар дүүрэг",
    },
    records: shopRecords,
    document: {
      version: 1,
      title: "Эрдэнэ — өдөр бүрийн үнэ цэн",
      description:
        "Монгол ноолуур, бодож бүтээсэн хувцас болон өдөр тутмын эдлэл.",
      root: n(
        "container",
        "Хуудас",
        {},
        { background: "#f7f3ed", color: "#292b26" },
        [
          n(
            "container",
            "Навигац",
            {},
            {
              display: "flex",
              direction: "row",
              justify: "space-between",
              align: "center",
              padding: 28,
            },
            [
              text("ЭРДЭНЭ", 24, { fontWeight: 800 }),
              text("Монголд бүтээв. Танд зориулав.", 13),
              button("Сагс", [{ type: "openPanel", target: "cart" }]),
            ],
          ),
          n(
            "container",
            "Нүүр хэсэг",
            {},
            { display: "grid", columns: 2, gap: 36, padding: 44 },
            [
              n(
                "container",
                "Танилцуулга",
                {},
                {
                  display: "flex",
                  direction: "column",
                  gap: 24,
                  justify: "center",
                },
                [
                  text("ШИНЭ ЦУГЛУУЛГА / 2026", 12),
                  text("Энгийн зүйлс.\nЭрхэм мэдрэмж.", 68, {
                    fontWeight: 500,
                  }),
                  text(
                    "Хувцаснаас илүү. Өөрийнхөөрөө амьдрах жижиг сонголтууд.",
                    18,
                  ),
                  button("Цуглуулга үзэх", [
                    { type: "navigate", target: "#catalog" },
                  ]),
                ],
              ),
              n(
                "image",
                "Ноолуурын түүх",
                {
                  src: "/art/editorial.svg",
                  alt: "Монгол ноолуурын шинэ цуглуулгын дүрслэл",
                },
                {
                  width: "100%",
                  height: "450px",
                  objectFit: "cover",
                  radius: 120,
                },
              ),
            ],
          ),
          n("container", "Каталог", {}, { padding: 36 }, [
            text("Өөрийнхөө хэмнэлийг ол.", 36),
            n(
              "container",
              "Ангилал",
              {},
              {
                display: "flex",
                direction: "row",
                gap: 12,
                padding: 16,
                wrap: true,
              },
              ["Бүгд", "Ноолуур", "Аксессуар"].map((c) =>
                button(c, [
                  {
                    type: "filter",
                    target: "products",
                    value: c === "Бүгд" ? "" : c,
                  },
                ]),
              ),
            ),
            n(
              "collection",
              "Бүтээгдэхүүнүүд",
              { collection: "products" },
              { display: "grid", columns: 3, gap: 28 },
              [productCard],
            ),
          ]),
          text("ЭРДЭНЭ / Сайн эдлэл удаан хэрэглэгддэг.", 14, { padding: 36 }),
        ],
      ),
    },
  };
  const services: RecordData[] = [
    {
      id: "interior",
      kind: "service",
      name: "Интерьер төлөвлөлт",
      description: "Орон зайг таны амьдралын хэмнэлтэй холбодог.",
      price: 180000,
      image: "/art/interior.svg",
      category: "Дизайн",
      variants: [],
    },
    {
      id: "renovation",
      kind: "service",
      name: "Гүйцэтгэл ба засвар",
      description: "Санаанаас бодит орон зай хүртэл нэг баг.",
      price: 250000,
      image: "/art/build.svg",
      category: "Барилга",
      variants: [],
    },
    {
      id: "project-home",
      kind: "project",
      name: "Нарны гэрэлтэй гэр",
      description: "Хан-Уул · Орон сууц · 86 м²",
      price: 0,
      image: "/art/interior.svg",
      category: "Орон сууц",
      variants: [],
    },
  ];
  const inquiryForm = n(
    "form",
    "Үнийн саналын хүсэлт",
    { actions: [{ type: "inquiry" }] },
    {
      display: "flex",
      direction: "column",
      gap: 18,
      padding: 28,
      background: "#ffffff",
      color: "#253b35",
      radius: 16,
    },
    [
      text("Төслөө хамт ярилцъя.", 30),
      input("name", "Таны нэр"),
      input("contact", "Утас эсвэл имэйл"),
      input("projectType", "Төслийн төрөл", "select", ["Орон сууц", "Оффис"]),
      n(
        "conditional",
        "Оффисын нэмэлт мэдээлэл",
        { condition: { field: "projectType", equals: "Оффис" } },
        {},
        [input("teamSize", "Багийн хүний тоо", "number")],
      ),
      input("message", "Төслийн тухай", "textarea"),
      button("Хүсэлт илгээх", []),
    ],
  );
  const studio: Seed = {
    slug: "orom",
    name: "Ором · design & build",
    theme: "studio",
    business: {
      name: "Ором студи",
      phone: "7711 2200",
      address: "Улаанбаатар · Хан-Уул дүүрэг",
    },
    records: services,
    document: {
      version: 1,
      title: "Ором — амьдрах орон зай",
      description:
        "Интерьер, барилгын үйлчилгээ. Төслөө танилцуулж үнийн санал аваарай.",
      root: n(
        "container",
        "Хуудас",
        {},
        { background: "#e8eee9", color: "#253b35" },
        [
          n(
            "container",
            "Навигац",
            {},
            {
              display: "flex",
              direction: "row",
              justify: "space-between",
              padding: 32,
            },
            [text("ором /", 32), text("ДИЗАЙН + ГҮЙЦЭТГЭЛ", 13)],
          ),
          n(
            "container",
            "Нүүр хэсэг",
            {},
            { padding: 44, display: "flex", direction: "column", gap: 28 },
            [
              text("Орон зайд\nутга нэмье.", 82, { maxWidth: "900px" }),
              text("Таны төсөөлөл. Бидний ур ухаан.", 20),
              n(
                "image",
                "Төсөл",
                {
                  src: "/art/interior.svg",
                  alt: "Дулаан өнгийн интерьерийн дүрслэл",
                },
                {
                  width: "100%",
                  height: "380px",
                  objectFit: "cover",
                  radius: 4,
                },
              ),
            ],
          ),
          n(
            "container",
            "Бидний ажил",
            {},
            { display: "grid", columns: 2, gap: 36, padding: 36 },
            [
              n(
                "container",
                "Үйлчилгээ",
                {},
                { display: "flex", direction: "column", gap: 22 },
                [
                  text("Бодож төлөвлөсөн.\nБодитоор бүтээсэн.", 38),
                  n(
                    "collection",
                    "Үйлчилгээнүүд",
                    { collection: "services" },
                    { display: "flex", direction: "column", gap: 28 },
                    [
                      n(
                        "container",
                        "Үйлчилгээний мэдээлэл",
                        {},
                        {
                          padding: 20,
                          borderWidth: 1,
                          borderColor: "#a4b5a8",
                          radius: 8,
                        },
                        [bound("name", 24), bound("description", 16)],
                      ),
                    ],
                  ),
                  n("collection", "Төслүүд", { collection: "projects" }, {}, [
                    n("container", "Төслийн карт", {}, {}, [
                      bound("name", 22),
                      bound("description", 14),
                    ]),
                  ]),
                ],
              ),
              inquiryForm,
            ],
          ),
        ],
      ),
    },
  };
  const bookingServices: RecordData[] = [
    {
      id: "hair",
      kind: "service",
      name: "Үс засалт & арчилгаа",
      description: "Танд тохирсон хэлбэр. Өөртөө өгөх шинэ мэдрэмж.",
      price: 65000,
      image: "/art/salon.svg",
      category: "Үс",
      duration: 60,
      variants: [],
    },
    {
      id: "skin",
      kind: "service",
      name: "Нүүрний гүн арчилгаа",
      description: "Арьсны онцлогт тохирсон зөөлөн арчилгаа.",
      price: 85000,
      image: "/art/skin.svg",
      category: "Арьс",
      duration: 90,
      variants: [],
    },
  ];
  const salon: Seed = {
    slug: "nami",
    name: "Нами · self-care studio",
    theme: "salon",
    business: {
      name: "Нами",
      phone: "7800 3300",
      address: "Улаанбаатар · Чингэлтэй дүүрэг",
    },
    records: bookingServices,
    document: {
      version: 1,
      title: "Нами — өөртөө зориулах цаг",
      description: "Үс, арьс арчилгааны студи. Туршилтын цаг захиалгын урсгал.",
      root: n(
        "container",
        "Хуудас",
        {},
        { background: "#f8eff1", color: "#653948" },
        [
          n(
            "container",
            "Навигац",
            {},
            {
              display: "flex",
              direction: "row",
              justify: "space-between",
              padding: 28,
            },
            [text("nami.", 36), text("BE A LITTLE KINDER TO YOURSELF", 11)],
          ),
          n(
            "container",
            "Танилцуулга",
            {},
            {
              display: "flex",
              direction: "column",
              align: "center",
              gap: 24,
              padding: 44,
              textAlign: "center",
            },
            [
              text("Таны цаг.\nТаны тайван мөч.", 70),
              text("Өдөр бүрийн завгүй хэмнэл дунд өөртөө зай гарга.", 18),
              n(
                "image",
                "Студийн дүрслэл",
                {
                  src: "/art/salon.svg",
                  alt: "Нами арчилгааны студийн дүрслэл",
                },
                {
                  width: "100%",
                  maxWidth: "700px",
                  height: "300px",
                  objectFit: "cover",
                  radius: 100,
                },
              ),
            ],
          ),
          n("container", "Үйлчилгээ ба цаг", {}, { padding: 36 }, [
            text("Жижиг завсарлага, их өөрчлөлт.", 36, {
              textAlign: "center",
              padding: 24,
            }),
            n(
              "collection",
              "Арчилгааны сонголт",
              { collection: "services" },
              { display: "grid", columns: 2, gap: 28 },
              [
                n(
                  "container",
                  "Захиалгын карт",
                  {},
                  {
                    padding: 28,
                    background: "#ffffff",
                    radius: 22,
                    display: "flex",
                    direction: "column",
                    gap: 16,
                  },
                  [
                    bound("name", 28),
                    bound("description", 16),
                    bound("price", 20),
                    n(
                      "form",
                      "Цаг захиалах",
                      { actions: [{ type: "booking" }] },
                      { display: "flex", direction: "column", gap: 14 },
                      [
                        input("name", "Таны нэр"),
                        input("contact", "Холбоо барих"),
                        input("date", "Өдөр", "date"),
                        input("time", "Цаг", "select", [
                          "10:00",
                          "12:00",
                          "14:00",
                          "16:00",
                        ]),
                        button("Туршилтын цаг захиалах", []),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ]),
          text(
            "Зөвхөн туршилтын цагийн хуваарь · бодит салоны боломжит цаг биш.",
            13,
            { padding: 28, textAlign: "center" },
          ),
        ],
      ),
    },
  };
  return [shop, studio, salon];
}
export function blankDocument(name: string): PageDocument {
  return {
    version: 1,
    title: name,
    description: "",
    root: {
      id: crypto.randomUUID(),
      type: "container",
      name: "Хуудас",
      props: {},
      style: {
        padding: 32,
        background: "#ffffff",
        color: "#253b35",
        minHeight: "600px",
      },
      children: [],
    },
  };
}
