import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    proxy: {
      "/claude": "http://localhost:8787",
      "/pronounce": "http://localhost:8787",
    },
  },
});
