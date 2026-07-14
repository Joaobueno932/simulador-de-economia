import "server-only";

/**
 * Propostas emitidas: registro, consulta, métricas.
 *
 * POR QUE NÃO GUARDAMOS OS BYTES DO PDF
 * -------------------------------------
 * Guardamos as ENTRADAS da simulação + a CONFIG usada naquele momento. Com os
 * dois, o PDF é regerado **idêntico** quando o gestor pede — e os números não
 * mudam nem que a tarifa seja alterada depois, porque a config vai congelada
 * na linha. Guardar ~1 MB de PDF por proposta encheria o banco à toa (o plano
 * gratuito do Neon tem 0,5 GB).
 */

import { consultar, consultarUm } from "./db";
import { ErroProibido } from "./auth";
import { ErroDeNegocio } from "./usuarios";
import { podeVerHistoricoDeTodos, podeVerProposta, type Usuario } from "@/domain/auth/types";
import { validarConfiguracao } from "@/domain/simulator/configSchema";
import { simulacaoSchema } from "@/domain/simulator/validation";
import type { ConfiguracaoSimulador } from "@/domain/simulator/config";
import type { ResultadoSimulacao, Simulacao } from "@/domain/simulator/types";

export interface RegistroProposta {
  usuarioId: number;
  /** O vendedor que assina a proposta (pode ser diferente de quem gerou). */
  vendedorId: number | null;
  simulacao: Simulacao;
  resultado: ResultadoSimulacao;
  configuracao: ConfiguracaoSimulador;
}

