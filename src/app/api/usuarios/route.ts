import { NextResponse } from "next/server";
import { z } from "zod";

import { ErroProibido, exigirUsuarioAtivo } from "@/server/auth";
import { criarUsuario, listarUsuarios } from "@/server/usuarios";
import { registrarEvento } from "@/server/eventos";
import { podeAdministrar, INSTITUICOES, ROTULO_PAPEL } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

const novoUsuarioSchema = z
  .object({
    nome: z.string().trim().min(3, "Informe o nome completo."),
    email: z.string().trim().email("E-mail inválido."),
    papel: z.enum(["admin", "gestor", "vendedor"], {
      errorMap: () => ({ message: "Selecione o papel." }),
    }),
    instituicoes: z.array(z.enum(INSTITUICOES)).default([]),
    /** Quando true, entra com a senha padrão e troca no primeiro acesso. */
    usarSenhaPadrao: z.boolean().default(true),
    senha: z
      .string()
      .min(8, "A senha deve ter ao menos 8 caracteres.")
      .optional()
      .nullable(),
  })
  .superRefine((d, ctx) => {
    if (!d.usarSenhaPadrao && !d.senha) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senha"],
        message: "Informe a senha ou use a senha padrão.",
      });
    }
  });

export async function GET() {
  try {
    const ator = await exigirUsuarioAtivo();
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
    const ator = await exigirUsuarioAtivo();
    // `criarUsuario` revalida o papel — esta checagem é só o corte rápido.
    if (!podeAdministrar(ator.papel)) {
      throw new ErroProibido("Você não pode criar usuários.");
    }

    const dados = novoUsuarioSchema.parse(await request.json());
    const usuario = await criarUsuario(ator, dados);

    await registrarEvento({
      usuarioId: ator.id,
      tipo: "usuario_criado",
      descricao: `Criou ${ROTULO_PAPEL[usuario.papel].toLowerCase()} ${usuario.nome}`,
      alvoUsuarioId: usuario.id,
    });

    return NextResponse.json({ usuario }, { status: 201 });
  } catch (erro) {
    return responderErro(erro);
  }
}
