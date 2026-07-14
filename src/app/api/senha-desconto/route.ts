import { NextResponse } from "next/server";
import { z } from "zod";

import { exigirUsuarioAtivo } from "@/server/auth";
import { registrarEvento } from "@/server/eventos";
import { emitirSenha, listarSenhasPendentes } from "@/server/senhasDesconto";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const emissaoSchema = z.object({
  vendedorId: z.number().int().positive("Selecione o vendedor."),
});

/** Senhas ainda válidas (admin/gestor). */
export async function GET() {
  try {
    const ator = await exigirUsuarioAtivo();
    return NextResponse.json({ senhas: await listarSenhasPendentes(ator) });
  } catch (erro) {
    return responderErro(erro);
  }
}

/** Emite uma senha para um vendedor. O código aparece UMA vez, aqui. */
export async function POST(request: Request) {
  try {
    const ator = await exigirUsuarioAtivo();
    const { vendedorId } = emissaoSchema.parse(await request.json());

    // A permissão é conferida dentro de `emitirSenha`.
    const senha = await emitirSenha(ator, vendedorId);

    await registrarEvento({
      usuarioId: ator.id,
      tipo: "senha_desconto_emitida",
      descricao: `Emitiu senha de desconto para ${senha.vendedorNome}`,
      alvoUsuarioId: vendedorId,
    });

    return NextResponse.json({ senha }, { status: 201 });
  } catch (erro) {
    return responderErro(erro);
  }
}
