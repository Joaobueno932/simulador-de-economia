import { NextResponse } from "next/server";
import { z } from "zod";

import { ErroProibido, exigirUsuario } from "@/server/auth";
import { criarUsuario, listarUsuarios } from "@/server/usuarios";
import { podeAdministrar, INSTITUICOES } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const novoUsuarioSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo."),
  email: z.string().trim().email("E-mail inválido."),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
  papel: z.enum(["admin", "gestor", "vendedor"], {
    errorMap: () => ({ message: "Selecione o papel." }),
  }),
  instituicao: z.enum(INSTITUICOES).nullable().default(null),
});

export async function GET() {
  try {
    const ator = await exigirUsuario();
    if (!podeAdministrar(ator.papel)) {
      throw new ErroProibido("Você não tem acesso à gestão de usuários.");
    }
    return NextResponse.json({ usuarios: await listarUsuarios() });
  } catch (erro) {
    return responderErro(erro);
  }
}

export async function POST(request: Request) {
  try {
    const ator = await exigirUsuario();
    // `criarUsuario` revalida o papel — esta checagem é só o corte rápido.
    if (!podeAdministrar(ator.papel)) {
      throw new ErroProibido("Você não pode criar usuários.");
    }

    const dados = novoUsuarioSchema.parse(await request.json());
    const usuario = await criarUsuario(ator, dados);

    return NextResponse.json({ usuario }, { status: 201 });
  } catch (erro) {
    return responderErro(erro);
  }
}
