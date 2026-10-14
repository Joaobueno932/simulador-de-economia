/**
 * Gerador de pasta de trabalho .xlsm (SpreadsheetML / OOXML).
 *
 * O QUE É UM .xlsm AQUI
 * ---------------------
 * `.xlsm` é o formato *macro-enabled* do Excel: o mesmo pacote OOXML do `.xlsx`,
 * mas com o tipo de conteúdo `sheet.macroEnabled.main+xml` na parte do workbook.
 * É o que esta função escreve. O arquivo sai sem `vbaProject.bin` — ou seja, é
 * um .xlsm legítimo e **sem macro nenhuma**: abre direto, sem o aviso amarelo de
 * "conteúdo bloqueado", e aceita macro do usuário depois, sem ter que converter
 * o arquivo. Gerar um projeto VBA do zero exigiria escrever um container OLE à
 * mão, e não há macro para pôr dentro dele.
 *
 * ESTILO
 * ------
 * Os estilos são declarados UMA vez, em listas ordenadas, e o índice que o Excel
 * exige sai da posição na lista (`ESTILO.moeda`, e não um `s="9"` solto no meio
 * do XML). Inserir um estilo no meio não desalinha o resto.
 *
 * Não leva o marcador `server-only`: é um gerador puro (dados -> bytes), coberto
 * por teste no vitest — que não consegue carregar o marcador.
 */

import { montarZip, type EntradaZip } from "./zip";

// ---------------------------------------------------------------------------
// Células
// ---------------------------------------------------------------------------

export type Celula =
  | { readonly tipo: "vazia"; readonly estilo: number }
  | { readonly tipo: "texto"; readonly valor: string; readonly estilo: number }
  | { readonly tipo: "numero"; readonly valor: number; readonly estilo: number }
  | { readonly tipo: "data"; readonly valor: Date; readonly estilo: number }
  | { readonly tipo: "formula"; readonly formula: string; readonly estilo: number }
  | {
      readonly tipo: "link";
      readonly texto: string;
      readonly url: string;
      readonly estilo: number;
    };

export const vazia = (estilo = 0): Celula => ({ tipo: "vazia", estilo });

export const texto = (valor: string, estilo = 0): Celula => ({ tipo: "texto", valor, estilo });

export const numero = (valor: number, estilo = 0): Celula => ({ tipo: "numero", valor, estilo });

export const data = (valor: Date, estilo = 0): Celula => ({ tipo: "data", valor, estilo });

export const formula = (expressao: string, estilo = 0): Celula => ({
  tipo: "formula",
  formula: expressao,
  estilo,
});

export const link = (rotulo: string, url: string, estilo = 0): Celula => ({
  tipo: "link",
  texto: rotulo,
  url,
  estilo,
});

export interface Linha {
  readonly celulas: readonly Celula[];
  /** Altura em pontos. Sem valor, o Excel usa a altura padrão. */
  readonly altura?: number;
}

export const linha = (celulas: readonly Celula[], altura?: number): Linha => ({
  celulas,
  altura,
});

export interface Coluna {
  /** Largura na unidade do Excel (aproximadamente "caracteres"). */
  readonly largura: number;
}

export interface Aba {
  readonly nome: string;
  readonly colunas: readonly Coluna[];
  readonly linhas: readonly Linha[];
  /** Congela o painel: tudo acima de `linha` e à esquerda de `coluna` fica fixo. */
  readonly congelar?: { readonly linha?: number; readonly coluna?: number };
  /** Intervalo do filtro automático, incluindo o cabeçalho — ex.: `A5:N40`. */
  readonly autoFiltro?: string;
  readonly mesclas?: readonly string[];
  /** Cor da guia, em ARGB (`FF` + hex). */
  readonly corDaGuia?: string;
}

// ---------------------------------------------------------------------------
// Paleta e estilos
// ---------------------------------------------------------------------------

/** As mesmas cores da marca usadas na tela (`globals.css`), em ARGB. */
const COR = {
  texto: "FF1C2B3A",
  textoSuave: "FF5B6B7C",
  azul: "FF0F579F",
  azulSuave: "FFEAF2FB",
  verdeEscuro: "FF2B8228",
  borda: "FFDFE6EE",
  branco: "FFFFFFFF",
} as const;

