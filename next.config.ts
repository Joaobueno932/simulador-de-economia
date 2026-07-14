import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Puppeteer só é carregado no runtime Node da rota de PDF; mantê-lo fora do bundle.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],

  /**
   * Arquivos que a função de PDF lê do DISCO em tempo de execução.
   *
   * O Next só empacota na função serverless o que consegue detectar
   * ESTATICAMENTE. Caminho montado em runtime passa despercebido — em
   * desenvolvimento funciona (o disco tem tudo), na Vercel o arquivo não vai
   * junto e a rota estoura. Foram DOIS casos:
   *
   * 1. `public/img/**` — logos e mascote, lidos com `readFile` e embutidos como
   *    data URI. Sem isso: ENOENT.
   *
   * 2. `@sparticuz/chromium/bin/**` — o BINÁRIO do Chromium (um .br compactado).
   *    `serverExternalPackages` só impede que o JS do pacote seja empacotado;
   *    não copia a pasta `bin/`, que o pacote descompacta em runtime. Sem isso:
   *    "The input directory /var/task/node_modules/@sparticuz/chromium/bin does
   *    not exist".
   */
  outputFileTracingIncludes: {
    "/api/proposta/pdf": [
      "./public/img/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/propostas/[id]/pdf": [
      "./public/img/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },

  /**
   * O Chromium do `puppeteer` (~150 MB, só para desenvolvimento) não pode ir
   * para a função serverless: estoura o limite de tamanho da Vercel. Em
   * produção quem roda é o `@sparticuz/chromium`.
   */
  outputFileTracingExcludes: {
    "/api/proposta/pdf": ["./node_modules/puppeteer/.local-chromium/**"],
    "/api/propostas/[id]/pdf": ["./node_modules/puppeteer/.local-chromium/**"],
  },
};

export default nextConfig;
