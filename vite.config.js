import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/papersignal/" : "/",
  build: { chunkSizeWarningLimit: 600 },
});
