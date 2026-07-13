"use client";

/**
 * Simulador — assistente de 3 etapas.
 *
 * Desktop: formulário à esquerda, resumo vivo à direita.
 * Celular: uma etapa por vez, com a barra de navegação fixa embaixo.
 */

import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileDown,
  Loader2,
  RotateCcw,
  Settings,
  Sun,
} from "lucide-react";
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

  /**
   * Enquanto nenhum consumo foi informado, os totais existem mas não significam
   * nada para o consultor (a "fatura" seria só o faturamento mínimo). Mostrar
   * "—" é mais honesto do que exibir um valor que parece resultado.
   */
  const semConsumo = resultado.consumoMedioMensal === 0;

  const resumo = useMemo(() => {
    const traco = "—";
    return [
      { rotulo: "Unidades", valor: String(resultado.quantidadeUCs) },
      {
        rotulo: "Consumo médio",
        valor: semConsumo ? traco : formatarKwh(resultado.consumoMedioMensal),
      },
      {
        rotulo: "Compensável",
        valor: semConsumo ? traco : formatarKwh(resultado.consumoCompensavelMensal),
      },
      { rotulo: "Fatura atual", valor: semConsumo ? traco : formatarMoeda(resultado.faturaAtual) },
      {
        rotulo: "Com Em Conta",
        valor: semConsumo ? traco : formatarMoeda(resultado.faturaComEmConta),
      },
      {
        rotulo: "Desconto",
        valor: semConsumo ? traco : formatarPercentual(resultado.descontoMedio, 1),
      },
    ];
  }, [resultado, semConsumo]);

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
      <header className="sticky top-0 z-30 border-b border-marca-borda bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo-em-conta.png"
              alt="Em Conta — Energia Renovável"
              className="h-11 w-auto"
            />
            <div className="hidden border-l border-marca-borda pl-3 sm:block">
              <p className="text-sm font-extrabold leading-tight text-marca-texto">
                Simulador de Economia
              </p>
              <p className="text-xs font-medium text-marca-texto-suave">Agentes de Energia</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/configuracoes"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-marca-borda px-3.5 py-2 text-sm font-bold text-marca-texto transition-colors hover:border-marca-azul-claro hover:bg-marca-azul-suave"
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

      {/* ================= HERO =================
          Some na etapa 3 — lá o destaque é a economia, não a apresentação. */}
      {etapa !== 3 ? (
        <section className="relative overflow-hidden bg-gradient-to-br from-marca-azul via-marca-azul to-marca-azul-escuro">
          {/* Textura de energia: raios sutis, sem poluir. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-marca-verde/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-marca-amarelo/15 blur-3xl"
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-marca-amarelo px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-marca-azul-escuro">
                <Sun aria-hidden="true" className="size-3.5" />
                Energia renovável
              </span>

              <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                Reduza o custo,{" "}
                <span className="text-marca-amarelo">amplie o impacto.</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
                Simule quanto o seu cliente economiza gerando a própria energia — e gere a
                proposta comercial em PDF na hora.
              </p>

              <ul className="mt-5 flex flex-wrap gap-2">
                {[
                  "Sem investimento",
                  "Sem obras nem equipamentos",
                  "Sem custo de adesão",
                ].map((v) => (
                  <li
                    key={v}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/20"
                  >
                    <Check aria-hidden="true" className="size-3.5 text-marca-verde-claro" />
                    {v}
                  </li>
                ))}
              </ul>
            </div>

            {/* O mascote aqui é decorativo: a informação já está no texto ao lado. */}
            <Mascote
              variante="heroi"
              className="mx-auto hidden h-56 w-auto drop-shadow-2xl lg:block xl:h-64"
            />
          </div>
        </section>
      ) : null}

      {/* ================= STEPPER =================
          Sobe por cima do hero (-mt-10) — é o que costura as duas faixas. */}
      <nav
        aria-label="Etapas da simulação"
        className={`relative z-10 mx-auto max-w-7xl px-4 sm:px-6 ${
          etapa !== 3 ? "-mt-10" : "pt-6"
        }`}
      >
        <ol className="grid grid-cols-3 gap-2 rounded-2xl border border-marca-borda/70 bg-white p-2 shadow-[0_8px_30px_-12px_rgba(16,42,67,.25)] sm:gap-3 sm:p-3">
          {ETAPAS.map((e) => {
            const atual = e.id === etapa;
            const concluida = e.id < etapa;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    // Só deixa voltar, ou avançar se as etapas anteriores estiverem válidas.
                    if (e.id < etapa) setEtapa(e.id as 1 | 2 | 3);
                    else if (e.id === 2 && clienteValido) setEtapa(2);
                    else if (e.id === 3 && simulacaoValida) setEtapa(3);
                    else setTentouAvancar(true);
                  }}
                  aria-current={atual ? "step" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors sm:px-3 ${
                    atual
                      ? "bg-marca-azul-suave"
                      : concluida
                        ? "hover:bg-marca-verde-suave"
                        : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-extrabold transition-colors sm:size-9 ${
                      atual
                        ? "bg-marca-azul text-white"
                        : concluida
                          ? "bg-marca-verde text-white"
                          : "bg-slate-100 text-marca-texto-suave"
                    }`}
                  >
                    {concluida ? <Check aria-hidden="true" className="size-4" /> : e.id}
                  </span>

                  <span className="min-w-0">
                    <span
                      className={`block text-[10px] font-bold uppercase tracking-wide sm:text-xs ${
                        atual
                          ? "text-marca-azul"
                          : concluida
                            ? "text-marca-verde-escuro"
                            : "text-marca-texto-suave"
                      }`}
                    >
                      Etapa {e.id}
                      {/* O estado não é comunicado só por cor. */}
                      {concluida ? <span className="sr-only"> (concluída)</span> : null}
                    </span>
                    <span
                      className={`hidden truncate text-sm font-bold sm:block ${
                        atual ? "text-marca-texto" : "text-marca-texto-suave"
                      }`}
                    >
                      {e.titulo}
                    </span>
                  </span>
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
              <div className="sticky top-24 space-y-4">
                <div className="overflow-hidden rounded-card border border-marca-borda/70 bg-white shadow-[0_1px_2px_rgba(16,42,67,.04),0_8px_24px_-12px_rgba(16,42,67,.15)]">
                  {/* Topo verde: a economia é a única coisa que o consultor
                      realmente quer ver enquanto digita. */}
                  <div
                    className={`relative overflow-hidden p-5 text-center ${
                      semConsumo
                        ? "bg-gradient-to-br from-slate-500 to-slate-600"
                        : "bg-gradient-to-br from-marca-verde to-marca-verde-escuro"
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-white/10"
                    />
                    <p className="relative text-xs font-bold uppercase tracking-wide text-white/85">
                      Economia anual estimada
                    </p>
                    {semConsumo ? (
                      <p className="relative mt-1.5 text-sm font-medium text-white/90">
                        Informe o consumo da unidade
                        <br />
                        para ver a economia.
                      </p>
                    ) : (
                      <>
                        <p className="relative mt-0.5 text-3xl font-extrabold tabular-nums text-white">
                          {formatarMoeda(resultado.economiaAnual)}
                        </p>
                        <p className="relative mt-1 text-xs font-medium text-white/80">
                          {formatarMoeda(resultado.economiaMensal)} por mês
                        </p>
                      </>
                    )}
                  </div>

                  <div className="p-5">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-marca-texto-suave">
                      Resumo em tempo real
                    </h2>
                    <dl className="divide-y divide-marca-borda">
                      {resumo.map((r) => (
                        <div
                          key={r.rotulo}
                          className="flex items-baseline justify-between gap-2 py-2"
                        >
                          <dt className="text-sm text-marca-texto-suave">{r.rotulo}</dt>
                          <dd className="text-sm font-bold tabular-nums text-marca-texto">
                            {r.valor}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                {/* O mascote orienta o preenchimento — função, não enfeite. */}
                <div className="flex items-center gap-3 rounded-card border border-marca-amarelo/50 bg-marca-amarelo-suave p-4">
                  <Mascote variante="aceno" className="h-20 w-auto shrink-0" />
                  <p className="text-xs font-medium leading-relaxed text-marca-texto">
                    {etapa === 1
                      ? "Preencha os dados do cliente. Eles vão direto para o cabeçalho da proposta."
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

      <footer className="mt-10 bg-marca-azul">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-7 sm:flex-row sm:justify-between sm:px-6">
          <div className="flex items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo-em-conta-branco.png" alt="Em Conta" className="h-9 w-auto" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo-csi-fiems.png"
              alt="CSI — Sistema FIEMS"
              className="h-8 w-auto"
            />
          </div>

          <div className="text-center text-xs text-white/70 sm:text-right">
            <p className="font-semibold text-white">{CONFIG.institucional.whatsapp}</p>
            <p className="mt-0.5">
              Tarifas vigentes desde {CONFIG.vigenciaTarifas.split("-").reverse().join("/")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
