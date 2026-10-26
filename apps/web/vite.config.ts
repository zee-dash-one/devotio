import { defineConfig, loadEnv, type Plugin } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const local: Plugin = {
    name: "devotio-local-backend",
    apply: "serve",
    async configureServer(server) {
      if (command !== "serve" || mode !== "development" || env.VITE_CONVEX_URL || env.VITE_CONVEX_SITE_URL || process.env.VITE_CONVEX_URL || process.env.VITE_CONVEX_SITE_URL) return;
      const { LocalDatabase } = await import("../../packages/backend/local/database.local");
      const { createLocalHandler } = await import("../../packages/backend/local/http.local");
      const root = resolve(import.meta.dirname, "../..");
      const database = new LocalDatabase(resolve(root, ".data/devotio.sqlite"), resolve(root, ".data/bible"));
      const { LocalImages } = await import("../../packages/backend/local/images.local");
      const images = new LocalImages(database);
      images.start();
      server.middlewares.use("/__local", createLocalHandler(database, images));
      server.httpServer?.once("close", () => { images.close(); database.close(); });
    },
  };
  return {
  plugins: [
    react(),
    local,
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.svg",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Devotio — Palavra, presença e oração",
        short_name: "Devotio",
        description: "Um espaço calmo para a Palavra e a comunidade.",
        lang: "pt-BR",
        theme_color: "#FBF9F5",
        background_color: "#FBF9F5",
        display: "standalone",
        start_url: "/devocional",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 3000, strictPort: true, host: "127.0.0.1", fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.data/**"] } },
  build: { target: "es2022", sourcemap: false },
  };
});
