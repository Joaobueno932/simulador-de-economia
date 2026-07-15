"use client";

/**
 * Estado da simulação + rascunho automático no navegador.
 *
 * O cálculo NÃO mora aqui: este hook só guarda as ENTRADAS e delega a
 * `calcularSimulacao`, passando a config que veio do servidor. Assim a tela
 * recalcula em tempo real sem duplicar regra de negócio, e o servidor recalcula
 * do mesmo jeito, com a mesma config, a partir das mesmas entradas.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { calcularSimulacao } from "@/domain/simulator/calculations";
import type { ConfiguracaoSimulador } from "@/domain/simulator/config";
import { hojeISO } from "@/domain/simulator/format";
import { MAX_UNIDADES } from "@/domain/simulator/validation";
import type {
  DadosCliente,
  ResultadoSimulacao,
  Simulacao,
  UnidadeConsumidora,
} from "@/domain/simulator/types";

/**
 * Prefixo de TODA chave de rascunho no navegador.
 *
 * A chave real inclui o id do usuário (`...:v3:<id>`): o rascunho de um
 * atendimento nunca aparece para outra pessoa que use a mesma máquina.
 */
export const PREFIXO_RASCUNHO = "em-conta:simulacao:";

function chaveRascunho(usuarioId: number): string {
  return `${PREFIXO_RASCUNHO}v3:${usuarioId}`;
}

/**
 * Apaga TODOS os rascunhos guardados no navegador.
 *
 * Chamado no login e no logout: ao entrar (de novo, ou como outra pessoa) a
 * simulação começa do zero. Isso evita o vendedor achar que já preencheu um
 * campo quando o dado é do cliente anterior.
 */
export function limparRascunhos(): void {
  if (typeof window === "undefined") return;
  try {
    for (const chave of Object.keys(window.localStorage)) {
      if (chave.startsWith(PREFIXO_RASCUNHO)) window.localStorage.removeItem(chave);
    }
  } catch {
    // Modo privado / cota: o rascunho é um conforto, não um requisito.
  }
}

/**
 * Máximo de unidades consumidoras. Vem do domínio (`MAX_UNIDADES`), que é o
 * mesmo limite que o servidor impõe — a tela e a API não podem divergir.
 */
export const MAX_UCS = MAX_UNIDADES;

