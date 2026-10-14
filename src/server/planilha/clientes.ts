/**
 * A planilha da aba "Clientes atendidos".
 *
 * Duas abas:
 *   - **Clientes** — uma linha por proposta emitida, com os mesmos números da
 *     tela, mais CPF/CNPJ, telefone, economia mensal e um link que abre o PDF
 *     original. Cabeçalho congelado, filtro automático e linha de totais.
 *   - **Resumo** — indicadores do período e o consolidado por vendedor.
 *
 * O QUE VAI COMO NÚMERO E O QUE VAI COMO TEXTO
 * --------------------------------------------
 * Valor é número de verdade na célula (com formato `R$`, `kWh`, `%`), nunca
 * string formatada: quem recebe a planilha precisa poder somar, ordenar e
 * montar tabela dinâmica. Já CPF/CNPJ e telefone vão como TEXTO, com máscara —
 * se fossem número, o Excel comeria o zero à esquerda e viraria notação
 * científica no CNPJ.
 *
 * Os totais são FÓRMULA (`SUM`, `AVERAGE`), não valor calculado aqui: quem usa
 * o filtro automático ou apaga uma linha vê o total acompanhar.
 *
 * Não leva o marcador `server-only` — ver `ooxml.ts`.
 */

import {
  ESTILO,
  MIME_XLSM,
  data,
  formula,
  linha,
  link,
  montarXlsm,
  numero,
  refCelula,
  texto,
  vazia,
  type Aba,
  type Celula,
} from "./ooxml";
import { formatarData, formatarDocumento, formatarTelefone } from "@/domain/simulator/format";
import type { PropostaListada } from "@/server/propostas";

export { MIME_XLSM };

/** Os filtros que estavam valendo na tela, para constar no cabeçalho. */
export interface FiltrosAplicados {
  readonly de: string | null;
  readonly ate: string | null;
  /** Nome do vendedor, já resolvido a partir do id. */
  readonly vendedor: string | null;
  readonly instituicao: string | null;
  readonly busca: string | null;
}

export interface DadosDaExportacao {
  readonly propostas: readonly PropostaListada[];
  readonly filtros: FiltrosAplicados;
  /** Quem clicou em exportar — vai no cabeçalho e nas propriedades do arquivo. */
  readonly geradaPor: string;
  readonly geradaEm: Date;
  /** Origem do app (`https://...`), para o link do PDF abrir de dentro do Excel. */
  readonly origem: string;
}

const AZUL_GUIA = "FF0F579F";
const VERDE_GUIA = "FF3AAA35";

const EMPRESA = "Em Conta";

/** Uma frase dizendo a que recorte a planilha se refere. */
function descreverFiltros(f: FiltrosAplicados): string {
  const partes: string[] = [];

  if (f.de && f.ate) partes.push(`período de ${formatarData(f.de)} a ${formatarData(f.ate)}`);
  else if (f.de) partes.push(`a partir de ${formatarData(f.de)}`);
  else if (f.ate) partes.push(`até ${formatarData(f.ate)}`);

  if (f.vendedor) partes.push(`vendedor: ${f.vendedor}`);
  if (f.instituicao) partes.push(`instituição: ${f.instituicao}`);
  if (f.busca) partes.push(`busca: "${f.busca}"`);

  return partes.length
    ? `Filtros aplicados — ${partes.join(" · ")}`
    : "Sem filtros — todas as propostas às quais você tem acesso";
}

