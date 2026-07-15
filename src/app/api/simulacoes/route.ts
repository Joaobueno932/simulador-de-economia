import { NextResponse } from "next/server";

import { exigirUsuarioAtivo } from "@/server/auth";
import { listarSimulacoes, salvarSimulacao } from "@/server/simulacoes";
import { simulacaoArmazenadaSchema } from "@/domain/simulator/validation";
import { responderErro } from "@/app/api/_lib/responder";
import { z } from "zod";

export const runtime = "nodejs";

/** Lista os clientes salvos — os do próprio (vendedor) ou todos (admin/gestor). */
export async function GET() {
  try {
    const ator = await exigirUsuarioAtivo();
    const clientes = await listarSimulacoes(ator);
    return NextResponse.json({ clientes });
  } catch (erro) {
    return responderErro(erro);
  }
}

const salvarSchema = z.object({
  // Presente ao continuar salvando o MESMO cliente; ausente para criar.
  id: z.number().int().positive().nullable().default(null),
  simulacao: simulacaoArmazenadaSchema,
});

/** Salva (cria ou atualiza) um cliente. Chamado ao chegar na etapa 2. */
export async function POST(request: Request) {
  try {
    const ator = await exigirUsuarioAtivo();
    const { id, simulacao } = salvarSchema.parse(await request.json());

    const salvoId = await salvarSimulacao(ator, simulacao, id);
    return NextResponse.json({ id: salvoId });
  } catch (erro) {
    return responderErro(erro);
  }
}
