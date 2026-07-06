import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_TARGET || env.VITE_API_BASE_URL || "http://127.0.0.1:3000";

  return {
    plugins: [react()],
    server: {
      allowedHosts: [
        ".ngrok-free.app",
        ".ngrok-free.dev",
        ".ngrok-free.pizza",
        ".ngrok.app",
        ".ngrok.dev",
        ".ngrok.io",
      ],
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
  };
});
