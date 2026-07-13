/**
 * Configurações.
 *
 * Sem banco e sem autenticação (não foram pedidos e não há necessidade real):
 * a fonte de verdade é `src/domain/simulator/config.ts`, um único objeto tipado.
 * Esta tela mostra, em leitura, TUDO que alimenta as fórmulas — para conferência
 * rápida — e diz exatamente onde alterar. Nada aqui é botão decorativo.
 */

import { ArrowLeft, FileCog } from "lucide-react";
import Link from "next/link";

import { Card, Mascote, SectionTitle } from "@/components/ui";
import { CONFIG } from "@/domain/simulator/config";
import {
  formatarData,
  formatarDecimal,
  formatarMoeda,
  formatarPercentual,
} from "@/domain/simulator/format";
import { impostoDaTarifa, tarifaComImposto } from "@/domain/simulator/tariffs";
import type { Tarifa } from "@/domain/simulator/config";

export const metadata = {
  title: "Configurações | Simulador Em Conta",
};

const TARIFAS: readonly { chave: string; rotulo: string; unidade: string; tarifa: Tarifa }[] = [
  { chave: "bt", rotulo: "Baixa tensão", unidade: "R$/kWh", tarifa: CONFIG.tarifas.baixaTensao },
  { chave: "fp", rotulo: "Fora ponta", unidade: "R$/kWh", tarifa: CONFIG.tarifas.foraPonta },
  { chave: "p", rotulo: "Ponta", unidade: "R$/kWh", tarifa: CONFIG.tarifas.ponta },
  { chave: "d", rotulo: "Demanda", unidade: "R$/kW", tarifa: CONFIG.tarifas.demanda },
];

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-marca-borda py-2 last:border-0">
      <dt className="text-sm text-marca-texto-suave">{rotulo}</dt>
      <dd className="text-sm font-bold tabular-nums text-marca-texto">{valor}</dd>
    </div>
  );
}

