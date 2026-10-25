import React, { useEffect, useState } from "react";
import App from "../App";
import { api } from "../api";
import { PageRenderer } from "../shared/renderer";
import { appHref } from "../paths";
import type { SiteData } from "../shared/schema";
export default function PagesDemo() {
  const params = new URLSearchParams(location.search);
  const slug = params.get("site"),
    preview = params.get("preview");
  const [site, setSite] = useState<SiteData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!slug && !preview) return;
    void (async () => {
      try {
        if (slug) setSite(await api("/public/" + slug));
        else {
          const me = await api("/me");
          let found;
          for (const w of me.workspaces) {
            try {
              found = await api(`/w/${w.id}/sites/${preview}`);
              break;
            } catch {}
          }
          if (!found)
            throw new Error(
              "This preview belongs to another browser. Return to the demo studio.",
            );
          setSite(found);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [slug, preview]);
  return (
    <>
      <div className="pages-demo-banner">
        <strong>GitHub Pages · Browser demo</strong>
        <span>
          Өгөгдөл зөвхөн энэ төхөөрөмжид хадгалагдана. No shared backend or
          secure accounts.
        </span>
        {(slug || preview) && <a href={appHref()}>← Studio</a>}
      </div>
      {slug || preview ? (
        error ? (
          <main className="loading">
            <p>
              {error} <a href={appHref()}>Open studio →</a>
            </p>
          </main>
        ) : site ? (
          <PageRenderer site={site} />
        ) : (
          <div className="loading">Loading device-local example…</div>
        )
      ) : (
        <App />
      )}
    </>
  );
}
