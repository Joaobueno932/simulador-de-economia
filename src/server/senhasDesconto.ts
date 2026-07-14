import "server-only";

/**
 * Senhas de uso único para liberar a edição do desconto.
 *
 * REGRAS (todas garantidas no SERVIDOR — o navegador não decide nada):
 *  - só admin/gestor emite;
 *  - a senha é emitida PARA UM VENDEDOR específico: outro vendedor não a usa;
 *  - morre no primeiro uso;
 *  - morre em 15 minutos, mesmo sem uso;
 *  - no banco fica só o hash: quem lê a tabela não consegue usar a senha.
 *
 * O consumo é feito num UPDATE condicional único (`usada_em IS NULL AND
 * expira_em > NOW()`), então duas requisições simultâneas com o mesmo código não
 * conseguem gastá-lo duas vezes — quem chega em segundo lugar atualiza 0 linhas.
 */

import { createHash, randomInt } from "node:crypto";

import { consultar, consultarUm } from "./db";
import { ErroProibido } from "./auth";
import { ErroDeNegocio } from "./usuarios";
import { podeEmitirSenhaDesconto, type Usuario } from "@/domain/auth/types";

/** Janela de validade da senha. */
export const MINUTOS_VALIDADE = 15;

/** 6 dígitos: fácil de ditar por telefone, e o uso único cobre o resto. */
const DIGITOS = 6;

function hashDoCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

/** Código numérico com entropia criptográfica (não `Math.random`). */
function gerarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < DIGITOS; i += 1) codigo += String(randomInt(0, 10));
  return codigo;
}

export interface SenhaEmitida {
  /** Em claro — mostrado UMA vez a quem emitiu. Não é recuperável depois. */
  readonly codigo: string;
  readonly vendedorNome: string;
  readonly expiraEm: string;
}

/**
 * Emite uma senha para um vendedor.
 *
 * Invalida as senhas anteriores ainda pendentes daquele vendedor: se o gestor
 * gerou duas, só a última vale — evita códigos esquecidos circulando.
 */
export async function emitirSenha(ator: Usuario, vendedorId: number): Promise<SenhaEmitida> {
  if (!podeEmitirSenhaDesconto(ator.papel)) {
    throw new ErroProibido("Você não pode emitir senhas de desconto.");
  }

  const vendedor = await consultarUm<{ id: number; nome: string; papel: string; ativo: boolean }>(
    `SELECT id, nome, papel, ativo FROM usuarios WHERE id = $1`,
    [vendedorId],
  );

  if (!vendedor) throw new ErroDeNegocio("Vendedor não encontrado.");
  if (vendedor.papel !== "vendedor") {
    throw new ErroDeNegocio("A senha de desconto só é emitida para vendedores.");
  }
  if (!vendedor.ativo) throw new ErroDeNegocio("Este vendedor está inativo.");

  const codigo = gerarCodigo();
  const expiraEm = new Date(Date.now() + MINUTOS_VALIDADE * 60 * 1000);

  // Anula as pendentes do mesmo vendedor.
  await consultar(
    `UPDATE senhas_desconto
        SET expira_em = NOW()
      WHERE vendedor_id = $1 AND usada_em IS NULL AND expira_em > NOW()`,
    [vendedorId],
  );

  await consultar(
    `INSERT INTO senhas_desconto (codigo_hash, vendedor_id, emitida_por, expira_em)
     VALUES ($1, $2, $3, $4)`,
    [hashDoCodigo(codigo), vendedorId, ator.id, expiraEm],
  );

  return {
    codigo,
    vendedorNome: vendedor.nome,
    expiraEm: expiraEm.toISOString(),
  };
}

/**
 * Consome a senha. Retorna `true` só se o código era válido PARA ESTE usuário,
 * ainda não usado e dentro da validade — e nesse caso já o marca como usado.
 */
export async function consumirSenha(usuario: Usuario, codigo: string): Promise<boolean> {
  const limpo = codigo.replace(/\D/g, "");
  if (limpo.length !== DIGITOS) return false;

  // O UPDATE condicional é a trava: ou ele pega a linha (e a queima), ou não
  // pega nada. Sem espaço para corrida entre duas tentativas simultâneas.
  const linhas = await consultar<{ id: number }>(
    `UPDATE senhas_desconto
        SET usada_em = NOW()
      WHERE codigo_hash = $1
        AND vendedor_id = $2
        AND usada_em IS NULL
        AND expira_em > NOW()
      RETURNING id`,
    [hashDoCodigo(limpo), usuario.id],
  );

  return linhas.length > 0;
}

export interface SenhaPendente {
  readonly id: number;
  readonly vendedorNome: string;
  readonly expiraEm: string;
}

/** Senhas ainda válidas — para o gestor ver o que está pendente. */
export async function listarSenhasPendentes(ator: Usuario): Promise<SenhaPendente[]> {
  if (!podeEmitirSenhaDesconto(ator.papel)) {
    throw new ErroProibido("Você não pode ver as senhas de desconto.");
  }

  const linhas = await consultar<{ id: number; nome: string; expira_em: Date }>(
    `SELECT s.id, u.nome, s.expira_em
       FROM senhas_desconto s
       JOIN usuarios u ON u.id = s.vendedor_id
      WHERE s.usada_em IS NULL AND s.expira_em > NOW()
      ORDER BY s.expira_em DESC`,
  );

  return linhas.map((l) => ({
    id: Number(l.id),
    vendedorNome: l.nome,
    expiraEm: l.expira_em.toISOString(),
  }));
}
