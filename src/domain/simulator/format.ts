/**
 * Formatação pt-BR — o ÚNICO lugar onde há arredondamento.
 *
 * Tela, testes e PDF consomem o mesmo `ResultadoSimulacao` e passam por estas
 * funções, então os três exibem exatamente os mesmos centavos.
 */

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numero = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimal2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * O ICU insere espaço não-quebrável (U+00A0 ou U+202F) entre "R$" e o número, e
 * a escolha varia conforme a versão do ICU. Normalizamos para espaço comum para
 * que Node (testes), navegador (tela) e Chromium (PDF) produzam a MESMA string.
 */
function normalizarEspacos(texto: string): string {
  return texto.replace(/[\u00A0\u202F]/g, " ");
}

/** R$ 1.234,56 */
export function formatarMoeda(valor: number): string {
  return normalizarEspacos(moeda.format(valor));
}

/** 2.616 kWh */
export function formatarKwh(valor: number): string {
  return `${normalizarEspacos(numero.format(valor))} kWh`;
}

/** 0,97 */
export function formatarDecimal(valor: number): string {
  return normalizarEspacos(decimal2.format(valor));
}

/**
 * Fração 0..1 -> "6,97%".
 * @param casas casas decimais (padrão 2)
 */
export function formatarPercentual(fracao: number, casas = 2): string {
  return normalizarEspacos(
    new Intl.NumberFormat("pt-BR", {
      style: "percent",
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }).format(fracao),
  );
}

/**
 * Desconto: sempre INTEIRO, sem casa decimal. Fração 0,2 -> "20%".
 *
 * Tem função própria (em vez de `formatarPercentual(x, 0)` espalhado) porque é
 * uma regra de negócio, não uma escolha de exibição: o desconto é um número
 * inteiro em todo lugar — tela, proposta e histórico. Um único ponto garante
 * que os três não divirjam.
 */
export function formatarDesconto(fracao: number): string {
  return formatarPercentual(fracao, 0);
}

/** ISO `yyyy-mm-dd` -> `dd/mm/aaaa`, sem depender do fuso do servidor. */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

/** Soma dias a uma data ISO e devolve ISO. */
export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Data de hoje em ISO, no fuso local. */
export function hojeISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Máscara de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00). */
export function formatarDocumento(digitos: string): string {
  const d = digitos.replace(/\D/g, "");
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Máscara de telefone: (00) 0000-0000 ou (00) 00000-0000. */
export function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/** "01 Unidade(s)" — como aparece na proposta da planilha. */
export function formatarQuantidadeUCs(quantidade: number): string {
  return `${String(quantidade).padStart(2, "0")} Unidade${quantidade === 1 ? "" : "s"}`;
}

/** Nome do arquivo: proposta-em-conta-nome-do-cliente-data.pdf */
export function nomeArquivoProposta(nomeCliente: string, dataISO: string): string {
  const slug = nomeCliente
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `proposta-em-conta-${slug || "cliente"}-${dataISO}.pdf`;
}
