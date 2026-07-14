import { NextResponse } from "next/server";

import { ErroProibido, exigirUsuario } from "@/server/auth";
import { carregarConfiguracao, salvarConfiguracao } from "@/server/configuracao";
import { podeEditarConfiguracoes } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

export async function GET() {
  try {
    await exigirUsuario();
    return NextResponse.json({ configuracao: await carregarConfiguracao() });
  } catch (erro) {
    return responderErro(erro);
  }
}

export async function PUT(request: Request) {
  try {
    const ator = await exigirUsuario();
    if (!podeEditarConfiguracoes(ator.papel)) {
      throw new ErroProibido("Apenas administradores e gestores alteram as configurações.");
    }

    // `salvarConfiguracao` valida com Zod antes de escrever: tarifa inválida
    // não entra no banco nem chega ao cálculo.
    const configuracao = await salvarConfiguracao(await request.json(), ator.id);

    return NextResponse.json({ ok: true, configuracao });
  } catch (erro) {
    return responderErro(erro);
  }
}
