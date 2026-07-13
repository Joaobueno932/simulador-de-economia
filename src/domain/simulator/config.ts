/**
 * Configuração central do simulador.
 *
 * TODOS os números da planilha vivem aqui. Nenhuma fórmula em `calculations.ts`
 * pode conter constante literal de negócio.
 *
 * Origem: aba `Dados` e `Preencher` de
 * "SIMULADOR DE ECONOMIA_Em Conta_ASSOCIAÇÃO- Atualizado (3) (1).xlsx".
 * Ver DOCUMENTACAO-REGRAS-PLANILHA.md.
 */

import type { Bandeira, Ligacao } from "./types";

/** Uma faixa da tabela de COSIP (`Dados!C8:E17` e `Dados!C20:E33`). */
export interface FaixaCosip {
  /** Consumo mínimo da faixa, em kWh (informativo — a busca usa apenas `maximo`). */
  readonly minimo: number;
  /** Consumo máximo da faixa, em kWh. É este valor que a busca compara. */
  readonly maximo: number;
  /** Valor da COSIP/IP em R$. */
  readonly valor: number;
}

/**
 * Uma tarifa da aba `Dados` (I2:L6).
 *
 * `comImposto` é o gross-up: `semImposto / (1 - icms) / (1 - pisCofins)`.
 * `pisCofins` varia por linha na planilha — ver observação em `TARIFAS`.
 */
export interface Tarifa {
  /** R$/kWh (ou R$/kW para demanda), sem impostos. Coluna J. */
  readonly semImposto: number;
  /** Alíquota PIS+COFINS aplicada NESTA linha da planilha. */
  readonly pisCofins: number;
}

export interface ConfiguracaoSimulador {
  /** Data de vigência das tarifas (ISO). */
  readonly vigenciaTarifas: string;

  readonly impostos: {
    /** `Dados` — ICMS usado em todas as linhas de tarifa. */
    readonly icms: number;
    /** `Dados!N3` */
    readonly pis: number;
    /** `Dados!O3` */
    readonly cofins: number;
    /** Nome definido `PIS_COFINS` — usado SOMENTE na tarifa de demanda. */
    readonly pisCofinsDemanda: number;
  };

  readonly tarifas: {
    /** `Dados!I3` — Baixa Tensão (R$/kWh). */
    readonly baixaTensao: Tarifa;
    /** `Dados!I4` — Fora Ponta (R$/kWh). */
    readonly foraPonta: Tarifa;
    /** `Dados!I5` — Ponta (R$/kWh). */
    readonly ponta: Tarifa;
    /** `Dados!I6` — Demanda Fora Ponta (R$/kW). */
    readonly demanda: Tarifa;
  };

  /** `Dados!I9:K12` — adicional por bandeira, R$/kWh. */
  readonly bandeiras: Readonly<Record<Bandeira, number>>;

  /** `Dados!D20:E33` — B1. */
  readonly cosipResidencial: readonly FaixaCosip[];
  /** `Dados!D8:E17` — B3 e MT. */
  readonly cosipDemais: readonly FaixaCosip[];

  /** Consumo mínimo faturável por tipo de ligação, em kWh (`Preencher!F10` / `F17`). */
  readonly consumoMinimo: Readonly<Record<Ligacao, number>>;

  readonly usina: {
    /** `Preencher!C35` — divisor. Capacidade de referência em kWh/mês. */
    readonly capacidadeReferenciaKwhMes: number;
    /** `Preencher!C34` — multiplicador. Potência de referência em kWp. */
    readonly potenciaReferenciaKwp: number;
  };

  readonly projecao: {
    /** `Preencher!C25` — reajuste anual composto (1,05 = 5% a.a.). */
    readonly reajusteAnual: number;
    /** Número de anos da projeção. */
    readonly anos: number;
  };

  /** Desconto padrão sugerido para uma nova UC (fração 0..1). */
  readonly descontoPadrao: number;
  /** Validade padrão da proposta, em dias. */
  readonly validadePropostaDias: number;

  readonly institucional: {
    readonly nomeEmpresa: string;
    readonly distribuidora: string;
    readonly whatsapp: string;
    readonly whatsappLink: string;
    readonly site: string;
  };

  /** Textos obrigatórios do rodapé da proposta. */
  readonly observacoesProposta: readonly string[];
}

