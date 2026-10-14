/**
 * Testes do gerador de .xlsm.
 *
 * O arquivo é um ZIP de XML, e o Excel não perdoa: uma parte faltando, um
 * elemento fora de ordem ou um caractere de controle no meio do nome do cliente
 * e ele acusa "conteúdo ilegível" em vez de abrir. Como não há Excel no CI, o
 * teste ABRE o pacote gerado (descomprimindo com o `zlib`) e confere as partes
 * e o conteúdo — é o mais perto que se chega de conferir no Excel sem ele.
 */

import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { montarPlanilhaDeClientes, nomeArquivoDeClientes } from "./clientes";
import { letraColuna, serialExcel } from "./ooxml";
import { montarZip } from "./zip";
import type { PropostaListada } from "@/server/propostas";

/** Lê o diretório central do ZIP e devolve `caminho -> conteúdo`. */
function abrirZip(bytes: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(bytes);

  // O fim do diretório central fica nos últimos 22 bytes (não geramos
  // comentário de arquivo).
  const fim = buffer.length - 22;
  expect(buffer.readUInt32LE(fim)).toBe(0x06054b50);

  const quantas = buffer.readUInt16LE(fim + 10);
  let posicao = buffer.readUInt32LE(fim + 16);

  const partes = new Map<string, string>();

  for (let i = 0; i < quantas; i++) {
    expect(buffer.readUInt32LE(posicao)).toBe(0x02014b50);

    const metodo = buffer.readUInt16LE(posicao + 10);
    const tamanhoComprimido = buffer.readUInt32LE(posicao + 20);
    const tamanhoNome = buffer.readUInt16LE(posicao + 28);
    const tamanhoExtra = buffer.readUInt16LE(posicao + 30);
    const tamanhoComentario = buffer.readUInt16LE(posicao + 32);
    const inicioLocal = buffer.readUInt32LE(posicao + 42);

    const nome = buffer.toString("utf8", posicao + 46, posicao + 46 + tamanhoNome);

    // No cabeçalho local, os dados vêm depois de 30 bytes + nome + extra.
    const nomeLocal = buffer.readUInt16LE(inicioLocal + 26);
    const extraLocal = buffer.readUInt16LE(inicioLocal + 28);
    const inicioDados = inicioLocal + 30 + nomeLocal + extraLocal;
    const dados = buffer.subarray(inicioDados, inicioDados + tamanhoComprimido);

    partes.set(nome, (metodo === 8 ? inflateRawSync(dados) : dados).toString("utf8"));

    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }

  return partes;
}

function proposta(sobrescreve: Partial<PropostaListada> = {}): PropostaListada {
  return {
    id: 17,
    clienteNome: "Padaria Pão & Cia",
    clienteDocumento: "12345678000199",
    clienteTelefone: "67999887766",
    consultor: "Ana Souza",
    vendedorId: 3,
    vendedorTemFoto: false,
    quantidadeUCs: 2,
    consumoMedio: 2616,
    faturaAtual: 2480.5,
    faturaComEmConta: 2100.25,
    economiaMensal: 380.25,
    economiaAnual: 4563,
    valorPagoLocador: 1194.16,
    descontoMedio: 0.15,
    criadaEm: "2026-03-10T14:30:00.000Z",
    ...sobrescreve,
  };
}

const dados = (propostas: readonly PropostaListada[]) => ({
  propostas,
  filtros: {
    de: "2026-01-01",
    ate: "2026-03-31",
    vendedor: "Ana Souza",
    instituicao: "FIEMS",
    busca: null,
  },
  geradaPor: "João Bueno",
  geradaEm: new Date(2026, 9, 14, 10, 32, 0),
  origem: "https://simulador.emconta.com.br",
});

describe("ZIP", () => {
  it("guarda e recupera o conteúdo das entradas", () => {
    const texto = "a".repeat(5000);
    const partes = abrirZip(
      montarZip([
        { nome: "a.txt", dados: new TextEncoder().encode(texto) },
        { nome: "pasta/b.txt", dados: new TextEncoder().encode("oi") },
      ]),
    );

    expect(partes.get("a.txt")).toBe(texto);
    expect(partes.get("pasta/b.txt")).toBe("oi");
  });
});

