import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget = process.env.VITE_API_BASE_URL ?? process.env.VITE_PROXY_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [".ngrok-free.app"],
    proxy: {
      "/auth": proxyTarget,
      "/users": proxyTarget,
      "/events": proxyTarget,
      "/points": proxyTarget,
      "/admin": proxyTarget,
      "/notifications": proxyTarget,
      "/support": proxyTarget,
    },
  },
});
