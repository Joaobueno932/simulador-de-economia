import { NextResponse } from "next/server";
import { z } from "zod";

import { ErroProibido, exigirUsuarioAtivo } from "@/server/auth";
import {
  buscarUsuario,
  editarUsuario,
  ErroDeNegocio,
  excluirUsuario,
} from "@/server/usuarios";
import { registrarEvento } from "@/server/eventos";
import { podeAdministrar, INSTITUICOES } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const edicaoSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo.").optional(),
  email: z.string().trim().email("E-mail inválido.").optional(),
  instituicoes: z.array(z.enum(INSTITUICOES)).optional(),
  ativo: z.boolean().optional(),
});

function idDe(valor: string): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErroDeNegocio("Usuário inválido.");
  return id;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ator = await exigirUsuarioAtivo();
    if (!podeAdministrar(ator.papel)) {
      throw new ErroProibido("Você não pode alterar usuários.");
    }

    const { id } = await params;
    const alvoId = idDe(id);

    const dados = edicaoSchema.parse(await request.json());
    const usuario = await editarUsuario(ator, alvoId, dados);

    if (dados.ativo !== undefined) {
      await registrarEvento({
        usuarioId: ator.id,
        tipo: dados.ativo ? "usuario_ativado" : "usuario_desativado",
        descricao: `${dados.ativo ? "Reativou" : "Desativou"} ${usuario.nome}`,
        alvoUsuarioId: usuario.id,
      });
    }

    return NextResponse.json({ usuario });
  } catch (erro) {
    return responderErro(erro);
  }
}

/**
 * Exclui o usuário. As propostas dele PERMANECEM no histórico — ver
 * `excluirUsuario`.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ator = await exigirUsuarioAtivo();
    if (!podeAdministrar(ator.papel)) {
      throw new ErroProibido("Você não pode excluir usuários.");
    }

    const { id } = await params;
    const alvoId = idDe(id);

    // Lemos o nome ANTES de excluir: depois do DELETE ele não existe mais, e o
    // evento guarda o nome em texto para o histórico continuar legível.
    const alvo = await buscarUsuario(alvoId);

    await excluirUsuario(ator, alvoId);

    await registrarEvento({
      usuarioId: ator.id,
      tipo: "usuario_excluido",
      descricao: `Excluiu o usuário ${alvo?.nome ?? `#${alvoId}`}`,
    });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