export const CONFIG: ConfiguracaoSimulador = {
  vigenciaTarifas: "2026-04-08",

  impostos: {
    icms: 0.17,
    pis: 0.0165,
    cofins: 0.076,
    // A planilha usa 6,08% (nome definido `PIS_COFINS`) SÓ na tarifa de demanda,
    // enquanto as demais usam PIS+COFINS = 9,25%. Divergência preservada.
    pisCofinsDemanda: 0.0608,
  },

  tarifas: {
    // Dados!K3 = J3/(1-17%)/(1-SUM(N3:O3)) -> PIS+COFINS = 9,25%
    baixaTensao: { semImposto: 0.9866, pisCofins: 0.0165 + 0.076 },
    // Dados!K4 = J4/(1-17%)/(1-SUM(N4:O4)); N4:O4 VAZIAS -> só ICMS.
    foraPonta: { semImposto: 0.48504, pisCofins: 0 },
    // Dados!K5 — idem, N5:O5 vazias -> só ICMS.
    ponta: { semImposto: 2.38151, pisCofins: 0 },
    // Dados!K6 = J6/(1-17%)/(1-6,08%) -> literal 6,08%.
    demanda: { semImposto: 35.79, pisCofins: 0.0608 },
  },

  bandeiras: {
    VERDE: 0,
    AMARELA: 0.01885,
    VERMELHA_P1: 0.04463,
    VERMELHA_P2: 0.07877,
  },

  // Dados!C20:E33 — RESIDENCIAL (B1)
  cosipResidencial: [
    { minimo: 0, maximo: 100, valor: 0 },
    { minimo: 101, maximo: 150, valor: 27.627396297284537 },
    { minimo: 151, maximo: 200, valor: 30.697106996982821 },
    { minimo: 201, maximo: 250, valor: 42.975949795775954 },
    { minimo: 251, maximo: 300, valor: 46.04566049547423 },
    { minimo: 301, maximo: 400, valor: 49.115371195172514 },
    { minimo: 401, maximo: 500, valor: 55.254792594569075 },
    { minimo: 501, maximo: 600, valor: 58.324503294267359 },
    { minimo: 601, maximo: 700, valor: 61.394213993965643 },
    { minimo: 701, maximo: 800, valor: 64.463924693663913 },
    { minimo: 801, maximo: 900, valor: 70.60334609306048 },
    { minimo: 901, maximo: 1000, valor: 76.742767492457048 },
    { minimo: 1001, maximo: 1500, valor: 82.882188891853616 },
    { minimo: 1500, maximo: 99999, valor: 92.09 },
  ],

  // Dados!C8:E17 — DEMAIS (B3 e MT)
  cosipDemais: [
    { minimo: 0, maximo: 100, valor: 3.07 },
    { minimo: 101, maximo: 150, valor: 58.32 },
    { minimo: 151, maximo: 200, valor: 85.951899591551907 },
    { minimo: 201, maximo: 400, valor: 138.13698148642268 },
    { minimo: 401, maximo: 600, valor: 159.62495638431068 },
    { minimo: 601, maximo: 800, valor: 174.97350988280206 },
    { minimo: 801, maximo: 1000, valor: 190.32206338129348 },
    { minimo: 1001, maximo: 1500, valor: 208.74032757948319 },
    { minimo: 1501, maximo: 5000, valor: 300.83164857043164 },
    { minimo: 5001, maximo: 99999, valor: 362.22586256439723 },
  ],

  consumoMinimo: {
    MONOFASICO: 30,
    BIFASICO: 50,
    TRIFASICO: 100,
    MEDIA_TENSAO: 0,
  },

  usina: {
    capacidadeReferenciaKwhMes: 24000,
    potenciaReferenciaKwp: 198,
  },

  projecao: {
    reajusteAnual: 1.05,
    anos: 5,
  },

  descontoPadrao: 0.2,
  validadePropostaDias: 30,

  institucional: {
    nomeEmpresa: "Em Conta Energia Renovável — Associação",
    distribuidora: "Energisa MS",
    whatsapp: "(67) 99731-4368",
    whatsappLink: "https://wa.me/5567997314368",
    site: "sistema.fiems.com.br/agentes-energia",
  },

  observacoesProposta: [
    "Valores estimados com base na tarifa vigente e taxas da concessionária.",
    "Esta simulação apresenta uma estimativa de economia com base no consumo médio da unidade.",
    "Os valores podem variar conforme o consumo real de energia compensada.",
  ],
};

/** Meses no ano — usado nas anualizações da planilha. */
export const MESES_NO_ANO = 12;
