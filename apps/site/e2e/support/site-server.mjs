import { dev } from "astro"
import process from "node:process"

// Playwright owns this foreground process. Avoid the CLI's agent background
// mode and project lock, which can replace the developer's running server.
const server = await dev({ server: { host: "127.0.0.1", port: Number(process.env.SITE_TEST_PORT) } })
const stop = async () => { await server.stop(); process.exit(0) }
process.once("SIGTERM", stop)
process.once("SIGINT", stop)
