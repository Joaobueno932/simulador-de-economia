"use client";

/**
 * Histórico: a trilha do que cada um fez.
 *
 * Inclui o USO da senha de desconto — o gestor precisa enxergar quem destravou
 * o desconto, quando, e qual proposta saiu depois disso.
 */

import { ExternalLink, History, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "../Avatar";
import { Card, SectionTitle, Select } from "../ui";
import { BarraFiltros, FILTROS_VAZIOS, paraQuery, type EstadoFiltros } from "./Filtros";
import { ROTULO_EVENTO, TIPOS_EVENTO, type TipoEvento } from "@/domain/auth/eventos";
import type { EventoListado } from "@/server/eventos";
import type { UsuarioListado } from "@/server/usuarios";

/** Cor por tipo — mas o rótulo em texto sempre acompanha (não só cor). */
const TOM: Partial<Record<TipoEvento, string>> = {
  proposta_gerada: "bg-marca-verde-suave text-marca-verde-escuro",
  senha_desconto_usada: "bg-marca-laranja-suave text-marca-laranja",
  senha_desconto_emitida: "bg-marca-amarelo-suave text-marca-texto",
  senha_resetada: "bg-marca-amarelo-suave text-marca-texto",
  usuario_desativado: "bg-red-50 text-red-700",
  config_alterada: "bg-marca-azul-suave text-marca-azul",
};

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AbaHistorico({ vendedores }: { vendedores: readonly UsuarioListado[] }) {
  const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_VAZIOS);
  const [tipo, setTipo] = useState<string>("");
  const [eventos, setEventos] = useState<EventoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (f: EstadoFiltros, t: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const query = paraQuery(f);
      const sep = query ? "&" : "?";
      const url = `/api/historico${query}${t ? `${sep}tipo=${t}` : ""}`;

      const resposta = await fetch(url);
      const corpo = (await resposta.json().catch(() => null)) as
        | { eventos?: EventoListado[]; erro?: string }
        | null;

      if (!resposta.ok || !corpo?.eventos) {
        setErro(corpo?.erro ?? "Não foi possível carregar o histórico.");
        return;
      }
      setEventos(corpo.eventos);
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar(filtros, tipo);
  }, [filtros, tipo, carregar]);

  return (
    <div className="space-y-4">
      <BarraFiltros filtros={filtros} onChange={setFiltros} vendedores={vendedores} />

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle
            icon={<History aria-hidden="true" className="size-5" />}
            descricao="Do mais recente para o mais antigo."
          >
            Histórico de atividades
          </SectionTitle>

          <div className="w-full sm:w-64">
            <Select
              label="Tipo de atividade"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              opcoes={[
                { value: "", label: "Todas" },
                ...TIPOS_EVENTO.map((t) => ({ value: t, label: ROTULO_EVENTO[t] })),
              ]}
            />
          </div>
        </div>

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
        ) : eventos.length === 0 ? (
          <p className="py-8 text-center text-sm text-marca-texto-suave">
            Nenhuma atividade encontrada com estes filtros.
          </p>
        ) : (
          <ol className="divide-y divide-marca-borda">
            {eventos.map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-3">
                {e.usuarioId ? (
                  <Avatar
                    usuarioId={e.usuarioId}
                    nome={e.usuarioNome ?? "?"}
                    temFoto={e.usuarioTemFoto}
                    tamanho="md"
                  />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-marca-texto-suave">
                    ?
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-marca-texto">
                      {e.usuarioNome ?? "Usuário removido"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        TOM[e.tipo] ?? "bg-slate-100 text-marca-texto-suave"
                      }`}
                    >
                      {ROTULO_EVENTO[e.tipo] ?? e.tipo}
                    </span>
                  </div>

                  <p className="mt-0.5 text-sm text-marca-texto-suave">{e.descricao}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="whitespace-nowrap text-xs text-marca-texto-suave">
                    {quando(e.criadoEm)}
                  </p>

                  {e.propostaId ? (
                    <a
                      href={`/api/propostas/${e.propostaId}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-marca-azul hover:underline"
                    >
                      Ver PDF
                      <ExternalLink aria-hidden="true" className="size-3" />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