const FONTES = [
  { nome: "padrao", tamanho: 11, cor: COR.texto },
  { nome: "cabecalho", tamanho: 11, cor: COR.branco, negrito: true },
  { nome: "titulo", tamanho: 16, cor: COR.azul, negrito: true },
  { nome: "subtitulo", tamanho: 10, cor: COR.textoSuave },
  { nome: "forte", tamanho: 11, cor: COR.texto, negrito: true },
  { nome: "destaque", tamanho: 11, cor: COR.verdeEscuro, negrito: true },
  { nome: "vinculo", tamanho: 11, cor: COR.azul, sublinhado: true },
  { nome: "rotulo", tamanho: 9, cor: COR.textoSuave, negrito: true },
  { nome: "kpi", tamanho: 14, cor: COR.azul, negrito: true },
] as const;

/**
 * Preenchimentos. Os dois primeiros são obrigatórios e nesta ordem — o Excel
 * exige `none` no índice 0 e `gray125` no 1.
 */
const FUNDOS = [
  { nome: "nenhum", cor: null },
  { nome: "cinza125", cor: null },
  { nome: "azul", cor: COR.azul },
  { nome: "azulSuave", cor: COR.azulSuave },
] as const;

const BORDAS = [
  { nome: "nenhuma", xml: "<left/><right/><top/><bottom/><diagonal/>" },
  {
    nome: "linha",
    xml: `<left/><right/><top/><bottom style="thin"><color rgb="${COR.borda}"/></bottom><diagonal/>`,
  },
  {
    nome: "total",
    xml: `<left/><right/><top style="medium"><color rgb="${COR.azul}"/></top><bottom/><diagonal/>`,
  },
  {
    nome: "caixa",
    xml:
      `<left style="thin"><color rgb="${COR.borda}"/></left>` +
      `<right style="thin"><color rgb="${COR.borda}"/></right>` +
      `<top style="thin"><color rgb="${COR.borda}"/></top>` +
      `<bottom style="thin"><color rgb="${COR.borda}"/></bottom><diagonal/>`,
  },
] as const;

/**
 * Formatos numéricos próprios. O Excel reserva os ids até 163 para os dele; os
 * nossos começam em 164.
 *
 * `dd/mm/yyyy` é escrito à mão em vez de usar o formato 14 (embutido) porque o
 * 14 muda a ordem dos campos conforme o idioma do Windows — e a data aqui é
 * sempre brasileira.
 */
const FORMATOS = [
  { nome: "moeda", id: 164, codigo: '"R$"\\ #,##0.00' },
  { nome: "kwh", id: 165, codigo: '#,##0\\ "kWh"' },
  { nome: "percentual", id: 166, codigo: "0%" },
  { nome: "dataCurta", id: 167, codigo: "dd/mm/yyyy" },
  { nome: "dataHora", id: 168, codigo: "dd/mm/yyyy\\ hh:mm" },
  { nome: "inteiro", id: 169, codigo: "#,##0" },
] as const;

type NomeFonte = (typeof FONTES)[number]["nome"];
type NomeFundo = (typeof FUNDOS)[number]["nome"];
type NomeBorda = (typeof BORDAS)[number]["nome"];
type NomeFormato = (typeof FORMATOS)[number]["nome"];

interface DefEstilo {
  readonly nome: string;
  readonly fonte?: NomeFonte;
  readonly fundo?: NomeFundo;
  readonly borda?: NomeBorda;
  readonly formato?: NomeFormato;
  readonly h?: "left" | "center" | "right";
  readonly v?: "top" | "center" | "bottom";
  readonly quebrar?: boolean;
}

/**
 * A ORDEM IMPORTA: o `s` de cada célula no XML é o índice nesta lista. Por isso
 * ninguém escreve o número à mão — use `ESTILO.<nome>`.
 */
