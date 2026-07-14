"use client";

/**
 * Etapa 3 — Resultado.
 *
 * Espelha a composição da fatura do `chart1` da planilha: a barra "com Em Conta"
 * tem o MESMO total da fatura atual, decomposta em Distribuidora + Locação +
 * Economia. É isso que faz a economia aparecer como a fatia poupada.
 */

import { Eye, EyeOff, Leaf, PiggyBank, Receipt, TrendingDown, Users, Zap } from "lucide-react";
import { useState } from "react";

import { Card, Mascote, SectionTitle } from "./ui";
import { CONFIG, type ConfiguracaoSimulador } from "@/domain/simulator/config";
import {
  formatarDecimal,
  formatarKwh,
  formatarMoeda,
  formatarPercentual,
} from "@/domain/simulator/format";
import type { ResultadoSimulacao } from "@/domain/simulator/types";

function Metrica({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-marca-texto-suave">{rotulo}</dt>
      <dd
        className={`text-right font-semibold tabular-nums ${
          destaque ? "text-marca-verde" : "text-marca-texto"
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}

function CardDestaque({
  rotulo,
  valor,
  icone,
  tom,
  nota,
}: {
  rotulo: string;
  valor: string;
  icone: React.ReactNode;
  tom: "azul" | "verde" | "amarelo" | "laranja";
  nota?: string;
}) {
  const tons = {
    azul: "border-marca-azul/20 bg-marca-azul-suave text-marca-azul",
    verde: "border-marca-verde/25 bg-marca-verde-suave text-marca-verde-escuro",
    amarelo: "border-marca-amarelo/50 bg-marca-amarelo-suave text-marca-texto",
    laranja: "border-marca-laranja/30 bg-marca-laranja-suave text-marca-laranja",
  } as const;

  return (
    <div className={`rounded-card border p-4 ${tons[tom]}`}>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
        {icone}
        {rotulo}
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-marca-texto">{valor}</p>
      {nota ? <p className="mt-1 text-xs text-marca-texto-suave">{nota}</p> : null}
    </div>
  );
}

/**
 * Economia efetiva — métrica interna, escondida do cliente.
 *
 * O card NÃO existe enquanto está fechado: nem título, nem rótulo, nem espaço
 * reservado. Em atendimento presencial o cliente lê a tela junto com o vendedor;
 * qualquer texto do tipo "Economia efetiva — Mostrar" viraria um convite a
 * "mostra aí". Então, fechado, sobra apenas um ícone cinza e mudo, sem legenda,
 * que o vendedor sabe onde fica e o cliente não tem como interpretar.
 *
 * O valor só é renderizado quando aberto — não fica escondido por CSS, onde
 * bastaria inspecionar a página (ou um Ctrl+F) para achá-lo.
 */
function EconomiaEfetivaOculta({ r }: { r: ResultadoSimulacao }) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        // aria-label existe para o teclado/leitor de tela do vendedor. Não
        // aparece na tela, então não entrega nada ao cliente que está do lado.
        aria-label="Mostrar indicador interno"
        title="Indicador interno"
        className="grid size-7 place-items-center rounded-lg text-marca-borda transition-colors hover:bg-slate-100 hover:text-marca-texto-suave"
      >
        <Eye aria-hidden="true" className="size-4" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-marca-borda bg-slate-50 px-2.5 py-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-marca-texto-suave">
        Economia efetiva
      </span>
      <span className="text-sm font-extrabold tabular-nums text-marca-texto">
        {formatarPercentual(r.economiaPercentualEfetiva)}
      </span>
      <button
        type="button"
        onClick={() => setAberto(false)}
        aria-label="Ocultar indicador interno"
        className="grid size-6 place-items-center rounded text-marca-texto-suave hover:bg-slate-200"
      >
        <EyeOff aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

/** Barra empilhada — a composição da fatura (chart1 da planilha). */
function ComposicaoFatura({
  r,
  config,
}: {
  r: ResultadoSimulacao;
  config: ConfiguracaoSimulador;
}) {
  const total = r.faturaAtual;
  if (total <= 0) return null;

  const pct = (v: number) => `${(v / total) * 100}%`;

  const partes = [
    {
      chave: "distribuidora",
      rotulo: `Fatura ${config.institucional.distribuidora}`,
      nota: "Taxa mínima + impostos + COSIP",
      valor: r.valorPagoDistribuidora,
      cor: "bg-marca-azul",
      texto: "text-marca-azul",
    },
    {
      chave: "locador",
      rotulo: "Fatura Em Conta",
      nota: "Energia compensada com desconto",
      valor: r.valorPagoLocador,
      cor: "bg-marca-laranja",
      texto: "text-marca-laranja",
    },
    {
      chave: "economia",
      rotulo: "Sua economia",
      nota: "O que deixa de sair do seu bolso",
      valor: r.economiaMensal,
      cor: "bg-marca-verde",
      texto: "text-marca-verde-escuro",
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-marca-texto-suave">
            Fatura atual
          </p>
          <p className="text-xl font-extrabold tabular-nums text-marca-azul">
            {formatarMoeda(r.faturaAtual)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-marca-texto-suave">
            Fatura com Em Conta
          </p>
          <p className="text-xl font-extrabold tabular-nums text-marca-verde">
            {formatarMoeda(r.faturaComEmConta)}
          </p>
        </div>
      </div>

      {/* A barra soma exatamente a fatura atual: os dois primeiros blocos são o
          que o cliente continua pagando; o terceiro é o que ele deixa de pagar. */}
      <div
        className="flex h-9 w-full overflow-hidden rounded-lg"
        role="img"
        aria-label={`Composição da fatura de ${formatarMoeda(total)}: ${partes
          .map((p) => `${p.rotulo}, ${formatarMoeda(p.valor)}`)
          .join("; ")}.`}
      >
        {partes.map((p) =>
          p.valor > 0 ? (
            <div key={p.chave} className={p.cor} style={{ width: pct(p.valor) }} />
          ) : null,
        )}
      </div>

      <dl className="mt-4 space-y-3">
        {partes.map((p) => (
          <div key={p.chave} className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded-sm ${p.cor}`} />
              <div>
                <dt className={`text-sm font-semibold ${p.texto}`}>{p.rotulo}</dt>
                <p className="text-xs text-marca-texto-suave">{p.nota}</p>
              </div>
            </div>
            <dd className="shrink-0 text-sm font-bold tabular-nums text-marca-texto">
              {formatarMoeda(p.valor)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Bandeiras({ r }: { r: ResultadoSimulacao }) {
  const linhas = [
    { rotulo: "Bandeira verde", valor: r.projecaoCincoAnos.verde, cor: "bg-marca-verde" },
    { rotulo: "Bandeira amarela", valor: r.projecaoCincoAnos.amarela, cor: "bg-marca-amarelo" },
    { rotulo: "Vermelha patamar I", valor: r.projecaoCincoAnos.vermelhaP1, cor: "bg-marca-laranja" },
    { rotulo: "Vermelha patamar II", valor: r.projecaoCincoAnos.vermelhaP2, cor: "bg-red-600" },
  ];
  const maximo = Math.max(...linhas.map((l) => l.valor), 1);

  return (
    <div className="space-y-3">
      {linhas.map((l) => (
        <div key={l.rotulo}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm text-marca-texto">{l.rotulo}</span>
            <span className="text-sm font-bold tabular-nums text-marca-texto">
              {formatarMoeda(l.valor)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-marca-borda">
            <div
              className={`h-full rounded-full ${l.cor}`}
              style={{ width: `${(l.valor / maximo) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EtapaResultado({
  r,
  config = CONFIG,
}: {
  r: ResultadoSimulacao;
  config?: ConfiguracaoSimulador;
}) {
  const temEconomia = r.economiaMensal > 0;

  return (
    <div className="space-y-4">
      {/* Faixa de destaque com o mascote comemorando quando há economia. */}
      <div className="relative overflow-hidden rounded-card bg-marca-azul px-5 py-6 text-white sm:px-8">
        <div className="relative z-10 max-w-[calc(100%-6rem)] sm:max-w-[calc(100%-9rem)]">
          <p className="text-sm font-semibold uppercase tracking-wide text-white/80">
            {temEconomia ? "Você vai economizar" : "Resultado da simulação"}
          </p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums sm:text-5xl">
            {formatarMoeda(r.economiaAnual)}
          </p>
          <p className="mt-1 text-sm text-white/80">
            por ano — {formatarMoeda(r.economiaMensal)} por mês, com{" "}
            {formatarPercentual(r.descontoMedio, 1)} de desconto sobre a tarifa compensável.
          </p>
        </div>
        <Mascote
          variante={temEconomia ? "feliz" : "confiante"}
          className="pointer-events-none absolute -bottom-2 right-2 h-28 w-auto sm:h-40"
        />
      </div>

      {/* Cards de destaque */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CardDestaque
          rotulo="Economia mensal"
          valor={formatarMoeda(r.economiaMensal)}
          icone={<PiggyBank aria-hidden="true" className="size-4" />}
          tom="verde"
        />
        <CardDestaque
          rotulo="Economia anual"
          valor={formatarMoeda(r.economiaAnual)}
          icone={<TrendingDown aria-hidden="true" className="size-4" />}
          tom="verde"
        />
        <CardDestaque
          rotulo="Desconto"
          valor={formatarPercentual(r.descontoMedio, 1)}
          icone={<Leaf aria-hidden="true" className="size-4" />}
          tom="amarelo"
          nota="Sobre a tarifa do consumo compensável"
        />
        <CardDestaque
          rotulo="Fatura atual"
          valor={formatarMoeda(r.faturaAtual)}
          icone={<Receipt aria-hidden="true" className="size-4" />}
          tom="azul"
        />
        <CardDestaque
          rotulo="Fatura com Em Conta"
          valor={formatarMoeda(r.faturaComEmConta)}
          icone={<Receipt aria-hidden="true" className="size-4" />}
          tom="verde"
        />
      </div>

      {/* A economia efetiva NÃO tem card. Fica atrás deste ícone mudo — ver
          `EconomiaEfetivaOculta`. Alinhado à direita, discreto, sem legenda. */}
      <div className="flex justify-end">
        <EconomiaEfetivaOculta r={r} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={<Receipt aria-hidden="true" className="size-5" />}>
            Composição da fatura
          </SectionTitle>
          <ComposicaoFatura r={r} config={config} />
        </Card>

        <Card>
          <SectionTitle
            icon={<TrendingDown aria-hidden="true" className="size-5" />}
            descricao="Custos com bandeiras tarifárias evitados, com reajuste de 5% ao ano."
          >
            Previsão de economia em 5 anos
          </SectionTitle>
          <Bandeiras r={r} />
        </Card>

        <Card>
          <SectionTitle icon={<Users aria-hidden="true" className="size-5" />}>
            Resumo geral
          </SectionTitle>
          <dl className="divide-y divide-marca-borda">
            <Metrica rotulo="Quantidade de UCs" valor={String(r.quantidadeUCs)} />
            <Metrica rotulo="Consumo anual" valor={formatarKwh(r.consumoAnual)} />
            <Metrica rotulo="Consumo médio mensal" valor={formatarKwh(r.consumoMedioMensal)} />
            <Metrica
              rotulo="Consumo compensável mensal"
              valor={formatarKwh(r.consumoCompensavelMensal)}
            />
            <Metrica
              rotulo="Valor pago à distribuidora"
              valor={formatarMoeda(r.valorPagoDistribuidora)}
            />
            <Metrica
              rotulo="Valor pago ao Em Conta"
              valor={formatarMoeda(r.valorPagoLocador)}
            />
            <Metrica
              rotulo="Participação na associação"
              valor={`${formatarDecimal(r.equivalenteKwp)} kWp`}
            />
            <Metrica
              rotulo="Quota-parte da potência da usina"
              valor={formatarPercentual(r.percentualPotenciaUsina)}
            />
          </dl>
        </Card>

        <Card className="flex flex-col justify-center bg-gradient-to-br from-marca-azul-suave to-white">
          <div className="flex items-center gap-4">
            <Mascote variante="fatura-sem-fundo" className="h-28 w-auto shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-marca-texto">Proposta pronta para enviar</h2>
              <p className="mt-1 text-sm text-marca-texto-suave">
                Os números acima já são os da proposta. Gere o PDF e envie ao cliente — ele sai em
                uma página, com a identidade da Em Conta.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detalhamento por UC */}
      <Card>
        <SectionTitle
          icon={<Zap aria-hidden="true" className="size-5" />}
          descricao="Todos os componentes calculados, unidade por unidade."
        >
          Detalhamento por unidade
        </SectionTitle>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">
              Detalhamento dos cálculos de cada unidade consumidora
            </caption>
            <thead>
              <tr className="border-b border-marca-borda text-left">
                {/* A coluna "% efetivo" saiu: é a MESMA métrica que fica atrás do
                    ícone discreto. Deixá-la aqui anulava o esconderijo — o
                    cliente lia o número na tabela. */}
                {[
                  "Unidade",
                  "Compensável",
                  "COSIP",
                  "Fat. mínimo",
                  "Impostos",
                  "Demanda",
                  "Residual",
                  "Custo s/ locação",
                  "Custo c/ locação",
                  "Fatura atual",
                  "Fatura Em Conta",
                  "Economia",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-xs font-bold uppercase tracking-wide text-marca-texto-suave"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.unidades.map((u) => (
                <tr key={u.id} className="border-b border-marca-borda/60">
                  <th scope="row" className="whitespace-nowrap px-2 py-2 text-left font-semibold">
                    {u.nome}
                    <span className="ml-1 font-normal text-marca-texto-suave">
                      ({u.classificacao})
                    </span>
                  </th>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarKwh(u.consumoCompensavel)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.cosip)}
                    {u.cosipManual ? (
                      <span
                        className="ml-1 text-xs text-marca-laranja"
                        title="Valor informado manualmente, sobrescrevendo a tabela"
                      >
                        *
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.faturamentoMinimo)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.impostos)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.custoDemanda)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.valorResidual)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.custoSemLocacao)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.custoComLocacao)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.faturaSemLocacao)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {formatarMoeda(u.faturaComLocacao)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-semibold tabular-nums text-marca-verde-escuro">
                    {formatarMoeda(u.economia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {r.unidades.some((u) => u.cosipManual) ? (
          <p className="mt-3 text-xs text-marca-texto-suave">
            <span className="text-marca-laranja">*</span> COSIP informada manualmente a partir da
            conta do cliente, no lugar do valor da tabela.
          </p>
        ) : null}

        {/* Custos de bandeira evitados, por UC (mensal). */}
        <h3 className="mt-6 mb-3 text-sm font-bold uppercase tracking-wide text-marca-texto-suave">
          Custos com bandeiras tarifárias evitados (por mês)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <caption className="sr-only">
              Custos mensais de bandeira tarifária evitados por unidade
            </caption>
            <thead>
              <tr className="border-b border-marca-borda text-left">
                {["Unidade", "Verde", "Amarela", "Vermelha P1", "Vermelha P2"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap px-2 py-2 text-xs font-bold uppercase tracking-wide text-marca-texto-suave"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.unidades.map((u) => (
                <tr key={u.id} className="border-b border-marca-borda/60">
                  <th scope="row" className="whitespace-nowrap px-2 py-2 text-left font-semibold">
                    {u.nome}
                  </th>
                  <td className="px-2 py-2 tabular-nums">
                    {formatarMoeda(u.custosBandeiras.verde)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {formatarMoeda(u.custosBandeiras.amarela)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {formatarMoeda(u.custosBandeiras.vermelhaP1)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {formatarMoeda(u.custosBandeiras.vermelhaP2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
