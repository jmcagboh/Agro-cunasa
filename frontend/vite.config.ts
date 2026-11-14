import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Agro-cunasa/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    fs: { allow: [".."] },
  },
  build: { outDir: "dist", emptyOutDir: true },
}));
