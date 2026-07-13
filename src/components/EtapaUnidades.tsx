"use client";

/**
 * Etapa 2 — Unidades consumidoras.
 *
 * Cards dinâmicos em vez das 10 colunas fixas da planilha. Consumo de ponta e
 * demanda só aparecem em média tensão; em baixa tensão os campos nem existem
 * (em vez de ficarem desabilitados e confundindo).
 */

import { Copy, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";

import { Botao, Campo, Card, MensagemErro, SectionTitle, Select } from "./ui";
import { MAX_UCS } from "./useSimulacao";
import { CONFIG } from "@/domain/simulator/config";
import { calcularCosip } from "@/domain/simulator/tariffs";
import { formatarKwh, formatarMoeda } from "@/domain/simulator/format";
import { unidadeConsumidoraSchema } from "@/domain/simulator/validation";
import type { Classificacao, Ligacao, ResultadoUC, UnidadeConsumidora } from "@/domain/simulator/types";

const CLASSIFICACOES: readonly { value: Classificacao; label: string }[] = [
  { value: "B1", label: "B1 — Residencial" },
  { value: "B2", label: "B2 — Rural" },
  { value: "B3", label: "B3 — Demais classes" },
  { value: "MT", label: "MT — Média tensão" },
];

const LIGACOES: readonly { value: Ligacao; label: string }[] = [
  { value: "MONOFASICO", label: "Monofásico (mínimo 30 kWh)" },
  { value: "BIFASICO", label: "Bifásico (mínimo 50 kWh)" },
  { value: "TRIFASICO", label: "Trifásico (mínimo 100 kWh)" },
  { value: "MEDIA_TENSAO", label: "Média tensão" },
];

/** Converte texto do input em número, tratando vazio como 0. */
function paraNumero(texto: string): number {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function CardUC({
  uc,
  resultado,
  indice,
  podeRemover,
  podeDuplicar,
  onChange,
  onDuplicar,
  onRemover,
  tentouAvancar,
}: {
  uc: UnidadeConsumidora;
  resultado: ResultadoUC;
  indice: number;
  podeRemover: boolean;
  podeDuplicar: boolean;
  onChange: (patch: Partial<UnidadeConsumidora>) => void;
  onDuplicar: () => void;
  onRemover: () => void;
  tentouAvancar: boolean;
}) {
  const [tocado, setTocado] = useState(false);
  const mostrarErros = tocado || tentouAvancar;

  const parse = unidadeConsumidoraSchema.safeParse(uc);
  const erros: Record<string, string> = {};
  if (!parse.success) {
    for (const issue of parse.error.issues) {
      const campo = String(issue.path[0]);
      if (campo && !erros[campo]) erros[campo] = issue.message;
    }
  }
  const erroDe = (campo: string) => (mostrarErros ? erros[campo] : undefined);

  const ehMT = uc.ligacao === "MEDIA_TENSAO";

  // COSIP sugerida pela tabela — mostrada como ajuda quando o consultor sobrescreve.
  const cosipTabela = calcularCosip(uc.classificacao, uc.consumoForaPonta);

  // Alerta (não erro): consumo abaixo do mínimo faturável não gera compensação.
  const abaixoDoMinimo =
    !ehMT && uc.consumoForaPonta > 0 && resultado.consumoCompensavel === 0;

  return (
    <Card className="relative">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-marca-azul-suave text-sm font-bold text-marca-azul">
            {indice + 1}
          </span>
          <input
            aria-label={`Nome da unidade ${indice + 1}`}
            value={uc.nome}
            onChange={(e) => onChange({ nome: e.target.value })}
            onBlur={() => setTocado(true)}
            className="min-w-0 max-w-45 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-bold text-marca-texto hover:border-marca-borda focus:border-marca-azul"
          />
        </div>

        <div className="flex items-center gap-2">
          <Botao
            variante="sutil"
            onClick={onDuplicar}
            disabled={!podeDuplicar}
            title={podeDuplicar ? "Duplicar unidade" : `Limite de ${MAX_UCS} unidades atingido`}
          >
            <Copy aria-hidden="true" className="size-4" />
            <span className="sr-only sm:not-sr-only">Duplicar</span>
          </Botao>
          <Botao
            variante="perigo"
            onClick={onRemover}
            disabled={!podeRemover}
            title={podeRemover ? "Excluir unidade" : "A simulação precisa de ao menos uma unidade"}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            <span className="sr-only sm:not-sr-only">Excluir</span>
          </Botao>
        </div>
      </div>

      {erros.nome && mostrarErros ? (
        <MensagemErro id={`${uc.id}-nome-erro`}>{erros.nome}</MensagemErro>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Classificação"
          value={uc.classificacao}
          onChange={(e) => {
            const classificacao = e.target.value as Classificacao;
            // MT e média tensão andam juntas — ajusta a ligação para manter coerência.
            if (classificacao === "MT") {
              onChange({ classificacao, ligacao: "MEDIA_TENSAO" });
            } else if (uc.ligacao === "MEDIA_TENSAO") {
              onChange({
                classificacao,
                ligacao: "TRIFASICO",
                consumoPonta: 0,
                demandaContratada: 0,
              });
            } else {
              onChange({ classificacao });
            }
          }}
          onBlur={() => setTocado(true)}
          erro={erroDe("classificacao")}
          opcoes={CLASSIFICACOES}
          ajuda={uc.classificacao === "B2" ? "B2 (rural) é isenta de COSIP." : undefined}
        />

        <Select
          label="Tipo de ligação"
          value={uc.ligacao}
          onChange={(e) => {
            const ligacao = e.target.value as Ligacao;
            if (ligacao === "MEDIA_TENSAO") {
              onChange({ ligacao, classificacao: "MT" });
            } else {
              // Saindo da média tensão, ponta e demanda deixam de existir.
              onChange({
                ligacao,
                classificacao: uc.classificacao === "MT" ? "B1" : uc.classificacao,
                consumoPonta: 0,
                demandaContratada: 0,
              });
            }
          }}
          onBlur={() => setTocado(true)}
          erro={erroDe("ligacao")}
          opcoes={LIGACOES}
        />

        <Campo
          label={ehMT ? "Consumo fora de ponta" : "Consumo mensal"}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={uc.consumoForaPonta === 0 ? "" : String(uc.consumoForaPonta)}
          onChange={(e) => onChange({ consumoForaPonta: paraNumero(e.target.value) })}
          onBlur={() => setTocado(true)}
          erro={erroDe("consumoForaPonta")}
          sufixo="kWh"
          placeholder="0"
          ajuda={
            ehMT
              ? "Consumo fora do horário de ponta."
              : `Compensável: ${formatarKwh(resultado.consumoCompensavel)}`
          }
        />

        {ehMT ? (
          <Campo
            label="Consumo de ponta"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={uc.consumoPonta === 0 ? "" : String(uc.consumoPonta)}
            onChange={(e) => onChange({ consumoPonta: paraNumero(e.target.value) })}
            onBlur={() => setTocado(true)}
            erro={erroDe("consumoPonta")}
            sufixo="kWh"
            placeholder="0"
            ajuda="Consumo no horário de ponta."
          />
        ) : null}

        {ehMT ? (
          <Campo
            label="Demanda contratada"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={uc.demandaContratada === 0 ? "" : String(uc.demandaContratada)}
            onChange={(e) => onChange({ demandaContratada: paraNumero(e.target.value) })}
            onBlur={() => setTocado(true)}
            erro={erroDe("demandaContratada")}
            sufixo="kW"
            placeholder="0"
            ajuda={`Custo de demanda: ${formatarMoeda(resultado.custoDemanda)}`}
          />
        ) : null}

        <Campo
          label="Desconto sobre a tarifa compensável"
          type="number"
          min={0}
          max={99}
          step="any"
          inputMode="decimal"
          value={uc.desconto === 0 ? "0" : String(Number((uc.desconto * 100).toFixed(4)))}
          onChange={(e) => onChange({ desconto: paraNumero(e.target.value) / 100 })}
          onBlur={() => setTocado(true)}
          erro={erroDe("desconto")}
          sufixo="%"
          ajuda={`Padrão: ${CONFIG.descontoPadrao * 100}%. Deve ser menor que 100%.`}
        />

        <Campo
          label="COSIP da conta (opcional)"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={uc.cosipOverride === null ? "" : String(uc.cosipOverride)}
          onChange={(e) =>
            onChange({
              cosipOverride: e.target.value.trim() === "" ? null : paraNumero(e.target.value),
            })
          }
          onBlur={() => setTocado(true)}
          erro={erroDe("cosipOverride")}
          sufixo="R$"
          placeholder={cosipTabela.toFixed(2)}
          ajuda={
            uc.cosipOverride === null
              ? `Calculada pela tabela: ${formatarMoeda(cosipTabela)}. Informe para usar o valor real da conta.`
              : `Substituindo a tabela (${formatarMoeda(cosipTabela)}) pelo valor da conta.`
          }
        />

        <Campo
          label="Custo por kWh do concorrente (opcional)"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={uc.custoKwhConcorrente === null ? "" : String(uc.custoKwhConcorrente)}
          onChange={(e) =>
            onChange({
              custoKwhConcorrente:
                e.target.value.trim() === "" ? null : paraNumero(e.target.value),
            })
          }
          onBlur={() => setTocado(true)}
          erro={erroDe("custoKwhConcorrente")}
          sufixo="R$/kWh"
          placeholder="—"
          ajuda="Preencha para comparar a Em Conta com outra geradora."
        />
      </div>

      {abaixoDoMinimo ? (
        <p className="mt-4 rounded-lg border border-marca-laranja/40 bg-marca-laranja-suave px-3 py-2 text-sm text-marca-texto">
          <strong className="font-semibold">Atenção:</strong> o consumo está no limite do mínimo
          faturável desta ligação, então não há energia compensável — e portanto não há economia.
          A conta continua sendo cobrada pelo faturamento mínimo.
        </p>
      ) : null}
    </Card>
  );
}

export function EtapaUnidades({
  unidades,
  resultados,
  onChange,
  onAdicionar,
  onDuplicar,
  onRemover,
  tentouAvancar,
}: {
  unidades: readonly UnidadeConsumidora[];
  resultados: readonly ResultadoUC[];
  onChange: (id: string, patch: Partial<UnidadeConsumidora>) => void;
  onAdicionar: () => void;
  onDuplicar: (id: string) => void;
  onRemover: (id: string) => void;
  tentouAvancar: boolean;
}) {
  const noLimite = unidades.length >= MAX_UCS;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          icon={<Zap aria-hidden="true" className="size-5" />}
          descricao="Adicione uma unidade para cada conta de luz do cliente. Os resultados são recalculados a cada alteração."
        >
          Unidades consumidoras
        </SectionTitle>
        <p className="text-sm text-marca-texto-suave">
          {unidades.length} de {MAX_UCS} unidades.
        </p>
      </Card>

      {unidades.map((uc, i) => (
        <CardUC
          key={uc.id}
          uc={uc}
          resultado={resultados[i]}
          indice={i}
          podeRemover={unidades.length > 1}
          podeDuplicar={!noLimite}
          onChange={(patch) => onChange(uc.id, patch)}
          onDuplicar={() => onDuplicar(uc.id)}
          onRemover={() => onRemover(uc.id)}
          tentouAvancar={tentouAvancar}
        />
      ))}

      <Botao
        variante="sutil"
        onClick={onAdicionar}
        disabled={noLimite}
        className="w-full border-dashed"
      >
        <Plus aria-hidden="true" className="size-4" />
        {noLimite ? `Limite de ${MAX_UCS} unidades atingido` : "Adicionar unidade consumidora"}
      </Botao>
    </div>
  );
}
