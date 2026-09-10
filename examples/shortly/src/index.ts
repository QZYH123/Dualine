import { createServer } from "./server";
import { openStore } from "./store";

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? "./data/shortly.db";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

const store = openStore(DB_PATH);
const app = createServer({ store, baseUrl: BASE_URL });

const server = app.listen(PORT, () => {
  console.log(`shortly listening on ${BASE_URL}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
