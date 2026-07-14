import "server-only";

/**
 * CRUD de usuários. Toda checagem de permissão acontece AQUI, no servidor —
 * a UI apenas esconde o que não interessa, nunca protege.
 */

import { consultar, consultarUm } from "./db";
import { ErroProibido, hashDeSenha, paraUsuario, SELECT_USUARIO } from "./auth";
import {
  podeCriarPapel,
  podeGerenciarUsuario,
  podeResetarSenha,
  SENHA_PADRAO,
  type Instituicao,
  type Papel,
  type Usuario,
} from "@/domain/auth/types";

export class ErroDeNegocio extends Error {
  readonly status = 400;
}

/** Tamanho máximo do avatar aceito pelo servidor (já redimensionado no cliente). */
export const MAX_FOTO_BYTES = 512 * 1024;

interface LinhaUsuario {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  senha_provisoria: boolean;
  tem_foto: boolean;
  instituicoes: Instituicao[] | null;
  criado_em: Date;
}

export interface UsuarioListado extends Usuario {
  readonly criadoEm: string;
}

function paraListado(l: LinhaUsuario): UsuarioListado {
  return {
    ...paraUsuario(l),
    criadoEm: l.criado_em.toISOString(),
  };
}

/** Todos os usuários (admin e gestor enxergam a base inteira). */
export async function listarUsuarios(): Promise<UsuarioListado[]> {
  const linhas = await consultar<LinhaUsuario>(
    `SELECT ${SELECT_USUARIO}, u.criado_em
       FROM usuarios u
      ORDER BY
        CASE u.papel WHEN 'admin' THEN 0 WHEN 'gestor' THEN 1 ELSE 2 END,
        u.nome`,
  );
  return linhas.map(paraListado);
}

/** Vendedores ativos — alimenta o seletor de consultor na proposta. */
export async function listarVendedoresAtivos(): Promise<UsuarioListado[]> {
  const linhas = await consultar<LinhaUsuario>(
    `SELECT ${SELECT_USUARIO}, u.criado_em
       FROM usuarios u
      WHERE u.papel = 'vendedor' AND u.ativo = TRUE
      ORDER BY u.nome`,
  );
  return linhas.map(paraListado);
}

export async function buscarUsuario(id: number): Promise<UsuarioListado | null> {
  const l = await consultarUm<LinhaUsuario>(
    `SELECT ${SELECT_USUARIO}, u.criado_em FROM usuarios u WHERE u.id = $1`,
    [id],
  );
  return l ? paraListado(l) : null;
}

/** Substitui as instituições do vendedor pelo conjunto informado. */
async function definirInstituicoes(
  usuarioId: number,
  instituicoes: readonly Instituicao[],
): Promise<void> {
  await consultar(`DELETE FROM usuario_instituicoes WHERE usuario_id = $1`, [usuarioId]);

  for (const i of new Set(instituicoes)) {
    await consultar(
      `INSERT INTO usuario_instituicoes (usuario_id, instituicao)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [usuarioId, i],
    );
  }
}

export interface NovoUsuario {
  nome: string;
  email: string;
  /** Quando ausente, usa a senha padrão e marca como provisória. */
  senha?: string | null;
  /** Força a senha padrão + troca no primeiro acesso. */
  usarSenhaPadrao?: boolean;
  papel: Papel;
  instituicoes: readonly Instituicao[];
}

export async function criarUsuario(ator: Usuario, dados: NovoUsuario): Promise<UsuarioListado> {
  if (!podeCriarPapel(ator.papel, dados.papel)) {
    throw new ErroProibido(
      ator.papel === "gestor"
        ? "Gestor só pode criar vendedores."
        : "Você não pode criar usuários com esse papel.",
    );
  }

  // Instituição serve só para métrica — e só faz sentido em vendedor.
  const instituicoes = dados.papel === "vendedor" ? dados.instituicoes : [];
  if (dados.papel === "vendedor" && instituicoes.length === 0) {
    throw new ErroDeNegocio("Selecione ao menos uma instituição para o vendedor.");
  }

  const jaExiste = await consultarUm<{ id: number }>(
    `SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [dados.email],
  );
  if (jaExiste) throw new ErroDeNegocio("Já existe um usuário com esse e-mail.");

  const comSenhaPadrao = dados.usarSenhaPadrao || !dados.senha;
  const senha = comSenhaPadrao ? SENHA_PADRAO : (dados.senha as string);

  const linha = await consultarUm<{ id: number }>(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, criado_por, senha_provisoria)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      dados.nome.trim(),
      dados.email.trim().toLowerCase(),
      await hashDeSenha(senha),
      dados.papel,
      ator.id,
      comSenhaPadrao,
    ],
  );

  const id = Number(linha?.id);
  if (instituicoes.length > 0) await definirInstituicoes(id, instituicoes);

  const criado = await buscarUsuario(id);
  if (!criado) throw new ErroDeNegocio("Falha ao criar o usuário.");
  return criado;
}

export interface EdicaoUsuario {
  nome?: string;
  email?: string;
  instituicoes?: readonly Instituicao[];
  ativo?: boolean;
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

  if (dados.instituicoes !== undefined) {
    if (alvo.papel !== "vendedor" && dados.instituicoes.length > 0) {
      throw new ErroDeNegocio("Apenas vendedores têm instituições.");
    }
    if (alvo.papel === "vendedor" && dados.instituicoes.length === 0) {
      throw new ErroDeNegocio("O vendedor precisa de ao menos uma instituição.");
    }
  }

