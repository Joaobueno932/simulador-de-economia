import "server-only";

/**
 * Clientes salvos ("Meus clientes").
 *
 * Rascunho editável de uma simulação, gravado quando o consultor chega à etapa
 * 2, para reabrir e continuar o atendimento depois. Diferente de `propostas`,
 * que é o registro imutável de um PDF emitido.
 *
 * O consultor logado é o dono. Um vendedor só vê e reabre os SEUS; admin/gestor
 * veem todos e podem excluir.
 */

import { consultar, consultarUm } from "./db";
import { ErroProibido } from "./auth";
import { ErroDeNegocio } from "./usuarios";
import {
  podeExcluirCliente,
  podeVerTodosClientes,
  type Usuario,
} from "@/domain/auth/types";
import { simulacaoArmazenadaSchema } from "@/domain/simulator/validation";
import type { Simulacao } from "@/domain/simulator/types";

/**
 * Cria ou atualiza um cliente salvo.
 *
 * Com `id` (e sendo o dono), atualiza; sem `id`, cria. A simulação é validada
 * com o mesmo schema dos registros armazenados — não gravamos lixo, mas
 * aceitamos uma simulação ainda em construção (consumo pode ser 0 na etapa 2).
 *
 * Devolve o id da linha, para o cliente continuar salvando na mesma.
 */
export async function salvarSimulacao(
  usuario: Usuario,
  simulacao: Simulacao,
  id: number | null,
): Promise<number> {
  const dados = simulacaoArmazenadaSchema.parse(simulacao) as Simulacao;
  const { cliente, unidades } = dados;
  const documento = cliente.documento ?? "";

  if (id !== null) {
    // Atualiza só se a linha for do próprio usuário. Um vendedor não sobrescreve
    // o cliente de outro; admin/gestor idem (cada um edita o que abriu).
    const linha = await consultarUm<{ id: number }>(
      `UPDATE simulacoes
          SET cliente_nome = $1, cliente_documento = $2, quantidade_ucs = $3,
              dados = $4, atualizada_em = NOW()
        WHERE id = $5 AND usuario_id = $6
        RETURNING id`,
      [cliente.nome, documento, unidades.length, JSON.stringify(dados), id, usuario.id],
    );
    if (linha) return Number(linha.id);
    // A linha não é dele (ou sumiu): cai para inserir uma nova, sem estourar.
  }

  const nova = await consultarUm<{ id: number }>(
    `INSERT INTO simulacoes (usuario_id, cliente_nome, cliente_documento, quantidade_ucs, dados)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [usuario.id, cliente.nome, documento, unidades.length, JSON.stringify(dados)],
  );
  return Number(nova?.id);
}

export interface ClienteSalvo {
  readonly id: number;
  readonly clienteNome: string;
  readonly clienteDocumento: string;
  readonly quantidadeUCs: number;
  readonly donoId: number;
  readonly donoNome: string | null;
  readonly donoTemFoto: boolean;
  readonly criadaEm: string;
  readonly atualizadaEm: string;
}

/**
 * Lista os clientes salvos.
 *
 * Vendedor: só os seus. Admin/gestor: todos, com o dono identificado (para
 * gerenciar/limpar).
 */
export async function listarSimulacoes(usuario: Usuario): Promise<ClienteSalvo[]> {
  const veTodos = podeVerTodosClientes(usuario.papel);

  const linhas = await consultar<{
    id: number;
    cliente_nome: string;
    cliente_documento: string;
    quantidade_ucs: number;
    usuario_id: number;
    dono_nome: string | null;
    dono_tem_foto: boolean;
    criada_em: Date;
    atualizada_em: Date;
  }>(
    `SELECT s.id, s.cliente_nome, s.cliente_documento, s.quantidade_ucs,
            s.usuario_id, u.nome AS dono_nome, (u.foto IS NOT NULL) AS dono_tem_foto,
            s.criada_em, s.atualizada_em
       FROM simulacoes s
       LEFT JOIN usuarios u ON u.id = s.usuario_id
      ${veTodos ? "" : "WHERE s.usuario_id = $1"}
      ORDER BY s.atualizada_em DESC
      LIMIT 500`,
    veTodos ? [] : [usuario.id],
  );

  return linhas.map((l) => ({
    id: Number(l.id),
    clienteNome: l.cliente_nome,
    clienteDocumento: l.cliente_documento,
    quantidadeUCs: Number(l.quantidade_ucs),
    donoId: Number(l.usuario_id),
    donoNome: l.dono_nome,
    donoTemFoto: Boolean(l.dono_tem_foto),
    criadaEm: l.criada_em.toISOString(),
    atualizadaEm: l.atualizada_em.toISOString(),
  }));
}

/**
 * Busca uma simulação salva para reabrir.
 *
 * Vendedor só abre a sua; admin/gestor abrem qualquer uma.
 */
export async function buscarSimulacao(usuario: Usuario, id: number): Promise<Simulacao> {
  const linha = await consultarUm<{ usuario_id: number; dados: unknown }>(
    `SELECT usuario_id, dados FROM simulacoes WHERE id = $1`,
    [id],
  );
  if (!linha) throw new ErroDeNegocio("Cliente não encontrado.");

  const ehDono = Number(linha.usuario_id) === usuario.id;
  if (!ehDono && !podeVerTodosClientes(usuario.papel)) {
    throw new ErroProibido("Você não tem acesso a este cliente.");
  }

  // A linha é antiga, o código é novo: revalida a estrutura.
  return simulacaoArmazenadaSchema.parse(linha.dados) as Simulacao;
}

/**
 * Exclui um cliente salvo. Só admin/gestor.
 *
 * Devolve o nome do cliente, para a descrição do evento de auditoria.
 */
export async function excluirSimulacao(ator: Usuario, id: number): Promise<string> {
  if (!podeExcluirCliente(ator.papel)) {
    throw new ErroProibido("Você não pode excluir clientes salvos.");
  }

  const linha = await consultarUm<{ cliente_nome: string }>(
    `DELETE FROM simulacoes WHERE id = $1 RETURNING cliente_nome`,
    [id],
  );
  if (!linha) throw new ErroDeNegocio("Cliente não encontrado.");
  return linha.cliente_nome;
}
