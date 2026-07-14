import { NextResponse } from "next/server";
import { z } from "zod";

import { autenticar, exigirSessao, trocarPropriaSenha } from "@/server/auth";
import { registrarEvento } from "@/server/eventos";
import { SENHA_PADRAO } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const schema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual."),
  novaSenha: z
    .string()
    .min(8, "A nova senha deve ter ao menos 8 caracteres.")
    .max(200, "Senha longa demais."),
});

/**
 * Troca da própria senha.
 *
 * Usa `exigirSessao` (não `exigirSessaoAtiva`): quem está com a senha provisória
 * tem que conseguir chegar aqui — é justamente o que se espera dele.
 */
export async function POST(request: Request) {
  try {
    const { usuario } = await exigirSessao();
    const { senhaAtual, novaSenha } = schema.parse(await request.json());

    // Confere a senha atual mesmo já estando logado: impede que alguém que
    // pegou a máquina destravada troque a senha e tome a conta.
    const confere = await autenticar(usuario.email, senhaAtual);
    if (!confere || confere.id !== usuario.id) {
      return NextResponse.json({ erro: "Senha atual incorreta." }, { status: 400 });
    }

    if (novaSenha === SENHA_PADRAO) {
      return NextResponse.json(
        { erro: "Escolha uma senha diferente da senha padrão." },
        { status: 400 },
      );
    }
    if (novaSenha === senhaAtual) {
      return NextResponse.json(
        { erro: "A nova senha deve ser diferente da atual." },
        { status: 400 },
      );
    }

    await trocarPropriaSenha(usuario.id, novaSenha);

    await registrarEvento({
      usuarioId: usuario.id,
      tipo: "senha_alterada",
      descricao: "Alterou a própria senha",
    });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
