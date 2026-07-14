import { NextResponse } from "next/server";
import { z } from "zod";

import { exigirUsuarioAtivo, liberarDescontoNaSessao } from "@/server/auth";
import { registrarEvento } from "@/server/eventos";
import { consumirSenha } from "@/server/senhasDesconto";
import { podeEditarDescontoLivremente } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const schema = z.object({
  codigo: z.string().trim().min(1, "Informe a senha."),
});

/**
 * O vendedor troca a senha de uso único pela liberação do campo de desconto.
 *
 * A senha é consumida aqui: um `UPDATE` condicional que só pega a linha se ela
 * for daquele vendedor, ainda não usada e dentro dos 15 minutos.
 */
export async function POST(request: Request) {
  try {
    const usuario = await exigirUsuarioAtivo();

    // Admin/gestor já editam sem senha — não faz sentido queimar um código.
    if (podeEditarDescontoLivremente(usuario.papel)) {
      return NextResponse.json({ liberado: true });
    }

    const { codigo } = schema.parse(await request.json());
    const ok = await consumirSenha(usuario, codigo);

    if (!ok) {
      return NextResponse.json(
        { erro: "Senha inválida, já utilizada ou expirada." },
        { status: 400 },
      );
    }

    // A liberação fica na SESSÃO (servidor). Não basta o campo destravar na
    // tela: é este registro que a rota do PDF confere antes de aceitar um
    // desconto diferente do padrão.
    await liberarDescontoNaSessao();

    // O uso da senha entra no histórico — o gestor precisa ver quem destravou
    // o desconto e quando.
    await registrarEvento({
      usuarioId: usuario.id,
      tipo: "senha_desconto_usada",
      descricao: "Usou a senha de liberação e destravou o desconto",
    });

    return NextResponse.json({ liberado: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
