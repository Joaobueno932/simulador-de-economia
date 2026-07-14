/**
 * POST /api/proposta/pdf
 *
 * Recebe APENAS as entradas da simulação. O servidor:
 *   1. exige sessão válida (e senha já trocada);
 *   2. valida as entradas com o mesmo schema Zod do formulário;
 *   3. impõe as regras que o navegador não pode escolher: consultor, data,
 *      validade e — o ponto sensível — o desconto;
 *   4. RECALCULA tudo com a config do banco;
 *   5. registra a proposta (histórico do gestor) e devolve o PDF.
 */

import { NextResponse } from "next/server";

import { calcularSimulacao } from "@/domain/simulator/calculations";
import { formatarMoeda, nomeArquivoProposta } from "@/domain/simulator/format";
import { simulacaoSchema } from "@/domain/simulator/validation";
import { podeEditarDescontoLivremente, podeEscolherConsultor } from "@/domain/auth/types";
import { exigirSessaoAtiva } from "@/server/auth";
import { carregarConfiguracao } from "@/server/configuracao";
import { registrarEvento } from "@/server/eventos";
import { gerarPdfProposta } from "@/server/pdf";
import { registrarProposta } from "@/server/propostas";
import { listarVendedoresAtivos } from "@/server/usuarios";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";
/** O Chromium leva alguns segundos para subir na primeira chamada. */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { usuario, descontoLiberado } = await exigirSessaoAtiva();

    let corpo: unknown;
    try {
      corpo = await request.json();
    } catch {
      return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
    }

    const parse = simulacaoSchema.safeParse(corpo);
    if (!parse.success) {
      // Devolve só a mensagem e o campo — nunca ecoa os dados pessoais recebidos.
      const problemas = parse.error.issues.map((i) => ({
        campo: i.path.join("."),
        mensagem: i.message,
      }));
      return NextResponse.json(
        { erro: "Dados da simulação inválidos.", problemas },
        { status: 400 },
      );
    }

    const enviada = parse.data;
    const config = await carregarConfiguracao();

    // ---------------------------------------------------------------------
    // Regras que o navegador NÃO escolhe.
    // ---------------------------------------------------------------------

    // Desconto: vendedor só sai do padrão se tiver queimado uma senha de uso
    // único NESTA sessão. Sem isso, o pedido é recusado — não silenciosamente
    // corrigido, para o vendedor não achar que emitiu o que não emitiu.
    if (!podeEditarDescontoLivremente(usuario.papel) && !descontoLiberado) {
      const foraDoPadrao = enviada.unidades.some(
        (u) => Math.abs(u.desconto - config.descontoPadrao) > 1e-9,
      );
      if (foraDoPadrao) {
        return NextResponse.json(
          {
            erro:
              "Desconto diferente do padrão exige a senha de liberação. " +
              "Peça uma senha ao seu gestor.",
          },
          { status: 403 },
        );
      }
    }

    // Consultor: vendedor emite sempre em nome de si mesmo. Admin/gestor podem
    // escolher, mas só entre vendedores que existem de fato.
    let consultor = usuario.nome;
    let vendedorId: number | null = usuario.papel === "vendedor" ? usuario.id : null;

    if (podeEscolherConsultor(usuario.papel)) {
      const vendedores = await listarVendedoresAtivos();
      const escolhido = enviada.cliente.consultor.trim();
      const vendedor = vendedores.find((v) => v.nome === escolhido);

      if (!vendedor && escolhido !== usuario.nome) {
        return NextResponse.json({ erro: "Consultor inválido." }, { status: 400 });
      }

      consultor = escolhido;
      // Se o gestor emitiu em nome de um vendedor, a métrica vai para o vendedor.
      vendedorId = vendedor?.id ?? null;
    }

    // Data e validade vêm do servidor/config, não do formulário.
    const hoje = new Date().toISOString().slice(0, 10);

    const simulacao = {
      ...enviada,
      cliente: {
        ...enviada.cliente,
        consultor,
        dataProposta: hoje,
        validadeDias: config.validadePropostaDias,
      },
    };

    // Recálculo no servidor, com a config do banco — a fonte de verdade do PDF.
    const resultado = calcularSimulacao(simulacao, config);
    const pdf = await gerarPdfProposta(simulacao.cliente, resultado, config);

    // Histórico: guardamos entradas + config (não os bytes do PDF), para o
    // gestor poder reabrir a proposta exatamente como foi emitida.
    const propostaId = await registrarProposta({
      usuarioId: usuario.id,
      vendedorId,
      simulacao,
      resultado,
      configuracao: config,
    });

    await registrarEvento({
      usuarioId: usuario.id,
      tipo: "proposta_gerada",
      descricao:
        `Gerou proposta para ${simulacao.cliente.nome} ` +
        `(economia anual de ${formatarMoeda(resultado.economiaAnual)})`,
      propostaId,
    });

    const arquivo = nomeArquivoProposta(simulacao.cliente.nome, simulacao.cliente.dataProposta);

    return new NextResponse(pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${arquivo}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    return responderErro(erro);
  }
}
