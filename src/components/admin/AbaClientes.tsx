"use client";

/**
 * Clientes atendidos: cada proposta emitida, com o PDF de volta.
 *
 * O PDF é REGERADO a partir das entradas e da config congeladas no momento da
 * emissão — sai idêntico ao que o cliente recebeu, mesmo que a tarifa tenha
 * mudado depois.
 */

import { ExternalLink, Loader2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "../Avatar";
import { Card, SectionTitle } from "../ui";
import { BarraFiltros, FILTROS_VAZIOS, paraQuery, type EstadoFiltros } from "./Filtros";
import {
  formatarDesconto,
  formatarDocumento,
  formatarKwh,
  formatarMoeda,
  formatarTelefone,
} from "@/domain/simulator/format";
import type { PropostaListada } from "@/server/propostas";
import type { UsuarioListado } from "@/server/usuarios";

function quando(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function AbaClientes({ vendedores }: { vendedores: readonly UsuarioListado[] }) {
  const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_VAZIOS);
  const [propostas, setPropostas] = useState<PropostaListada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (f: EstadoFiltros) => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/propostas${paraQuery(f)}`);
      const corpo = (await resposta.json().catch(() => null)) as
        | { propostas?: PropostaListada[]; erro?: string }
        | null;

      if (!resposta.ok || !corpo?.propostas) {
        setErro(corpo?.erro ?? "Não foi possível carregar os clientes.");
        return;
      }
      setPropostas(corpo.propostas);
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // Busca por texto é debounced: não dispara um fetch por tecla digitada.
  useEffect(() => {
    const t = setTimeout(() => carregar(filtros), filtros.busca ? 350 : 0);
    return () => clearTimeout(t);
  }, [filtros, carregar]);

  const economiaTotal = propostas.reduce((s, p) => s + p.economiaAnual, 0);

  return (
    <div className="space-y-4">
      <BarraFiltros
        filtros={filtros}
        onChange={setFiltros}
        vendedores={vendedores}
        comBusca
      />

      <Card>
        <SectionTitle
          icon={<Users aria-hidden="true" className="size-5" />}
          descricao={
            propostas.length > 0
              ? `${propostas.length} proposta(s) · ${formatarMoeda(economiaTotal)} de economia anual`
              : "Cada proposta emitida, com o PDF original."
          }
        >
          Clientes atendidos
        </SectionTitle>

        {erro ? (
          <p
            role="alert"
            className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {erro}
          </p>
        ) : null}

        {carregando ? (
          <p className="flex items-center gap-2 py-6 text-marca-texto-suave">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            Carregando…
          </p>
        ) : propostas.length === 0 ? (
          <p className="py-8 text-center text-sm text-marca-texto-suave">
            Nenhuma proposta encontrada com estes filtros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-marca-borda text-left">
                  {[
                    "Cliente",
                    "Vendedor",
                    "UCs",
                    "Consumo",
                    "Fatura atual",
                    "Com Em Conta",
                    "Economia anual",
                    "Desconto",
                    "Data",
                    "Proposta",
                  ].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="whitespace-nowrap px-2 py-2 text-xs font-bold uppercase tracking-wide text-marca-texto-suave"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propostas.map((p) => (
                  <tr key={p.id} className="border-b border-marca-borda/60">
                    <th scope="row" className="px-2 py-2.5 text-left font-semibold">
                      <span className="block truncate">{p.clienteNome}</span>
                      <span className="block text-xs font-normal text-marca-texto-suave">
                        {formatarDocumento(p.clienteDocumento)} ·{" "}
                        {formatarTelefone(p.clienteTelefone)}
                      </span>
                    </th>

                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2">
                        {p.vendedorId ? (
                          <Avatar
                            usuarioId={p.vendedorId}
                            nome={p.consultor}
                            temFoto={p.vendedorTemFoto}
                            tamanho="sm"
                          />
                        ) : null}
                        <span className="truncate text-xs">{p.consultor}</span>
                      </span>
                    </td>

                    <td className="px-2 py-2.5 tabular-nums">{p.quantidadeUCs}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">
                      {formatarKwh(p.consumoMedio)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">
                      {formatarMoeda(p.faturaAtual)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">
                      {formatarMoeda(p.faturaComEmConta)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 font-bold tabular-nums text-marca-verde-escuro">
                      {formatarMoeda(p.economiaAnual)}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">
                      {formatarDesconto(p.descontoMedio)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-marca-texto-suave">
                      {quando(p.criadaEm)}
                    </td>

                    <td className="px-2 py-2.5">
                      <a
                        href={`/api/propostas/${p.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-marca-borda px-2.5 py-1.5 text-xs font-bold text-marca-texto hover:border-marca-azul-claro hover:bg-marca-azul-suave"
                      >
                        Ver PDF
                        <ExternalLink aria-hidden="true" className="size-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
