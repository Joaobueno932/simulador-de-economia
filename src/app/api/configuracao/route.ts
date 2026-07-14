import { NextResponse } from "next/server";

import { ErroProibido, exigirUsuarioAtivo } from "@/server/auth";
import { carregarConfiguracao, salvarConfiguracao } from "@/server/configuracao";
import { registrarEvento } from "@/server/eventos";
import { podeEditarConfiguracoes } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

export async function GET() {
  try {
    await exigirUsuarioAtivo();
    return NextResponse.json({ configuracao: await carregarConfiguracao() });
  } catch (erro) {
    return responderErro(erro);
  }
}

export async function PUT(request: Request) {
  try {
    const ator = await exigirUsuarioAtivo();
    if (!podeEditarConfiguracoes(ator.papel)) {
      throw new ErroProibido("Apenas administradores e gestores alteram as configurações.");
    }

    // `salvarConfiguracao` valida com Zod antes de escrever: tarifa inválida
    // não entra no banco nem chega ao cálculo.
    const configuracao = await salvarConfiguracao(await request.json(), ator.id);

    await registrarEvento({
      usuarioId: ator.id,
      tipo: "config_alterada",
      descricao: "Alterou as configurações do simulador",
    });

    return NextResponse.json({ ok: true, configuracao });
  } catch (erro) {
    return responderErro(erro);
  }
}
