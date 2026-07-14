import "server-only";

/**
 * Autenticação e sessão.
 *
 * DECISÕES DE SEGURANÇA
 * ---------------------
 * - Senha: bcrypt (custo 12). Nunca guardamos a senha, só o hash.
 * - Sessão: token aleatório de 32 bytes no cookie httpOnly + SameSite=Lax.
 *   No banco fica só o SHA-256 do token — vazar o banco não dá sessão viva a
 *   ninguém. E a sessão é revogável (basta apagar a linha), o que um JWT
 *   autocontido não permitiria.
 * - Login com e-mail errado e senha errada levam exatamente à mesma resposta e
 *   ao mesmo custo de tempo (comparamos contra um hash falso), para não vazar
 *   quais e-mails existem.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { consultar, consultarUm } from "./db";
import type { Instituicao, Papel, Usuario } from "@/domain/auth/types";

const COOKIE_SESSAO = "em_conta_sessao";
const DIAS_SESSAO = 7;
const CUSTO_BCRYPT = 12;

/**
 * Hash real (de uma senha aleatória descartada) usado quando o e-mail não
 * existe. Precisa ser um bcrypt VÁLIDO: contra um hash malformado o `compare`
 * retorna na hora e o tempo de resposta entregaria que o e-mail não existe.
 */
const HASH_FALSO = "$2b$12$0YPFk5eQuQYQvYlGgpi/yeqtJDid/wmi0zrHn/.tBdkgulVxW2XYG";

interface LinhaUsuario {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  senha_provisoria: boolean;
  tem_foto: boolean;
  instituicoes: Instituicao[] | null;
}

/**
 * Campos do usuário + instituições agregadas.
 *
 * As instituições viraram N:N, então toda leitura de usuário passa por este
 * `SELECT` — assim nenhum lugar do código esquece de trazê-las.
 */
export const SELECT_USUARIO = `
  u.id, u.nome, u.email, u.papel, u.ativo, u.senha_provisoria,
  (u.foto IS NOT NULL) AS tem_foto,
  COALESCE(
    (SELECT ARRAY_AGG(i.instituicao ORDER BY i.instituicao)
       FROM usuario_instituicoes i WHERE i.usuario_id = u.id),
    ARRAY[]::TEXT[]
  ) AS instituicoes
`;

export function paraUsuario(l: LinhaUsuario): Usuario {
  return {
    id: Number(l.id),
    nome: l.nome,
    email: l.email,
    papel: l.papel,
    instituicoes: l.instituicoes ?? [],
    ativo: l.ativo,
    senhaProvisoria: l.senha_provisoria,
    temFoto: l.tem_foto,
  };
}

export function hashDeSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

/** SHA-256 do token de sessão — é isso que vai para o banco. */
function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Confere e-mail + senha.
 *
 * Devolve `null` para credencial inválida, usuário inativo ou e-mail
 * inexistente — sem distinguir os casos para quem está de fora.
 */
export async function autenticar(email: string, senha: string): Promise<Usuario | null> {
  const linha = await consultarUm<LinhaUsuario & { senha_hash: string }>(
    `SELECT ${SELECT_USUARIO}, u.senha_hash
       FROM usuarios u
      WHERE LOWER(u.email) = LOWER($1)`,
    [email.trim()],
  );

  // Sempre gasta o tempo de um bcrypt, mesmo sem usuário.
  const confere = await bcrypt.compare(senha, linha?.senha_hash ?? HASH_FALSO);

  if (!linha || !confere || !linha.ativo) return null;
  return paraUsuario(linha);
}

/** Cria a sessão e grava o cookie. */
export async function criarSessao(usuarioId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DIAS_SESSAO * 24 * 60 * 60 * 1000);

  await consultar(
    `INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, $3)`,
    [hashDeToken(token), usuarioId, expira],
  );

  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expira,
  });
}

