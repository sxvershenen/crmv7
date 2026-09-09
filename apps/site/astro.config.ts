import react from "@astrojs/react"
import node from "@astrojs/node"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

export default defineConfig({
  site: "https://svistoplyasovo.ru",
  output: "server",
  devToolbar: { enabled: false },
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
})
