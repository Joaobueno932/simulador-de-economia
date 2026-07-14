import "server-only";

/**
 * Trilha de auditoria.
 *
 * Registra o que cada um fez. É a base do histórico que o gestor consulta.
 *
 * REGRA: o registro NUNCA derruba a operação. Se gravar o evento falhar, a
 * proposta já foi gerada e o usuário não pode ser punido por isso — logamos o
 * erro e seguimos. Auditoria é importante, mas não é mais importante que o
 * trabalho do vendedor.
 */

import { consultar } from "./db";
import type { TipoEvento } from "@/domain/auth/eventos";

interface Registro {
  usuarioId: number | null;
  tipo: TipoEvento;
  descricao: string;
  alvoUsuarioId?: number | null;
  propostaId?: number | null;
}

export async function registrarEvento(e: Registro): Promise<void> {
  try {
    await consultar(
      `INSERT INTO eventos (usuario_id, tipo, descricao, alvo_usuario_id, proposta_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [e.usuarioId, e.tipo, e.descricao, e.alvoUsuarioId ?? null, e.propostaId ?? null],
    );
  } catch (erro) {
    // Ver comentário do topo: auditoria não derruba operação.
    console.error(
      "Falha ao registrar evento:",
      erro instanceof Error ? erro.message : "desconhecido",
    );
  }
}

export interface EventoListado {
  readonly id: number;
  readonly tipo: TipoEvento;
  readonly descricao: string;
  readonly usuarioId: number | null;
  readonly usuarioNome: string | null;
  readonly usuarioPapel: string | null;
  readonly usuarioTemFoto: boolean;
  readonly alvoNome: string | null;
  readonly propostaId: number | null;
  readonly criadoEm: string;
}

export interface FiltroHistorico {
  /** ISO yyyy-mm-dd. */
  de?: string | null;
  ate?: string | null;
  usuarioId?: number | null;
  tipo?: TipoEvento | null;
  instituicao?: string | null;
  limite?: number;
}

/**
 * Histórico de eventos, com filtros.
 *
 * `restringirAoUsuario` é a trava do vendedor: ele só enxerga a própria trilha.
 * Passar `null` (admin/gestor) libera todo mundo.
 */
export async function listarEventos(
  filtro: FiltroHistorico,
  restringirAoUsuario: number | null,
): Promise<EventoListado[]> {
  const cond: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, valor: unknown) => {
    params.push(valor);
    cond.push(sql.replace("?", `$${params.length}`));
  };

  if (restringirAoUsuario !== null) add("e.usuario_id = ?", restringirAoUsuario);
  if (filtro.usuarioId) add("e.usuario_id = ?", filtro.usuarioId);
  if (filtro.tipo) add("e.tipo = ?", filtro.tipo);
  if (filtro.de) add("e.criado_em >= ?::date", filtro.de);
  // `+ 1 dia` para incluir o dia inteiro do "até".
  if (filtro.ate) add("e.criado_em < (?::date + INTERVAL '1 day')", filtro.ate);
  if (filtro.instituicao) {
    add(
      "EXISTS (SELECT 1 FROM usuario_instituicoes ui WHERE ui.usuario_id = e.usuario_id AND ui.instituicao = ?)",
      filtro.instituicao,
    );
  }

  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 500);
  params.push(limite);

  const linhas = await consultar<{
    id: number;
    tipo: TipoEvento;
    descricao: string;
    usuario_id: number | null;
    usuario_nome: string | null;
    usuario_papel: string | null;
    usuario_tem_foto: boolean;
    alvo_nome: string | null;
    proposta_id: number | null;
    criado_em: Date;
  }>(
    `SELECT e.id, e.tipo, e.descricao, e.usuario_id,
            u.nome AS usuario_nome, u.papel AS usuario_papel,
            (u.foto IS NOT NULL) AS usuario_tem_foto,
            a.nome AS alvo_nome,
            e.proposta_id, e.criado_em
       FROM eventos e
       LEFT JOIN usuarios u ON u.id = e.usuario_id
       LEFT JOIN usuarios a ON a.id = e.alvo_usuario_id
      ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
      ORDER BY e.criado_em DESC
      LIMIT $${params.length}`,
    params,
  );

  return linhas.map((l) => ({
    id: Number(l.id),
    tipo: l.tipo,
    descricao: l.descricao,
    usuarioId: l.usuario_id === null ? null : Number(l.usuario_id),
    usuarioNome: l.usuario_nome,
    usuarioPapel: l.usuario_papel,
    usuarioTemFoto: Boolean(l.usuario_tem_foto),
    alvoNome: l.alvo_nome,
    propostaId: l.proposta_id === null ? null : Number(l.proposta_id),
    criadoEm: l.criado_em.toISOString(),
  }));
}
