import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Puppeteer só é carregado no runtime Node da rota de PDF; mantê-lo fora do bundle.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],

  /**
   * As imagens do PDF (logos e mascote) são lidas do disco em tempo de execução,
   * com `readFile(process.cwd() + "/public/img/...")`.
   *
   * O Next só empacota na função serverless os arquivos que consegue detectar
   * ESTATICAMENTE. Um caminho montado em runtime passa despercebido: em
   * desenvolvimento funciona (o disco tem tudo), mas na Vercel os PNGs não vão
   * junto e o `readFile` estoura com ENOENT — o PDF quebrava só depois de
   * publicado.
   *
   * Isto manda incluir os arquivos explicitamente nas duas rotas que geram PDF.
   */
  outputFileTracingIncludes: {
    "/api/proposta/pdf": ["./public/img/**"],
    "/api/propostas/[id]/pdf": ["./public/img/**"],
  },
};

export default nextConfig;