function novoId(): string {
  return `uc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function criarUC(indice: number, descontoPadrao: number): UnidadeConsumidora {
  return {
    id: novoId(),
    nome: `UC ${String(indice + 1).padStart(2, "0")}`,
    classificacao: "B1",
    ligacao: "TRIFASICO",
    consumoForaPonta: 0,
    consumoPonta: 0,
    demandaContratada: 0,
    desconto: descontoPadrao,
    cosipOverride: null,
    custoKwhConcorrente: null,
  };
}

interface Inicial {
  readonly consultor: string;
  readonly config: ConfiguracaoSimulador;
}

function estadoInicial({ consultor, config }: Inicial): Simulacao {
  return {
    cliente: {
      nome: "",
      documento: "",
      telefone: "",
      email: "",
      consultor,
      // Data sempre "hoje" e validade sempre da config — o formulário não edita.
      dataProposta: hojeISO(),
      validadeDias: config.validadePropostaDias,
    },
    unidades: [criarUC(0, config.descontoPadrao)],
  };
}

/** Aceita apenas rascunhos com o formato esperado — nunca confia no localStorage. */
function lerRascunho(chave: string): Simulacao | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Simulacao;
    if (!dados?.cliente || !Array.isArray(dados.unidades)) return null;
    if (dados.unidades.length === 0) return null;
    return dados;
  } catch {
    return null;
  }
}

/**
 * Reimpõe data e validade em uma simulação carregada (rascunho ou cliente
 * salvo): a proposta é sempre de hoje, com a validade atual da configuração —
 * nunca a data de quando foi guardada.
 */
function comDataDeHoje(
  s: Simulacao,
  config: ConfiguracaoSimulador,
  consultorInicial: string,
): Simulacao {
  return {
    ...s,
    cliente: {
      ...s.cliente,
      dataProposta: hojeISO(),
      validadeDias: config.validadePropostaDias,
      consultor: s.cliente.consultor || consultorInicial,
    },
  };
}

export function useSimulacao(
  config: ConfiguracaoSimulador,
  consultorInicial: string,
  usuarioId: number,
) {
  const chave = chaveRascunho(usuarioId);

  const [simulacao, setSimulacao] = useState<Simulacao>(() =>
    estadoInicial({ consultor: consultorInicial, config }),
  );
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);
  const primeiraRenderizacao = useRef(true);

  // Restaura o rascunho depois da hidratação (o servidor não tem localStorage).
  useEffect(() => {
    const salvo = lerRascunho(chave);
    if (salvo) setSimulacao(comDataDeHoje(salvo, config, consultorInicial));
    setRascunhoCarregado(true);
    // Só na montagem: o rascunho é restaurado uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva a cada mudança, exceto na restauração inicial.
  useEffect(() => {
    if (!rascunhoCarregado) return;
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    try {
      window.localStorage.setItem(chave, JSON.stringify(simulacao));
    } catch {
      // Modo privado / cota cheia: o rascunho é um conforto, não um requisito.
    }
  }, [simulacao, rascunhoCarregado, chave]);

  const atualizarCliente = useCallback((patch: Partial<DadosCliente>) => {
    setSimulacao((s) => ({ ...s, cliente: { ...s.cliente, ...patch } }));
  }, []);

  const atualizarUC = useCallback((id: string, patch: Partial<UnidadeConsumidora>) => {
    setSimulacao((s) => ({
      ...s,
      unidades: s.unidades.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    }));
  }, []);

  const adicionarUC = useCallback(() => {
    setSimulacao((s) => {
      if (s.unidades.length >= MAX_UCS) return s;
      return {
        ...s,
        unidades: [...s.unidades, criarUC(s.unidades.length, config.descontoPadrao)],
      };
    });
  }, [config.descontoPadrao]);

  const duplicarUC = useCallback((id: string) => {
    setSimulacao((s) => {
      if (s.unidades.length >= MAX_UCS) return s;
      const origem = s.unidades.find((u) => u.id === id);
      if (!origem) return s;
      const copia: UnidadeConsumidora = {
        ...origem,
        id: novoId(),
        nome: `UC ${String(s.unidades.length + 1).padStart(2, "0")}`,
      };
      return { ...s, unidades: [...s.unidades, copia] };
    });
  }, []);

  const removerUC = useCallback((id: string) => {
    setSimulacao((s) => {
      // Sempre resta ao menos uma UC — a simulação não faz sentido com zero.
      if (s.unidades.length <= 1) return s;
      return { ...s, unidades: s.unidades.filter((u) => u.id !== id) };
    });
  }, []);

  const limpar = useCallback(() => {
    setSimulacao(estadoInicial({ consultor: consultorInicial, config }));
    try {
      window.localStorage.removeItem(chave);
    } catch {
      // ignorado — ver acima
    }
  }, [config, consultorInicial, chave]);

  /** Carrega uma simulação inteira (ex.: reabrir um cliente salvo). */
  const substituir = useCallback(
    (s: Simulacao) => {
      setSimulacao(comDataDeHoje(s, config, consultorInicial));
    },
    [config, consultorInicial],
  );

  // Recalcula a cada tecla: é o "tempo real" exigido, e é barato (funções puras).
  const resultado: ResultadoSimulacao = useMemo(
    () => calcularSimulacao(simulacao, config),
    [simulacao, config],
  );

  return {
    simulacao,
    resultado,
    rascunhoCarregado,
    atualizarCliente,
    atualizarUC,
    adicionarUC,
    duplicarUC,
    removerUC,
    limpar,
    substituir,
  };
}
