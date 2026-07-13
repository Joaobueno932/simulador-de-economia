"use client";

/**
 * Pré-visualização da proposta.
 *
 * Lê o rascunho do navegador e renderiza EXATAMENTE o mesmo componente que a
 * rota de PDF usa no servidor. O que se vê aqui é o que sai no PDF.
 */

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

import { Proposta } from "@/components/Proposta";
import { useSimulacao } from "@/components/useSimulacao";

export default function PreviewPage() {
  const { simulacao, resultado, rascunhoCarregado } = useSimulacao();

  if (!rascunhoCarregado) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-marca-texto-suave">
        Carregando proposta…
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-marca-fundo py-6">
      {/* Barra de ações — não sai na impressão. */}
      <div className="nao-imprimir mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-marca-borda bg-white px-4 py-2.5 text-sm font-semibold text-marca-texto hover:bg-marca-azul-suave"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar ao simulador
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-marca-azul px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-azul-escuro"
        >
          <Printer aria-hidden="true" className="size-4" />
          Imprimir
        </button>
      </div>

      {/* A folha A4. `origin-top` + scale mantém a proporção em telas estreitas. */}
      <div className="flex justify-center overflow-x-auto px-4">
        <div className="shadow-lg print:shadow-none">
          <Proposta cliente={simulacao.cliente} r={resultado} />
        </div>
      </div>
    </div>
  );
}
