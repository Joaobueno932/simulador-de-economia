"use client";

/**
 * "Meus clientes" — clientes salvos, para reabrir e continuar o atendimento.
 *
 * Vendedor: só os seus, e SEM excluir. Admin/gestor: todos (com o dono) e com
 * exclusão. A checagem real está na rota de API; a tela só reflete a permissão.
 */

import { ArrowLeft, ArrowRight, Loader2, Trash2, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "./Avatar";
import { Botao, Card, SectionTitle } from "./ui";
import { podeVerTodosClientes, type Papel } from "@/domain/auth/types";
import type { ClienteSalvo } from "@/server/simulacoes";

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConfirmarExclusao({
  cliente,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  cliente: ClienteSalvo;
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-marca-texto/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-excluir-cliente"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancelar();
      }}
    >
      <div className="w-full max-w-md rounded-card border border-marca-borda bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 id="titulo-excluir-cliente" className="font-bold text-marca-texto">
              Excluir cliente salvo?
            </h2>
            <p className="mt-0.5 text-sm text-marca-texto-suave">
              <strong className="font-semibold">{cliente.clienteNome || "(sem nome)"}</strong> some
              da lista de clientes salvos. As propostas já emitidas não são afetadas. Não há como
              desfazer.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Botao variante="sutil" onClick={onCancelar} disabled={ocupado} className="flex-1">
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={onConfirmar} disabled={ocupado} className="flex-1">
            {ocupado ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
            Excluir
          </Botao>
        </div>
      </div>
    </div>
  );
}

export function MeusClientes({
  papel,
  clientesIniciais,
  podeExcluir,
}: {
  papel: Papel;
  clientesIniciais: readonly ClienteSalvo[];
  podeExcluir: boolean;
}) {
  const router = useRouter();
  const [clientes, setClientes] = useState<readonly ClienteSalvo[]>(clientesIniciais);
  const [aExcluir, setAExcluir] = useState<ClienteSalvo | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const veDono = podeVerTodosClientes(papel);

  function abrir(id: number) {
    // O simulador lê `?cliente=ID`, carrega a simulação e cai na etapa 2.
    router.push(`/?cliente=${id}`);
  }

  async function excluir() {
    if (!aExcluir) return;
    setExcluindo(true);
    setErro(null);
    try {
      const r = await fetch(`/api/simulacoes/${aExcluir.id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { erro?: string } | null;
        setErro(d?.erro ?? "Não foi possível excluir.");
        return;
      }
      setClientes((atual) => atual.filter((c) => c.id !== aExcluir.id));
      setAExcluir(null);
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-marca-borda bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-marca-borda px-3.5 py-2 text-sm font-bold text-marca-texto transition-colors hover:border-marca-azul-claro hover:bg-marca-azul-suave"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Simulador</span>
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-marca-texto">
            <Users aria-hidden="true" className="size-5 text-marca-azul" />
            Meus clientes
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Card>
          <SectionTitle
            descricao={
              veDono
                ? "Simulações salvas por todos os consultores. Clique para abrir e continuar."
                : "Suas simulações salvas. Clique em uma para abrir e continuar o atendimento."
            }
          >
            {clientes.length} cliente(s) salvo(s)
          </SectionTitle>

          {erro ? (
            <p
              role="alert"
              className="mb-4 rounded-xl border-2 border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
            >
              {erro}
            </p>
          ) : null}

          {clientes.length === 0 ? (
            <div className="py-10 text-center">
              <Users aria-hidden="true" className="mx-auto size-10 text-marca-borda" />
              <p className="mt-3 text-sm text-marca-texto-suave">
                Nenhum cliente salvo ainda. Ao chegar na etapa 2 de uma simulação, o cliente
                aparece aqui automaticamente.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-marca-azul px-4 py-2.5 text-sm font-bold text-white hover:bg-marca-azul-escuro"
              >
                Nova simulação
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-marca-borda">
              {clientes.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => abrir(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-marca-azul-suave"
                  >
                    {veDono ? (
                      <Avatar
                        usuarioId={c.donoId}
                        nome={c.donoNome ?? "?"}
                        temFoto={c.donoTemFoto}
                        tamanho="md"
                      />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-marca-azul-suave text-marca-azul">
                        <Users aria-hidden="true" className="size-5" />
                      </span>
                    )}

                    <span className="min-w-0">
                      <span className="block truncate font-bold text-marca-texto">
                        {c.clienteNome || "(sem nome)"}
                      </span>
                      <span className="block truncate text-xs text-marca-texto-suave">
                        {c.quantidadeUCs} unidade(s) · atualizado em {quando(c.atualizadaEm)}
                        {veDono && c.donoNome ? ` · por ${c.donoNome}` : ""}
                      </span>
                    </span>

                    <ArrowRight
                      aria-hidden="true"
                      className="ml-auto size-4 shrink-0 text-marca-texto-suave"
                    />
                  </button>

                  {/* Excluir: só admin/gestor. O vendedor nem vê o botão. */}
                  {podeExcluir ? (
                    <button
                      type="button"
                      onClick={() => setAExcluir(c)}
                      aria-label={`Excluir o cliente salvo ${c.clienteNome || "(sem nome)"}`}
                      title="Excluir cliente salvo"
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-marca-texto-suave transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      {aExcluir ? (
        <ConfirmarExclusao
          cliente={aExcluir}
          ocupado={excluindo}
          onConfirmar={excluir}
          onCancelar={() => setAExcluir(null)}
        />
      ) : null}
    </div>
  );
}
