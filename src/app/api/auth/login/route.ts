import { NextResponse } from "next/server";
import { z } from "zod";

import { autenticar, criarSessao, limparSessoesVencidas } from "@/server/auth";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail."),
  senha: z.string().min(1, "Informe a senha."),
});

export async function POST(request: Request) {
  try {
    const { email, senha } = schema.parse(await request.json());

    const usuario = await autenticar(email, senha);
    if (!usuario) {
      // Mensagem única: não dizemos se o e-mail existe ou se a senha errou.
      return NextResponse.json({ erro: "E-mail ou senha inválidos." }, { status: 401 });
    }

    await criarSessao(usuario.id);
    await limparSessoesVencidas();

    return NextResponse.json({ ok: true, papel: usuario.papel });
  } catch (erro) {
    return responderErro(erro);
  }
}
