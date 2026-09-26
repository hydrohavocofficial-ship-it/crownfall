import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Keeps the source entry usable after `index.html` is promoted to a double-clickable bundle. */
function developmentEntry(): Plugin {
  return {
    name: "shonen-development-entry",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/" && request.url !== "/index.html") return next();
        const html = fs.readFileSync(path.resolve(__dirname, "index.dev.html"), "utf8");
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(html);
      });
    },
  };
}

export default defineConfig({
  plugins: [developmentEntry(), react(), tailwindcss(), viteSingleFile()],
  publicDir: false,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 20_000_000,
    rollupOptions: {
      input: { index: path.resolve(__dirname, "index.dev.html") },
    },
  },
});