function quandoLongo(momento: Date): string {
  return momento.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Linha mesclada de ponta a ponta — título, subtítulo, nota de rodapé. */
function faixa(texto_: string, estilo: number, colunas: number, altura?: number) {
  const celulas: Celula[] = [texto(texto_, estilo)];
  // As demais células da mescla existem vazias: é o que o Excel espera.
  for (let i = 1; i < colunas; i++) celulas.push(vazia());
  return linha(celulas, altura);
}

// ---------------------------------------------------------------------------
// Aba "Clientes"
// ---------------------------------------------------------------------------

const COLUNAS_CLIENTES = [
  { titulo: "Nº", largura: 7 },
  { titulo: "Cliente", largura: 34 },
  { titulo: "CPF / CNPJ", largura: 20 },
  { titulo: "Telefone", largura: 17 },
  { titulo: "Vendedor", largura: 26 },
  { titulo: "UCs", largura: 7 },
  { titulo: "Consumo médio", largura: 16 },
  { titulo: "Fatura atual", largura: 15 },
  { titulo: "Com Em Conta", largura: 15 },
  { titulo: "Economia mensal", largura: 16 },
  { titulo: "Economia anual", largura: 16 },
  { titulo: "Desconto", largura: 11 },
  { titulo: "Emitida em", largura: 13 },
  { titulo: "Proposta", largura: 13 },
] as const;

/** Linha 1-based onde fica o cabeçalho da tabela. */
const LINHA_CABECALHO = 5;

function abaClientes(dados: DadosDaExportacao): Aba {
  const total = COLUNAS_CLIENTES.length;
  const ultima = total - 1;
  const linhas = [
    faixa("Clientes atendidos", ESTILO.titulo, total, 32),
    faixa(
      `Simulador de Economia · ${EMPRESA} — exportado em ${quandoLongo(dados.geradaEm)} por ${dados.geradaPor}`,
      ESTILO.subtitulo,
      total,
      18,
    ),
    faixa(descreverFiltros(dados.filtros), ESTILO.subtitulo, total, 18),
    linha([]),
    linha(
      COLUNAS_CLIENTES.map((c, i) =>
        texto(c.titulo, i === 1 || i === 4 ? ESTILO.cabecalhoEsquerda : ESTILO.cabecalho),
      ),
      30,
    ),
  ];

  dados.propostas.forEach((p) => {
    linhas.push(
      linha([
        numero(p.id, ESTILO.inteiro),
        texto(p.clienteNome, ESTILO.textoForte),
        texto(formatarDocumento(p.clienteDocumento), ESTILO.texto),
        texto(formatarTelefone(p.clienteTelefone), ESTILO.texto),
        texto(p.consultor, ESTILO.texto),
        numero(p.quantidadeUCs, ESTILO.inteiro),
        numero(p.consumoMedio, ESTILO.kwh),
        numero(p.faturaAtual, ESTILO.moeda),
        numero(p.faturaComEmConta, ESTILO.moeda),
        numero(p.economiaMensal, ESTILO.moeda),
        numero(p.economiaAnual, ESTILO.moedaDestaque),
        numero(p.descontoMedio, ESTILO.percentual),
        data(new Date(p.criadaEm), ESTILO.dataCurta),
        link("Abrir PDF", `${dados.origem}/api/propostas/${p.id}/pdf`, ESTILO.vinculo),
      ]),
    );
  });

  const primeiraDeDados = LINHA_CABECALHO + 1;
  const ultimaDeDados = LINHA_CABECALHO + dados.propostas.length;

  if (dados.propostas.length === 0) {
    linhas.push(
      faixa(
        "Nenhuma proposta encontrada com estes filtros.",
        ESTILO.subtitulo,
        total,
        24,
      ),
    );
  } else {
    /** `SUM(H6:H40)` para a coluna informada. */
    const consolidar = (funcao: "SUM" | "AVERAGE", coluna: number, estilo: number) =>
      formula(
        `${funcao}(${refCelula(primeiraDeDados, coluna)}:${refCelula(ultimaDeDados, coluna)})`,
        estilo,
      );

    const quantas = dados.propostas.length;

    linhas.push(
      linha(
        [
          vazia(ESTILO.totalVazio),
          texto(
            `Total — ${quantas} ${quantas === 1 ? "proposta" : "propostas"}`,
            ESTILO.totalTexto,
          ),
          vazia(ESTILO.totalVazio),
          vazia(ESTILO.totalVazio),
          vazia(ESTILO.totalVazio),
          consolidar("SUM", 5, ESTILO.totalInteiro),
          consolidar("SUM", 6, ESTILO.totalKwh),
          consolidar("SUM", 7, ESTILO.totalMoeda),
          consolidar("SUM", 8, ESTILO.totalMoeda),
          consolidar("SUM", 9, ESTILO.totalMoeda),
          consolidar("SUM", 10, ESTILO.totalMoedaDestaque),
          consolidar("AVERAGE", 11, ESTILO.totalPercentual),
          vazia(ESTILO.totalVazio),
          vazia(ESTILO.totalVazio),
        ],
        24,
      ),
    );
  }

  linhas.push(linha([]));
  linhas.push(
    faixa(
      "Cada linha é uma proposta já emitida, com os números congelados na emissão — " +
        "eles não mudam se a tarifa for alterada depois. O link abre o PDF original " +
        "(é preciso estar logado no simulador).",
      ESTILO.subtitulo,
      total,
      18,
    ),
  );

  const mesclas = [1, 2, 3].map((l) => `A${l}:${refCelula(l, ultima)}`);
  mesclas.push(`A${linhas.length}:${refCelula(linhas.length, ultima)}`);
  if (dados.propostas.length === 0) {
    mesclas.push(`A${primeiraDeDados}:${refCelula(primeiraDeDados, ultima)}`);
  }

  return {
    nome: "Clientes",
    corDaGuia: AZUL_GUIA,
    colunas: COLUNAS_CLIENTES.map((c) => ({ largura: c.largura })),
    linhas,
    congelar: { linha: LINHA_CABECALHO },
    // O filtro cobre só cabeçalho + dados: a linha de totais fica de fora, para
    // não ser escondida por um filtro.
    autoFiltro:
      dados.propostas.length > 0
        ? `A${LINHA_CABECALHO}:${refCelula(ultimaDeDados, ultima)}`
        : undefined,
    mesclas,
  };
}

// ---------------------------------------------------------------------------
// Aba "Resumo"
// ---------------------------------------------------------------------------

interface LinhaDeVendedor {
  readonly nome: string;
  readonly propostas: number;
  readonly clientes: number;
  readonly economiaAnual: number;
  readonly descontoMedio: number;
  readonly ultima: Date | null;
}

/**
 * Consolidado por vendedor.
 *
 * "Clientes" conta DOCUMENTOS distintos, não propostas: o mesmo cliente pode ter
 * recebido mais de uma proposta, e contá-lo duas vezes inflaria o número — é o
 * mesmo critério do dashboard.
 */
function consolidarPorVendedor(
  propostas: readonly PropostaListada[],
): readonly LinhaDeVendedor[] {
  const porVendedor = new Map<
    string,
    { propostas: number; documentos: Set<string>; economia: number; desconto: number; ultima: Date | null }
  >();

  for (const p of propostas) {
    const chave = p.consultor || "(sem vendedor)";
    const atual =
      porVendedor.get(chave) ??
      { propostas: 0, documentos: new Set<string>(), economia: 0, desconto: 0, ultima: null };

    const quando = new Date(p.criadaEm);

    atual.propostas += 1;
    atual.documentos.add(p.clienteDocumento);
    atual.economia += p.economiaAnual;
    atual.desconto += p.descontoMedio;
    atual.ultima = !atual.ultima || quando > atual.ultima ? quando : atual.ultima;

    porVendedor.set(chave, atual);
  }

  return [...porVendedor.entries()]
    .map(([nome, v]) => ({
      nome,
      propostas: v.propostas,
      clientes: v.documentos.size,
      economiaAnual: v.economia,
      descontoMedio: v.desconto / v.propostas,
      ultima: v.ultima,
    }))
    .sort((a, b) => b.economiaAnual - a.economiaAnual || a.nome.localeCompare(b.nome, "pt-BR"));
}

const COLUNAS_RESUMO = [
  { titulo: "Vendedor", largura: 30 },
  { titulo: "Propostas", largura: 12 },
  { titulo: "Clientes", largura: 12 },
  { titulo: "Economia anual", largura: 18 },
  { titulo: "Economia média", largura: 18 },
  { titulo: "Desconto médio", largura: 15 },
  { titulo: "Última proposta", largura: 16 },
] as const;

const LINHA_CABECALHO_RESUMO = 8;

function abaResumo(dados: DadosDaExportacao): Aba {
  const total = COLUNAS_RESUMO.length;
  const ultima = total - 1;

  const vendedores = consolidarPorVendedor(dados.propostas);
  const economiaTotal = dados.propostas.reduce((s, p) => s + p.economiaAnual, 0);
  const clientesDistintos = new Set(dados.propostas.map((p) => p.clienteDocumento)).size;
  const descontoMedio = dados.propostas.length
    ? dados.propostas.reduce((s, p) => s + p.descontoMedio, 0) / dados.propostas.length
    : 0;

  const linhas = [
    faixa("Resumo do período", ESTILO.titulo, total, 32),
    faixa(descreverFiltros(dados.filtros), ESTILO.subtitulo, total, 18),
    linha([]),

    // Faixa de indicadores: rótulos em cima, números embaixo.
    linha(
      [
        texto("PROPOSTAS", ESTILO.kpiRotulo),
        vazia(ESTILO.kpiRotulo),
        texto("CLIENTES", ESTILO.kpiRotulo),
        vazia(ESTILO.kpiRotulo),
        texto("ECONOMIA ANUAL", ESTILO.kpiRotulo),
        vazia(ESTILO.kpiRotulo),
        texto("DESCONTO MÉDIO", ESTILO.kpiRotulo),
      ],
      18,
    ),
    linha(
      [
        numero(dados.propostas.length, ESTILO.kpiInteiro),
        vazia(ESTILO.kpiInteiro),
        numero(clientesDistintos, ESTILO.kpiInteiro),
        vazia(ESTILO.kpiInteiro),
        numero(economiaTotal, ESTILO.kpiMoeda),
        vazia(ESTILO.kpiMoeda),
        numero(descontoMedio, ESTILO.kpiPercentual),
      ],
      30,
    ),

    linha([]),
    faixa("Por vendedor", ESTILO.textoForte, total, 22),
    linha(
      COLUNAS_RESUMO.map((c, i) =>
        texto(c.titulo, i === 0 ? ESTILO.cabecalhoEsquerda : ESTILO.cabecalho),
      ),
      26,
    ),
  ];

  vendedores.forEach((v) => {
    linhas.push(
      linha([
        texto(v.nome, ESTILO.textoForte),
        numero(v.propostas, ESTILO.inteiro),
        numero(v.clientes, ESTILO.inteiro),
        numero(v.economiaAnual, ESTILO.moedaDestaque),
        numero(v.economiaAnual / v.propostas, ESTILO.moeda),
        numero(v.descontoMedio, ESTILO.percentual),
        v.ultima ? data(v.ultima, ESTILO.dataCurta) : vazia(ESTILO.texto),
      ]),
    );
  });

  const primeiraDeDados = LINHA_CABECALHO_RESUMO + 1;
  const ultimaDeDados = LINHA_CABECALHO_RESUMO + vendedores.length;

  if (vendedores.length === 0) {
    linhas.push(
      faixa("Nenhuma proposta encontrada com estes filtros.", ESTILO.subtitulo, total, 24),
    );
  } else {
    const somar = (coluna: number, estilo: number) =>
      formula(
        `SUM(${refCelula(primeiraDeDados, coluna)}:${refCelula(ultimaDeDados, coluna)})`,
        estilo,
      );

    linhas.push(
      linha(
        [
          texto(`Total — ${vendedores.length} vendedor(es)`, ESTILO.totalTexto),
          somar(1, ESTILO.totalInteiro),
          // Os clientes NÃO são somados: o mesmo cliente pode aparecer para dois
          // vendedores, e a soma das colunas daria mais que o total real.
          numero(clientesDistintos, ESTILO.totalInteiro),
          somar(3, ESTILO.totalMoedaDestaque),
          formula(
            `IFERROR(${refCelula(ultimaDeDados + 1, 3)}/${refCelula(ultimaDeDados + 1, 1)},0)`,
            ESTILO.totalMoeda,
          ),
          numero(descontoMedio, ESTILO.totalPercentual),
          vazia(ESTILO.totalVazio),
        ],
        24,
      ),
    );
  }

  linhas.push(linha([]));
  linhas.push(
    faixa(
      "Clientes conta CPF/CNPJ distintos — o mesmo cliente pode ter recebido mais de " +
        "uma proposta. Por isso a coluna de clientes não é somada.",
      ESTILO.subtitulo,
      total,
      18,
    ),
  );

  const mesclas = [
    `A1:${refCelula(1, ultima)}`,
    `A2:${refCelula(2, ultima)}`,
    "A4:B4",
    "C4:D4",
    "E4:F4",
    "A5:B5",
    "C5:D5",
    "E5:F5",
    `A7:${refCelula(7, ultima)}`,
    `A${linhas.length}:${refCelula(linhas.length, ultima)}`,
  ];
  if (vendedores.length === 0) {
    mesclas.push(`A${primeiraDeDados}:${refCelula(primeiraDeDados, ultima)}`);
  }

  return {
    nome: "Resumo",
    corDaGuia: VERDE_GUIA,
    colunas: COLUNAS_RESUMO.map((c) => ({ largura: c.largura })),
    linhas,
    congelar: { linha: LINHA_CABECALHO_RESUMO },
    autoFiltro:
      vendedores.length > 0
        ? `A${LINHA_CABECALHO_RESUMO}:${refCelula(ultimaDeDados, ultima)}`
        : undefined,
    mesclas,
  };
}

// ---------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------

/** Monta o .xlsm da aba Clientes e devolve os bytes. */
export function montarPlanilhaDeClientes(dados: DadosDaExportacao): Uint8Array {
  return montarXlsm(
    [abaClientes(dados), abaResumo(dados)],
    {
      titulo: "Clientes atendidos — Simulador de Economia Em Conta",
      autor: dados.geradaPor,
      empresa: EMPRESA,
      descricao: descreverFiltros(dados.filtros),
    },
    dados.geradaEm,
  );
}

/** `clientes-em-conta-2026-10-14.xlsm` */
export function nomeArquivoDeClientes(quando: Date): string {
  const dia = [
    quando.getFullYear(),
    String(quando.getMonth() + 1).padStart(2, "0"),
    String(quando.getDate()).padStart(2, "0"),
  ].join("-");
  return `clientes-em-conta-${dia}.xlsm`;
}
