import "server-only";

/**
 * Leitura dos filtros da querystring, num lugar só.
 *
 * Nada aqui vira SQL por concatenação: o valor sai daqui já limpo e vai como
 * parâmetro (`$1`, `$2`…) nas consultas.
 */

import { INSTITUICOES } from "@/domain/auth/types";

export interface Filtros {
  de: string | null;
  ate: string | null;
  vendedorId: number | null;
  instituicao: string | null;
  busca: string | null;
  tipo: string | null;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function filtrosDaUrl(url: URL): Filtros {
  const p = url.searchParams;

  const data = (chave: string): string | null => {
    const v = p.get(chave);
    return v && DATA_ISO.test(v) ? v : null;
  };

  const vendedor = Number(p.get("vendedorId"));
  const instituicao = p.get("instituicao");

  return {
    de: data("de"),
    ate: data("ate"),
    vendedorId: Number.isInteger(vendedor) && vendedor > 0 ? vendedor : null,
    // Só aceita instituição conhecida — não deixa string arbitrária chegar à consulta.
    instituicao:
      instituicao && (INSTITUICOES as readonly string[]).includes(instituicao)
        ? instituicao
        : null,
    busca: p.get("busca")?.trim() || null,
    tipo: p.get("tipo")?.trim() || null,
  };
}
