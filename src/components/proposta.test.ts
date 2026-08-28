/**
 * Paginação da proposta.
 *
 * O número de unidades consumidoras não tem limite comercial, mas cada folha do
 * PDF só comporta `UCS_POR_PAGINA` unidades. Este teste garante o contrato que
 * o PDF depende: uma folha de resumo, folhas de continuação com o resto, e a
 * quebra de página declarada em todas menos na última (senão o Chromium cospe
 * uma página em branco no fim).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Proposta } from "./Proposta";
import { UCS_POR_PAGINA } from "./propostaLayout";
import { calcularSimulacao } from "@/domain/simulator/calculations";
import { CONFIG } from "@/domain/simulator/config";
import type { DadosCliente, UnidadeConsumidora } from "@/domain/simulator/types";

const CLIENTE: DadosCliente = {
  nome: "CLIENTE EXEMPLO",
  documento: "",
  telefone: "",
  email: "",
  consultor: "CONSULTOR EXEMPLO",
  dataProposta: "2026-07-10",
  validadeDias: 30,
};

function uc(i: number): UnidadeConsumidora {
  return {
    id: `uc-${i}`,
    nome: `UC ${String(i + 1).padStart(2, "0")}`,
    classificacao: "B1",
    ligacao: "TRIFASICO",
    consumoForaPonta: 1000,
    consumoPonta: 0,
    demandaContratada: 0,
    desconto: CONFIG.descontoPadrao,
    cosipOverride: null,
    custoKwhConcorrente: null,
  };
}

function markupCom(qtdUCs: number): string {
  const unidades = Array.from({ length: qtdUCs }, (_, i) => uc(i));
  const resultado = calcularSimulacao({ cliente: CLIENTE, unidades }, CONFIG);
  return renderToStaticMarkup(Proposta({ cliente: CLIENTE, r: resultado, config: CONFIG }));
}

/** Cada folha é um `div` de 297mm de altura. */
function contarFolhas(markup: string): number {
  return markup.split("height:297mm").length - 1;
}

function contarQuebras(markup: string): number {
  return markup.split("break-after:page").length - 1;
}

describe("paginação da proposta", () => {
  it(`até ${UCS_POR_PAGINA} unidades cabem numa folha só, sem quebra de página`, () => {
    for (let qtd = 1; qtd <= UCS_POR_PAGINA; qtd++) {
      const markup = markupCom(qtd);
      expect(contarFolhas(markup)).toBe(1);
      expect(contarQuebras(markup)).toBe(0);
    }
  });

  it("acima disso, uma folha nova a cada 3 unidades", () => {
    expect(contarFolhas(markupCom(UCS_POR_PAGINA + 1))).toBe(2);
    expect(contarFolhas(markupCom(UCS_POR_PAGINA * 2))).toBe(2);
    expect(contarFolhas(markupCom(UCS_POR_PAGINA * 2 + 1))).toBe(3);
    expect(contarFolhas(markupCom(10))).toBe(4);
  });

  it("a quebra existe em todas as folhas MENOS na última", () => {
    const markup = markupCom(10);
    expect(contarQuebras(markup)).toBe(contarFolhas(markup) - 1);
  });

  it("toda unidade aparece uma vez, e a numeração das páginas fecha", () => {
    const markup = markupCom(8);

    for (let i = 0; i < 8; i++) {
      const nome = `UC ${String(i + 1).padStart(2, "0")}`;
      expect(markup.split(nome).length - 1).toBeGreaterThan(0);
    }

    expect(markup).toContain("Página 1 de 3");
    expect(markup).toContain("Página 2 de 3");
    expect(markup).toContain("Página 3 de 3");
    // A folha de resumo avisa que a lista continua.
    expect(markup).toContain("+ 5 unidades consumidoras nas páginas seguintes.");
  });
});
