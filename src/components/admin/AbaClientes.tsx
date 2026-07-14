"use client";

/**
 * Clientes atendidos: cada proposta emitida, com o PDF de volta.
 *
 * O PDF é REGERADO a partir das entradas e da config congeladas no momento da
 * emissão — sai idêntico ao que o cliente recebeu, mesmo que a tarifa tenha
 * mudado depois.
 */

import { ExternalLink, Loader2, Trash2, TriangleAlert, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "../Avatar";
import { Botao, Card, SectionTitle } from "../ui";
import { BarraFiltros, FILTROS_VAZIOS, paraQuery, type EstadoFiltros } from "./Filtros";
import { podeExcluirProposta, type Usuario } from "@/domain/auth/types";
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

/**
 * Confirmação da remoção.
 *
 * É irreversível e mexe nas métricas do dashboard, então não pode ser um clique
 * só — e o texto diz exatamente o que vai acontecer.
 */
function ConfirmarRemocao({
  proposta,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  proposta: PropostaListada;
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-marca-texto/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-remover"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancelar();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-marca-borda bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700">
              <TriangleAlert aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 id="titulo-remover" className="font-bold text-marca-texto">
                Remover do histórico?
              </h2>
              <p className="mt-0.5 text-sm text-marca-texto-suave">
                Proposta de <strong className="font-semibold">{proposta.clienteNome}</strong>,
                de {quando(proposta.criadaEm)}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancelar}
            aria-label="Fechar"
            className="rounded-lg p-1 text-marca-texto-suave hover:bg-slate-100"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <ul className="list-inside list-disc space-y-1 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-marca-texto-suave">
          <li>A proposta some da lista de clientes e do histórico.</li>
          <li>O PDF dela deixa de ser acessível.</li>
          <li>As métricas do dashboard são recalculadas sem ela.</li>
          <li>
            Fica registrado que <strong className="font-semibold">você</strong> a removeu.
          </li>
        </ul>

        <p className="mt-3 text-xs text-marca-texto-suave">
          Use para limpar simulações de teste. Não há como desfazer.
        </p>

        <div className="mt-5 flex gap-2">
          <Botao variante="sutil" onClick={onCancelar} disabled={ocupado} className="flex-1">
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={onConfirmar} disabled={ocupado} className="flex-1">
            {ocupado ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
            Remover
          </Botao>
        </div>
      </div>
    </div>
  );
}

export function AbaClientes({
  ator,
  vendedores,
}: {
  ator: Usuario;
  vendedores: readonly UsuarioListado[];
}) {
  const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_VAZIOS);
  const [propostas, setPropostas] = useState<PropostaListada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aRemover, setARemover] = useState<PropostaListada | null>(null);
  const [removendo, setRemovendo] = useState(false);

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

  const podeRemover = podeExcluirProposta(ator.papel);

  async function remover() {
    if (!aRemover) return;
    setRemovendo(true);
    setErro(null);

    try {
      const resposta = await fetch(`/api/propostas/${aRemover.id}`, { method: "DELETE" });
      const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null;

      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não foi possível remover a proposta.");
        return;
      }

      setPropostas((atual) => atual.filter((p) => p.id !== aRemover.id));
      setARemover(null);
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setRemovendo(false);
    }
  }

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
                    ...(podeRemover ? [""] : []),
                  ].map((h, i) => (
                    <th
                      // A última coluna (ações) não tem título — daí a chave
                      // combinar rótulo e índice.
                      key={`${h}-${i}`}
                      scope="col"
                      className="whitespace-nowrap px-2 py-2 text-xs font-bold uppercase tracking-wide text-marca-texto-suave"
                    >
                      {h ? h : <span className="sr-only">Ações</span>}
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

                    {podeRemover ? (
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => setARemover(p)}
                          aria-label={`Remover do histórico a proposta de ${p.clienteNome}`}
                          title="Remover do histórico"
                          className="grid size-8 place-items-center rounded-lg text-marca-texto-suave transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {podeRemover ? (
          <p className="mt-3 text-xs text-marca-texto-suave">
            Use a lixeira para tirar do histórico as simulações de teste. A remoção é
            registrada e não pode ser desfeita.
          </p>
        ) : null}
      </Card>

      {aRemover ? (
        <ConfirmarRemocao
          proposta={aRemover}
          ocupado={removendo}
          onConfirmar={remover}
          onCancelar={() => setARemover(null)}
        />
      ) : null}
    </div>
  );
}
