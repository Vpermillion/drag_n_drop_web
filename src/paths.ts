export const isPages = import.meta.env?.VITE_PAGES_DEMO === "true";
const base = import.meta.env?.BASE_URL || "/";
export const appHref = () => (isPages ? base : "/");
export const editorHref = (id: string) =>
  appHref() + "?editor=" + encodeURIComponent(id);
export const siteHref = (slug: string) =>
  isPages ? base + "?site=" + encodeURIComponent(slug) : "/s/" + slug;
export const previewHref = (id: string) =>
  isPages ? base + "?preview=" + encodeURIComponent(id) : "/preview/" + id;
export function localHref(path: string) {
  if (!isPages) return path;
  if (path.startsWith("/s/")) return siteHref(path.slice(3));
  if (path.startsWith("/preview/")) return previewHref(path.slice(9));
  return base + path.replace(/^\//, "");
}
export function assetUrl(path: string | undefined) {
  if (!path) return undefined;
  if (!isPages) return path;
  if (path.startsWith("/api/media/"))
    return (
      localStorage.getItem("uru-pages-image-" + path.slice(11)) ?? undefined
    );
  return path.startsWith("/") ? base + path.slice(1) : path;
}
