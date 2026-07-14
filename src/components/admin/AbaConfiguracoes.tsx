"use client";

/**
 * Aba de configurações — TODOS os parâmetros do cálculo, editáveis.
 *
 * O que se salva aqui é o que o simulador, a tela e o PDF passam a usar: o
 * servidor lê esta config do banco e a injeta no domínio. Nada fica só no
 * navegador.
 *
 * As porcentagens são exibidas em % (17) e guardadas em fração (0,17) — a
 * conversão acontece só na borda, para o domínio continuar recebendo fração.
 */

import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import { Botao, Campo, Card, SectionTitle } from "../ui";
import { CONFIG, type ConfiguracaoSimulador, type FaixaCosip } from "@/domain/simulator/config";
import type { ConfiguracaoEditavel } from "@/domain/simulator/configSchema";
import { formatarData } from "@/domain/simulator/format";

/**
 * O rascunho do formulário é `ConfiguracaoEditavel` (o tipo inferido do Zod),
 * que é MUTÁVEL. A `ConfiguracaoSimulador` é `readonly` de propósito — o domínio
 * não pode ter a config alterada por baixo. Aqui editamos uma cópia solta; ao
 * salvar, o Zod valida e ela vira de novo uma config imutável.
 */
type Rascunho = ConfiguracaoEditavel;

/** Clona em profundidade — o formulário edita uma cópia, não a config viva. */
function clonar(c: ConfiguracaoSimulador | Rascunho): Rascunho {
  return JSON.parse(JSON.stringify(c)) as Rascunho;
}

