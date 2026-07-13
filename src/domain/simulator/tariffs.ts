/**
 * Tabelas e tarifas — as consultas puras da aba `Dados`.
 *
 * Separado de `calculations.ts` para que as buscas em tabela possam ser testadas
 * isoladamente (limites de faixa de COSIP, gross-up de impostos, bandeiras).
 */

import { CONFIG, type ConfiguracaoSimulador, type FaixaCosip, type Tarifa } from "./config";
import type { Bandeira, Classificacao, Ligacao } from "./types";

/**
 * Gross-up de imposto: `Dados!K = J / (1 - ICMS) / (1 - PIS_COFINS)`.
 *
 * Corresponde ao LAMBDA `TARIFA_COM_IMPOSTO` da planilha, mas com o PIS/COFINS
 * vindo da própria tarifa — porque a planilha usa alíquotas diferentes por linha.
 */
export function tarifaComImposto(tarifa: Tarifa, config: ConfiguracaoSimulador = CONFIG): number {
  return tarifa.semImposto / (1 - config.impostos.icms) / (1 - tarifa.pisCofins);
}

/**
 * Parcela de imposto embutida na tarifa: `Dados!L = K - J`.
 */
export function impostoDaTarifa(tarifa: Tarifa, config: ConfiguracaoSimulador = CONFIG): number {
  return tarifaComImposto(tarifa, config) - tarifa.semImposto;
}

/**
 * Busca em tabela de COSIP.
 *
 * Reproduz `INDEX(valores; MATCH(TRUE; maximos >= consumo; 0))`: retorna a
 * **primeira** faixa cujo `maximo` é maior ou igual ao consumo. Se o consumo
 * ultrapassar todas as faixas, a planilha devolveria `#N/A` (capturado por
 * `IFERROR` → `"-"`); aqui devolvemos o valor da última faixa, que é o
 * comportamento pretendido (a última faixa vai até 99999).
 */
function buscarFaixa(faixas: readonly FaixaCosip[], consumo: number): number {
  const faixa = faixas.find((f) => f.maximo >= consumo);
  return faixa ? faixa.valor : (faixas[faixas.length - 1]?.valor ?? 0);
}

/**
 * COSIP (contribuição de iluminação pública) — `Preencher!F9`.
 *
 * A busca usa o **consumo BT/fora-ponta bruto**, não o compensável.
 *
 * - `B1` → tabela residencial
 * - `B2` → sempre 0 (fixo na fórmula da planilha)
 * - `B3` / `MT` → tabela "demais"
 */
export function calcularCosip(
  classificacao: Classificacao,
  consumoForaPonta: number,
  config: ConfiguracaoSimulador = CONFIG,
): number {
  switch (classificacao) {
    case "B1":
      return buscarFaixa(config.cosipResidencial, consumoForaPonta);
    case "B2":
      return 0;
    case "B3":
    case "MT":
      return buscarFaixa(config.cosipDemais, consumoForaPonta);
  }
}

/** Adicional da bandeira em R$/kWh (`Dados!K9:K12`). */
export function adicionalBandeira(
  bandeira: Bandeira,
  config: ConfiguracaoSimulador = CONFIG,
): number {
  return config.bandeiras[bandeira];
}

/** Consumo mínimo faturável da ligação, em kWh. */
export function consumoMinimo(ligacao: Ligacao, config: ConfiguracaoSimulador = CONFIG): number {
  return config.consumoMinimo[ligacao];
}

/** `true` quando a ligação é média tensão (habilita ponta e demanda). */
export function isMediaTensao(ligacao: Ligacao): boolean {
  return ligacao === "MEDIA_TENSAO";
}

/**
 * Fator geométrico da projeção: `1 + r + r² + ... + r^(n-1)`.
 *
 * Para r = 1,05 e n = 5 → 5,52563125, exatamente o que as fórmulas
 * `C25:C28` da planilha expandem à mão.
 */
export function fatorProjecao(config: ConfiguracaoSimulador = CONFIG): number {
  const { reajusteAnual, anos } = config.projecao;
  let fator = 0;
  for (let i = 0; i < anos; i += 1) {
    fator += reajusteAnual ** i;
  }
  return fator;
}