function TabelaCosip({
  titulo,
  descricao,
  faixas,
}: {
  titulo: string;
  descricao: string;
  faixas: readonly { minimo: number; maximo: number; valor: number }[];
}) {
  return (
    <Card>
      <SectionTitle descricao={descricao}>{titulo}</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-marca-borda text-left">
              <th
                scope="col"
                className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-marca-texto-suave"
              >
                Faixa de consumo
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-marca-texto-suave"
              >
                COSIP
              </th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f) => (
              <tr key={f.maximo} className="border-b border-marca-borda/60">
                <td className="px-2 py-1.5 tabular-nums">
                  {f.minimo} – {f.maximo === 99999 ? "acima" : f.maximo} kWh
                </td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                  {formatarMoeda(f.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function ConfiguracoesPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-marca-borda bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-marca-borda px-3 py-2 text-sm font-semibold text-marca-texto hover:bg-marca-azul-suave"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar
          </Link>
          <h1 className="text-lg font-bold text-marca-azul">Configurações</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {/* Onde editar — a tela é honesta sobre o que faz. */}
        <div className="flex flex-col gap-4 rounded-card border border-marca-amarelo/50 bg-marca-amarelo-suave p-5 sm:flex-row sm:items-center">
          <Mascote variante="suporte-sem-fundo" className="h-20 w-auto shrink-0" />
          <div>
            <h2 className="flex items-center gap-2 font-bold text-marca-texto">
              <FileCog aria-hidden="true" className="size-5" />
              Como alterar estes valores
            </h2>
            <p className="mt-1 text-sm text-marca-texto">
              Todos os parâmetros abaixo vivem em um único arquivo tipado:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                src/domain/simulator/config.ts
              </code>
              . Edite lá e o simulador, os testes e o PDF passam a usar os novos
              valores automaticamente — não há número solto espalhado pelo código.
            </p>
            <p className="mt-2 text-sm text-marca-texto">
              Esta tela é somente leitura de propósito: sem banco de dados e sem
              login, um formulário editável aqui daria a falsa impressão de que a
              mudança fica salva para todo mundo.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle descricao={`Vigentes desde ${formatarData(CONFIG.vigenciaTarifas)}.`}>
              Tarifas
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-marca-borda text-left">
                    {["Tarifa", "Sem imposto", "PIS/COFINS", "Com imposto", "Impostos"].map((h) => (
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
                  {TARIFAS.map((t) => (
                    <tr key={t.chave} className="border-b border-marca-borda/60">
                      <th scope="row" className="px-2 py-2 text-left font-semibold">
                        {t.rotulo}
                        <span className="ml-1 font-normal text-marca-texto-suave">{t.unidade}</span>
                      </th>
                      <td className="px-2 py-2 tabular-nums">{t.tarifa.semImposto.toFixed(5)}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {formatarPercentual(t.tarifa.pisCofins)}
                      </td>
                      <td className="px-2 py-2 font-semibold tabular-nums">
                        {tarifaComImposto(t.tarifa).toFixed(5)}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {impostoDaTarifa(t.tarifa).toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 rounded-lg bg-marca-azul-suave px-3 py-2 text-xs text-marca-texto-suave">
              O PIS/COFINS varia por linha porque é assim na planilha: só a baixa
              tensão recebe 9,25%; fora ponta e ponta levam apenas ICMS; a demanda
              usa 6,08%. Preservado para reproduzir os números da planilha.
            </p>
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionTitle>Impostos</SectionTitle>
              <dl>
                <Linha rotulo="ICMS" valor={formatarPercentual(CONFIG.impostos.icms)} />
                <Linha rotulo="PIS" valor={formatarPercentual(CONFIG.impostos.pis)} />
                <Linha rotulo="COFINS" valor={formatarPercentual(CONFIG.impostos.cofins)} />
                <Linha
                  rotulo="PIS/COFINS da demanda"
                  valor={formatarPercentual(CONFIG.impostos.pisCofinsDemanda)}
                />
              </dl>
            </Card>

            <Card>
              <SectionTitle descricao="Adicional por kWh compensável.">
                Bandeiras tarifárias
              </SectionTitle>
              <dl>
                <Linha rotulo="Verde" valor={`R$ ${CONFIG.bandeiras.VERDE.toFixed(5)}`} />
                <Linha rotulo="Amarela" valor={`R$ ${CONFIG.bandeiras.AMARELA.toFixed(5)}`} />
                <Linha
                  rotulo="Vermelha patamar I"
                  valor={`R$ ${CONFIG.bandeiras.VERMELHA_P1.toFixed(5)}`}
                />
                <Linha
                  rotulo="Vermelha patamar II"
                  valor={`R$ ${CONFIG.bandeiras.VERMELHA_P2.toFixed(5)}`}
                />
              </dl>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle>Usina e projeção</SectionTitle>
            <dl>
              <Linha
                rotulo="Capacidade de referência"
                valor={`${CONFIG.usina.capacidadeReferenciaKwhMes.toLocaleString("pt-BR")} kWh/mês`}
              />
              <Linha
                rotulo="Potência de referência"
                valor={`${formatarDecimal(CONFIG.usina.potenciaReferenciaKwp)} kWp`}
              />
              <Linha
                rotulo="Reajuste anual da projeção"
                valor={formatarPercentual(CONFIG.projecao.reajusteAnual - 1, 0)}
              />
              <Linha rotulo="Anos da projeção" valor={`${CONFIG.projecao.anos} anos`} />
            </dl>
          </Card>

          <Card>
            <SectionTitle>Proposta e contato</SectionTitle>
            <dl>
              <Linha
                rotulo="Desconto padrão"
                valor={formatarPercentual(CONFIG.descontoPadrao, 0)}
              />
              <Linha
                rotulo="Validade da proposta"
                valor={`${CONFIG.validadePropostaDias} dias`}
              />
              <Linha rotulo="Distribuidora" valor={CONFIG.institucional.distribuidora} />
              <Linha rotulo="WhatsApp" valor={CONFIG.institucional.whatsapp} />
            </dl>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <TabelaCosip
            titulo="COSIP — Residencial (B1)"
            descricao="Aplicada às unidades classificadas como B1."
            faixas={CONFIG.cosipResidencial}
          />
          <TabelaCosip
            titulo="COSIP — Demais (B3 e MT)"
            descricao="Aplicada a B3 e MT. B2 (rural) é isenta."
            faixas={CONFIG.cosipDemais}
          />
        </div>

        <Card>
          <SectionTitle>Observações fixas da proposta</SectionTitle>
          <ul className="list-inside list-disc space-y-1 text-sm text-marca-texto">
            {CONFIG.observacoesProposta.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
