/**
 * Motor de cálculo — transcrição das fórmulas da aba `Preencher`.
 *
 * Funções puras, sem dependência de React. Cada função cita a célula de origem.
 *
 * PRECISÃO: o Excel calcula em IEEE-754 double, exatamente como o `number` do
 * JavaScript. Manter `number` reproduz a planilha bit-a-bit; usar decimal.js
 * afastaria o resultado em vez de aproximá-lo. O arredondamento acontece
 * SOMENTE na formatação (`format.ts`).
 */

import { CONFIG, MESES_NO_ANO, type ConfiguracaoSimulador } from "./config";
import {
  calcularCosip,
  consumoMinimo,
  fatorProjecao,
  impostoDaTarifa,
  isMediaTensao,
  tarifaComImposto,
} from "./tariffs";
import type {
  CustosBandeiras,
  ProjecaoCincoAnos,
  ResultadoSimulacao,
  ResultadoUC,
  Simulacao,
  UnidadeConsumidora,
} from "./types";

/**
 * Consumo compensável — `Preencher!F17`.
 *
 * `IFS(MONOFÁSICO; F5-30; BIFÁSICO; F5-50; TRIFÁSICO; F5-100; MÉDIA TENSÃO; F5+F6)`
 *
 * DESVIO INTENCIONAL: a planilha não protege contra negativo — um trifásico com
 * 80 kWh produziria −20 kWh e contaminaria impostos e custos com valores
 * negativos. Aplicamos `max(0, …)`.
 */
export function calcularConsumoCompensavel(
  uc: UnidadeConsumidora,
  config: ConfiguracaoSimulador = CONFIG,
): number {
  const bruto = isMediaTensao(uc.ligacao)
    ? uc.consumoForaPonta + uc.consumoPonta
    : uc.consumoForaPonta - consumoMinimo(uc.ligacao, config);

  return Math.max(0, bruto);
}

/**
 * Faturamento mínimo — `Preencher!F10`.
 *
 * `IFS(MONOFÁSICO; 30*K3; BIFÁSICO; 50*K3; TRIFÁSICO; 100*K3; MÉDIA TENSÃO; 0)`
 *
 * Sempre usa a tarifa de **baixa tensão com imposto**, mesmo o mínimo variando
 * com a ligação. Média tensão não tem faturamento mínimo nesta regra.
 */
export function calcularFaturamentoMinimo(
  uc: UnidadeConsumidora,
  config: ConfiguracaoSimulador = CONFIG,
): number {
  if (isMediaTensao(uc.ligacao)) return 0;
  return consumoMinimo(uc.ligacao, config) * tarifaComImposto(config.tarifas.baixaTensao, config);
}

/**
 * Impostos sobre a parcela compensável — `Preencher!F11`.
 *
 * `F17 * Dados!$L$3` — o delta de imposto da tarifa de **baixa tensão**.
 *
 * ATENÇÃO: a planilha usa `L3` (BT) mesmo quando a UC é média tensão. É
 * incoerente do ponto de vista tarifário, mas é o que produz os números da
 * planilha. Replicado deliberadamente. Ver DOCUMENTACAO-REGRAS-PLANILHA.md §3.
 */
export function calcularImpostos(
  consumoCompensavel: number,
  config: ConfiguracaoSimulador = CONFIG,
): number {
  return consumoCompensavel * impostoDaTarifa(config.tarifas.baixaTensao, config);
}

/**
 * Custo de demanda — `Preencher!F13`.
 *
 * `IF(MÉDIA TENSÃO; F7 * K6; 0)`
 */
export function calcularCustoDemanda(
  uc: UnidadeConsumidora,
  config: ConfiguracaoSimulador = CONFIG,
): number {
  if (!isMediaTensao(uc.ligacao)) return 0;
  return uc.demandaContratada * tarifaComImposto(config.tarifas.demanda, config);
}

/**
 * Custo sem locação — `Preencher!F19`.
 *
 * `IF(MÉDIA TENSÃO; F5*K4 + F6*K5; F17*K3) - F11`
 *
 * Baixa tensão: compensável × tarifa BT c/ imposto − impostos.
 * Média tensão: (fora-ponta × tarifa FP) + (ponta × tarifa P) − impostos.
 */
