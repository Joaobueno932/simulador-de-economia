/**
 * Vocabulário do histórico.
 *
 * Fica no DOMÍNIO (não em `src/server`) porque a tela do gestor precisa dos
 * rótulos — e `src/server/*` é `server-only`. Tipo é apagado na compilação, mas
 * `ROTULO_EVENTO` é um valor: se morasse no servidor, arrastaria o módulo
 * inteiro (e o driver do Postgres) para o bundle do navegador.
 */

export type TipoEvento =
  | "login"
  | "senha_alterada"
  | "senha_resetada"
  | "usuario_criado"
  | "usuario_ativado"
  | "usuario_desativado"
  | "usuario_excluido"
  | "config_alterada"
  | "senha_desconto_emitida"
  | "senha_desconto_usada"
  | "proposta_gerada"
  | "proposta_excluida"
  | "cliente_excluido"
  | "foto_alterada";

export const ROTULO_EVENTO: Readonly<Record<TipoEvento, string>> = {
  login: "Entrou no sistema",
  senha_alterada: "Alterou a própria senha",
  senha_resetada: "Redefiniu a senha de um usuário",
  usuario_criado: "Criou um usuário",
  usuario_ativado: "Reativou um usuário",
  usuario_desativado: "Desativou um usuário",
  usuario_excluido: "Excluiu um usuário",
  config_alterada: "Alterou as configurações",
  senha_desconto_emitida: "Emitiu senha de desconto",
  senha_desconto_usada: "Usou senha de desconto",
  proposta_gerada: "Gerou uma proposta",
  proposta_excluida: "Removeu uma proposta do histórico",
  cliente_excluido: "Excluiu um cliente salvo",
  foto_alterada: "Alterou a foto de perfil",
};

/** Tipos oferecidos no filtro do histórico, na ordem em que aparecem. */
export const TIPOS_EVENTO: readonly TipoEvento[] = [
  "proposta_gerada",
  "proposta_excluida",
  "cliente_excluido",
  "senha_desconto_emitida",
  "senha_desconto_usada",
  "login",
  "usuario_criado",
  "usuario_desativado",
  "usuario_ativado",
  "usuario_excluido",
  "senha_resetada",
  "senha_alterada",
  "config_alterada",
  "foto_alterada",
];
