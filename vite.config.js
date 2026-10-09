import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const apiProxy = { "/api": "http://localhost:8000" };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "अन्नदृष्टि AI",
        short_name: "अन्नदृष्टि",
        description: "पहाड़ की फ़सल के लिए ऑफ़लाइन-तैयार सलाह",
        lang: "hi",
        start_url: "/",
        display: "standalone",
        background_color: "#f5f5e9",
        theme_color: "#174936",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => url.origin === self.location.origin
              && (request.mode === "navigate" || ["script", "style"].includes(request.destination)),
            handler: "NetworkFirst",
            options: {
              cacheName: "app-shell",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/v1\/forecast/,
            handler: "NetworkFirst",
            options: {
              cacheName: "open-meteo-forecast",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/history/")
              && url.pathname.endsWith("/photo"),
            handler: "NetworkFirst",
            options: {
              cacheName: "crop-history-photos",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