/** Grava a proposta e devolve o id. */
export async function registrarProposta(r: RegistroProposta): Promise<number> {
  const { cliente } = r.simulacao;

  const linha = await consultarUm<{ id: number }>(
    `INSERT INTO propostas (
       usuario_id, vendedor_id, consultor,
       cliente_nome, cliente_documento, cliente_telefone,
       quantidade_ucs, consumo_medio, fatura_atual, fatura_com_em_conta,
       economia_mensal, economia_anual, desconto_medio,
       simulacao, configuracao
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      r.usuarioId,
      r.vendedorId,
      cliente.consultor,
      cliente.nome,
      cliente.documento,
      cliente.telefone,
      r.resultado.quantidadeUCs,
      r.resultado.consumoMedioMensal,
      r.resultado.faturaAtual,
      r.resultado.faturaComEmConta,
      r.resultado.economiaMensal,
      r.resultado.economiaAnual,
      r.resultado.descontoMedio,
      JSON.stringify(r.simulacao),
      JSON.stringify(r.configuracao),
    ],
  );

  return Number(linha?.id);
}

export interface PropostaListada {
  readonly id: number;
  readonly clienteNome: string;
  readonly clienteDocumento: string;
  readonly clienteTelefone: string;
  readonly consultor: string;
  readonly vendedorId: number | null;
  readonly vendedorTemFoto: boolean;
  readonly quantidadeUCs: number;
  readonly consumoMedio: number;
  readonly faturaAtual: number;
  readonly faturaComEmConta: number;
  readonly economiaMensal: number;
  readonly economiaAnual: number;
  readonly descontoMedio: number;
  readonly criadaEm: string;
}

export interface FiltroPropostas {
  de?: string | null;
  ate?: string | null;
  vendedorId?: number | null;
  instituicao?: string | null;
  /** Busca por nome ou documento do cliente. */
  busca?: string | null;
  limite?: number;
}

/** O Postgres devolve NUMERIC como string — converter aqui evita "12" + 1 = "121". */
const n = (v: unknown): number => Number(v);

function condicoes(filtro: FiltroPropostas, restringirAoVendedor: number | null) {
  const cond: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, valor: unknown) => {
    params.push(valor);
    cond.push(sql.replace("?", `$${params.length}`));
  };

  if (restringirAoVendedor !== null) {
    params.push(restringirAoVendedor);
    cond.push(`(p.vendedor_id = $${params.length} OR p.usuario_id = $${params.length})`);
  }
  if (filtro.vendedorId) add("p.vendedor_id = ?", filtro.vendedorId);
  if (filtro.de) add("p.criada_em >= ?::date", filtro.de);
  if (filtro.ate) add("p.criada_em < (?::date + INTERVAL '1 day')", filtro.ate);
  if (filtro.instituicao) {
    add(
      "EXISTS (SELECT 1 FROM usuario_instituicoes ui WHERE ui.usuario_id = p.vendedor_id AND ui.instituicao = ?)",
      filtro.instituicao,
    );
  }
  if (filtro.busca?.trim()) {
    const termo = `%${filtro.busca.trim()}%`;
    params.push(termo);
    // Busca por nome OU por documento (o documento é guardado só com dígitos).
    cond.push(
      `(p.cliente_nome ILIKE $${params.length} OR p.cliente_documento ILIKE $${params.length})`,
    );
  }

  return { where: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params };
}

export async function listarPropostas(
  filtro: FiltroPropostas,
  restringirAoVendedor: number | null,
): Promise<PropostaListada[]> {
  const { where, params } = condicoes(filtro, restringirAoVendedor);

  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 500);
  params.push(limite);

  const linhas = await consultar<Record<string, unknown>>(
    `SELECT p.id, p.cliente_nome, p.cliente_documento, p.cliente_telefone,
            p.consultor, p.vendedor_id,
            (v.foto IS NOT NULL) AS vendedor_tem_foto,
            p.quantidade_ucs, p.consumo_medio, p.fatura_atual, p.fatura_com_em_conta,
            p.economia_mensal, p.economia_anual, p.desconto_medio, p.criada_em
       FROM propostas p
       LEFT JOIN usuarios v ON v.id = p.vendedor_id
       ${where}
      ORDER BY p.criada_em DESC
      LIMIT $${params.length}`,
    params,
  );

  return linhas.map((l) => ({
    id: Number(l.id),
    clienteNome: String(l.cliente_nome),
    clienteDocumento: String(l.cliente_documento),
    clienteTelefone: String(l.cliente_telefone),
    consultor: String(l.consultor),
    vendedorId: l.vendedor_id === null ? null : Number(l.vendedor_id),
    vendedorTemFoto: Boolean(l.vendedor_tem_foto),
    quantidadeUCs: n(l.quantidade_ucs),
    consumoMedio: n(l.consumo_medio),
    faturaAtual: n(l.fatura_atual),
    faturaComEmConta: n(l.fatura_com_em_conta),
    economiaMensal: n(l.economia_mensal),
    economiaAnual: n(l.economia_anual),
    descontoMedio: n(l.desconto_medio),
    criadaEm: (l.criada_em as Date).toISOString(),
  }));
}

/** Métricas de um vendedor no período. */
export interface MetricaVendedor {
  readonly vendedorId: number;
  readonly nome: string;
  readonly temFoto: boolean;
  readonly ativo: boolean;
  readonly instituicoes: readonly string[];
  readonly propostas: number;
  readonly clientes: number;
  readonly economiaAnualTotal: number;
  readonly economiaAnualMedia: number;
  readonly descontoMedio: number;
  readonly ultimaProposta: string | null;
}

export interface ResumoDashboard {
  readonly totalPropostas: number;
  readonly totalClientes: number;
  readonly economiaAnualTotal: number;
  readonly vendedoresAtivos: number;
  readonly porVendedor: readonly MetricaVendedor[];
  readonly porInstituicao: readonly {
    readonly instituicao: string;
    readonly propostas: number;
    readonly economiaAnualTotal: number;
  }[];
}

/**
 * Dashboard do gestor.
 *
 * Um vendedor pode estar em mais de uma instituição — então a soma por
 * instituição conta a mesma proposta em cada instituição do vendedor. Isso é
 * proposital: as instituições servem para métrica, e cada uma quer ver o que o
 * seu pessoal produziu. Por isso o total por instituição pode passar do total
 * geral, e a tela avisa isso.
 */
export async function montarDashboard(filtro: FiltroPropostas): Promise<ResumoDashboard> {
  // Parâmetros fixos, com NULL significando "sem filtro". Evita SQL dinâmico e
  // deixa o filtro de período dentro do ON do LEFT JOIN — se fosse no WHERE, o
  // LEFT viraria INNER e sumiriam os vendedores sem proposta no período (que são
  // justamente os que o gestor precisa ver).
  const p = [
    filtro.de ?? null,
    filtro.ate ?? null,
    filtro.vendedorId ?? null,
    filtro.instituicao ?? null,
  ];

  const periodo = `
    AND ($1::date IS NULL OR p.criada_em >= $1::date)
    AND ($2::date IS NULL OR p.criada_em < $2::date + INTERVAL '1 day')
  `;

  const porVendedor = await consultar<Record<string, unknown>>(
    `SELECT v.id AS vendedor_id, v.nome, v.ativo,
            (v.foto IS NOT NULL) AS tem_foto,
            COALESCE(
              (SELECT ARRAY_AGG(i.instituicao ORDER BY i.instituicao)
                 FROM usuario_instituicoes i WHERE i.usuario_id = v.id),
              ARRAY[]::TEXT[]
            ) AS instituicoes,
            COUNT(p.id) AS propostas,
            COUNT(DISTINCT p.cliente_documento) AS clientes,
            COALESCE(SUM(p.economia_anual), 0) AS economia_total,
            COALESCE(AVG(p.economia_anual), 0) AS economia_media,
            COALESCE(AVG(p.desconto_medio), 0) AS desconto_medio,
            MAX(p.criada_em) AS ultima
       FROM usuarios v
       LEFT JOIN propostas p ON p.vendedor_id = v.id ${periodo}
      WHERE v.papel = 'vendedor'
        AND ($3::bigint IS NULL OR v.id = $3::bigint)
        AND ($4::text IS NULL OR EXISTS (
              SELECT 1 FROM usuario_instituicoes ui
               WHERE ui.usuario_id = v.id AND ui.instituicao = $4::text))
      GROUP BY v.id, v.nome, v.ativo, tem_foto
      ORDER BY economia_total DESC, v.nome`,
    p,
  );

  const totais = await consultarUm<Record<string, unknown>>(
    `SELECT COUNT(p.id) AS propostas,
            COUNT(DISTINCT p.cliente_documento) AS clientes,
            COALESCE(SUM(p.economia_anual), 0) AS economia_total
       FROM propostas p
       JOIN usuarios v ON v.id = p.vendedor_id
      WHERE TRUE ${periodo}
        AND ($3::bigint IS NULL OR v.id = $3::bigint)
        AND ($4::text IS NULL OR EXISTS (
              SELECT 1 FROM usuario_instituicoes ui
               WHERE ui.usuario_id = v.id AND ui.instituicao = $4::text))`,
    p,
  );

  const porInstituicao = await consultar<Record<string, unknown>>(
    `SELECT ui.instituicao,
            COUNT(p.id) AS propostas,
            COALESCE(SUM(p.economia_anual), 0) AS economia_total
       FROM usuario_instituicoes ui
       JOIN propostas p ON p.vendedor_id = ui.usuario_id
      WHERE TRUE ${periodo}
        AND ($3::bigint IS NULL OR ui.usuario_id = $3::bigint)
        AND ($4::text IS NULL OR ui.instituicao = $4::text)
      GROUP BY ui.instituicao
      ORDER BY economia_total DESC`,
    p,
  );

  const ativos = await consultarUm<{ total: number }>(
    `SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'vendedor' AND ativo = TRUE`,
  );

  return {
    totalPropostas: n(totais?.propostas ?? 0),
    totalClientes: n(totais?.clientes ?? 0),
    economiaAnualTotal: n(totais?.economia_total ?? 0),
    vendedoresAtivos: n(ativos?.total ?? 0),
    porVendedor: porVendedor.map((l) => ({
      vendedorId: Number(l.vendedor_id),
      nome: String(l.nome),
      temFoto: Boolean(l.tem_foto),
      ativo: Boolean(l.ativo),
      instituicoes: (l.instituicoes as string[]) ?? [],
      propostas: n(l.propostas),
      clientes: n(l.clientes),
      economiaAnualTotal: n(l.economia_total),
      economiaAnualMedia: n(l.economia_media),
      descontoMedio: n(l.desconto_medio),
      ultimaProposta: l.ultima ? (l.ultima as Date).toISOString() : null,
    })),
    porInstituicao: porInstituicao.map((l) => ({
      instituicao: String(l.instituicao),
      propostas: n(l.propostas),
      economiaAnualTotal: n(l.economia_total),
    })),
  };
}

/** Dados necessários para regerar o PDF de uma proposta antiga. */
export interface PropostaCompleta {
  readonly id: number;
  readonly usuarioId: number;
  readonly vendedorId: number | null;
  readonly simulacao: Simulacao;
  readonly configuracao: ConfiguracaoSimulador;
}

export async function buscarPropostaParaPdf(
  ator: Usuario,
  id: number,
): Promise<PropostaCompleta> {
  const linha = await consultarUm<{
    id: number;
    usuario_id: number;
    vendedor_id: number | null;
    simulacao: unknown;
    configuracao: unknown;
  }>(
    `SELECT id, usuario_id, vendedor_id, simulacao, configuracao
       FROM propostas WHERE id = $1`,
    [id],
  );

  if (!linha) throw new ErroDeNegocio("Proposta não encontrada.");

  const usuarioId = Number(linha.usuario_id);
  const vendedorId = linha.vendedor_id === null ? null : Number(linha.vendedor_id);

  if (!podeVerProposta(ator, { usuarioId, vendedorId })) {
    throw new ErroProibido("Você não tem acesso a esta proposta.");
  }

  // Revalidamos o que veio do banco: a linha é antiga, o código é novo.
  return {
    id: Number(linha.id),
    usuarioId,
    vendedorId,
    simulacao: simulacaoSchema.parse(linha.simulacao) as Simulacao,
    configuracao: validarConfiguracao(linha.configuracao),
  };
}

/** Trava do dashboard: só admin/gestor. */
export function exigirAcessoAoDashboard(ator: Usuario): void {
  if (!podeVerHistoricoDeTodos(ator.papel)) {
    throw new ErroProibido("Você não tem acesso ao dashboard.");
  }
}