const num = (t: string): number => {
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Fração 0..1 -> número em % para exibir. Evita 0,17000000000000004 na tela. */
const paraPct = (fracao: number): string => String(Number((fracao * 100).toFixed(6)));

function TabelaCosip({
  titulo,
  descricao,
  faixas,
  onChange,
}: {
  titulo: string;
  descricao: string;
  faixas: FaixaCosip[];
  onChange: (faixas: FaixaCosip[]) => void;
}) {
  const editar = (i: number, patch: Partial<FaixaCosip>) => {
    onChange(faixas.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  };

  return (
    <Card>
      <SectionTitle descricao={descricao}>{titulo}</SectionTitle>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-marca-borda text-left">
              {["Mínimo (kWh)", "Máximo (kWh)", "COSIP (R$)", ""].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-1 py-2 text-xs font-bold uppercase tracking-wide text-marca-texto-suave"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, i) => (
              <tr key={i} className="border-b border-marca-borda/60">
                <td className="px-1 py-1.5">
                  <input
                    aria-label={`Mínimo da faixa ${i + 1}`}
                    type="number"
                    min={0}
                    value={f.minimo}
                    onChange={(e) => editar(i, { minimo: num(e.target.value) })}
                    className="w-full rounded-lg border-2 border-marca-borda px-2 py-1.5 tabular-nums focus:border-marca-azul"
                  />
                </td>
                <td className="px-1 py-1.5">
                  <input
                    aria-label={`Máximo da faixa ${i + 1}`}
                    type="number"
                    min={0}
                    value={f.maximo}
                    onChange={(e) => editar(i, { maximo: num(e.target.value) })}
                    className="w-full rounded-lg border-2 border-marca-borda px-2 py-1.5 tabular-nums focus:border-marca-azul"
                  />
                </td>
                <td className="px-1 py-1.5">
                  <input
                    aria-label={`COSIP da faixa ${i + 1}`}
                    type="number"
                    min={0}
                    step="any"
                    value={f.valor}
                    onChange={(e) => editar(i, { valor: num(e.target.value) })}
                    className="w-full rounded-lg border-2 border-marca-borda px-2 py-1.5 tabular-nums focus:border-marca-azul"
                  />
                </td>
                <td className="px-1 py-1.5">
                  <button
                    type="button"
                    onClick={() => onChange(faixas.filter((_, j) => j !== i))}
                    disabled={faixas.length <= 1}
                    aria-label={`Remover faixa ${i + 1}`}
                    className="rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Botao
        variante="sutil"
        onClick={() => {
          const ultima = faixas[faixas.length - 1];
          onChange([
            ...faixas,
            { minimo: (ultima?.maximo ?? 0) + 1, maximo: (ultima?.maximo ?? 0) + 100, valor: 0 },
          ]);
        }}
        className="mt-3 w-full border-dashed"
      >
        <Plus aria-hidden="true" className="size-4" />
        Adicionar faixa
      </Botao>
    </Card>
  );
}

export function AbaConfiguracoes({
  configInicial,
  meta,
}: {
  configInicial: ConfiguracaoSimulador;
  meta: { atualizadoEm: string | null; atualizadoPor: string | null };
}) {
  const [c, setC] = useState<Rascunho>(() => clonar(configInicial));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  /** Atualiza um pedaço da config sem perder o resto. */
  function set(patch: (rascunho: Rascunho) => void) {
    setC((atual) => {
      const copia = clonar(atual);
      patch(copia);
      return copia;
    });
  }

  async function salvar() {
    setSalvando(true);
    setMensagem(null);
    try {
      const resposta = await fetch("/api/configuracao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });

      const dados = (await resposta.json().catch(() => null)) as
        | { erro?: string; problemas?: { campo: string; mensagem: string }[] }
        | null;

      if (!resposta.ok) {
        const detalhe = dados?.problemas?.[0];
        setMensagem({
          tipo: "erro",
          texto: detalhe
            ? `${detalhe.campo}: ${detalhe.mensagem}`
            : (dados?.erro ?? "Não foi possível salvar."),
        });
        return;
      }

      setMensagem({ tipo: "ok", texto: "Configurações salvas. Já valem para novas simulações." });
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível conectar." });
    } finally {
      setSalvando(false);
    }
  }

  const tarifas = [
    { chave: "baixaTensao", rotulo: "Baixa tensão", unidade: "R$/kWh" },
    { chave: "foraPonta", rotulo: "Fora ponta", unidade: "R$/kWh" },
    { chave: "ponta", rotulo: "Ponta", unidade: "R$/kWh" },
    { chave: "demanda", rotulo: "Demanda", unidade: "R$/kW" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Barra de ação — fica no topo, colada, porque a página é longa. */}
      <div className="sticky top-16 z-20 flex flex-col gap-3 rounded-card border border-marca-borda/70 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-marca-texto-suave">
          {meta.atualizadoEm ? (
            <>
              Última alteração em {formatarData(meta.atualizadoEm.slice(0, 10))}
              {meta.atualizadoPor ? ` por ${meta.atualizadoPor}` : ""}.
            </>
          ) : (
            "Usando os valores padrão da planilha."
          )}
        </div>

        <div className="flex gap-2">
          <Botao
            variante="sutil"
            onClick={() => {
              setC(clonar(CONFIG));
              setMensagem({
                tipo: "ok",
                texto: "Valores da planilha restaurados no formulário. Clique em Salvar para aplicar.",
              });
            }}
            title="Voltar aos valores originais da planilha"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Restaurar padrão
          </Botao>

          <Botao variante="secundario" onClick={salvar} disabled={salvando}>
            {salvando ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      </div>

      {mensagem ? (
        <p
          role="status"
          className={`rounded-xl border-2 px-4 py-3 text-sm font-medium ${
            mensagem.tipo === "ok"
              ? "border-marca-verde/30 bg-marca-verde-suave text-marca-verde-escuro"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {mensagem.texto}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tarifas */}
        <Card>
          <SectionTitle descricao="Valores sem imposto. O sistema aplica o gross-up automaticamente.">
            Tarifas
          </SectionTitle>
          <div className="space-y-4">
            {tarifas.map((t) => (
              <div key={t.chave} className="grid grid-cols-2 gap-3">
                <Campo
                  label={`${t.rotulo} — sem imposto`}
                  type="number"
                  min={0}
                  step="any"
                  value={String(c.tarifas[t.chave].semImposto)}
                  onChange={(e) =>
                    set((d) => {
                      d.tarifas[t.chave].semImposto = num(e.target.value);
                    })
                  }
                  sufixo={t.unidade}
                />
                <Campo
                  label="PIS/COFINS"
                  type="number"
                  min={0}
                  step="any"
                  value={paraPct(c.tarifas[t.chave].pisCofins)}
                  onChange={(e) =>
                    set((d) => {
                      d.tarifas[t.chave].pisCofins = num(e.target.value) / 100;
                    })
                  }
                  sufixo="%"
                />
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-marca-azul-suave px-3 py-2 text-xs text-marca-texto-suave">
            O PIS/COFINS varia por linha porque é assim na planilha: só a baixa tensão recebe
            9,25%; fora ponta e ponta levam apenas ICMS; a demanda usa 6,08%.
          </p>
        </Card>

        <div className="space-y-4">
          {/* Impostos */}
          <Card>
            <SectionTitle>Impostos</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                label="ICMS"
                type="number"
                min={0}
                step="any"
                value={paraPct(c.impostos.icms)}
                onChange={(e) =>
                  set((d) => {
                    d.impostos.icms = num(e.target.value) / 100;
                  })
                }
                sufixo="%"
              />
              <Campo
                label="PIS"
                type="number"
                min={0}
                step="any"
                value={paraPct(c.impostos.pis)}
                onChange={(e) =>
                  set((d) => {
                    d.impostos.pis = num(e.target.value) / 100;
                  })
                }
                sufixo="%"
              />
              <Campo
                label="COFINS"
                type="number"
                min={0}
                step="any"
                value={paraPct(c.impostos.cofins)}
                onChange={(e) =>
                  set((d) => {
                    d.impostos.cofins = num(e.target.value) / 100;
                  })
                }
                sufixo="%"
              />
              <Campo
                label="PIS/COFINS da demanda"
                type="number"
                min={0}
                step="any"
                value={paraPct(c.impostos.pisCofinsDemanda)}
                onChange={(e) =>
                  set((d) => {
                    d.impostos.pisCofinsDemanda = num(e.target.value) / 100;
                  })
                }
                sufixo="%"
              />
            </div>
          </Card>

          {/* Bandeiras */}
          <Card>
            <SectionTitle descricao="Adicional por kWh compensável.">
              Bandeiras tarifárias
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["VERDE", "Verde"],
                  ["AMARELA", "Amarela"],
                  ["VERMELHA_P1", "Vermelha P1"],
                  ["VERMELHA_P2", "Vermelha P2"],
                ] as const
              ).map(([chave, rotulo]) => (
                <Campo
                  key={chave}
                  label={rotulo}
                  type="number"
                  min={0}
                  step="any"
                  value={String(c.bandeiras[chave])}
                  onChange={(e) =>
                    set((d) => {
                      d.bandeiras[chave] = num(e.target.value);
                    })
                  }
                  sufixo="R$/kWh"
                />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Usina e projeção */}
        <Card>
          <SectionTitle>Usina e projeção</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Capacidade de referência"
              type="number"
              min={1}
              step="any"
              value={String(c.usina.capacidadeReferenciaKwhMes)}
              onChange={(e) =>
                set((d) => {
                  d.usina.capacidadeReferenciaKwhMes = num(e.target.value);
                })
              }
              sufixo="kWh"
              ajuda="Divisor da quota-parte."
            />
            <Campo
              label="Potência de referência"
              type="number"
              min={1}
              step="any"
              value={String(c.usina.potenciaReferenciaKwp)}
              onChange={(e) =>
                set((d) => {
                  d.usina.potenciaReferenciaKwp = num(e.target.value);
                })
              }
              sufixo="kWp"
            />
            <Campo
              label="Reajuste anual da projeção"
              type="number"
              min={0}
              step="any"
              value={paraPct(c.projecao.reajusteAnual - 1)}
              onChange={(e) =>
                set((d) => {
                  d.projecao.reajusteAnual = 1 + num(e.target.value) / 100;
                })
              }
              sufixo="% a.a."
            />
            <Campo
              label="Anos da projeção"
              type="number"
              min={1}
              step={1}
              value={String(c.projecao.anos)}
              onChange={(e) =>
                set((d) => {
                  d.projecao.anos = Math.trunc(num(e.target.value));
                })
              }
              sufixo="anos"
            />
          </div>
        </Card>

        {/* Proposta e institucional */}
        <Card>
          <SectionTitle>Proposta e contato</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              label="Desconto padrão"
              type="number"
              min={0}
              max={99}
              step="any"
              value={paraPct(c.descontoPadrao)}
              onChange={(e) =>
                set((d) => {
                  d.descontoPadrao = num(e.target.value) / 100;
                })
              }
              sufixo="%"
              ajuda="Valor travado para os vendedores."
            />
            <Campo
              label="Validade da proposta"
              type="number"
              min={1}
              step={1}
              value={String(c.validadePropostaDias)}
              onChange={(e) =>
                set((d) => {
                  d.validadePropostaDias = Math.trunc(num(e.target.value));
                })
              }
              sufixo="dias"
              ajuda="Aplicada a todas as propostas."
            />
            <Campo
              label="Vigência das tarifas"
              type="date"
              value={c.vigenciaTarifas}
              onChange={(e) =>
                set((d) => {
                  d.vigenciaTarifas = e.target.value;
                })
              }
            />
            <Campo
              label="Distribuidora"
              value={c.institucional.distribuidora}
              onChange={(e) =>
                set((d) => {
                  d.institucional.distribuidora = e.target.value;
                })
              }
            />
            <Campo
              label="WhatsApp (exibido)"
              value={c.institucional.whatsapp}
              onChange={(e) =>
                set((d) => {
                  d.institucional.whatsapp = e.target.value;
                })
              }
              ajuda="Aparece no rodapé da proposta."
            />
            <Campo
              label="Link do WhatsApp"
              value={c.institucional.whatsappLink}
              onChange={(e) =>
                set((d) => {
                  d.institucional.whatsappLink = e.target.value;
                })
              }
              placeholder="https://wa.me/55…"
            />
            <Campo
              label="Nome da empresa"
              value={c.institucional.nomeEmpresa}
              onChange={(e) =>
                set((d) => {
                  d.institucional.nomeEmpresa = e.target.value;
                })
              }
              className="sm:col-span-2"
            />
          </div>
        </Card>
      </div>

      {/* Observações da proposta */}
      <Card>
        <SectionTitle descricao="Aparecem no rodapé do PDF, em bullets.">
          Observações da proposta
        </SectionTitle>
        <div className="space-y-2">
          {c.observacoesProposta.map((obs, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                aria-label={`Observação ${i + 1}`}
                value={obs}
                rows={2}
                onChange={(e) =>
                  set((d) => {
                    d.observacoesProposta[i] = e.target.value;
                  })
                }
                className="w-full rounded-xl border-2 border-marca-borda px-3 py-2 text-sm focus:border-marca-azul focus:ring-4 focus:ring-marca-azul/10"
              />
              <button
                type="button"
                onClick={() =>
                  set((d) => {
                    d.observacoesProposta = d.observacoesProposta.filter((_, j) => j !== i);
                  })
                }
                disabled={c.observacoesProposta.length <= 1}
                aria-label={`Remover observação ${i + 1}`}
                className="mt-1 rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <Botao
          variante="sutil"
          onClick={() =>
            set((d) => {
              d.observacoesProposta.push("");
            })
          }
          className="mt-3 w-full border-dashed"
        >
          <Plus aria-hidden="true" className="size-4" />
          Adicionar observação
        </Botao>
      </Card>

      {/* Faixas de COSIP */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TabelaCosip
          titulo="COSIP — Residencial (B1)"
          descricao="Aplicada às unidades classificadas como B1. As faixas devem estar em ordem crescente."
          faixas={c.cosipResidencial}
          onChange={(faixas) =>
            set((d) => {
              d.cosipResidencial = faixas;
            })
          }
        />
        <TabelaCosip
          titulo="COSIP — Demais (B3 e MT)"
          descricao="Aplicada a B3 e MT. B2 (rural) é isenta por regra."
          faixas={c.cosipDemais}
          onChange={(faixas) =>
            set((d) => {
              d.cosipDemais = faixas;
            })
          }
        />
      </div>
    </div>
  );
}
