import { NextResponse } from "next/server";

import { exigirUsuarioAtivo } from "@/server/auth";
import { ErroDeNegocio, resetarSenha } from "@/server/usuarios";
import { registrarEvento } from "@/server/eventos";
import { SENHA_PADRAO } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

/**
 * Redefine a senha de um usuário para a senha padrão.
 *
 * Ele volta a entrar com `senha123` e é obrigado a escolher uma nova no primeiro
 * acesso. As sessões dele caem na hora.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ator = await exigirUsuarioAtivo();

    const { id } = await params;
    const alvoId = Number(id);
    if (!Number.isInteger(alvoId) || alvoId <= 0) {
      throw new ErroDeNegocio("Usuário inválido.");
    }

    // A permissão é conferida dentro de `resetarSenha`.
    const usuario = await resetarSenha(ator, alvoId);

    await registrarEvento({
      usuarioId: ator.id,
      tipo: "senha_resetada",
      descricao: `Redefiniu a senha de ${usuario.nome}`,
      alvoUsuarioId: usuario.id,
    });

    return NextResponse.json({ usuario, senhaPadrao: SENHA_PADRAO });
  } catch (erro) {
    return responderErro(erro);
  }
}