export function calcularCustoSemLocacao(
  uc: UnidadeConsumidora,
  consumoCompensavel: number,
  impostos: number,
  config: ConfiguracaoSimulador = CONFIG,
): number {
  const bruto = isMediaTensao(uc.ligacao)
    ? uc.consumoForaPonta * tarifaComImposto(config.tarifas.foraPonta, config) +
      uc.consumoPonta * tarifaComImposto(config.tarifas.ponta, config)
    : consumoCompensavel * tarifaComImposto(config.tarifas.baixaTensao, config);

  return bruto - impostos;
}

/** Custos evitados por bandeira — `Preencher!F32:F34` (`compensável × adicional`). */
export function calcularCustosBandeiras(
  consumoCompensavel: number,
  config: ConfiguracaoSimulador = CONFIG,
): CustosBandeiras {
  return {
    verde: consumoCompensavel * config.bandeiras.VERDE,
    amarela: consumoCompensavel * config.bandeiras.AMARELA,
    vermelhaP1: consumoCompensavel * config.bandeiras.VERMELHA_P1,
    vermelhaP2: consumoCompensavel * config.bandeiras.VERMELHA_P2,
  };
}

/** Calcula todos os campos de uma única UC (coluna `F` da planilha). */
export function calcularUC(
  uc: UnidadeConsumidora,
  config: ConfiguracaoSimulador = CONFIG,
): ResultadoUC {
  const consumoCompensavel = calcularConsumoCompensavel(uc, config);

  // F9 — COSIP: tabela por padrão; o consultor pode sobrescrever com o valor
  // real da conta (é o que a planilha faz ao digitar por cima da fórmula).
  const cosipManual = uc.cosipOverride !== null;
  const cosip = cosipManual
    ? (uc.cosipOverride as number)
    : calcularCosip(uc.classificacao, uc.consumoForaPonta, config);

  const faturamentoMinimo = calcularFaturamentoMinimo(uc, config); // F10
  const impostos = calcularImpostos(consumoCompensavel, config); // F11
  const custoDemanda = calcularCustoDemanda(uc, config); // F13

  // F15 = SUM(F9:F13)
  const valorResidual = cosip + faturamentoMinimo + impostos + custoDemanda;

  const custoSemLocacao = calcularCustoSemLocacao(uc, consumoCompensavel, impostos, config); // F19
  const custoComLocacao = custoSemLocacao * (1 - uc.desconto); // F20

  const faturaSemLocacao = valorResidual + custoSemLocacao; // F23
  const faturaComLocacao = valorResidual + custoComLocacao; // F24
  const economia = custoSemLocacao - custoComLocacao; // F25

  // F26 — guarda contra divisão por zero (a planilha usa IFERROR).
  const economiaPercentualEfetiva = faturaSemLocacao === 0 ? 0 : economia / faturaSemLocacao;

  // F29 / F30 — só existem quando o concorrente foi informado.
  // (Na planilha, o campo vazio vira 0 e gera uma "economia do concorrente"
  //  fictícia; aqui o bloco simplesmente não se aplica.)
  let economiaConcorrenteAnual: number | null = null;
  let economiaVsConcorrenteAnual: number | null = null;
  if (uc.custoKwhConcorrente !== null) {
    const tarifaBase = config.tarifas.baixaTensao.semImposto; // Dados!J3
    economiaConcorrenteAnual =
      (tarifaBase - uc.custoKwhConcorrente) * consumoCompensavel * MESES_NO_ANO;
    economiaVsConcorrenteAnual = economia * MESES_NO_ANO - economiaConcorrenteAnual;
  }

  return {
    id: uc.id,
    nome: uc.nome,
    classificacao: uc.classificacao,
    ligacao: uc.ligacao,
    consumoCompensavel,
    cosip,
    cosipManual,
    faturamentoMinimo,
    impostos,
    custoDemanda,
    valorResidual,
    custoSemLocacao,
    custoComLocacao,
    faturaSemLocacao,
    faturaComLocacao,
    economia,
    economiaPercentualEfetiva,
    custosBandeiras: calcularCustosBandeiras(consumoCompensavel, config),
    economiaConcorrenteAnual,
    economiaVsConcorrenteAnual,
  };
}

/**
 * Projeção de 5 anos — `Preencher!C25:C28`.
 *
 * Verde   = economiaMensal × 12 × fator
 * Amarela = Verde + bandeiraAmarela × 12 × fator     (as bandeiras SOMAM à verde)
 * ...com fator = 1 + 1,05 + 1,05² + 1,05³ + 1,05⁴ = 5,52563125
 */
