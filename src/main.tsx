import "./tailwind.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { isPages } from "./paths";
import PagesDemo from "./pages/PagesDemo";
import "./site.css";
import "./styles.css";
import "./editor/studio.css";
createRoot(document.getElementById("root")!).render(
  isPages ? <PagesDemo /> : <App />,
);
