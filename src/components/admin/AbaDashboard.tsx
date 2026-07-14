"use client";

/**
 * Dashboard do gestor: como cada vendedor está produzindo.
 *
 * OBSERVAÇÃO SOBRE INSTITUIÇÕES: um vendedor pode estar em mais de uma. O
 * quadro "por instituição" conta a proposta dele em CADA instituição — é o que
 * cada instituição quer ver do seu pessoal. Por isso a soma por instituição pode
 * passar do total geral, e a tela diz isso em vez de deixar o gestor achar que
 * há erro de conta.
 */

import { Building2, Loader2, PiggyBank, Receipt, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "../Avatar";
import { Card, SectionTitle } from "../ui";
import { BarraFiltros, FILTROS_VAZIOS, paraQuery, type EstadoFiltros } from "./Filtros";
import { formatarMoeda, formatarPercentual } from "@/domain/simulator/format";
import type { ResumoDashboard } from "@/server/propostas";
import type { UsuarioListado } from "@/server/usuarios";

function Kpi({
  rotulo,
  valor,
  icone,
  tom,
}: {
  rotulo: string;
  valor: string;
  icone: React.ReactNode;
  tom: "azul" | "verde" | "amarelo" | "laranja";
}) {
  const tons = {
    azul: "border-marca-azul/20 bg-marca-azul-suave text-marca-azul",
    verde: "border-marca-verde/25 bg-marca-verde-suave text-marca-verde-escuro",
    amarelo: "border-marca-amarelo/50 bg-marca-amarelo-suave text-marca-texto",
    laranja: "border-marca-laranja/30 bg-marca-laranja-suave text-marca-laranja",
  } as const;

  return (
    <div className={`rounded-card border p-4 ${tons[tom]}`}>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
        {icone}
        {rotulo}
      </div>
      <p className="text-2xl font-extrabold tabular-nums text-marca-texto">{valor}</p>
    </div>
  );
}

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function AbaDashboard({ vendedores }: { vendedores: readonly UsuarioListado[] }) {
  const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_VAZIOS);
  const [dados, setDados] = useState<ResumoDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (f: EstadoFiltros) => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/dashboard${paraQuery(f)}`);
      const corpo = (await resposta.json().catch(() => null)) as
        | { dashboard?: ResumoDashboard; erro?: string }
        | null;

      if (!resposta.ok || !corpo?.dashboard) {
        setErro(corpo?.erro ?? "Não foi possível carregar o dashboard.");
        return;
      }
      setDados(corpo.dashboard);
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar(filtros);
  }, [filtros, carregar]);

  const maiorEconomia = Math.max(
    ...(dados?.porVendedor.map((v) => v.economiaAnualTotal) ?? [0]),
    1,
  );

  return (
    <div className="space-y-4">
      <BarraFiltros filtros={filtros} onChange={setFiltros} vendedores={vendedores} />

      {erro ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {erro}
        </p>
      ) : null}

      {carregando && !dados ? (
        <p className="flex items-center gap-2 p-6 text-marca-texto-suave">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          Carregando…
        </p>
      ) : null}

      {dados ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              rotulo="Propostas"
              valor={String(dados.totalPropostas)}
              icone={<Receipt aria-hidden="true" className="size-4" />}
              tom="azul"
            />
            <Kpi
              rotulo="Clientes atendidos"
              valor={String(dados.totalClientes)}
              icone={<Users aria-hidden="true" className="size-4" />}
              tom="amarelo"
            />
            <Kpi
              rotulo="Economia anual gerada"
              valor={formatarMoeda(dados.economiaAnualTotal)}
              icone={<PiggyBank aria-hidden="true" className="size-4" />}
              tom="verde"
            />
            <Kpi
              rotulo="Vendedores ativos"
              valor={String(dados.vendedoresAtivos)}
              icone={<Building2 aria-hidden="true" className="size-4" />}
              tom="laranja"
            />
          </div>

          <Card>
            <SectionTitle
              icon={<Users aria-hidden="true" className="size-5" />}
              descricao="Ordenado pela economia anual gerada no período."
            >
              Desempenho por vendedor
            </SectionTitle>

            {dados.porVendedor.length === 0 ? (
              <p className="py-6 text-center text-sm text-marca-texto-suave">
                Nenhum vendedor encontrado com estes filtros.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-marca-borda text-left">
                      {[
                        "Vendedor",
                        "Instituições",
                        "Propostas",
                        "Clientes",
                        "Economia anual gerada",
                        "Ticket médio",
                        "Desconto médio",
                        "Última proposta",
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
                    {dados.porVendedor.map((v) => (
                      <tr key={v.vendedorId} className="border-b border-marca-borda/60">
                        <th scope="row" className="px-2 py-2.5 text-left font-semibold">
                          <span className="flex items-center gap-2.5">
                            <Avatar
                              usuarioId={v.vendedorId}
                              nome={v.nome}
                              temFoto={v.temFoto}
                              tamanho="md"
                            />
                            <span>
                              <span className="block">{v.nome}</span>
                              {!v.ativo ? (
                                <span className="text-xs font-normal text-marca-texto-suave">
                                  inativo
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </th>
                        <td className="px-2 py-2.5 text-xs text-marca-texto-suave">
                          {v.instituicoes.length > 0 ? v.instituicoes.join(", ") : "—"}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">{v.propostas}</td>
                        <td className="px-2 py-2.5 tabular-nums">{v.clientes}</td>
                        <td className="px-2 py-2.5">
                          <span className="block font-bold tabular-nums text-marca-verde-escuro">
                            {formatarMoeda(v.economiaAnualTotal)}
                          </span>
                          {/* Barra comparativa: dá a leitura de relance. */}
                          <span className="mt-1 block h-1.5 w-32 overflow-hidden rounded-full bg-marca-borda">
                            <span
                              className="block h-full rounded-full bg-marca-verde"
                              style={{
                                width: `${(v.economiaAnualTotal / maiorEconomia) * 100}%`,
                              }}
                            />
                          </span>
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {v.propostas > 0 ? formatarMoeda(v.economiaAnualMedia) : "—"}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {v.propostas > 0 ? formatarPercentual(v.descontoMedio, 1) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-marca-texto-suave">
                          {quando(v.ultimaProposta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {dados.porInstituicao.length > 0 ? (
            <Card>
              <SectionTitle
                icon={<Building2 aria-hidden="true" className="size-5" />}
                descricao="Um vendedor pode pertencer a mais de uma instituição — nesse caso, a proposta dele é contada em cada uma. Por isso a soma pode passar do total geral."
              >
                Por instituição
              </SectionTitle>

              <div className="grid gap-3 sm:grid-cols-3">
                {dados.porInstituicao.map((i) => (
                  <div
                    key={i.instituicao}
                    className="rounded-card border border-marca-borda bg-white p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-marca-azul">
                      {i.instituicao}
                    </p>
                    <p className="mt-1 text-xl font-extrabold tabular-nums text-marca-verde-escuro">
                      {formatarMoeda(i.economiaAnualTotal)}
                    </p>
                    <p className="text-xs text-marca-texto-suave">
                      {i.propostas} proposta{i.propostas === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