const ESTILOS = [
  { nome: "padrao" },
  { nome: "titulo", fonte: "titulo", v: "center" },
  { nome: "subtitulo", fonte: "subtitulo", v: "center" },
  { nome: "rotulo", fonte: "rotulo", v: "center" },

  // Cabeçalho da tabela.
  { nome: "cabecalho", fonte: "cabecalho", fundo: "azul", h: "center", v: "center", quebrar: true },
  { nome: "cabecalhoEsquerda", fonte: "cabecalho", fundo: "azul", h: "left", v: "center" },

  // Corpo da tabela: toda célula leva o fio de baixo, como a tabela da tela.
  { nome: "texto", borda: "linha", v: "center" },
  { nome: "textoForte", fonte: "forte", borda: "linha", v: "center" },
  { nome: "inteiro", borda: "linha", formato: "inteiro", h: "center", v: "center" },
  { nome: "kwh", borda: "linha", formato: "kwh", h: "right", v: "center" },
  { nome: "moeda", borda: "linha", formato: "moeda", h: "right", v: "center" },
  {
    nome: "moedaDestaque",
    fonte: "destaque",
    borda: "linha",
    formato: "moeda",
    h: "right",
    v: "center",
  },
  { nome: "percentual", borda: "linha", formato: "percentual", h: "center", v: "center" },
  { nome: "dataCurta", borda: "linha", formato: "dataCurta", h: "center", v: "center" },
  { nome: "dataHora", borda: "linha", formato: "dataHora", h: "center", v: "center" },
  { nome: "vinculo", fonte: "vinculo", borda: "linha", h: "center", v: "center" },

  // Linha de totais.
  { nome: "totalVazio", borda: "total" },
  { nome: "totalTexto", fonte: "forte", borda: "total", v: "center" },
  {
    nome: "totalInteiro",
    fonte: "forte",
    borda: "total",
    formato: "inteiro",
    h: "center",
    v: "center",
  },
  { nome: "totalKwh", fonte: "forte", borda: "total", formato: "kwh", h: "right", v: "center" },
  { nome: "totalMoeda", fonte: "forte", borda: "total", formato: "moeda", h: "right", v: "center" },
  {
    nome: "totalMoedaDestaque",
    fonte: "destaque",
    borda: "total",
    formato: "moeda",
    h: "right",
    v: "center",
  },
  {
    nome: "totalPercentual",
    fonte: "forte",
    borda: "total",
    formato: "percentual",
    h: "center",
    v: "center",
  },

  // Cartões de indicador do resumo.
  {
    nome: "kpiRotulo",
    fonte: "rotulo",
    fundo: "azulSuave",
    borda: "caixa",
    h: "center",
    v: "center",
  },
  {
    nome: "kpiMoeda",
    fonte: "kpi",
    fundo: "azulSuave",
    borda: "caixa",
    formato: "moeda",
    h: "center",
    v: "center",
  },
  {
    nome: "kpiInteiro",
    fonte: "kpi",
    fundo: "azulSuave",
    borda: "caixa",
    formato: "inteiro",
    h: "center",
    v: "center",
  },
  {
    nome: "kpiPercentual",
    fonte: "kpi",
    fundo: "azulSuave",
    borda: "caixa",
    formato: "percentual",
    h: "center",
    v: "center",
  },
] as const satisfies readonly DefEstilo[];

type NomeEstilo = (typeof ESTILOS)[number]["nome"];

/** Nome do estilo -> índice em `cellXfs`. */
export const ESTILO = Object.fromEntries(ESTILOS.map((e, i) => [e.nome, i])) as Record<
  NomeEstilo,
  number
>;

const indiceDe = (
  lista: readonly { readonly nome: string }[],
  nome: string | undefined,
): number => (nome === undefined ? 0 : Math.max(0, lista.findIndex((i) => i.nome === nome)));

// ---------------------------------------------------------------------------
// Utilidades de XML e de referência de célula
// ---------------------------------------------------------------------------

const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Escapa texto para XML.
 *
 * Também derruba caracteres de controle: o XML 1.0 não os aceita, e um nome de
 * cliente colado de outro sistema pode trazer um deles — o que faria o Excel
 * acusar arquivo corrompido em vez de abrir a planilha.
 */
export function escaparXml(valor: string): string {
  return valor
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function letraColuna(indice: number): string {
  let n = indice + 1;
  let letras = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - resto) / 26);
  }
  return letras;
}

/** (linha 1-based, coluna 0-based) -> "B7". */
export const refCelula = (linha: number, coluna: number): string =>
  `${letraColuna(coluna)}${linha}`;

/**
 * Data -> número de série do Excel (dias desde 30/12/1899).
 *
 * Usa os componentes LOCAIS da data: a planilha é lida no mesmo fuso de quem
 * gerou, e o que importa é o dia que aparece na tela, não o instante em UTC.
 */
export function serialExcel(quando: Date): number {
  const dias =
    Date.UTC(quando.getFullYear(), quando.getMonth(), quando.getDate()) / 86_400_000 + 25_569;
  const fracao =
    (quando.getHours() * 3600 + quando.getMinutes() * 60 + quando.getSeconds()) / 86_400;
  return dias + fracao;
}

/** O Excel recusa `: \ / ? * [ ]` no nome da aba e corta em 31 caracteres. */
const nomeDeAbaValido = (nome: string): string =>
  nome.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Planilha";

