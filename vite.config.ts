import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base:
    mode === "pages"
      ? (process.env.PAGES_BASE_PATH ?? "/drag_n_drop_web/")
      : "/",
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      input: mode === "pages" ? ["index.html"] : ["index.html", "site.html"],
    },
  },
}));
