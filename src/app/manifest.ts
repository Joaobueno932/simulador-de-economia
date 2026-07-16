import type { MetadataRoute } from "next";

/**
 * Manifest do PWA — é o que o Android/iPad lê ao "Adicionar à tela inicial".
 *
 * Sem isto, o aparelho usava o favicon (48 px no máximo) esticado para o ícone
 * da home — daí a pixelação. Os ícones abaixo vêm da arte original em 512 px:
 *
 * - `any`      → fundo transparente, usado onde o sistema não recorta;
 * - `maskable` → fundo azul da marca com a arte na zona segura, para o Android
 *   recortar em círculo/quadrado arredondado sem cortar o mascote.
 *
 * O `apple-icon.png` (iOS) segue a convenção de arquivo do Next em `src/app/`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Simulador de Economia — Em Conta",
    short_name: "Em Conta",
    description:
      "Simule a economia na conta de luz com energia renovável e gere a proposta comercial em PDF.",
    start_url: "/",
    display: "standalone",
    background_color: "#F1F8F1",
    theme_color: "#0F579F",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icones/icone-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