// ---------------------------------------------------------------------------
// Partes do pacote
// ---------------------------------------------------------------------------

function estilosXml(): string {
  const fontes = FONTES.map((f) => {
    const negrito = "negrito" in f && f.negrito ? "<b/>" : "";
    const sublinhado = "sublinhado" in f && f.sublinhado ? "<u/>" : "";
    return (
      `<font>${negrito}${sublinhado}<sz val="${f.tamanho}"/><color rgb="${f.cor}"/>` +
      `<name val="Calibri"/><family val="2"/><scheme val="minor"/></font>`
    );
  }).join("");

  const fundos = FUNDOS.map((f, i) => {
    if (i === 0) return '<fill><patternFill patternType="none"/></fill>';
    if (i === 1) return '<fill><patternFill patternType="gray125"/></fill>';
    return (
      '<fill><patternFill patternType="solid">' +
      `<fgColor rgb="${f.cor}"/><bgColor indexed="64"/></patternFill></fill>`
    );
  }).join("");

  const bordas = BORDAS.map((b) => `<border>${b.xml}</border>`).join("");

  const formatos = FORMATOS.map(
    (f) => `<numFmt numFmtId="${f.id}" formatCode="${escaparXml(f.codigo)}"/>`,
  ).join("");

  // O `as const` acima preserva os nomes literais (que viram `NomeEstilo`), mas
  // deixa cada item com um tipo próprio, sem as chaves opcionais. Aqui a leitura
  // é pela forma comum.
  const xfs = (ESTILOS as readonly DefEstilo[]).map((e) => {
    const alinhado = Boolean(e.h || e.v || e.quebrar);

    const atributos = [
      `numFmtId="${e.formato ? FORMATOS[indiceDe(FORMATOS, e.formato)]!.id : 0}"`,
      `fontId="${indiceDe(FONTES, e.fonte)}"`,
      `fillId="${indiceDe(FUNDOS, e.fundo)}"`,
      `borderId="${indiceDe(BORDAS, e.borda)}"`,
      'xfId="0"',
      e.fonte ? 'applyFont="1"' : "",
      e.fundo ? 'applyFill="1"' : "",
      e.borda ? 'applyBorder="1"' : "",
      e.formato ? 'applyNumberFormat="1"' : "",
      alinhado ? 'applyAlignment="1"' : "",
    ].filter(Boolean);

    if (!alinhado) return `<xf ${atributos.join(" ")}/>`;

    const alinhamento =
      "<alignment" +
      (e.h ? ` horizontal="${e.h}"` : "") +
      (e.v ? ` vertical="${e.v}"` : "") +
      (e.quebrar ? ' wrapText="1"' : "") +
      "/>";

    return `<xf ${atributos.join(" ")}>${alinhamento}</xf>`;
  }).join("");

  return (
    CABECALHO_XML +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<numFmts count="${FORMATOS.length}">${formatos}</numFmts>` +
    `<fonts count="${FONTES.length}">${fontes}</fonts>` +
    `<fills count="${FUNDOS.length}">${fundos}</fills>` +
    `<borders count="${BORDAS.length}">${bordas}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${ESTILOS.length}">${xfs}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="0"/>' +
    '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
    "</styleSheet>"
  );
}

interface AbaRenderizada {
  readonly xml: string;
  /** Vínculos externos da aba, na ordem dos `rId`. */
  readonly links: readonly string[];
}

