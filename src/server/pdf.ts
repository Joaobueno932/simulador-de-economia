import "server-only";

/**
 * Geração do PDF da proposta.
 *
 * ESTRATÉGIA
 * ----------
 * 1. O componente `Proposta` é renderizado para HTML estático com
 *    `renderToStaticMarkup`. Como ele usa apenas estilos inline, o HTML é
 *    autossuficiente — não depende do build do Tailwind.
 * 2. As imagens são embutidas como data URI (base64) lidas do disco: o Chromium
 *    não precisa fazer nenhuma requisição de rede, então nunca há imagem faltando
 *    nem dependência de hotlink.
 * 3. O Chromium imprime esse HTML em A4 com `printBackground`. O texto sai
 *    VETORIAL e selecionável — não é screenshot.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Browser } from "puppeteer";

import { Proposta, type AssetsProposta } from "@/components/Proposta";
import type { ConfiguracaoSimulador } from "@/domain/simulator/config";
import type { DadosCliente, ResultadoSimulacao } from "@/domain/simulator/types";

const PASTA_IMG = path.join(process.cwd(), "public", "img");

/** Lê um PNG do disco e devolve como data URI. */
async function dataUri(arquivo: string): Promise<string> {
  const bytes = await readFile(path.join(PASTA_IMG, arquivo));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

let assetsCache: AssetsProposta | null = null;

/** Os assets mudam só no deploy — vale guardar em memória. */
async function carregarAssets(): Promise<AssetsProposta> {
  if (assetsCache) return assetsCache;

  const [logoEmConta, logoEmContaBranco, logoCsiFiems, mascote] = await Promise.all([
    dataUri("logo-em-conta.png"),
    dataUri("logo-em-conta-branco.png"),
    dataUri("logo-csi-fiems.png"),
    dataUri("mascote-heroi.png"),
  ]);

  assetsCache = { logoEmConta, logoEmContaBranco, logoCsiFiems, mascote };
  return assetsCache;
}

const ARGS_CHROME = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--font-render-hinting=none",
];

/** Locais usuais de um Chrome/Edge já instalado no sistema. */
const CAMINHOS_SISTEMA: Readonly<Record<string, readonly string[]>> = {
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ],
};

/** Primeiro navegador do sistema que realmente exista em disco. */
async function navegadorDoSistema(): Promise<string | null> {
  const { access } = await import("node:fs/promises");
  for (const caminho of CAMINHOS_SISTEMA[process.platform] ?? []) {
    try {
      await access(caminho);
      return caminho;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

async function abrirComExecutavel(executablePath: string): Promise<Browser> {
  const { default: puppeteerCore } = await import("puppeteer-core");
  return (await puppeteerCore.launch({
    executablePath,
    headless: true,
    args: ARGS_CHROME,
  })) as unknown as Browser;
}

/**
 * Abre o navegador, em ordem de preferência:
 *
 *  1. `PUPPETEER_EXECUTABLE_PATH` — controle explícito (Docker, CI, máquina
 *     corporativa onde o antivírus bloqueia o download do Chromium).
 *  2. Serverless (Vercel/Lambda): `@sparticuz/chromium`, porque o Chromium
 *     completo não cabe no bundle.
 *  3. Chromium que o `puppeteer` baixa junto — o caminho normal.
 *  4. Chrome/Edge já instalado no sistema — rede de segurança para quando o
 *     download do Chromium foi bloqueado.
 */
async function abrirNavegador(): Promise<Browser> {
  const explicito = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicito) return abrirComExecutavel(explicito);

  if (process.env.AWS_LAMBDA_FUNCTION_VERSION ?? process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return (await puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })) as unknown as Browser;
  }

  try {
    const { default: puppeteer } = await import("puppeteer");
    return await puppeteer.launch({ headless: true, args: ARGS_CHROME });
  } catch (erro) {
    const doSistema = await navegadorDoSistema();
    if (!doSistema) throw erro;
    return abrirComExecutavel(doSistema);
  }
}

/** Monta o documento HTML completo em volta do markup da proposta. */
function montarHtml(markup: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Proposta Em Conta</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  /* Reset mínimo para o markup da proposta */
  h1, ul, li, p { margin: 0; padding: 0; }
  img { display: block; }
</style>
</head>
<body>${markup}</body>
</html>`;
}

/**
 * Gera o PDF da proposta.
 *
 * Recebe o RESULTADO já recalculado no servidor — nunca valores vindos do
 * navegador.
 */
export async function gerarPdfProposta(
  cliente: DadosCliente,
  resultado: ResultadoSimulacao,
  config: ConfiguracaoSimulador,
): Promise<Uint8Array> {
  const assets = await carregarAssets();

  // Import dinâmico: o Next barra `react-dom/server` importado no topo de um
  // módulo alcançável pelo bundle, mesmo em rota Node.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(Proposta({ cliente, r: resultado, config, assets }));

  const navegador = await abrirNavegador();
  try {
    const pagina = await navegador.newPage();

    // `networkidle0` não é necessário: não há requisição externa nenhuma.
    await pagina.setContent(montarHtml(markup), { waitUntil: "load" });

    const pdf = await pagina.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return pdf;
  } finally {
    await navegador.close();
  }
}
