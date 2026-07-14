/**
 * Cria (ou atualiza a senha do) usuário admin inicial.
 *
 *   npm run db:seed-admin
 *
 * Lê ADMIN_EMAIL, ADMIN_SENHA e ADMIN_NOME do .env.local.
 * A senha nunca aparece no código nem no banco: só o hash bcrypt.
 */

import bcrypt from "bcryptjs";
import pg from "pg";
import { carregarEnv } from "./env.mjs";

carregarEnv();

const url = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL;
const senha = process.env.ADMIN_SENHA;
const nome = process.env.ADMIN_NOME ?? "Administrador";

if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}
if (!email || !senha) {
  console.error("Defina ADMIN_EMAIL e ADMIN_SENHA no .env.local antes de rodar o seed.");
  process.exit(1);
}
if (senha.length < 8) {
  console.error("ADMIN_SENHA deve ter ao menos 8 caracteres.");
  process.exit(1);
}

const local = url.includes("localhost") || url.includes("127.0.0.1") || url.includes("sslmode=disable");
const cliente = new pg.Client({
  connectionString: url,
  ssl: local ? undefined : { rejectUnauthorized: true },
});

const hash = await bcrypt.hash(senha, 12);

await cliente.connect();
try {
  const { rows } = await cliente.query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, instituicao)
     VALUES ($1, $2, $3, 'admin', NULL)
     ON CONFLICT (LOWER(email)) DO UPDATE
       SET senha_hash = EXCLUDED.senha_hash,
           nome = EXCLUDED.nome,
           papel = 'admin',
           ativo = TRUE,
           atualizado_em = NOW()
     RETURNING id, email, papel`,
    [nome, email.toLowerCase(), hash],
  );
  const u = rows[0];
  console.log(`Admin pronto: #${u.id} ${u.email} (${u.papel})`);
} finally {
  await cliente.end();
}
