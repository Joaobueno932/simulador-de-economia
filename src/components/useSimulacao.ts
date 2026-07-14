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
import type {
  DadosCliente,
  ResultadoSimulacao,
  Simulacao,
  UnidadeConsumidora,
} from "@/domain/simulator/types";

const CHAVE_RASCUNHO = "em-conta:simulacao:v2";
export const MAX_UCS = 10;

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
function lerRascunho(): Simulacao | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Simulacao;
    if (!dados?.cliente || !Array.isArray(dados.unidades)) return null;
    if (dados.unidades.length === 0) return null;
    return dados;
  } catch {
    return null;
  }
}

export function useSimulacao(config: ConfiguracaoSimulador, consultorInicial: string) {
  const [simulacao, setSimulacao] = useState<Simulacao>(() =>
    estadoInicial({ consultor: consultorInicial, config }),
  );
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);
  const primeiraRenderizacao = useRef(true);

  // Restaura o rascunho depois da hidratação (o servidor não tem localStorage).
  useEffect(() => {
    const salvo = lerRascunho();
    if (salvo) {
      // Data e validade são sempre reimpostas: um rascunho de ontem não pode
      // ressuscitar a data de ontem nem uma validade antiga.
      setSimulacao({
        ...salvo,
        cliente: {
          ...salvo.cliente,
          dataProposta: hojeISO(),
          validadeDias: config.validadePropostaDias,
          consultor: salvo.cliente.consultor || consultorInicial,
        },
      });
    }
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
      window.localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(simulacao));
    } catch {
      // Modo privado / cota cheia: o rascunho é um conforto, não um requisito.
    }
  }, [simulacao, rascunhoCarregado]);

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
      window.localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {
      // ignorado — ver acima
    }
  }, [config, consultorInicial]);

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
  };
}
