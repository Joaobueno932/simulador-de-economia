"use client";

/** Filtros compartilhados pelo dashboard, pelo histórico e pelos clientes. */

import { Filter, X } from "lucide-react";

import { Botao, Select } from "../ui";
import { INSTITUICOES } from "@/domain/auth/types";
import type { UsuarioListado } from "@/server/usuarios";

export interface EstadoFiltros {
  de: string;
  ate: string;
  vendedorId: string;
  instituicao: string;
  busca: string;
}

export const FILTROS_VAZIOS: EstadoFiltros = {
  de: "",
  ate: "",
  vendedorId: "",
  instituicao: "",
  busca: "",
};

/** Monta a querystring, omitindo o que está vazio. */
export function paraQuery(f: EstadoFiltros): string {
  const p = new URLSearchParams();
  if (f.de) p.set("de", f.de);
  if (f.ate) p.set("ate", f.ate);
  if (f.vendedorId) p.set("vendedorId", f.vendedorId);
  if (f.instituicao) p.set("instituicao", f.instituicao);
  if (f.busca.trim()) p.set("busca", f.busca.trim());
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function BarraFiltros({
  filtros,
  onChange,
  vendedores,
  comBusca = false,
}: {
  filtros: EstadoFiltros;
  onChange: (f: EstadoFiltros) => void;
  vendedores: readonly UsuarioListado[];
  comBusca?: boolean;
}) {
  const set = (patch: Partial<EstadoFiltros>) => onChange({ ...filtros, ...patch });

  const algumAtivo =
    filtros.de || filtros.ate || filtros.vendedorId || filtros.instituicao || filtros.busca;

  return (
    <div className="rounded-card border border-marca-borda/70 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-marca-texto-suave">
          <Filter aria-hidden="true" className="size-4" />
          Filtros
        </h2>

        {algumAtivo ? (
          <Botao variante="sutil" onClick={() => onChange(FILTROS_VAZIOS)}>
            <X aria-hidden="true" className="size-4" />
            Limpar
          </Botao>
        ) : null}
      </div>

      <div className={`grid gap-3 sm:grid-cols-2 ${comBusca ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <div>
          <label
            htmlFor="filtro-de"
            className="mb-1.5 block text-sm font-semibold text-marca-texto"
          >
            De
          </label>
          <input
            id="filtro-de"
            type="date"
            value={filtros.de}
            onChange={(e) => set({ de: e.target.value })}
            className="w-full rounded-xl border-2 border-marca-borda px-3 py-2 text-sm focus:border-marca-azul focus:ring-4 focus:ring-marca-azul/10"
          />
        </div>

        <div>
          <label
            htmlFor="filtro-ate"
            className="mb-1.5 block text-sm font-semibold text-marca-texto"
          >
            Até
          </label>
          <input
            id="filtro-ate"
            type="date"
            value={filtros.ate}
            onChange={(e) => set({ ate: e.target.value })}
            className="w-full rounded-xl border-2 border-marca-borda px-3 py-2 text-sm focus:border-marca-azul focus:ring-4 focus:ring-marca-azul/10"
          />
        </div>

        <Select
          label="Vendedor"
          value={filtros.vendedorId}
          onChange={(e) => set({ vendedorId: e.target.value })}
          opcoes={[
            { value: "", label: "Todos" },
            ...vendedores.map((v) => ({ value: String(v.id), label: v.nome })),
          ]}
        />

        <Select
          label="Instituição"
          value={filtros.instituicao}
          onChange={(e) => set({ instituicao: e.target.value })}
          opcoes={[
            { value: "", label: "Todas" },
            ...INSTITUICOES.map((i) => ({ value: i, label: i })),
          ]}
        />

        {comBusca ? (
          <div>
            <label
              htmlFor="filtro-busca"
              className="mb-1.5 block text-sm font-semibold text-marca-texto"
            >
              Cliente
            </label>
            <input
              id="filtro-busca"
              type="search"
              value={filtros.busca}
              onChange={(e) => set({ busca: e.target.value })}
              placeholder="Nome ou CPF/CNPJ"
              className="w-full rounded-xl border-2 border-marca-borda px-3 py-2 text-sm focus:border-marca-azul focus:ring-4 focus:ring-marca-azul/10"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
