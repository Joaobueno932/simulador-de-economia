import "server-only";

/**
 * Leitura e escrita da configuração do simulador.
 *
 * A config é a fonte de verdade das TARIFAS — então ela vive no banco, é
 * validada ao ler e ao gravar, e é injetada no domínio (`calcularSimulacao`).
 * O navegador nunca dita tarifa: mesmo que a tela mande outra coisa, o PDF é
 * gerado com a config lida daqui.
 */

import { consultar, consultarUm } from "./db";
import {
  configuracaoPadrao,
  validarConfiguracao,
} from "@/domain/simulator/configSchema";
import type { ConfiguracaoSimulador } from "@/domain/simulator/config";

interface LinhaConfig {
  dados: unknown;
  atualizado_em: Date;
}

/**
 * Config vigente. Se ainda não há linha no banco (ou se a linha ficou inválida
 * depois de uma mudança de código), cai no padrão da planilha — o simulador
 * nunca fica sem tarifa.
 */
export async function carregarConfiguracao(): Promise<ConfiguracaoSimulador> {
  const linha = await consultarUm<LinhaConfig>(
    `SELECT dados, atualizado_em FROM configuracao WHERE id = 1`,
  );

  if (!linha) return configuracaoPadrao();

  try {
    return validarConfiguracao(linha.dados);
  } catch {
    // Config salva não bate mais com o schema (ex.: campo novo no código).
    // Melhor calcular com o padrão conhecido do que quebrar a proposta.
    console.error("Configuração do banco é inválida; usando o padrão da planilha.");
    return configuracaoPadrao();
  }
}

/** Grava a config. Valida ANTES de escrever — lixo não entra no banco. */
export async function salvarConfiguracao(
  dados: unknown,
  usuarioId: number,
): Promise<ConfiguracaoSimulador> {
  const valida = validarConfiguracao(dados);

  await consultar(
    `INSERT INTO configuracao (id, dados, atualizado_em, atualizado_por)
     VALUES (1, $1, NOW(), $2)
     ON CONFLICT (id) DO UPDATE
       SET dados = EXCLUDED.dados,
           atualizado_em = NOW(),
           atualizado_por = EXCLUDED.atualizado_por`,
    [JSON.stringify(valida), usuarioId],
  );

  return valida;
}

/** Quando e por quem a config foi alterada pela última vez. */
export async function metadadosConfiguracao(): Promise<{
  atualizadoEm: string | null;
  atualizadoPor: string | null;
}> {
  const linha = await consultarUm<{ atualizado_em: Date | null; nome: string | null }>(
    `SELECT c.atualizado_em, u.nome
       FROM configuracao c
       LEFT JOIN usuarios u ON u.id = c.atualizado_por
      WHERE c.id = 1`,
  );

  return {
    atualizadoEm: linha?.atualizado_em ? linha.atualizado_em.toISOString() : null,
    atualizadoPor: linha?.nome ?? null,
  };
}
