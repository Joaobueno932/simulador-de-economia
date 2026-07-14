/**
 * Carrega .env.local (e .env como reserva) para os scripts de linha de comando.
 * O Next já faz isso sozinho no app; os scripts não.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function aplicar(arquivo) {
  if (!existsSync(arquivo)) return;
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual === -1) continue;
    const chave = limpa.slice(0, igual).trim();
    let valor = limpa.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    // .env.local tem precedência: só define o que ainda não existe.
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}

export function carregarEnv() {
  aplicar(path.join(raiz, ".env.local"));
  aplicar(path.join(raiz, ".env"));
}
