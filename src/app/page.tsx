"use client";

/**
 * Simulador — assistente de 3 etapas.
 *
 * Desktop: formulário à esquerda, resumo vivo à direita.
 * Celular: uma etapa por vez, com a barra de navegação fixa embaixo.
 */

import { ArrowLeft, ArrowRight, FileDown, Loader2, RotateCcw, Settings } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EtapaCliente } from "@/components/EtapaCliente";
import { EtapaResultado } from "@/components/EtapaResultado";
import { EtapaUnidades } from "@/components/EtapaUnidades";
import { Botao, Mascote } from "@/components/ui";
import { useSimulacao } from "@/components/useSimulacao";
import { CONFIG } from "@/domain/simulator/config";
import { formatarKwh, formatarMoeda, formatarPercentual } from "@/domain/simulator/format";
import { dadosClienteSchema, simulacaoSchema } from "@/domain/simulator/validation";

const ETAPAS = [
  { id: 1, titulo: "Dados do cliente" },
  { id: 2, titulo: "Unidades consumidoras" },
  { id: 3, titulo: "Resultado" },
] as const;

export default function Page() {
  const {
    simulacao,
    resultado,
    rascunhoCarregado,
    atualizarCliente,
    atualizarUC,
    adicionarUC,
    duplicarUC,
    removerUC,
    limpar,
  } = useSimulacao();

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  const clienteValido = dadosClienteSchema.safeParse(simulacao.cliente).success;
  const simulacaoValida = simulacaoSchema.safeParse(simulacao).success;

  const podeAvancar = etapa === 1 ? clienteValido : etapa === 2 ? simulacaoValida : false;

  function avancar() {
    if (!podeAvancar) {
      setTentouAvancar(true);
      return;
    }
    setTentouAvancar(false);
    setEtapa((e) => (e === 1 ? 2 : 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function voltar() {
    setTentouAvancar(false);
    setEtapa((e) => (e === 3 ? 2 : 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Envia só as ENTRADAS: o servidor revalida e recalcula tudo do zero. */
  async function gerarPdf() {
    setGerando(true);
    setErroPdf(null);
    try {
      const resposta = await fetch("/api/proposta/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(simulacao),
      });

      if (!resposta.ok) {
        const detalhe = (await resposta.json().catch(() => null)) as { erro?: string } | null;
        throw new Error(detalhe?.erro ?? "Não foi possível gerar o PDF.");
      }

      const blob = await resposta.blob();
      const nome =
        resposta.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "proposta-em-conta.pdf";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErroPdf(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  const resumo = useMemo(
    () => [
      { rotulo: "Unidades", valor: String(resultado.quantidadeUCs) },
      { rotulo: "Consumo médio", valor: formatarKwh(resultado.consumoMedioMensal) },
      { rotulo: "Compensável", valor: formatarKwh(resultado.consumoCompensavelMensal) },
      { rotulo: "Fatura atual", valor: formatarMoeda(resultado.faturaAtual) },
      { rotulo: "Com Em Conta", valor: formatarMoeda(resultado.faturaComEmConta) },
      { rotulo: "Desconto", valor: formatarPercentual(resultado.descontoMedio, 1) },
    ],
    [resultado],
  );

  // Evita piscar o formulário vazio antes de restaurar o rascunho.
  if (!rascunhoCarregado) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <p className="flex items-center gap-2 text-marca-texto-suave">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          Carregando simulador…
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh pb-28 lg:pb-0">
      {/* Cabeçalho */}
      <header className="border-b border-marca-borda bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo-em-conta.png" alt="Em Conta — Energia Renovável" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-tight text-marca-azul">
                Simulador de Economia
              </p>
              <p className="text-xs text-marca-texto-suave">Agentes de Energia</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/configuracoes"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-marca-borda px-3 py-2 text-sm font-semibold text-marca-texto hover:bg-marca-azul-suave"
            >
              <Settings aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Link>
            <Botao variante="sutil" onClick={limpar} title="Recomeçar a simulação">
              <RotateCcw aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Limpar</span>
            </Botao>
          </div>
        </div>
      </header>

      {/* Passos */}
      <nav aria-label="Etapas da simulação" className="border-b border-marca-borda bg-white">
        <ol className="mx-auto flex max-w-7xl gap-1 px-4 sm:gap-2 sm:px-6">
          {ETAPAS.map((e) => {
            const atual = e.id === etapa;
            const concluida = e.id < etapa;
            return (
              <li key={e.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => {
                    // Só deixa pular para trás, ou para frente se as etapas anteriores estiverem válidas.
                    if (e.id < etapa) setEtapa(e.id as 1 | 2 | 3);
                    else if (e.id === 2 && clienteValido) setEtapa(2);
                    else if (e.id === 3 && simulacaoValida) setEtapa(3);
                    else setTentouAvancar(true);
                  }}
                  aria-current={atual ? "step" : undefined}
                  className={`w-full border-b-3 px-1 py-3 text-left transition-colors ${
                    atual
                      ? "border-marca-azul text-marca-azul"
                      : concluida
                        ? "border-marca-verde text-marca-verde-escuro"
                        : "border-transparent text-marca-texto-suave"
                  }`}
                >
                  <span className="block text-xs font-bold uppercase tracking-wide">
                    Etapa {e.id}
                  </span>
                  <span className="block truncate text-sm font-semibold">{e.titulo}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {etapa === 3 ? (
          <>
            <EtapaResultado r={resultado} />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Botao variante="sutil" onClick={voltar}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar às unidades
              </Botao>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <Link
                  href="/proposta/preview"
                  target="_blank"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-marca-borda bg-white px-4 py-2.5 text-sm font-semibold text-marca-texto hover:bg-marca-azul-suave"
                >
                  Pré-visualizar proposta
                </Link>
                <Botao variante="secundario" onClick={gerarPdf} disabled={gerando}>
                  {gerando ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <FileDown aria-hidden="true" className="size-4" />
                  )}
                  {gerando ? "Gerando PDF…" : "Baixar proposta em PDF"}
                </Botao>
              </div>
            </div>

            {erroPdf ? (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {erroPdf}
              </p>
            ) : null}
          </>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              {etapa === 1 ? (
                <EtapaCliente
                  cliente={simulacao.cliente}
                  onChange={atualizarCliente}
                  tentouAvancar={tentouAvancar}
                />
              ) : (
                <EtapaUnidades
                  unidades={simulacao.unidades}
                  resultados={resultado.unidades}
                  onChange={atualizarUC}
                  onAdicionar={adicionarUC}
                  onDuplicar={duplicarUC}
                  onRemover={removerUC}
                  tentouAvancar={tentouAvancar}
                />
              )}

              {/* Navegação no desktop */}
              <div className="mt-6 hidden items-center justify-between lg:flex">
                {etapa === 2 ? (
                  <Botao variante="sutil" onClick={voltar}>
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    Voltar
                  </Botao>
                ) : (
                  <span />
                )}
                <Botao onClick={avancar}>
                  Continuar
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Botao>
              </div>
            </div>

            {/* Resumo vivo — só cabe lado a lado no desktop. */}
            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-4">
                <div className="rounded-card border border-marca-borda bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-marca-texto-suave">
                    Resumo em tempo real
                  </h2>
                  <dl className="divide-y divide-marca-borda">
                    {resumo.map((r) => (
                      <div key={r.rotulo} className="flex items-baseline justify-between gap-2 py-2">
                        <dt className="text-sm text-marca-texto-suave">{r.rotulo}</dt>
                        <dd className="text-sm font-bold tabular-nums text-marca-texto">
                          {r.valor}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 rounded-lg bg-marca-verde-suave p-3 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-marca-verde-escuro">
                      Economia anual
                    </p>
                    <p className="text-2xl font-extrabold tabular-nums text-marca-verde-escuro">
                      {formatarMoeda(resultado.economiaAnual)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-card border border-marca-borda bg-white p-4">
                  <Mascote variante="aceno" className="h-16 w-auto shrink-0" />
                  <p className="text-xs text-marca-texto-suave">
                    {etapa === 1
                      ? "Preencha os dados do cliente. Eles vão para o cabeçalho da proposta."
                      : "Informe o consumo de cada conta de luz. Já estou calculando enquanto você digita."}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Navegação fixa no celular — o botão continuar fica sempre acessível. */}
      {etapa !== 3 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-marca-borda bg-white/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            {etapa === 2 ? (
              <Botao variante="sutil" onClick={voltar} className="shrink-0">
                <ArrowLeft aria-hidden="true" className="size-4" />
                <span className="sr-only">Voltar</span>
              </Botao>
            ) : null}
            <Botao onClick={avancar} className="flex-1">
              Continuar
              <ArrowRight aria-hidden="true" className="size-4" />
            </Botao>
          </div>
          {tentouAvancar && !podeAvancar ? (
            <p role="alert" className="mx-auto mt-2 max-w-7xl text-center text-xs text-red-700">
              Corrija os campos destacados para continuar.
            </p>
          ) : null}
        </div>
      ) : null}

      <footer className="border-t border-marca-borda bg-white px-4 py-6 text-center text-xs text-marca-texto-suave sm:px-6">
        <p>
          {CONFIG.institucional.nomeEmpresa} · Tarifas vigentes desde{" "}
          {CONFIG.vigenciaTarifas.split("-").reverse().join("/")} ·{" "}
          {CONFIG.institucional.whatsapp}
        </p>
      </footer>
    </div>
  );
}
