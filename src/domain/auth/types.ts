/**
 * Papéis, instituições e permissões.
 *
 * Puro e testável — sem React, sem banco. Quem decide "pode ou não pode" é este
 * arquivo, e tanto o servidor quanto a UI consultam as MESMAS funções. A UI usa
 * para esconder o que não interessa; o servidor usa para de fato barrar.
 */

/** admin > gestor > vendedor. */
export type Papel = "admin" | "gestor" | "vendedor";

/**
 * Instituições às quais um vendedor pode estar vinculado.
 *
 * Servem SOMENTE para métricas: não alteram cálculo, permissão nem proposta.
 * Um vendedor pode pertencer a mais de uma.
 */
export const INSTITUICOES = ["SEMAPA", "FIEMS", "ADILSON"] as const;
export type Instituicao = (typeof INSTITUICOES)[number];

/** Senha entregue a um usuário novo (ou em um reset). Trocada no 1º acesso. */
export const SENHA_PADRAO = "senha123";

export interface Usuario {
  readonly id: number;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  /** Só vendedor tem instituições. Pode ter mais de uma, ou nenhuma. */
  readonly instituicoes: readonly Instituicao[];
  readonly ativo: boolean;
  /** Está com a senha padrão e precisa trocá-la antes de usar o sistema. */
  readonly senhaProvisoria: boolean;
  /** Tem foto de perfil enviada. */
  readonly temFoto: boolean;
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

/** Ver o dashboard e o histórico de TODOS os vendedores. */
export function podeVerHistoricoDeTodos(papel: Papel): boolean {
  return podeAdministrar(papel);
}

/**
 * Ver as instituições (SEMAPA, FIEMS, ADILSON).
 *
 * Elas existem só para as métricas do gestor — o vendedor não precisa saber a
 * que instituição está vinculado, e mostrar isso a ele só gera pergunta.
 */
export function podeVerInstituicoes(papel: Papel): boolean {
  return podeAdministrar(papel);
}

/**
 * Prepara o usuário para ir ao navegador.
 *
 * Para o vendedor, APAGA as instituições — não basta esconder no HTML: o objeto
 * viaja no payload da página e apareceria no DevTools. O que não deve ser visto
 * não é enviado.
 */
export function usuarioParaCliente(usuario: Usuario): Usuario {
  if (podeVerInstituicoes(usuario.papel)) return usuario;
  return { ...usuario, instituicoes: [] };
}

/** Redefinir a senha de outro usuário para a senha padrão. */
export function podeResetarSenha(papel: Papel): boolean {
  return podeAdministrar(papel);
}

/**
 * Remover uma proposta do histórico.
 *
 * SÓ admin e gestor. Deixar o vendedor apagar as próprias propostas destruiria
 * a auditoria — ele poderia esconder o que fez. A exclusão existe para limpar
 * lixo de teste, não para reescrever o passado; e a própria exclusão é
 * registrada no histórico, com quem apagou e qual cliente.
 */
export function podeExcluirProposta(papel: Papel): boolean {
  return podeAdministrar(papel);
}

/**
 * Excluir um cliente salvo ("Meus clientes").
 *
 * SÓ admin e gestor. O vendedor reabre e continua os seus clientes, mas não os
 * apaga — evita que ele suma com o próprio trabalho, e é o gestor quem faz a
 * limpeza.
 */
export function podeExcluirCliente(papel: Papel): boolean {
  return podeAdministrar(papel);
}

/**
 * Ver os clientes salvos de TODOS (não só os próprios).
 *
 * Admin e gestor precisam disso para gerenciar/limpar; o vendedor vê apenas os
 * seus.
 */
export function podeVerTodosClientes(papel: Papel): boolean {
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
 * Quem pode editar/desativar/resetar um usuário já existente.
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

/**
 * Quem pode abrir o PDF de uma proposta já emitida.
 *
 * Admin/gestor veem tudo. Vendedor vê só o que saiu no nome dele — inclusive as
 * que um gestor emitiu em seu nome.
 */
export function podeVerProposta(
  ator: Usuario,
  // `usuarioId` pode ser nulo: a conta de quem emitiu foi excluída, mas a
  // proposta permanece no histórico.
  proposta: { usuarioId: number | null; vendedorId: number | null },
): boolean {
  if (podeAdministrar(ator.papel)) return true;
  return proposta.usuarioId === ator.id || proposta.vendedorId === ator.id;
}