/** Encerra a sessão atual (apaga do banco e do navegador). */
export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;

  if (token) {
    await consultar(`DELETE FROM sessoes WHERE token_hash = $1`, [hashDeToken(token)]);
  }
  jar.delete(COOKIE_SESSAO);
}

/** O usuário da sessão + o que essa sessão específica já conquistou. */
export interface Sessao {
  readonly usuario: Usuario;
  /** O desconto foi liberado nesta sessão (senha de uso único já consumida). */
  readonly descontoLiberado: boolean;
}

/**
 * Sessão da requisição atual, ou `null`.
 *
 * É a ÚNICA fonte de identidade no servidor. Nenhuma rota deve confiar em id,
 * papel ou liberação vindos do corpo da requisição.
 */
export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const linha = await consultarUm<LinhaUsuario & { desconto_liberado: boolean }>(
    `SELECT ${SELECT_USUARIO}, s.desconto_liberado
       FROM sessoes s
       JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1
        AND s.expira_em > NOW()
        AND u.ativo = TRUE`,
    [hashDeToken(token)],
  );

  if (!linha) return null;

  return {
    usuario: paraUsuario(linha),
    descontoLiberado: linha.desconto_liberado,
  };
}

/** Atalho: só o usuário. */
export async function usuarioAtual(): Promise<Usuario | null> {
  const s = await sessaoAtual();
  return s?.usuario ?? null;
}

/**
 * Marca a sessão atual como "desconto liberado".
 *
 * Chamado só depois de consumir uma senha de uso único válida.
 */
export async function liberarDescontoNaSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;
  if (!token) return;

  await consultar(`UPDATE sessoes SET desconto_liberado = TRUE WHERE token_hash = $1`, [
    hashDeToken(token),
  ]);
}

/**
 * Troca a senha do próprio usuário e limpa a marca de provisória.
 *
 * Derruba as OUTRAS sessões dele: se a senha padrão vazou, quem estiver logado
 * com ela perde o acesso na hora. A sessão atual continua viva.
 */
export async function trocarPropriaSenha(usuarioId: number, novaSenha: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO)?.value;

  await consultar(
    `UPDATE usuarios
        SET senha_hash = $1, senha_provisoria = FALSE, atualizado_em = NOW()
      WHERE id = $2`,
    [await hashDeSenha(novaSenha), usuarioId],
  );

  if (token) {
    await consultar(`DELETE FROM sessoes WHERE usuario_id = $1 AND token_hash <> $2`, [
      usuarioId,
      hashDeToken(token),
    ]);
  }
}

/** Como `usuarioAtual`, mas estoura se não houver sessão. Use nas rotas de API. */
export async function exigirUsuario(): Promise<Usuario> {
  return (await exigirSessao()).usuario;
}

/** Sessão completa (usuário + liberações). Estoura se não houver. */
export async function exigirSessao(): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) throw new ErroNaoAutorizado("Sessão expirada. Faça login novamente.");
  return s;
}

/**
 * Sessão de quem JÁ trocou a senha provisória.
 *
 * Usada em todas as rotas de trabalho. Quem está com a senha padrão só consegue
 * trocá-la ou sair — não simula, não gera PDF, não administra nada.
 */
export async function exigirSessaoAtiva(): Promise<Sessao> {
  const s = await exigirSessao();
  if (s.usuario.senhaProvisoria) {
    throw new ErroProibido("Troque a senha provisória antes de usar o sistema.");
  }
  return s;
}

export async function exigirUsuarioAtivo(): Promise<Usuario> {
  return (await exigirSessaoAtiva()).usuario;
}

export class ErroNaoAutorizado extends Error {
  readonly status = 401;
}

export class ErroProibido extends Error {
  readonly status = 403;
}

/** Comparação em tempo constante. */
export function comparaSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Remove sessões vencidas. Chamado no login — barato e evita tabela infinita. */
export async function limparSessoesVencidas(): Promise<void> {
  await consultar(`DELETE FROM sessoes WHERE expira_em < NOW()`);
}
