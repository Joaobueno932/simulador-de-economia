import { NextResponse } from "next/server";
import { z } from "zod";

import { ErroProibido, exigirUsuarioAtivo } from "@/server/auth";
import { editarUsuario, ErroDeNegocio } from "@/server/usuarios";
import { registrarEvento } from "@/server/eventos";
import { podeAdministrar, INSTITUICOES } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const edicaoSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo.").optional(),
  instituicoes: z.array(z.enum(INSTITUICOES)).optional(),
  ativo: z.boolean().optional(),
});

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
    const alvoId = Number(id);
    if (!Number.isInteger(alvoId) || alvoId <= 0) {
      throw new ErroDeNegocio("Usuário inválido.");
    }

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
