import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://magentic_backend:3000",
      "/mcp": "http://magentic_mcp:3000"
    }
  }
});
