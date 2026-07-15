import { describe, expect, it } from "vitest";

import { CONFIG } from "./config";
import {
  calcularConsumoCompensavel,
  calcularCustoDemanda,
  calcularFaturamentoMinimo,
  calcularProjecaoCincoAnos,
  calcularSimulacao,
  calcularUC,
} from "./calculations";
import { calcularCosip, fatorProjecao, tarifaComImposto } from "./tariffs";
import {
  formatarDesconto,
  formatarMoeda,
  formatarPercentual,
  nomeArquivoProposta,
} from "./format";
import { validarConfiguracao } from "./configSchema";
import {
  dadosClienteSchema,
  isDocumentoValido,
  MAX_UNIDADES,
  simulacaoArmazenadaSchema,
  simulacaoSchema,
  unidadeConsumidoraSchema,
} from "./validation";
import type { Classificacao, Ligacao, Simulacao, UnidadeConsumidora } from "./types";

/** Tolerância: 1 centavo. As diferenças reais são da ordem de 1e-13. */
const CENTAVO = 0.005;

function uc(over: Partial<UnidadeConsumidora> = {}): UnidadeConsumidora {
  return {
    id: "uc-1",
    nome: "UC 01",
    classificacao: "B1",
    ligacao: "TRIFASICO",
    consumoForaPonta: 218,
    consumoPonta: 0,
    demandaContratada: 0,
    desconto: 0.2,
    cosipOverride: null,
    custoKwhConcorrente: null,
    ...over,
  };
}

function simulacao(unidades: UnidadeConsumidora[]): Simulacao {
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
    unidades,
  };
}

// ---------------------------------------------------------------------------
// CASO DE REGRESSÃO DA PLANILHA
// ---------------------------------------------------------------------------
describe("regressão: caso de exemplo da planilha original (UC 01)", () => {
  // Na planilha, Preencher!F9 é o literal 48,58 digitado por cima da fórmula.
  // O consultor copia a COSIP real da conta do cliente. Ver DOC §6.
  const unidade = uc({ cosipOverride: 48.58 });
  const r = calcularUC(unidade);
  const total = calcularSimulacao(simulacao([unidade]));

  it("consumo compensável = 118 kWh", () => {
    expect(r.consumoCompensavel).toBe(118);
  });

  it("COSIP = R$ 48,58", () => {
    expect(r.cosip).toBeCloseTo(48.58, 2);
    expect(r.cosipManual).toBe(true);
  });

  it("faturamento mínimo = R$ 130,98", () => {
    expect(r.faturamentoMinimo).toBeCloseTo(130.98, 2);
  });

  it("impostos = R$ 38,14", () => {
    expect(r.impostos).toBeCloseTo(38.14, 2);
  });

  it("valor residual da distribuidora = R$ 217,71", () => {
    expect(r.valorResidual).toBeCloseTo(217.71, 2);
  });

  it("custo sem locação = R$ 116,42", () => {
    expect(r.custoSemLocacao).toBeCloseTo(116.42, 2);
  });

  it("custo com locação = R$ 93,14", () => {
    expect(r.custoComLocacao).toBeCloseTo(93.14, 2);
  });

  it("fatura atual = R$ 334,12", () => {
    expect(r.faturaSemLocacao).toBeCloseTo(334.12, 2);
    expect(total.faturaAtual).toBeCloseTo(334.12, 2);
  });

  it("fatura com Em Conta = R$ 310,84", () => {
    expect(r.faturaComLocacao).toBeCloseTo(310.84, 2);
    expect(total.faturaComEmConta).toBeCloseTo(310.84, 2);
  });

  it("economia mensal = R$ 23,28", () => {
    expect(total.economiaMensal).toBeCloseTo(23.28, 2);
  });

  it("economia anual = R$ 279,41", () => {
    expect(total.economiaAnual).toBeCloseTo(279.41, 2);
  });

  it("economia efetiva ≈ 6,97%", () => {
    expect(total.economiaPercentualEfetiva).toBeCloseTo(0.0697, 4);
  });

  it("projeção 5 anos — bandeira verde = R$ 1.543,89", () => {
    expect(total.projecaoCincoAnos.verde).toBeCloseTo(1543.89, 2);
  });

  it("projeção 5 anos — bandeira amarela = R$ 1.691,38", () => {
    expect(total.projecaoCincoAnos.amarela).toBeCloseTo(1691.38, 2);
  });

  it("projeção 5 anos — vermelha P1 = R$ 1.893,09", () => {
    expect(total.projecaoCincoAnos.vermelhaP1).toBeCloseTo(1893.09, 2);
  });

  it("projeção 5 anos — vermelha P2 = R$ 2.160,21", () => {
    expect(total.projecaoCincoAnos.vermelhaP2).toBeCloseTo(2160.21, 2);
  });

  it("equivalente em kWp ≈ 0,97", () => {
    expect(total.equivalenteKwp).toBeCloseTo(0.97, 2);
  });

  it("participação na potência da usina ≈ 0,49%", () => {
    expect(total.percentualPotenciaUsina).toBeCloseTo(0.0049166, 6);
    expect(formatarPercentual(total.percentualPotenciaUsina)).toBe("0,49%");
  });

  it("consumo anual = 2.616 kWh e média mensal = 218 kWh", () => {
    expect(total.consumoAnual).toBe(2616);
    expect(total.consumoMedioMensal).toBe(218);
  });

  it("valores exibidos batem com a proposta da planilha", () => {
    expect(formatarMoeda(total.faturaAtual)).toBe("R$ 334,12");
    expect(formatarMoeda(total.faturaComEmConta)).toBe("R$ 310,84");
    expect(formatarMoeda(total.economiaMensal)).toBe("R$ 23,28");
    expect(formatarMoeda(total.economiaAnual)).toBe("R$ 279,41");
    expect(formatarMoeda(total.valorPagoLocador)).toBe("R$ 93,14");
    expect(formatarMoeda(total.valorPagoDistribuidora)).toBe("R$ 217,71");
  });

  it("a composição da fatura fecha: residual + locador + economia = fatura atual", () => {
    const soma = total.valorPagoDistribuidora + total.valorPagoLocador + total.economiaMensal;
    expect(soma).toBeCloseTo(total.faturaAtual, 10);
  });
});