describe("referências do OOXML", () => {
  it("converte índice de coluna em letra", () => {
    expect(letraColuna(0)).toBe("A");
    expect(letraColuna(13)).toBe("N");
    expect(letraColuna(25)).toBe("Z");
    expect(letraColuna(26)).toBe("AA");
  });

  it("converte data em número de série do Excel", () => {
    // 01/01/2026 é o dia 46.023 na contagem do Excel.
    expect(serialExcel(new Date(2026, 0, 1))).toBe(46023);
    expect(serialExcel(new Date(2026, 0, 1, 12, 0, 0))).toBe(46023.5);
  });
});

describe("planilha de clientes", () => {
  const partes = abrirZip(montarPlanilhaDeClientes(dados([proposta()])));

  it("tem todas as partes que o Excel exige", () => {
    for (const parte of [
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/core.xml",
      "docProps/app.xml",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
      "xl/worksheets/_rels/sheet1.xml.rels",
    ]) {
      expect(partes.has(parte), `faltou ${parte}`).toBe(true);
    }
  });

  it("se declara macro-enabled — é o que faz dele um .xlsm, e não um .xlsx", () => {
    expect(partes.get("[Content_Types].xml")).toContain(
      "application/vnd.ms-excel.sheet.macroEnabled.main+xml",
    );
  });

  it("declara um Override para cada aba e um rId para cada parte", () => {
    const tipos = partes.get("[Content_Types].xml")!;
    expect(tipos).toContain("/xl/worksheets/sheet1.xml");
    expect(tipos).toContain("/xl/worksheets/sheet2.xml");

    const rels = partes.get("xl/_rels/workbook.xml.rels")!;
    expect(rels).toContain('Id="rId1"');
    expect(rels).toContain('Id="rId2"');
    expect(rels).toContain('Id="rId3"'); // styles.xml
  });

  it("nomeia as duas abas", () => {
    const workbook = partes.get("xl/workbook.xml")!;
    expect(workbook).toContain('name="Clientes"');
    expect(workbook).toContain('name="Resumo"');
  });

  it("escreve um estilo para cada definição, e nenhuma célula aponta para fora", () => {
    const estilos = partes.get("xl/styles.xml")!;
    const quantos = Number(/<cellXfs count="(\d+)"/.exec(estilos)![1]);
    expect(quantos).toBeGreaterThan(0);
    expect(estilos.match(/<xf /g)!.length).toBe(quantos + 1); // +1 do cellStyleXfs

    const usados = [...partes.get("xl/worksheets/sheet1.xml")!.matchAll(/ s="(\d+)"/g)].map(
      (m) => Number(m[1]),
    );
    expect(usados.length).toBeGreaterThan(0);
    expect(Math.max(...usados)).toBeLessThan(quantos);
  });

  it("leva valor como número e documento como texto", () => {
    const aba = partes.get("xl/worksheets/sheet1.xml")!;

    // Fatura, economia e desconto são números — para poder somar e ordenar.
    expect(aba).toContain("<v>2480.5</v>");
    expect(aba).toContain("<v>4563</v>");
    expect(aba).toContain("<v>0.15</v>");

    // CNPJ e telefone vão mascarados, como texto.
    expect(aba).toContain("12.345.678/0001-99");
    expect(aba).toContain("(67) 99988-7766");
  });

  it("traz a Fatura Em Conta, separada do total que o cliente passa a pagar", () => {
    const aba = partes.get("xl/worksheets/sheet1.xml")!;

    expect(aba).toContain("Fatura Em Conta");
    expect(aba).toContain("<v>1194.16</v>"); // a parte que vai para a Em Conta
    expect(aba).toContain("<v>2100.25</v>"); // o total, que já existia
    expect(aba).toContain("<f>SUM(J6:J6)</f>"); // e ela entra na linha de totais
  });

  it("deixa a célula EM BRANCO quando a proposta antiga não tem o valor", () => {
    const antiga = abrirZip(
      montarPlanilhaDeClientes(dados([proposta({ valorPagoLocador: null })])),
    );
    const aba = antiga.get("xl/worksheets/sheet1.xml")!;

    // Em branco, e não zero: zero somaria errado no total e mentiria na leitura.
    expect(aba).toContain('<c r="J6" s="10"/>');
    expect(aba).not.toContain("<v>0</v>");
  });

  it("congela o cabeçalho, filtra só os dados e soma por fórmula", () => {
    const aba = partes.get("xl/worksheets/sheet1.xml")!;

    expect(aba).toContain('ySplit="5"');
    expect(aba).toContain('topLeftCell="A6"');
    // Uma proposta: cabeçalho na 5, dado na 6. A linha 7 (totais) fica fora.
    expect(aba).toContain('<autoFilter ref="A5:O6"/>');
    expect(aba).toContain("<f>SUM(L6:L6)</f>");
    expect(aba).toContain("<f>AVERAGE(M6:M6)</f>");
  });

  it("liga cada linha ao PDF da proposta", () => {
    expect(partes.get("xl/worksheets/sheet1.xml")).toContain('<hyperlink ref="O6"');
    expect(partes.get("xl/worksheets/_rels/sheet1.xml.rels")).toContain(
      "https://simulador.emconta.com.br/api/propostas/17/pdf",
    );
  });

  it("registra no cabeçalho quem exportou e com que filtros", () => {
    const aba = partes.get("xl/worksheets/sheet1.xml")!;
    expect(aba).toContain("João Bueno");
    expect(aba).toContain("período de 01/01/2026 a 31/03/2026");
    expect(aba).toContain("vendedor: Ana Souza");
    expect(aba).toContain("instituição: FIEMS");
  });

  it("escapa o XML e derruba caractere de controle do nome do cliente", () => {
    const partesEscapadas = abrirZip(
      montarPlanilhaDeClientes(
        dados([proposta({ clienteNome: "Lanches <A & B>\u0007 Ltda" })]),
      ),
    );
    const aba = partesEscapadas.get("xl/worksheets/sheet1.xml")!;

    expect(aba).toContain("Lanches &lt;A &amp; B&gt; Ltda");
    expect(aba).not.toContain("\u0007");
  });

  it("não quebra sem nenhuma proposta — e aí não tem filtro nem totais", () => {
    const vazia = abrirZip(montarPlanilhaDeClientes(dados([])));
    const aba = vazia.get("xl/worksheets/sheet1.xml")!;

    expect(aba).toContain("Nenhuma proposta encontrada");
    expect(aba).not.toContain("<autoFilter");
    expect(aba).not.toContain("<f>SUM(");
  });
});