function abaXml(aba: Aba): AbaRenderizada {
  const links: string[] = [];
  const ancoras: string[] = [];

  const linhasXml = aba.linhas
    .map((l, indice) => {
      const numeroDaLinha = indice + 1;

      const celulas = l.celulas
        .map((celula, coluna) => {
          const ref = refCelula(numeroDaLinha, coluna);
          const s = celula.estilo ? ` s="${celula.estilo}"` : "";

          switch (celula.tipo) {
            case "vazia":
              // Uma célula só com estilo ainda precisa existir no XML, senão o
              // fio de baixo e o fundo não são desenhados.
              return celula.estilo ? `<c r="${ref}"${s}/>` : "";

            case "texto":
              return (
                `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">` +
                `${escaparXml(celula.valor)}</t></is></c>`
              );

            case "numero":
              return Number.isFinite(celula.valor)
                ? `<c r="${ref}"${s}><v>${celula.valor}</v></c>`
                : `<c r="${ref}"${s}/>`;

            case "data":
              return `<c r="${ref}"${s}><v>${serialExcel(celula.valor)}</v></c>`;

            case "formula":
              // Sem valor em cache: o `fullCalcOnLoad` do workbook manda o Excel
              // calcular na abertura.
              return `<c r="${ref}"${s}><f>${escaparXml(celula.formula)}</f></c>`;

            case "link":
              links.push(celula.url);
              ancoras.push(`<hyperlink ref="${ref}" r:id="rId${links.length}"/>`);
              return (
                `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">` +
                `${escaparXml(celula.texto)}</t></is></c>`
              );
          }
        })
        .join("");

      const altura = l.altura ? ` ht="${l.altura}" customHeight="1"` : "";
      return `<row r="${numeroDaLinha}"${altura}>${celulas}</row>`;
    })
    .join("");

  const colunasUsadas = Math.max(
    1,
    aba.colunas.length,
    ...aba.linhas.map((l) => l.celulas.length),
  );
  const dimensao = `A1:${refCelula(Math.max(1, aba.linhas.length), colunasUsadas - 1)}`;

  const colunas = aba.colunas.length
    ? "<cols>" +
      aba.colunas
        .map(
          (c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura}" customWidth="1"/>`,
        )
        .join("") +
      "</cols>"
    : "";

  // Painel congelado: `topLeftCell` é a primeira célula que ainda rola.
  const painel = (() => {
    const l = aba.congelar?.linha ?? 0;
    const c = aba.congelar?.coluna ?? 0;
    if (!l && !c) return "";
    const ativo = l && c ? "bottomRight" : l ? "bottomLeft" : "topRight";
    const canto = refCelula(l + 1, c);
    return (
      `<pane${c ? ` xSplit="${c}"` : ""}${l ? ` ySplit="${l}"` : ""} topLeftCell="${canto}"` +
      ` activePane="${ativo}" state="frozen"/>` +
      `<selection pane="${ativo}" activeCell="${canto}" sqref="${canto}"/>`
    );
  })();

  const mesclas = aba.mesclas?.length
    ? `<mergeCells count="${aba.mesclas.length}">` +
      aba.mesclas.map((m) => `<mergeCell ref="${m}"/>`).join("") +
      "</mergeCells>"
    : "";

  // A ORDEM dos elementos abaixo é imposta pelo esquema do OOXML — trocar dois
  // de lugar faz o Excel acusar arquivo corrompido.
  const xml =
    CABECALHO_XML +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    "<sheetPr>" +
    (aba.corDaGuia ? `<tabColor rgb="${aba.corDaGuia}"/>` : "") +
    '<pageSetUpPr fitToPage="1"/>' +
    "</sheetPr>" +
    `<dimension ref="${dimensao}"/>` +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0">' +
    painel +
    "</sheetView></sheetViews>" +
    '<sheetFormatPr defaultRowHeight="18" baseColWidth="10"/>' +
    colunas +
    `<sheetData>${linhasXml}</sheetData>` +
    (aba.autoFiltro ? `<autoFilter ref="${aba.autoFiltro}"/>` : "") +
    mesclas +
    (ancoras.length ? `<hyperlinks>${ancoras.join("")}</hyperlinks>` : "") +
    '<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    "</worksheet>";

  return { xml, links };
}

function relsDaAba(links: readonly string[]): string {
  return (
    CABECALHO_XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    links
      .map(
        (url, i) =>
          `<Relationship Id="rId${i + 1}"` +
          ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"' +
          ` Target="${escaparXml(url)}" TargetMode="External"/>`,
      )
      .join("") +
    "</Relationships>"
  );
}

export interface MetadadosPlanilha {
  readonly titulo: string;
  readonly autor: string;
  readonly empresa: string;
  readonly descricao?: string;
}

function nucleoXml(meta: MetadadosPlanilha, quando: Date): string {
  const iso = quando.toISOString().replace(/\.\d{3}Z$/, "Z");
  return (
    CABECALHO_XML +
    '<cp:coreProperties' +
    ' xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"' +
    ' xmlns:dcmitype="http://purl.org/dc/dcmitype/"' +
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escaparXml(meta.titulo)}</dc:title>` +
    (meta.descricao ? `<dc:description>${escaparXml(meta.descricao)}</dc:description>` : "") +
    `<dc:creator>${escaparXml(meta.autor)}</dc:creator>` +
    `<cp:lastModifiedBy>${escaparXml(meta.autor)}</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
    "</cp:coreProperties>"
  );
}

