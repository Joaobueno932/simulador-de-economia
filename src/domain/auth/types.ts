/**
 * Papéis, instituições e permissões.
 *
 * Puro e testável — sem React, sem banco. Quem decide "pode ou não pode" é este
 * arquivo, e tanto o servidor quanto a UI consultam as MESMAS funções. A UI usa
 * para esconder o que não interessa; o servidor usa para de fato barrar.
 */

/** admin > gestor > vendedor. */
export type Papel = "admin" | "gestor" | "vendedor";

/** Instituições às quais um vendedor pode estar vinculado. */
export const INSTITUICOES = ["SEMAPA", "FIEMS", "ADILSON"] as const;
export type Instituicao = (typeof INSTITUICOES)[number];

export interface Usuario {
  readonly id: number;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  /** Só vendedor tem instituição. */
  readonly instituicao: Instituicao | null;
  readonly ativo: boolean;
}

export const ROTULO_PAPEL: Readonly<Record<Papel, string>> = {
  admin: "Administrador",
  gestor: "Gestor",
  vendedor: "Vendedor",
};

/** Admin e gestor administram o sistema; vendedor apenas simula. */
export function podeAdministrar(papel: Papel): boolean {
  return papel === "admin" || papel === "gestor";
}

/** Editar tarifas, impostos, COSIP, validade da proposta etc. */
export function podeEditarConfiguracoes(papel: Papel): boolean {
  return podeAdministrar(papel);
}

/** Emitir senha de uso único para liberar o desconto de um vendedor. */
export function podeEmitirSenhaDesconto(papel: Papel): boolean {
  return podeAdministrar(papel);
}

/**
 * Quais papéis cada um pode CRIAR.
 *
 * Gestor cria apenas vendedores — não pode se promover nem criar pares.
 * Só o admin cria gestores e outros admins.
 */
export function papeisQuePodeCriar(papel: Papel): readonly Papel[] {
  switch (papel) {
    case "admin":
      return ["admin", "gestor", "vendedor"];
    case "gestor":
      return ["vendedor"];
    case "vendedor":
      return [];
  }
}

export function podeCriarPapel(criador: Papel, alvo: Papel): boolean {
  return papeisQuePodeCriar(criador).includes(alvo);
}

/**
 * Quem pode editar/desativar um usuário já existente.
 *
 * Regras:
 * - ninguém mexe em si mesmo por esta tela (evita se desativar ou se rebaixar);
 * - gestor só mexe em vendedor;
 * - admin mexe em qualquer um (menos nele mesmo).
 */
export function podeGerenciarUsuario(ator: Usuario, alvo: Usuario): boolean {
  if (ator.id === alvo.id) return false;
  if (ator.papel === "admin") return true;
  if (ator.papel === "gestor") return alvo.papel === "vendedor";
  return false;
}

/**
 * O desconto é travado para vendedor: só um admin/gestor libera, e mesmo assim
 * por uma senha de uso único. Admin e gestor editam direto.
 */
export function podeEditarDescontoLivremente(papel: Papel): boolean {
  return podeAdministrar(papel);
}

/** Vendedor só emite proposta em nome de si mesmo. */
export function podeEscolherConsultor(papel: Papel): boolean {
  return podeAdministrar(papel);
}
