import "./tailwind.css";
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { PageRenderer } from "./shared/renderer";
import "./site.css";
const site = JSON.parse(document.getElementById("site-data")!.textContent!);
hydrateRoot(
  document.getElementById("site-root")!,
  <PageRenderer site={site} />,
);
