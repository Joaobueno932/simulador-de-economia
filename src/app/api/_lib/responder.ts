import "server-only";

/**
 * Tradução de erro -> resposta HTTP, num lugar só.
 *
 * Erros esperados (401/403/400) viram mensagem legível. Qualquer outra coisa
 * vira 500 genérico e o motivo técnico vai para o log — nunca para o cliente,
 * e nunca com dado pessoal junto.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ErroNaoAutorizado, ErroProibido } from "@/server/auth";
import { ErroGeracaoPdf } from "@/server/pdf";
import { ErroDeNegocio } from "@/server/usuarios";

export function responderErro(erro: unknown): NextResponse {
  // Falha de infraestrutura do PDF: a mensagem DIZ o que faltou. Um "erro
  // interno" genérico aqui deixaria o problema indiagnosticável para quem
  // opera o sistema.
  if (erro instanceof ErroGeracaoPdf) {
    console.error("Falha ao gerar o PDF:", erro.message);
    return NextResponse.json({ erro: erro.message }, { status: 500 });
  }

  if (erro instanceof ZodError) {
    const problemas = erro.issues.map((i) => ({
      campo: i.path.join("."),
      mensagem: i.message,
    }));
    return NextResponse.json({ erro: "Dados inválidos.", problemas }, { status: 400 });
  }

  if (erro instanceof ErroNaoAutorizado) {
    return NextResponse.json({ erro: erro.message }, { status: 401 });
  }

  if (erro instanceof ErroProibido) {
    return NextResponse.json({ erro: erro.message }, { status: 403 });
  }

  if (erro instanceof ErroDeNegocio) {
    return NextResponse.json({ erro: erro.message }, { status: 400 });
  }

  console.error(
    "Erro não tratado:",
    erro instanceof Error ? erro.message : "desconhecido",
  );
  return NextResponse.json({ erro: "Erro interno. Tente novamente." }, { status: 500 });
}