// ---------------------------------------------------------------------------
// COSIP pela tabela (sem override)
// ---------------------------------------------------------------------------
describe("COSIP — tabela da aba Dados", () => {
  it("B1 / 218 kWh cai na faixa 201–250 (a planilha sobrescreve isso com 48,58)", () => {
    expect(calcularCosip("B1", 218)).toBeCloseTo(42.975949795775954, 9);
  });

  it("B2 é sempre zero, em qualquer consumo", () => {
    expect(calcularCosip("B2", 0)).toBe(0);
    expect(calcularCosip("B2", 5000)).toBe(0);
  });

  it.each<[Classificacao, number, number]>([
    // limites exatos das faixas — residencial
    ["B1", 100, 0],
    ["B1", 101, 27.627396297284537],
    ["B1", 150, 27.627396297284537],
    ["B1", 151, 30.697106996982821],
    ["B1", 200, 30.697106996982821],
    ["B1", 201, 42.975949795775954],
    ["B1", 250, 42.975949795775954],
    ["B1", 251, 46.04566049547423],
    ["B1", 1500, 82.882188891853616],
    ["B1", 1501, 92.09],
    ["B1", 99999, 92.09],
    // limites exatos das faixas — demais
    ["B3", 0, 3.07],
    ["B3", 100, 3.07],
    ["B3", 101, 58.32],
    ["B3", 150, 58.32],
    ["B3", 151, 85.951899591551907],
    ["B3", 400, 138.13698148642268],
    ["B3", 401, 159.62495638431068],
    ["B3", 5000, 300.83164857043164],
    ["B3", 5001, 362.22586256439723],
    ["MT", 800, 174.97350988280206],
  ])("%s com %i kWh -> COSIP %f", (classificacao, consumo, esperado) => {
    expect(calcularCosip(classificacao, consumo)).toBeCloseTo(esperado, 9);
  });

  it("acima da última faixa devolve o valor da última faixa (não quebra)", () => {
    expect(calcularCosip("B1", 999999)).toBe(92.09);
    expect(calcularCosip("B3", 999999)).toBeCloseTo(362.22586256439723, 9);
  });
});

