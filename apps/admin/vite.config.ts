import path from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          if (id.includes("@tabler/icons-react")) return "product-icons"
          if (id.includes("@base-ui") || id.includes("cmdk") || id.includes("lucide-react")) return "ui-vendor"
          if (/\/node_modules\/(?:react|react-dom|react-router|react-router-dom)\//.test(id)) return "react-vendor"
          return undefined
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  preview: {
    port: 4174,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@admin": path.resolve(currentDirectory, "src"),
      "@": path.resolve(currentDirectory, "../../packages/ui/src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3000",
      },
    },
    strictPort: true,
  },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test/setup.ts" },
})
