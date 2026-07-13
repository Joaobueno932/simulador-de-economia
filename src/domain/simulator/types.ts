/**
 * Tipos do domínio de simulação.
 *
 * Espelham a aba `Preencher` da planilha original, mas sem o limite de 10 colunas
 * fixas: as UCs são uma lista.
 */

/** Classificação tarifária da unidade consumidora (`Preencher!F3`). */
export type Classificacao = "B1" | "B2" | "B3" | "MT";

/** Tipo de ligação (`Preencher!F4`). */
export type Ligacao = "MONOFASICO" | "BIFASICO" | "TRIFASICO" | "MEDIA_TENSAO";

/** Bandeiras tarifárias (aba `Dados`, I9:K12). */
export type Bandeira = "VERDE" | "AMARELA" | "VERMELHA_P1" | "VERMELHA_P2";

/** Entrada de uma unidade consumidora. */
export interface UnidadeConsumidora {
  /** Identificador estável no cliente (não vai para o cálculo). */
  readonly id: string;
  /** Rótulo exibido, ex.: "UC 01". */
  readonly nome: string;
  readonly classificacao: Classificacao;
  readonly ligacao: Ligacao;
  /** Consumo fora de ponta (MT) ou baixa tensão, em kWh. `Preencher!F5`. */
  readonly consumoForaPonta: number;
  /** Consumo de ponta em kWh — só se aplica a Média Tensão. `Preencher!F6`. */
  readonly consumoPonta: number;
  /** Demanda contratada em kW — só se aplica a Média Tensão. `Preencher!F7`. */
  readonly demandaContratada: number;
  /** Desconto sobre a tarifa do consumo compensável, 0..1 (exclusivo). `Preencher!F18`. */
  readonly desconto: number;
  /**
   * COSIP informada manualmente (R$). Quando `null`, usa-se a tabela da aba `Dados`.
   *
   * Existe porque na planilha `Preencher!F9` é um literal digitado por cima da fórmula:
   * o consultor copia a COSIP real da conta do cliente. Ver DOCUMENTACAO-REGRAS-PLANILHA.md §6.
   */
  readonly cosipOverride: number | null;
  /** Custo por kWh cobrado pelo concorrente (R$/kWh). `Preencher!F28`. Opcional. */
  readonly custoKwhConcorrente: number | null;
}

/** Dados do cliente / proposta. */
export interface DadosCliente {
  readonly nome: string;
  /** Só dígitos — a pontuação é aplicada apenas na formatação. */
  readonly documento: string;
  /** Só dígitos. */
  readonly telefone: string;
  readonly email: string;
  readonly consultor: string;
  /** ISO `yyyy-mm-dd`. */
  readonly dataProposta: string;
  /** Dias de validade da proposta. */
  readonly validadeDias: number;
}

/** Custos evitados por bandeira, em R$/mês (`Preencher!F32:F34`). */
export interface CustosBandeiras {
  readonly verde: number;
  readonly amarela: number;
  readonly vermelhaP1: number;
  readonly vermelhaP2: number;
}

/** Resultado do cálculo de uma UC. Todos os valores em R$/mês, salvo indicação. */
export interface ResultadoUC {
  readonly id: string;
  readonly nome: string;
  readonly classificacao: Classificacao;
  readonly ligacao: Ligacao;

  /** kWh/mês. `Preencher!F17` (com proteção contra negativo). */
  readonly consumoCompensavel: number;
  /** `Preencher!F9` */
  readonly cosip: number;
  /** `true` se a COSIP veio do campo manual em vez da tabela. */
  readonly cosipManual: boolean;
  /** `Preencher!F10` */
  readonly faturamentoMinimo: number;
  /** `Preencher!F11` */
  readonly impostos: number;
  /** `Preencher!F13` */
  readonly custoDemanda: number;
  /** `Preencher!F15` */
  readonly valorResidual: number;
  /** `Preencher!F19` */
  readonly custoSemLocacao: number;
  /** `Preencher!F20` */
  readonly custoComLocacao: number;
  /** `Preencher!F23` */
  readonly faturaSemLocacao: number;
  /** `Preencher!F24` */
  readonly faturaComLocacao: number;
  /** `Preencher!F25` */
  readonly economia: number;
  /** `Preencher!F26` — fração 0..1. */
  readonly economiaPercentualEfetiva: number;
  /** `Preencher!F32:F34` */
  readonly custosBandeiras: CustosBandeiras;
  /** `Preencher!F29` — R$/ano. `null` quando o concorrente não foi informado. */
  readonly economiaConcorrenteAnual: number | null;
  /** `Preencher!F30` — R$/ano. `null` quando o concorrente não foi informado. */
  readonly economiaVsConcorrenteAnual: number | null;
}

/** Projeção de 5 anos por bandeira (`Preencher!C25:C28`). */
export interface ProjecaoCincoAnos {
  readonly verde: number;
  readonly amarela: number;
  readonly vermelhaP1: number;
  readonly vermelhaP2: number;
}

/** Resultado consolidado da simulação. */
export interface ResultadoSimulacao {
  readonly unidades: readonly ResultadoUC[];

  /** `Preencher!C9` */
  readonly quantidadeUCs: number;
  /** `Preencher!C8` — kWh/ano. */
  readonly consumoAnual: number;
  /** `Preencher!C10` — kWh/mês. */
  readonly consumoMedioMensal: number;
  /** `Preencher!C11` — kWh/mês. */
  readonly consumoCompensavelMensal: number;

  /** `Preencher!C14` — "Conta de Luz Atual". */
  readonly faturaAtual: number;
  /** `Preencher!C41` — "Conta de Luz com Locação". */
  readonly faturaComEmConta: number;
  /** `Preencher!C19` */
  readonly valorPagoDistribuidora: number;
  /** `Preencher!C18` */
  readonly valorPagoLocador: number;

  /** `Preencher!C17` */
  readonly economiaMensal: number;
  /** `Preencher!C7` */
  readonly economiaAnual: number;
  /** Fração 0..1 — economia mensal / fatura atual. */
  readonly economiaPercentualEfetiva: number;
  /** Desconto médio ponderado pelo custo sem locação — fração 0..1. */
  readonly descontoMedio: number;

  readonly projecaoCincoAnos: ProjecaoCincoAnos;
  /** Custos de bandeira evitados somados, R$/mês. */
  readonly custosBandeiras: CustosBandeiras;

  /** `Preencher!C34` */
  readonly equivalenteKwp: number;
  /** `Preencher!C35` — fração 0..1. */
  readonly percentualPotenciaUsina: number;

  /** `Preencher!C21` — R$/ano. `null` se nenhuma UC informou concorrente. */
  readonly economiaConcorrenteAnual: number | null;
  /** `Preencher!C22` — R$/ano. `null` se nenhuma UC informou concorrente. */
  readonly economiaVsConcorrenteAnual: number | null;
}

/** Payload completo de uma simulação (entrada do PDF). */
export interface Simulacao {
  readonly cliente: DadosCliente;
  readonly unidades: readonly UnidadeConsumidora[];
}