describe("aba Resumo", () => {
  const partes = abrirZip(
    montarPlanilhaDeClientes(
      dados([
        proposta({ id: 1, consultor: "Ana Souza", economiaAnual: 1000 }),
        proposta({ id: 2, consultor: "Ana Souza", economiaAnual: 2000 }),
        proposta({
          id: 3,
          consultor: "Bruno Lima",
          economiaAnual: 9000,
          clienteDocumento: "98765432000111",
        }),
      ]),
    ),
  );

  it("ordena os vendedores pela economia anual, do maior para o menor", () => {
    const aba = partes.get("xl/worksheets/sheet2.xml")!;
    // Só da tabela para baixo: o nome do vendedor também aparece lá em cima, na
    // linha que descreve os filtros.
    const tabela = aba.slice(aba.indexOf('<row r="9"'));
    expect(tabela.indexOf("Bruno Lima")).toBeLessThan(tabela.indexOf("Ana Souza"));
  });

  it("conta clientes por CPF/CNPJ distinto, não por proposta", () => {
    // Três propostas, mas dois documentos.
    const aba = partes.get("xl/worksheets/sheet2.xml")!;
    const linhaDoKpi = /<row r="5".*?<\/row>/s.exec(aba)![0];
    expect(linhaDoKpi).toContain("<v>3</v>"); // propostas
    expect(linhaDoKpi).toContain("<v>2</v>"); // clientes
  });
});

describe("nome do arquivo", () => {
  it("usa a data da exportação", () => {
    expect(nomeArquivoDeClientes(new Date(2026, 9, 14))).toBe(
      "clientes-em-conta-2026-10-14.xlsm",
    );
  });
});
