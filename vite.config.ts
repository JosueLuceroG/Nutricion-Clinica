import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDependency = (id: string, dependency: string) => {
  const normalizedId = id.replace(/\\/g, "/");
  return normalizedId.includes(`/node_modules/${dependency}/`);
};

const isScopedDependency = (id: string, scope: string) => {
  const normalizedId = id.replace(/\\/g, "/");
  return normalizedId.includes(`/node_modules/${scope}/`);
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@modules": path.resolve(__dirname, "./src/modules"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@store": path.resolve(__dirname, "./src/store"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@i18n": path.resolve(__dirname, "./src/i18n"),
      "@nutriclinica/shared": path.resolve(__dirname, "./packages/shared/src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 1421,
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: process.env.CI ? false : true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            isDependency(id, "react") ||
            isDependency(id, "react-dom") ||
            isDependency(id, "react-router-dom")
          ) {
            return "react";
          }

          if (
            isScopedDependency(id, "@radix-ui") ||
            isDependency(id, "cmdk") ||
            isDependency(id, "class-variance-authority") ||
            isDependency(id, "clsx") ||
            isDependency(id, "tailwind-merge") ||
            isDependency(id, "tailwindcss-animate")
          ) {
            return "ui";
          }

          if (
            isDependency(id, "react-hook-form") ||
            isScopedDependency(id, "@hookform") ||
            isDependency(id, "zod")
          ) {
            return "forms";
          }

          if (isScopedDependency(id, "@tanstack")) {
            return "table";
          }

          if (isDependency(id, "recharts")) {
            return "charts";
          }

          if (isScopedDependency(id, "@dnd-kit")) {
            return "dnd";
          }

          if (isDependency(id, "jspdf") || isDependency(id, "jspdf-autotable")) {
            return "pdf";
          }

          if (isDependency(id, "html2canvas")) {
            return "canvas";
          }

          if (isDependency(id, "tesseract.js")) {
            return "ocr";
          }

          if (isDependency(id, "i18next") || isDependency(id, "react-i18next")) {
            return "i18n";
          }

          if (
            isDependency(id, "dexie") ||
            isDependency(id, "dexie-react-hooks") ||
            isDependency(id, "zustand")
          ) {
            return "state";
          }

          if (isScopedDependency(id, "@tauri-apps")) {
            return "tauri";
          }

          if (isDependency(id, "date-fns") || isDependency(id, "uuid")) {
            return "utils";
          }

          if (isDependency(id, "lucide-react")) {
            return "icons";
          }

          if (isDependency(id, "react-day-picker")) {
            return "calendar";
          }

          if (isDependency(id, "sonner")) {
            return "notifications";
          }
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
