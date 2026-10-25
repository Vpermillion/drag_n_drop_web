import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => ({
  base:
    mode === "pages"
      ? (process.env.PAGES_BASE_PATH ?? "/drag_n_drop_web/")
      : "/",
  plugins: [react(), tailwindcss()],
  build: {
    manifest: true,
    rollupOptions: {
      input: mode === "pages" ? ["index.html"] : ["index.html", "site.html"],
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/css-tree/") ||
            id.includes("/node_modules/mdn-data/") ||
            id.includes("/node_modules/source-map-js/")
          )
            return "css-engine";
        },
      },
    },
  },
}));
