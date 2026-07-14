"use client";

/**
 * "Onde encontro isso na fatura?"
 *
 * Uma lupinha ao lado do rótulo abre a imagem de uma conta de luz com o campo
 * destacado. É o que tira a dúvida do vendedor em campo sem ele ter que ligar
 * para alguém.
 *
 * As imagens são faturas ANONIMIZADAS (sem nome, sem código de cliente, valores
 * zerados) com o campo em questão marcado em verde. Ficam em
 * `public/instrucoes/` — servidas como arquivo estático, não embutidas no
 * bundle.
 */

import { Search, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";

export type CampoAjuda = "ligacao" | "consumo" | "cosip";

interface Instrucao {
  readonly titulo: string;
  readonly imagem: string;
  /** O que procurar, em uma frase. Serve também de alternativa à imagem. */
  readonly onde: string;
  readonly dica?: string;
}

const INSTRUCOES: Readonly<Record<CampoAjuda, Instrucao>> = {
  ligacao: {
    titulo: "Tipo de ligação",
    imagem: "/instrucoes/tipo-de-ligacao.png",
    onde:
      'No alto da fatura, no campo "Tipo de Fornecimento" — pode aparecer como ' +
      "MONOFÁSICO, BIFÁSICO ou TRIFÁSICO.",
    dica: 'Ao lado dele fica a "Classificação" (B1, B2, B3), que é o outro campo do formulário.',
  },
  consumo: {
    titulo: "Consumo mensal",
    imagem: "/instrucoes/consumo-mensal.png",
    onde:
      'No quadro "CONSUMO FATURADO", use a linha "MÉDIA" — é a média dos últimos ' +
      "12 meses, em kWh.",
    dica: "A média representa melhor o ano inteiro do que o consumo de um mês isolado.",
  },
  cosip: {
    titulo: "COSIP da conta",
    imagem: "/instrucoes/cosip.png",
    onde:
      'Em "ITENS DA FATURA", na linha da contribuição de iluminação pública — costuma ' +
      'vir como "CONT. IL. PUB" ou "CIP/COSIP". Use o valor em R$.',
    dica: "Campo opcional: sem ele, o sistema calcula a COSIP pela tabela da distribuidora.",
  },
};

export function AjudaFatura({ campo }: { campo: CampoAjuda }) {
  const [aberto, setAberto] = useState(false);
  const instrucao = INSTRUCOES[campo];

  // Esc fecha.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Onde encontrar "${instrucao.titulo}" na fatura`}
        title="Onde encontro isso na fatura?"
        className="grid size-5 shrink-0 place-items-center rounded-md text-marca-azul transition-colors hover:bg-marca-azul-suave"
      >
        <Search aria-hidden="true" className="size-3.5" />
      </button>

      {aberto ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-marca-texto/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`ajuda-${campo}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAberto(false);
          }}
        >
          <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-marca-borda bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-marca-borda p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-azul-suave text-marca-azul">
                  <ZoomIn aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h2 id={`ajuda-${campo}`} className="font-bold text-marca-texto">
                    {instrucao.titulo}
                  </h2>
                  <p className="mt-0.5 text-sm text-marca-texto-suave">
                    Onde encontrar na fatura do cliente
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-marca-texto-suave hover:bg-slate-100"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              <p className="mb-4 rounded-xl bg-marca-verde-suave px-3.5 py-2.5 text-sm font-medium text-marca-texto">
                {instrucao.onde}
              </p>

              {/* A imagem tem `alt` descritivo: quem não conseguir vê-la ainda
                  sabe o que procurar. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={instrucao.imagem}
                alt={`Fatura de energia com o campo "${instrucao.titulo}" destacado em verde. ${instrucao.onde}`}
                className="w-full rounded-xl border border-marca-borda"
              />

              {instrucao.dica ? (
                <p className="mt-3 text-xs text-marca-texto-suave">{instrucao.dica}</p>
              ) : null}

              <p className="mt-3 text-xs text-marca-texto-suave">
                Imagem ilustrativa. O leiaute pode variar conforme a distribuidora.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