  // Trocar o e-mail é trocar o login: não pode colidir com o de outra conta.
  if (dados.email !== undefined) {
    const emUso = await consultarUm<{ id: number }>(
      `SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) AND id <> $2`,
      [dados.email.trim(), alvoId],
    );
    if (emUso) throw new ErroDeNegocio("Já existe um usuário com esse e-mail.");
  }

  const campos: string[] = [];
  const valores: unknown[] = [];
  const add = (coluna: string, valor: unknown) => {
    valores.push(valor);
    campos.push(`${coluna} = $${valores.length}`);
  };

  if (dados.nome !== undefined) add("nome", dados.nome.trim());
  if (dados.email !== undefined) add("email", dados.email.trim().toLowerCase());
  if (dados.ativo !== undefined) add("ativo", dados.ativo);

  if (campos.length > 0) {
    campos.push("atualizado_em = NOW()");
    valores.push(alvoId);
    await consultar(
      `UPDATE usuarios SET ${campos.join(", ")} WHERE id = $${valores.length}`,
      valores,
    );
  }

  if (dados.instituicoes !== undefined && alvo.papel === "vendedor") {
    await definirInstituicoes(alvoId, dados.instituicoes);
  }

  // Desativar alguém derruba as sessões dele na hora.
  if (dados.ativo === false) {
    await consultar(`DELETE FROM sessoes WHERE usuario_id = $1`, [alvoId]);
  }

  const atualizado = await buscarUsuario(alvoId);
  if (!atualizado) throw new ErroDeNegocio("Usuário não encontrado.");
  return atualizado;
}

/**
 * Redefine a senha do usuário para a senha padrão e marca como provisória.
 *
 * Derruba as sessões dele: quem estava logado sai. No próximo acesso ele entra
 * com a senha padrão e é obrigado a escolher uma nova.
 */
export async function resetarSenha(ator: Usuario, alvoId: number): Promise<UsuarioListado> {
  if (!podeResetarSenha(ator.papel)) {
    throw new ErroProibido("Você não pode redefinir senhas.");
  }

  const alvo = await buscarUsuario(alvoId);
  if (!alvo) throw new ErroDeNegocio("Usuário não encontrado.");

  if (!podeGerenciarUsuario(ator, alvo)) {
    throw new ErroProibido(
      ator.id === alvo.id
        ? "Para trocar a própria senha, use o seu perfil."
        : "Você não tem permissão para redefinir a senha deste usuário.",
    );
  }

  await consultar(
    `UPDATE usuarios
        SET senha_hash = $1, senha_provisoria = TRUE, atualizado_em = NOW()
      WHERE id = $2`,
    [await hashDeSenha(SENHA_PADRAO), alvoId],
  );

  await consultar(`DELETE FROM sessoes WHERE usuario_id = $1`, [alvoId]);

  const atualizado = await buscarUsuario(alvoId);
  if (!atualizado) throw new ErroDeNegocio("Usuário não encontrado.");
  return atualizado;
}

/**
 * Exclui o usuário de vez.
 *
 * O histórico SOBREVIVE: `propostas.usuario_id` e `propostas.vendedor_id` são
 * `ON DELETE SET NULL`, e o nome do consultor fica gravado em texto na própria
 * proposta. O gestor continua vendo o que foi vendido, mesmo depois de a conta
 * sumir. Sessões, senhas de desconto e vínculos de instituição caem junto
 * (CASCADE), que é o desejado.
 *
 * Quando não dá para excluir, o caminho é DESATIVAR — que já bloqueia o acesso
 * e derruba as sessões.
 */
export async function excluirUsuario(ator: Usuario, alvoId: number): Promise<void> {
  const alvo = await buscarUsuario(alvoId);
  if (!alvo) throw new ErroDeNegocio("Usuário não encontrado.");

  if (!podeGerenciarUsuario(ator, alvo)) {
    throw new ErroProibido(
      ator.id === alvo.id
        ? "Você não pode excluir a própria conta."
        : "Você não tem permissão para excluir este usuário.",
    );
  }

  // Trava de segurança: apagar o último admin trancaria todo mundo para fora do
  // sistema, sem ninguém capaz de criar outro.
  if (alvo.papel === "admin") {
    const linha = await consultarUm<{ total: string }>(
      `SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'admin'`,
    );
    if (Number(linha?.total ?? 0) <= 1) {
      throw new ErroDeNegocio(
        "Este é o único administrador. Crie outro antes de excluí-lo.",
      );
    }
  }

  await consultar(`DELETE FROM usuarios WHERE id = $1`, [alvoId]);
}

/** Grava a foto de perfil do PRÓPRIO usuário. */
export async function salvarFoto(
  usuarioId: number,
  bytes: Buffer,
  mime: string,
): Promise<void> {
  if (bytes.byteLength === 0) throw new ErroDeNegocio("Arquivo vazio.");
  if (bytes.byteLength > MAX_FOTO_BYTES) {
    throw new ErroDeNegocio("A foto é grande demais. Envie uma imagem menor.");
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
    throw new ErroDeNegocio("Formato inválido. Use PNG, JPEG ou WebP.");
  }

  await consultar(
    `UPDATE usuarios SET foto = $1, foto_mime = $2, atualizado_em = NOW() WHERE id = $3`,
    [bytes, mime, usuarioId],
  );
}

export async function buscarFoto(
  usuarioId: number,
): Promise<{ bytes: Buffer; mime: string } | null> {
  const l = await consultarUm<{ foto: Buffer | null; foto_mime: string | null }>(
    `SELECT foto, foto_mime FROM usuarios WHERE id = $1`,
    [usuarioId],
  );
  if (!l?.foto || !l.foto_mime) return null;
  return { bytes: l.foto, mime: l.foto_mime };
}