function aplicativoXml(meta: MetadadosPlanilha, abas: readonly Aba[]): string {
  const nomes = abas
    .map((a) => `<vt:lpstr>${escaparXml(nomeDeAbaValido(a.nome))}</vt:lpstr>`)
    .join("");

  // A ordem dos elementos segue o esquema extended-properties.
  return (
    CABECALHO_XML +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"' +
    ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    `<Company>${escaparXml(meta.empresa)}</Company>` +
    "<ScaleCrop>false</ScaleCrop>" +
    '<HeadingPairs><vt:vector size="2" baseType="variant">' +
    "<vt:variant><vt:lpstr>Planilhas</vt:lpstr></vt:variant>" +
    `<vt:variant><vt:i4>${abas.length}</vt:i4></vt:variant>` +
    "</vt:vector></HeadingPairs>" +
    `<TitlesOfParts><vt:vector size="${abas.length}" baseType="lpstr">${nomes}</vt:vector></TitlesOfParts>` +
    "<LinksUpToDate>false</LinksUpToDate>" +
    "<SharedDoc>false</SharedDoc>" +
    "<HyperlinksChanged>false</HyperlinksChanged>" +
    `<Application>${escaparXml(meta.empresa)} - Simulador de Economia</Application>` +
    "<DocSecurity>0</DocSecurity>" +
    "</Properties>"
  );
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

const utf8 = (texto: string): Uint8Array => new TextEncoder().encode(texto);

/** Monta o .xlsm e devolve os bytes do arquivo. */
export function montarXlsm(
  abas: readonly Aba[],
  meta: MetadadosPlanilha,
  quando: Date = new Date(),
): Uint8Array {
  if (abas.length === 0) throw new Error("A planilha precisa de pelo menos uma aba.");

  const entradas: EntradaZip[] = [];
  const renderizadas = abas.map(abaXml);

  // [Content_Types].xml — é aqui que o arquivo se declara macro-enabled.
  entradas.push({
    nome: "[Content_Types].xml",
    dados: utf8(
      CABECALHO_XML +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels"' +
        ' ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml"' +
        ' ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/>' +
        abas
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml"` +
              ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
          )
          .join("") +
        '<Override PartName="/xl/styles.xml"' +
        ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml"' +
        ' ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml"' +
        ' ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        "</Types>",
    ),
  });

  entradas.push({
    nome: "_rels/.rels",
    dados: utf8(
      CABECALHO_XML +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1"' +
        ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"' +
        ' Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2"' +
        ' Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"' +
        ' Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3"' +
        ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"' +
        ' Target="docProps/app.xml"/>' +
        "</Relationships>",
    ),
  });

  entradas.push({ nome: "docProps/core.xml", dados: utf8(nucleoXml(meta, quando)) });
  entradas.push({ nome: "docProps/app.xml", dados: utf8(aplicativoXml(meta, abas)) });

  entradas.push({
    nome: "xl/workbook.xml",
    dados: utf8(
      CABECALHO_XML +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<workbookPr codeName="Planilha"/>' +
        '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="26000" windowHeight="15000"/></bookViews>' +
        "<sheets>" +
        abas
          .map(
            (aba, i) =>
              `<sheet name="${escaparXml(nomeDeAbaValido(aba.nome))}" sheetId="${i + 1}"` +
              ` r:id="rId${i + 1}"/>`,
          )
          .join("") +
        "</sheets>" +
        // As fórmulas vão sem valor em cache; `fullCalcOnLoad` faz o Excel
        // calcular tudo ao abrir.
        '<calcPr calcId="0" fullCalcOnLoad="1"/>' +
        "</workbook>",
    ),
  });

  entradas.push({
    nome: "xl/_rels/workbook.xml.rels",
    dados: utf8(
      CABECALHO_XML +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        abas
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}"` +
              ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"' +
              ` Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${abas.length + 1}"` +
        ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"' +
        ' Target="styles.xml"/>' +
        "</Relationships>",
    ),
  });

  entradas.push({ nome: "xl/styles.xml", dados: utf8(estilosXml()) });

  renderizadas.forEach((render, i) => {
    entradas.push({ nome: `xl/worksheets/sheet${i + 1}.xml`, dados: utf8(render.xml) });
    if (render.links.length) {
      entradas.push({
        nome: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
        dados: utf8(relsDaAba(render.links)),
      });
    }
  });

  return montarZip(entradas, quando);
}

/** O tipo MIME do .xlsm — o do .xlsx não serve. */
export const MIME_XLSM = "application/vnd.ms-excel.sheet.macroEnabled.12";
