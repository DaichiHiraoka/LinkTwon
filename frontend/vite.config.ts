import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [".ngrok-free.app"],
    proxy: {
      "/auth": "http://127.0.0.1:3000",
      "/users": "http://127.0.0.1:3000",
      "/events": "http://127.0.0.1:3000",
      "/points": "http://127.0.0.1:3000",
      "/admin": "http://127.0.0.1:3000",
    },
  },
});
