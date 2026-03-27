import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@web": path.resolve(__dirname, "src/web"),
    },
  },
});