export function calcularProjecaoCincoAnos(
  economiaMensal: number,
  bandeiras: CustosBandeiras,
  config: ConfiguracaoSimulador = CONFIG,
): ProjecaoCincoAnos {
  const fator = fatorProjecao(config);
  const base = economiaMensal * MESES_NO_ANO * fator;
  const anualizar = (v: number) => v * MESES_NO_ANO * fator;

  return {
    verde: base + anualizar(bandeiras.verde),
    amarela: base + anualizar(bandeiras.amarela),
    vermelhaP1: base + anualizar(bandeiras.vermelhaP1),
    vermelhaP2: base + anualizar(bandeiras.vermelhaP2),
  };
}

const somar = (valores: readonly number[]): number => valores.reduce((a, b) => a + b, 0);

/** Consolida a simulação inteira (coluna `C` da planilha). */
export function calcularSimulacao(
  simulacao: Simulacao,
  config: ConfiguracaoSimulador = CONFIG,
): ResultadoSimulacao {
  const unidades = simulacao.unidades.map((uc) => calcularUC(uc, config));

  const quantidadeUCs = unidades.length; // C9
  const consumoMedioMensal = somar(simulacao.unidades.map((u) => u.consumoForaPonta)); // C10
  const consumoAnual = consumoMedioMensal * MESES_NO_ANO; // C8
  const consumoCompensavelMensal = somar(unidades.map((u) => u.consumoCompensavel)); // C11

  const valorPagoDistribuidora = somar(unidades.map((u) => u.valorResidual)); // C19
  const valorPagoLocador = somar(unidades.map((u) => u.custoComLocacao)); // C18
  const custoSemLocacaoTotal = somar(unidades.map((u) => u.custoSemLocacao));

  const faturaAtual = valorPagoDistribuidora + custoSemLocacaoTotal; // C14
  const faturaComEmConta = somar(unidades.map((u) => u.faturaComLocacao)); // C41

  const economiaMensal = somar(unidades.map((u) => u.economia)); // C17
  const economiaAnual = economiaMensal * MESES_NO_ANO; // C7
  const economiaPercentualEfetiva = faturaAtual === 0 ? 0 : economiaMensal / faturaAtual;

  // Desconto médio ponderado pelo custo sem locação: com uma única UC devolve
  // exatamente o desconto dela.
  const descontoMedio =
    custoSemLocacaoTotal === 0
      ? 0
      : somar(simulacao.unidades.map((u, i) => u.desconto * unidades[i].custoSemLocacao)) /
        custoSemLocacaoTotal;

  const custosBandeiras: CustosBandeiras = {
    verde: somar(unidades.map((u) => u.custosBandeiras.verde)),
    amarela: somar(unidades.map((u) => u.custosBandeiras.amarela)),
    vermelhaP1: somar(unidades.map((u) => u.custosBandeiras.vermelhaP1)),
    vermelhaP2: somar(unidades.map((u) => u.custosBandeiras.vermelhaP2)),
  };

  // C35 e C34
  const percentualPotenciaUsina =
    consumoCompensavelMensal / config.usina.capacidadeReferenciaKwhMes;
  const equivalenteKwp = config.usina.potenciaReferenciaKwp * percentualPotenciaUsina;

  // C21 / C22 — só se ao menos uma UC informou o concorrente.
  const comConcorrente = unidades.filter((u) => u.economiaConcorrenteAnual !== null);
  const economiaConcorrenteAnual =
    comConcorrente.length === 0
      ? null
      : somar(comConcorrente.map((u) => u.economiaConcorrenteAnual as number));
  const economiaVsConcorrenteAnual =
    comConcorrente.length === 0
      ? null
      : somar(comConcorrente.map((u) => u.economiaVsConcorrenteAnual as number));

  return {
    unidades,
    quantidadeUCs,
    consumoAnual,
    consumoMedioMensal,
    consumoCompensavelMensal,
    faturaAtual,
    faturaComEmConta,
    valorPagoDistribuidora,
    valorPagoLocador,
    economiaMensal,
    economiaAnual,
    economiaPercentualEfetiva,
    descontoMedio,
    projecaoCincoAnos: calcularProjecaoCincoAnos(economiaMensal, custosBandeiras, config),
    custosBandeiras,
    equivalenteKwp,
    percentualPotenciaUsina,
    economiaConcorrenteAnual,
    economiaVsConcorrenteAnual,
  };
}
