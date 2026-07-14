"use client";

/**
 * Avatar do usuário.
 *
 * Sem foto, mostra as iniciais — nunca um espaço vazio. A cor vem do nome, então
 * o mesmo vendedor tem sempre a mesma cor e o gestor o reconhece de relance.
 */

const CORES = [
  "bg-marca-azul",
  "bg-marca-verde",
  "bg-marca-laranja",
  "bg-marca-azul-claro",
  "bg-marca-verde-escuro",
] as const;

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function corDe(nome: string): string {
  let soma = 0;
  for (const c of nome) soma += c.charCodeAt(0);
  return CORES[soma % CORES.length];
}

const TAMANHOS = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl",
} as const;

export function Avatar({
  usuarioId,
  nome,
  temFoto,
  tamanho = "md",
  /** Muda quando a foto é trocada, para furar o cache do navegador. */
  versao,
  className = "",
}: {
  usuarioId: number;
  nome: string;
  temFoto: boolean;
  tamanho?: keyof typeof TAMANHOS;
  versao?: number;
  className?: string;
}) {
  const base = `${TAMANHOS[tamanho]} shrink-0 rounded-full object-cover ${className}`;

  if (temFoto) {
    const src = `/api/usuarios/${usuarioId}/foto${versao ? `?v=${versao}` : ""}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`Foto de ${nome}`}
        className={`${base} border-2 border-white shadow-sm`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={nome}
      className={`${TAMANHOS[tamanho]} grid shrink-0 place-items-center rounded-full font-bold text-white ${corDe(nome)} ${className}`}
    >
      {iniciais(nome)}
    </span>
  );
}