// ---------------------------------------------------------------------------
// Consumo compensável por tipo de ligação
// ---------------------------------------------------------------------------
describe("consumo compensável por ligação", () => {
  it.each<[Ligacao, number, number]>([
    ["MONOFASICO", 218, 188],
    ["BIFASICO", 218, 168],
    ["TRIFASICO", 218, 118],
  ])("%s: %i kWh -> %i kWh", (ligacao, consumo, esperado) => {
    expect(calcularConsumoCompensavel(uc({ ligacao, consumoForaPonta: consumo }))).toBe(esperado);
  });

  it("média tensão soma fora ponta + ponta", () => {
    const u = uc({
      classificacao: "MT",
      ligacao: "MEDIA_TENSAO",
      consumoForaPonta: 5000,
      consumoPonta: 800,
    });
    expect(calcularConsumoCompensavel(u)).toBe(5800);
  });

  it.each<[Ligacao, number]>([
    ["MONOFASICO", 30],
    ["BIFASICO", 50],
    ["TRIFASICO", 100],
  ])("consumo exatamente igual ao mínimo (%s) -> compensável zero", (ligacao, minimo) => {
    expect(calcularConsumoCompensavel(uc({ ligacao, consumoForaPonta: minimo }))).toBe(0);
  });

  it.each<[Ligacao, number]>([
    ["MONOFASICO", 10],
    ["BIFASICO", 20],
    ["TRIFASICO", 80],
  ])("consumo abaixo do mínimo (%s) nunca gera compensável negativo", (ligacao, consumo) => {
    expect(calcularConsumoCompensavel(uc({ ligacao, consumoForaPonta: consumo }))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Faturamento mínimo
// ---------------------------------------------------------------------------
describe("faturamento mínimo", () => {
  const tarifaBT = tarifaComImposto(CONFIG.tarifas.baixaTensao);

  it.each<[Ligacao, number]>([
    ["MONOFASICO", 30],
    ["BIFASICO", 50],
    ["TRIFASICO", 100],
  ])("%s = %i kWh × tarifa BT c/ imposto", (ligacao, kwh) => {
    expect(calcularFaturamentoMinimo(uc({ ligacao }))).toBeCloseTo(kwh * tarifaBT, 9);
  });

  it("média tensão não tem faturamento mínimo", () => {
    const u = uc({ classificacao: "MT", ligacao: "MEDIA_TENSAO" });
    expect(calcularFaturamentoMinimo(u)).toBe(0);
  });

  it("a tarifa BT com imposto é 1,309834378837665 (Dados!K3)", () => {
    expect(tarifaBT).toBeCloseTo(1.309834378837665, 12);
  });
});

// ---------------------------------------------------------------------------
// Compensável zero: economia zero, mas fatura mínima continua sendo cobrada
// ---------------------------------------------------------------------------
describe("consumo compensável zero", () => {
  const r = calcularUC(uc({ ligacao: "TRIFASICO", consumoForaPonta: 100 }));

  it("não gera economia nem impostos", () => {
    expect(r.consumoCompensavel).toBe(0);
    expect(r.impostos).toBe(0);
    expect(r.custoSemLocacao).toBe(0);
    expect(r.custoComLocacao).toBe(0);
    expect(r.economia).toBe(0);
  });

  it("ainda cobra faturamento mínimo + COSIP, sem divisão por zero", () => {
    expect(r.faturamentoMinimo).toBeGreaterThan(0);
    expect(r.faturaSemLocacao).toBeCloseTo(r.valorResidual, 9);
    expect(Number.isFinite(r.economiaPercentualEfetiva)).toBe(true);
    expect(r.economiaPercentualEfetiva).toBe(0);
  });

  it("consumo abaixo do mínimo não produz valores negativos", () => {
    const abaixo = calcularUC(uc({ ligacao: "TRIFASICO", consumoForaPonta: 80 }));
    expect(abaixo.consumoCompensavel).toBe(0);
    expect(abaixo.impostos).toBe(0);
    expect(abaixo.custoSemLocacao).toBe(0);
    expect(abaixo.economia).toBe(0);
    expect(abaixo.valorResidual).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Média tensão
// ---------------------------------------------------------------------------
describe("média tensão", () => {
  const u = uc({
    classificacao: "MT",
    ligacao: "MEDIA_TENSAO",
    consumoForaPonta: 5000,
    consumoPonta: 800,
    demandaContratada: 100,
    desconto: 0.2,
  });
  const r = calcularUC(u);

  it("custo de demanda = demanda × tarifa de demanda c/ imposto", () => {
    const tarifaDemanda = tarifaComImposto(CONFIG.tarifas.demanda);
    expect(tarifaDemanda).toBeCloseTo(45.911927095092459, 9);
    expect(r.custoDemanda).toBeCloseTo(100 * tarifaDemanda, 9);
  });

  it("custo sem locação usa as tarifas de fora ponta e ponta", () => {
    const fp = tarifaComImposto(CONFIG.tarifas.foraPonta);
    const p = tarifaComImposto(CONFIG.tarifas.ponta);
    const esperado = 5000 * fp + 800 * p - r.impostos;
    expect(r.custoSemLocacao).toBeCloseTo(esperado, 9);
  });

  it("faturamento mínimo é zero e o residual inclui a demanda", () => {
    expect(r.faturamentoMinimo).toBe(0);
    expect(r.valorResidual).toBeCloseTo(r.cosip + r.impostos + r.custoDemanda, 9);
  });

  it("COSIP vem da tabela DEMAIS", () => {
    expect(r.cosip).toBeCloseTo(calcularCosip("MT", 5000), 9);
  });

  it("baixa tensão não tem custo de demanda, mesmo com demanda preenchida", () => {
    expect(calcularCustoDemanda(uc({ demandaContratada: 500 }))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Descontos
// ---------------------------------------------------------------------------
describe("desconto", () => {
  it("desconto zero -> economia zero, mas a fatura continua idêntica à atual", () => {
    const r = calcularUC(uc({ desconto: 0 }));
    expect(r.economia).toBe(0);
    expect(r.custoComLocacao).toBeCloseTo(r.custoSemLocacao, 9);
    expect(r.faturaComLocacao).toBeCloseTo(r.faturaSemLocacao, 9);
  });

  it("desconto de 100% é inválido (schema rejeita)", () => {
    const r = unidadeConsumidoraSchema.safeParse({ ...uc(), desconto: 1 });
    expect(r.success).toBe(false);
  });

  it("desconto negativo é inválido", () => {
    const r = unidadeConsumidoraSchema.safeParse({ ...uc(), desconto: -0.1 });
    expect(r.success).toBe(false);
  });

  it("desconto de 50% corta o custo compensável pela metade", () => {
    const r = calcularUC(uc({ desconto: 0.5 }));
    expect(r.custoComLocacao).toBeCloseTo(r.custoSemLocacao / 2, 9);
    expect(r.economia).toBeCloseTo(r.custoSemLocacao / 2, 9);
  });
});

// ---------------------------------------------------------------------------
// Bandeiras e projeção
// ---------------------------------------------------------------------------
describe("bandeiras tarifárias", () => {
  const r = calcularUC(uc({ cosipOverride: 48.58 }));

  it("custos evitados = compensável × adicional (118 kWh)", () => {
    expect(r.custosBandeiras.verde).toBe(0);
    expect(r.custosBandeiras.amarela).toBeCloseTo(2.2243, 6);
    expect(r.custosBandeiras.vermelhaP1).toBeCloseTo(5.26634, 6);
    expect(r.custosBandeiras.vermelhaP2).toBeCloseTo(9.29486, 6);
  });

  it("bandeira verde não adiciona custo evitado", () => {
    expect(CONFIG.bandeiras.VERDE).toBe(0);
  });
});

describe("projeção de 5 anos", () => {
  it("o fator geométrico é 5,52563125 (1 + 1,05 + 1,05² + 1,05³ + 1,05⁴)", () => {
    expect(fatorProjecao()).toBeCloseTo(5.52563125, 10);
  });

  it("as bandeiras somam-se à projeção verde, não a substituem", () => {
    const bandeiras = { verde: 0, amarela: 10, vermelhaP1: 20, vermelhaP2: 30 };
    const p = calcularProjecaoCincoAnos(100, bandeiras);
    const fator = fatorProjecao();
    expect(p.verde).toBeCloseTo(100 * 12 * fator, 9);
    expect(p.amarela).toBeCloseTo(p.verde + 10 * 12 * fator, 9);
    expect(p.vermelhaP1).toBeCloseTo(p.verde + 20 * 12 * fator, 9);
    expect(p.vermelhaP2).toBeCloseTo(p.verde + 30 * 12 * fator, 9);
  });

  it("economia zero -> projeção zero", () => {
    const p = calcularProjecaoCincoAnos(0, {
      verde: 0,
      amarela: 0,
      vermelhaP1: 0,
      vermelhaP2: 0,
    });
    expect(p.verde).toBe(0);
    expect(p.vermelhaP2).toBe(0);
  });

  it("a projeção é crescente entre as bandeiras", () => {
    const total = calcularSimulacao(simulacao([uc({ cosipOverride: 48.58 })]));
    const p = total.projecaoCincoAnos;
    expect(p.verde).toBeLessThan(p.amarela);
    expect(p.amarela).toBeLessThan(p.vermelhaP1);
    expect(p.vermelhaP1).toBeLessThan(p.vermelhaP2);
  });
});

// ---------------------------------------------------------------------------
// Múltiplas UCs
// ---------------------------------------------------------------------------
describe("múltiplas UCs", () => {
  const unidades = [
    uc({ id: "a", nome: "UC 01", ligacao: "TRIFASICO", consumoForaPonta: 218 }),
    uc({ id: "b", nome: "UC 02", ligacao: "BIFASICO", consumoForaPonta: 400, classificacao: "B3" }),
    uc({ id: "c", nome: "UC 03", ligacao: "MONOFASICO", consumoForaPonta: 150 }),
  ];
  const total = calcularSimulacao(simulacao(unidades));

  it("agrega quantidade, consumo e compensável", () => {
    expect(total.quantidadeUCs).toBe(3);
    expect(total.consumoMedioMensal).toBe(218 + 400 + 150);
    expect(total.consumoAnual).toBe((218 + 400 + 150) * 12);
    // 118 + 350 + 120
    expect(total.consumoCompensavelMensal).toBe(118 + 350 + 120);
  });

  it("os totais são a soma das UCs", () => {
    const somaEconomia = total.unidades.reduce((a, u) => a + u.economia, 0);
    expect(total.economiaMensal).toBeCloseTo(somaEconomia, 9);
    expect(total.economiaAnual).toBeCloseTo(somaEconomia * 12, 9);
  });

  it("a composição da fatura fecha com a fatura atual", () => {
    const soma = total.valorPagoDistribuidora + total.valorPagoLocador + total.economiaMensal;
    expect(soma).toBeCloseTo(total.faturaAtual, 9);
  });

  it("cada UC mantém sua própria classificação e COSIP", () => {
    expect(total.unidades[1].cosip).toBeCloseTo(calcularCosip("B3", 400), 9);
    expect(total.unidades[2].cosip).toBeCloseTo(calcularCosip("B1", 150), 9);
  });

  it("kWp e participação escalam com o compensável total", () => {
    const esperadoPct = 588 / CONFIG.usina.capacidadeReferenciaKwhMes;
    expect(total.percentualPotenciaUsina).toBeCloseTo(esperadoPct, 12);
    expect(total.equivalenteKwp).toBeCloseTo(198 * esperadoPct, 12);
  });

  it("descontos diferentes por UC produzem um desconto médio ponderado", () => {
    const mistas = [
      uc({ id: "a", desconto: 0.2, consumoForaPonta: 218 }),
      uc({ id: "b", desconto: 0.4, consumoForaPonta: 218 }),
    ];
    const t = calcularSimulacao(simulacao(mistas));
    // custos sem locação iguais -> média simples = 30%
    expect(t.descontoMedio).toBeCloseTo(0.3, 9);
  });

  it("simulação sem UCs não quebra (divisões por zero protegidas)", () => {
    const t = calcularSimulacao(simulacao([]));
    expect(t.quantidadeUCs).toBe(0);
    expect(t.faturaAtual).toBe(0);
    expect(t.economiaPercentualEfetiva).toBe(0);
    expect(t.descontoMedio).toBe(0);
    expect(t.equivalenteKwp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Concorrente
// ---------------------------------------------------------------------------
describe("comparação com concorrente", () => {
  it("sem concorrente informado, o bloco não se aplica (null, não zero)", () => {
    const t = calcularSimulacao(simulacao([uc()]));
    expect(t.economiaConcorrenteAnual).toBeNull();
    expect(t.economiaVsConcorrenteAnual).toBeNull();
  });

  it("com concorrente informado: (tarifaBT s/ imposto − custoConcorrente) × compensável × 12", () => {
    const r = calcularUC(uc({ custoKwhConcorrente: 0.7, cosipOverride: 48.58 }));
    const esperado = (CONFIG.tarifas.baixaTensao.semImposto - 0.7) * 118 * 12;
    expect(r.economiaConcorrenteAnual).toBeCloseTo(esperado, 9);
    expect(r.economiaVsConcorrenteAnual).toBeCloseTo(r.economia * 12 - esperado, 9);
  });

  it("reproduz o valor da planilha quando o concorrente é 0 (célula vazia)", () => {
    // Preencher!F29 com F28 vazio -> (0,9866 - 0) * 118 * 12 = 1397,0256
    const r = calcularUC(uc({ custoKwhConcorrente: 0, cosipOverride: 48.58 }));
    expect(r.economiaConcorrenteAnual).toBeCloseTo(1397.0256, 4);
    expect(r.economiaVsConcorrenteAnual).toBeCloseTo(-1117.62048, 4);
  });
});

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------
describe("validação", () => {
  it("rejeita consumo negativo", () => {
    const r = unidadeConsumidoraSchema.safeParse({ ...uc(), consumoForaPonta: -1 });
    expect(r.success).toBe(false);
  });

  it("rejeita demanda e COSIP negativas", () => {
    expect(
      unidadeConsumidoraSchema.safeParse({
        ...uc(),
        classificacao: "MT",
        ligacao: "MEDIA_TENSAO",
        demandaContratada: -5,
      }).success,
    ).toBe(false);
    expect(unidadeConsumidoraSchema.safeParse({ ...uc(), cosipOverride: -1 }).success).toBe(false);
  });

  it("rejeita ponta/demanda em baixa tensão", () => {
    expect(unidadeConsumidoraSchema.safeParse({ ...uc(), consumoPonta: 10 }).success).toBe(false);
    expect(unidadeConsumidoraSchema.safeParse({ ...uc(), demandaContratada: 10 }).success).toBe(
      false,
    );
  });

  it("exige coerência entre classificação MT e ligação em média tensão", () => {
    expect(
      unidadeConsumidoraSchema.safeParse({ ...uc(), classificacao: "MT", ligacao: "TRIFASICO" })
        .success,
    ).toBe(false);
    expect(
      unidadeConsumidoraSchema.safeParse({
        ...uc(),
        classificacao: "B1",
        ligacao: "MEDIA_TENSAO",
      }).success,
    ).toBe(false);
  });

  it("aceita uma UC de média tensão coerente", () => {
    const r = unidadeConsumidoraSchema.safeParse({
      ...uc(),
      classificacao: "MT",
      ligacao: "MEDIA_TENSAO",
      consumoPonta: 800,
      demandaContratada: 100,
    });
    expect(r.success).toBe(true);
  });

  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isDocumentoValido("529.982.247-25")).toBe(true);
    expect(isDocumentoValido("111.111.111-11")).toBe(false);
    expect(isDocumentoValido("11.222.333/0001-81")).toBe(true);
    expect(isDocumentoValido("11.222.333/0001-82")).toBe(false);
    expect(isDocumentoValido("123")).toBe(false);
  });

  it("CPF/CNPJ e telefone são OPCIONAIS (podem ficar em branco)", () => {
    const semContato = dadosClienteSchema.safeParse({
      nome: "CLIENTE EXEMPLO",
      documento: "",
      telefone: "",
      email: "",
      consultor: "CONSULTOR EXEMPLO",
      dataProposta: "2026-07-10",
      validadeDias: 30,
    });
    expect(semContato.success).toBe(true);
  });

  it("mas se PREENCHIDOS, continuam sendo validados", () => {
    const base = {
      nome: "CLIENTE EXEMPLO",
      email: "",
      consultor: "CONSULTOR EXEMPLO",
      dataProposta: "2026-07-10",
      validadeDias: 30,
    };
    // documento pela metade / inválido -> recusado
    expect(
      dadosClienteSchema.safeParse({ ...base, documento: "123", telefone: "" }).success,
    ).toBe(false);
    // telefone curto -> recusado
    expect(
      dadosClienteSchema.safeParse({ ...base, documento: "", telefone: "6799" }).success,
    ).toBe(false);
    // ambos válidos -> aceito
    expect(
      dadosClienteSchema.safeParse({
        ...base,
        documento: "529.982.247-25",
        telefone: "(67) 99999-9999",
      }).success,
    ).toBe(true);
  });

  it(`exige ao menos uma UC e no máximo ${MAX_UNIDADES}`, () => {
    expect(simulacaoSchema.safeParse(simulacao([])).success).toBe(false);

    const acima = Array.from({ length: MAX_UNIDADES + 1 }, (_, i) => uc({ id: `uc-${i}` }));
    expect(simulacaoSchema.safeParse(simulacao(acima)).success).toBe(false);

    const noLimite = Array.from({ length: MAX_UNIDADES }, (_, i) => uc({ id: `uc-${i}` }));
    expect(simulacaoSchema.safeParse(simulacao(noLimite)).success).toBe(true);
  });

  it("uma proposta JÁ GRAVADA com mais UCs que o limite atual continua válida", () => {
    // Baixar o limite não pode invalidar o passado: o gestor precisa conseguir
    // reabrir o PDF de uma proposta antiga.
    const muitas = Array.from({ length: 10 }, (_, i) => uc({ id: `uc-${i}` }));
    expect(simulacaoSchema.safeParse(simulacao(muitas)).success).toBe(false);
    expect(simulacaoArmazenadaSchema.safeParse(simulacao(muitas)).success).toBe(true);
  });

  it("aceita a simulação de regressão inteira", () => {
    const r = simulacaoSchema.safeParse(simulacao([uc({ cosipOverride: 48.58 })]));
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Proposta / PDF
// ---------------------------------------------------------------------------
describe("geração da proposta", () => {
  it("o nome do arquivo segue o padrão pedido", () => {
    expect(nomeArquivoProposta("CLIENTE EXEMPLO", "2026-07-10")).toBe(
      "proposta-em-conta-cliente-exemplo-2026-07-10.pdf",
    );
  });

  it("o nome do arquivo remove acentos e caracteres especiais", () => {
    expect(nomeArquivoProposta("Indústria Ação & Cia. Ltda", "2026-01-05")).toBe(
      "proposta-em-conta-industria-acao-cia-ltda-2026-01-05.pdf",
    );
  });

  it("nome vazio ainda produz um arquivo válido", () => {
    expect(nomeArquivoProposta("", "2026-01-05")).toBe("proposta-em-conta-cliente-2026-01-05.pdf");
  });

  it("a proposta carrega todos os campos que o PDF exibe", () => {
    const t = calcularSimulacao(simulacao([uc({ cosipOverride: 48.58 })]));
    expect(t.descontoMedio).toBeCloseTo(0.2, 9);
    expect(formatarDesconto(t.descontoMedio)).toBe("20%");
    expect(t.equivalenteKwp).toBeGreaterThan(0);
    expect(t.projecaoCincoAnos.vermelhaP2).toBeGreaterThan(t.projecaoCincoAnos.verde);
    expect(CONFIG.observacoesProposta).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Desconto: número INTEIRO de porcento
// ---------------------------------------------------------------------------
describe("desconto é sempre um número inteiro de porcento", () => {
  it("exibe sem casa decimal: 20%, não 20,0%", () => {
    expect(formatarDesconto(0.2)).toBe("20%");
    expect(formatarDesconto(0)).toBe("0%");
    expect(formatarDesconto(0.35)).toBe("35%");
    expect(formatarDesconto(0.99)).toBe("99%");
  });

  it("o schema aceita descontos inteiros", () => {
    for (const pct of [0, 5, 20, 35, 99]) {
      const r = unidadeConsumidoraSchema.safeParse({ ...uc(), desconto: pct / 100 });
      expect(r.success, `${pct}% deveria ser aceito`).toBe(true);
    }
  });

  it("o schema RECUSA fração de porcento (20,5%)", () => {
    for (const frac of [0.205, 0.2075, 0.001]) {
      const r = unidadeConsumidoraSchema.safeParse({ ...uc(), desconto: frac });
      expect(r.success, `${frac * 100}% deveria ser recusado`).toBe(false);
    }
  });

  it("não é confundido por erro de ponto flutuante (0,07 * 100 ≠ 7 exato)", () => {
    // Casos onde `x * 100` não dá um inteiro exato em IEEE-754. A checagem usa
    // tolerância justamente por isso — sem ela, 7% seria recusado.
    for (const pct of [7, 29, 57, 83]) {
      const r = unidadeConsumidoraSchema.safeParse({ ...uc(), desconto: pct / 100 });
      expect(r.success, `${pct}% deveria ser aceito`).toBe(true);
    }
  });

  it("o desconto padrão da configuração também precisa ser inteiro", () => {
    const base = JSON.parse(JSON.stringify(CONFIG)) as Record<string, unknown>;
    expect(() => validarConfiguracao({ ...base, descontoPadrao: 0.2 })).not.toThrow();
    expect(() => validarConfiguracao({ ...base, descontoPadrao: 0.205 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Coerência geral / arredondamento
// ---------------------------------------------------------------------------
describe("coerência de arredondamento", () => {
  it("os erros de ponto flutuante ficam muito abaixo de um centavo", () => {
    const t = calcularSimulacao(simulacao([uc({ cosipOverride: 48.58 })]));
    const recomposta = t.valorPagoDistribuidora + t.valorPagoLocador + t.economiaMensal;
    expect(Math.abs(recomposta - t.faturaAtual)).toBeLessThan(CENTAVO);
  });

  it("fatura com Em Conta = residual + valor pago ao locador", () => {
    const t = calcularSimulacao(simulacao([uc({ cosipOverride: 48.58 })]));
    expect(t.faturaComEmConta).toBeCloseTo(t.valorPagoDistribuidora + t.valorPagoLocador, 9);
  });

  it("economia mensal × 12 = economia anual", () => {
    const t = calcularSimulacao(simulacao([uc({ cosipOverride: 48.58 })]));
    expect(t.economiaAnual).toBeCloseTo(t.economiaMensal * 12, 9);
  });
});
