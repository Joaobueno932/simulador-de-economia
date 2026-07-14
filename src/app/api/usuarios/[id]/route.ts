import { NextResponse } from "next/server";
import { z } from "zod";

import { ErroProibido, exigirUsuario } from "@/server/auth";
import { editarUsuario, ErroDeNegocio } from "@/server/usuarios";
import { podeAdministrar, INSTITUICOES } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const edicaoSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo.").optional(),
  instituicao: z.enum(INSTITUICOES).nullable().optional(),
  ativo: z.boolean().optional(),
  senha: z
    .string()
    .min(8, "A nova senha deve ter ao menos 8 caracteres.")
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ator = await exigirUsuario();
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

    return NextResponse.json({ usuario });
  } catch (erro) {
    return responderErro(erro);
  }
}
