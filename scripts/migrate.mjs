/**
 * Aplica o esquema no banco. Idempotente — pode rodar quantas vezes quiser.
 *
 *   npm run db:migrate
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { carregarEnv } from "./env.mjs";

carregarEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(__dirname, "..");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida. Crie .env.local a partir de .env.example.");
  process.exit(1);
}

const local = url.includes("localhost") || url.includes("127.0.0.1") || url.includes("sslmode=disable");

const cliente = new pg.Client({
  connectionString: url,
  ssl: local ? undefined : { rejectUnauthorized: true },
});

const sql = await readFile(path.join(raiz, "src", "server", "db", "schema.sql"), "utf8");

await cliente.connect();
try {
  await cliente.query(sql);
  console.log("Esquema aplicado com sucesso.");
} finally {
  await cliente.end();
}
