import { describe, expect, it } from "vitest";

import { CONFIG } from "./config";
import { configuracaoPadrao, validarConfiguracao } from "./configSchema";
import { calcularSimulacao } from "./calculations";
import type { Simulacao, UnidadeConsumidora } from "./types";

/** Cópia mutável profunda, para mexer sem afetar o CONFIG global. */
function clonarConfig() {
  return JSON.parse(JSON.stringify(CONFIG)) as Record<string, unknown>;
}

function simulacao(uc: Partial<UnidadeConsumidora> = {}): Simulacao {
  const unidade: UnidadeConsumidora = {
    id: "uc-1",
    nome: "UC 01",
    classificacao: "B1",
    ligacao: "TRIFASICO",
    consumoForaPonta: 218,
    consumoPonta: 0,
    demandaContratada: 0,
    desconto: 0.2,
    cosipOverride: 48.58,
    custoKwhConcorrente: null,
    ...uc,
  };
  return {
    cliente: {
      nome: "CLIENTE EXEMPLO",
      documento: "52998224725",
      telefone: "67999999999",
      email: "",
      consultor: "CONSULTOR EXEMPLO",
      dataProposta: "2026-07-10",
      validadeDias: 30,
    },
    unidades: [unidade],
  };
}

describe("schema da configuração", () => {
  it("a config padrão da planilha é válida", () => {
    expect(() => validarConfiguracao(configuracaoPadrao())).not.toThrow();
  });

  it("rejeita tarifa negativa", () => {
    const c = clonarConfig();
    (c.tarifas as { baixaTensao: { semImposto: number } }).baixaTensao.semImposto = -1;
    expect(() => validarConfiguracao(c)).toThrow();
  });

  it("rejeita desconto padrão de 100% ou mais", () => {
    const c = clonarConfig();
    c.descontoPadrao = 1;
    expect(() => validarConfiguracao(c)).toThrow();
  });

  it("rejeita validade de proposta zero ou negativa", () => {
    const c = clonarConfig();
    c.validadePropostaDias = 0;
    expect(() => validarConfiguracao(c)).toThrow();
  });

  it("rejeita capacidade de usina zero (evita divisão por zero no cálculo)", () => {
    const c = clonarConfig();
    (c.usina as { capacidadeReferenciaKwhMes: number }).capacidadeReferenciaKwhMes = 0;
    expect(() => validarConfiguracao(c)).toThrow();
  });

  it("rejeita faixas de COSIP fora de ordem — a busca depende da ordem crescente", () => {
    const c = clonarConfig();
    c.cosipResidencial = [
      { minimo: 0, maximo: 200, valor: 10 },
      { minimo: 201, maximo: 100, valor: 20 }, // máximo menor que o anterior
    ];
    expect(() => validarConfiguracao(c)).toThrow();
  });

  it("aceita faixas de COSIP em ordem crescente", () => {
    const c = clonarConfig();
    c.cosipResidencial = [
      { minimo: 0, maximo: 100, valor: 0 },
      { minimo: 101, maximo: 500, valor: 25 },
    ];
    expect(() => validarConfiguracao(c)).not.toThrow();
  });

  it("rejeita link de WhatsApp que não é URL", () => {
    const c = clonarConfig();
    (c.institucional as { whatsappLink: string }).whatsappLink = "zap";
    expect(() => validarConfiguracao(c)).toThrow();
  });

  it("exige ao menos uma observação na proposta", () => {
    const c = clonarConfig();
    c.observacoesProposta = [];
    expect(() => validarConfiguracao(c)).toThrow();
  });

  it("rejeita reajuste anual menor que 1 (a projeção não pode encolher)", () => {
    const c = clonarConfig();
    (c.projecao as { reajusteAnual: number }).reajusteAnual = 0.9;
    expect(() => validarConfiguracao(c)).toThrow();
  });
});

describe("configuração alterada muda o cálculo", () => {
  it("mudar a tarifa de baixa tensão muda a economia", () => {
    const original = calcularSimulacao(simulacao());

    const c = clonarConfig();
    (c.tarifas as { baixaTensao: { semImposto: number } }).baixaTensao.semImposto = 1.5;
    const nova = validarConfiguracao(c);

    const alterado = calcularSimulacao(simulacao(), nova);

    expect(alterado.economiaMensal).toBeGreaterThan(original.economiaMensal);
    // O caso de regressão continua valendo para a config padrão.
    expect(original.economiaMensal).toBeCloseTo(23.28, 2);
  });

  it("mudar o desconto padrão não altera uma UC que já tem desconto próprio", () => {
    const c = clonarConfig();
    c.descontoPadrao = 0.5;
    const nova = validarConfiguracao(c);

    // A UC traz desconto 0,2 explícito — o padrão só afeta UCs novas.
    const r = calcularSimulacao(simulacao({ desconto: 0.2 }), nova);
    expect(r.descontoMedio).toBeCloseTo(0.2, 9);
  });

  it("mudar a potência da usina muda o equivalente em kWp", () => {
    const c = clonarConfig();
    (c.usina as { potenciaReferenciaKwp: number }).potenciaReferenciaKwp = 396; // dobro

    const nova = validarConfiguracao(c);
    const padrao = calcularSimulacao(simulacao());
    const dobrado = calcularSimulacao(simulacao(), nova);

    expect(dobrado.equivalenteKwp).toBeCloseTo(padrao.equivalenteKwp * 2, 9);
  });

  it("mudar as bandeiras muda a projeção de 5 anos", () => {
    const c = clonarConfig();
    (c.bandeiras as { AMARELA: number }).AMARELA = 0.1;

    const nova = validarConfiguracao(c);
    const padrao = calcularSimulacao(simulacao());
    const alterado = calcularSimulacao(simulacao(), nova);

    expect(alterado.projecaoCincoAnos.amarela).toBeGreaterThan(
      padrao.projecaoCincoAnos.amarela,
    );
    // A verde não depende da amarela.
    expect(alterado.projecaoCincoAnos.verde).toBeCloseTo(padrao.projecaoCincoAnos.verde, 9);
  });
});
