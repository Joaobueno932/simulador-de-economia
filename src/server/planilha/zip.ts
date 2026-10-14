/**
 * Escritor de ZIP mínimo — o container de qualquer arquivo OOXML.
 *
 * POR QUE À MÃO, SEM BIBLIOTECA
 * -----------------------------
 * Um .xlsm é um ZIP com XML dentro. Escrever o ZIP são ~80 linhas usando o
 * `zlib` que já vem no Node; trazer `jszip`/`exceljs` custaria megabytes de
 * dependência (e `exceljs` nem escreve o formato macro-enabled) para fazer
 * exatamente isto. O projeto tem poucas dependências de propósito.
 *
 * Só o essencial: ZIP de 32 bits, sem Zip64 e sem criptografia. Dá conta de
 * sobra — a planilha exportada tem alguns milhares de linhas, não gigabytes.
 *
 * Não leva o marcador `server-only`: é um gerador puro (bytes a partir de
 * bytes), coberto por teste no vitest — que não consegue carregar o marcador.
 */

import { deflateRawSync } from "node:zlib";

export interface EntradaZip {
  /** Caminho dentro do pacote, sempre com "/" — ex.: `xl/worksheets/sheet1.xml`. */
  readonly nome: string;
  readonly dados: Uint8Array;
}

/** Tabela do CRC-32 (polinômio 0xEDB88320), montada uma vez. */
const TABELA_CRC: Uint32Array = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[i] = c >>> 0;
  }
  return tabela;
})();

function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) {
    c = TABELA_CRC[(c ^ dados[i]) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Data/hora no formato MS-DOS que o ZIP usa (segundos com resolução de 2). */
function dataHoraDos(quando: Date): { data: number; hora: number } {
  const ano = Math.max(1980, quando.getFullYear());
  return {
    data: ((ano - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate(),
    hora: (quando.getHours() << 11) | (quando.getMinutes() << 5) | (quando.getSeconds() >> 1),
  };
}

/**
 * Monta o ZIP.
 *
 * Cada entrada é comprimida com deflate; se a compressão não ajudar (arquivo
 * pequeno, já compactado), a entrada vai armazenada — um ZIP com entrada maior
 * que o original seria um resultado ruim de graça.
 */
export function montarZip(
  entradas: readonly EntradaZip[],
  carimbo: Date = new Date(),
): Uint8Array {
  const { data, hora } = dataHoraDos(carimbo);

  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;

  for (const entrada of entradas) {
    const nome = Buffer.from(entrada.nome, "utf8");
    const bruto = Buffer.from(entrada.dados);
    const comprimido = deflateRawSync(bruto, { level: 9 });

    const comprime = comprimido.length < bruto.length;
    const corpo = comprime ? comprimido : bruto;
    const metodo = comprime ? 8 : 0;
    const crc = crc32(bruto);

    const cabecalho = Buffer.alloc(30);
    cabecalho.writeUInt32LE(0x04034b50, 0); // assinatura do cabeçalho local
    cabecalho.writeUInt16LE(20, 4); // versão necessária (2.0)
    cabecalho.writeUInt16LE(0x0800, 6); // bit 11: nome em UTF-8
    cabecalho.writeUInt16LE(metodo, 8);
    cabecalho.writeUInt16LE(hora, 10);
    cabecalho.writeUInt16LE(data, 12);
    cabecalho.writeUInt32LE(crc, 14);
    cabecalho.writeUInt32LE(corpo.length, 18);
    cabecalho.writeUInt32LE(bruto.length, 22);
    cabecalho.writeUInt16LE(nome.length, 26);
    cabecalho.writeUInt16LE(0, 28); // sem campo extra

    locais.push(cabecalho, nome, corpo);

    const registro = Buffer.alloc(46);
    registro.writeUInt32LE(0x02014b50, 0); // assinatura do diretório central
    registro.writeUInt16LE(20, 4); // versão de quem escreveu
    registro.writeUInt16LE(20, 6); // versão necessária
    registro.writeUInt16LE(0x0800, 8);
    registro.writeUInt16LE(metodo, 10);
    registro.writeUInt16LE(hora, 12);
    registro.writeUInt16LE(data, 14);
    registro.writeUInt32LE(crc, 16);
    registro.writeUInt32LE(corpo.length, 20);
    registro.writeUInt32LE(bruto.length, 24);
    registro.writeUInt16LE(nome.length, 28);
    registro.writeUInt16LE(0, 30); // extra
    registro.writeUInt16LE(0, 32); // comentário
    registro.writeUInt16LE(0, 34); // disco
    registro.writeUInt16LE(0, 36); // atributos internos
    registro.writeUInt32LE(0, 38); // atributos externos
    registro.writeUInt32LE(deslocamento, 42);

    central.push(registro, nome);
    deslocamento += cabecalho.length + nome.length + corpo.length;
  }

  const diretorio = Buffer.concat(central);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); // assinatura do fim do diretório central
  fim.writeUInt16LE(0, 4); // disco atual
  fim.writeUInt16LE(0, 6); // disco do diretório
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  fim.writeUInt16LE(0, 20); // sem comentário

  return Buffer.concat([...locais, diretorio, fim]);
}
