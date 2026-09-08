import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { initCloudinary } from "./config/cloudinary.js";
import { initSockets } from "./sockets/index.js";

/** Boot order: env (validated on import) -> DB -> app -> sockets -> listen. */
async function main() {
  await connectDB();
  initCloudinary();

  const app = createApp();
  const httpServer = createServer(app);
  initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`[api] listening on :${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error("[api] fatal boot error", err);
  process.exit(1);
});
