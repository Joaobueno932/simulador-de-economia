import "server-only";

/**
 * CRUD de usuários. Toda checagem de permissão acontece AQUI, no servidor —
 * a UI apenas esconde o que não interessa, nunca protege.
 */

import { consultar, consultarUm } from "./db";
import { ErroProibido, hashDeSenha } from "./auth";
import {
  podeCriarPapel,
  podeGerenciarUsuario,
  type Instituicao,
  type Papel,
  type Usuario,
} from "@/domain/auth/types";

interface LinhaUsuario {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  instituicao: Instituicao | null;
  ativo: boolean;
  criado_em: Date;
}

export interface UsuarioListado extends Usuario {
  readonly criadoEm: string;
}

function paraListado(l: LinhaUsuario): UsuarioListado {
  return {
    id: Number(l.id),
    nome: l.nome,
    email: l.email,
    papel: l.papel,
    instituicao: l.instituicao,
    ativo: l.ativo,
    criadoEm: l.criado_em.toISOString(),
  };
}

/** Todos os usuários (admin e gestor enxergam a base inteira). */
export async function listarUsuarios(): Promise<UsuarioListado[]> {
  const linhas = await consultar<LinhaUsuario>(
    `SELECT id, nome, email, papel, instituicao, ativo, criado_em
       FROM usuarios
      ORDER BY
        CASE papel WHEN 'admin' THEN 0 WHEN 'gestor' THEN 1 ELSE 2 END,
        nome`,
  );
  return linhas.map(paraListado);
}

/** Vendedores ativos — alimenta o seletor de consultor na proposta. */
export async function listarVendedoresAtivos(): Promise<UsuarioListado[]> {
  const linhas = await consultar<LinhaUsuario>(
    `SELECT id, nome, email, papel, instituicao, ativo, criado_em
       FROM usuarios
      WHERE papel = 'vendedor' AND ativo = TRUE
      ORDER BY nome`,
  );
  return linhas.map(paraListado);
}

export async function buscarUsuario(id: number): Promise<UsuarioListado | null> {
  const l = await consultarUm<LinhaUsuario>(
    `SELECT id, nome, email, papel, instituicao, ativo, criado_em
       FROM usuarios WHERE id = $1`,
    [id],
  );
  return l ? paraListado(l) : null;
}

export class ErroDeNegocio extends Error {
  readonly status = 400;
}

export interface NovoUsuario {
  nome: string;
  email: string;
  senha: string;
  papel: Papel;
  instituicao: Instituicao | null;
}

export async function criarUsuario(ator: Usuario, dados: NovoUsuario): Promise<UsuarioListado> {
  if (!podeCriarPapel(ator.papel, dados.papel)) {
    throw new ErroProibido(
      ator.papel === "gestor"
        ? "Gestor só pode criar vendedores."
        : "Você não pode criar usuários com esse papel.",
    );
  }

  // A regra "vendedor tem instituição, os outros não" também está no banco
  // (CHECK), mas aqui devolvemos uma mensagem legível em vez de erro de SQL.
  if (dados.papel === "vendedor" && !dados.instituicao) {
    throw new ErroDeNegocio("Selecione a instituição do vendedor.");
  }
  const instituicao = dados.papel === "vendedor" ? dados.instituicao : null;

  const jaExiste = await consultarUm<{ id: number }>(
    `SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [dados.email],
  );
  if (jaExiste) throw new ErroDeNegocio("Já existe um usuário com esse e-mail.");

  const linha = await consultarUm<LinhaUsuario>(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, instituicao, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nome, email, papel, instituicao, ativo, criado_em`,
    [
      dados.nome.trim(),
      dados.email.trim().toLowerCase(),
      await hashDeSenha(dados.senha),
      dados.papel,
      instituicao,
      ator.id,
    ],
  );

  return paraListado(linha as LinhaUsuario);
}

export interface EdicaoUsuario {
  nome?: string;
  instituicao?: Instituicao | null;
  ativo?: boolean;
  /** Opcional: quando vem, redefine a senha. */
  senha?: string;
}

export async function editarUsuario(
  ator: Usuario,
  alvoId: number,
  dados: EdicaoUsuario,
): Promise<UsuarioListado> {
  const alvo = await buscarUsuario(alvoId);
  if (!alvo) throw new ErroDeNegocio("Usuário não encontrado.");

  if (!podeGerenciarUsuario(ator, alvo)) {
    throw new ErroProibido(
      ator.id === alvo.id
        ? "Você não pode alterar a própria conta por esta tela."
        : "Você não tem permissão para alterar este usuário.",
    );
  }

  // Instituição só faz sentido para vendedor.
  if (dados.instituicao !== undefined && alvo.papel !== "vendedor" && dados.instituicao !== null) {
    throw new ErroDeNegocio("Apenas vendedores têm instituição.");
  }
  if (alvo.papel === "vendedor" && dados.instituicao === null) {
    throw new ErroDeNegocio("O vendedor precisa de uma instituição.");
  }

  const campos: string[] = [];
  const valores: unknown[] = [];
  const add = (sql: string, valor: unknown) => {
    valores.push(valor);
    campos.push(`${sql} = $${valores.length}`);
  };

  if (dados.nome !== undefined) add("nome", dados.nome.trim());
  if (dados.instituicao !== undefined) add("instituicao", dados.instituicao);
  if (dados.ativo !== undefined) add("ativo", dados.ativo);
  if (dados.senha) add("senha_hash", await hashDeSenha(dados.senha));

  if (campos.length === 0) return alvo;

  campos.push("atualizado_em = NOW()");
  valores.push(alvoId);

  const linha = await consultarUm<LinhaUsuario>(
    `UPDATE usuarios SET ${campos.join(", ")}
      WHERE id = $${valores.length}
      RETURNING id, nome, email, papel, instituicao, ativo, criado_em`,
    valores,
  );

  // Desativar alguém derruba as sessões dele na hora.
  if (dados.ativo === false) {
    await consultar(`DELETE FROM sessoes WHERE usuario_id = $1`, [alvoId]);
  }

  return paraListado(linha as LinhaUsuario);
}
