"use client";

/**
 * Ficha do usuário — abre ao clicar na linha da tabela.
 *
 * Concentra tudo aqui (editar nome/e-mail, instituições, senha, situação e
 * exclusão) para a tabela não virar uma fileira de botões por linha.
 *
 * Toda ação bate na API, que revalida a permissão no servidor. A tela só deixa
 * de oferecer o que o papel não permite.
 */

import { KeyRound, Loader2, Save, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "../Avatar";
import { Botao, Campo } from "../ui";
import {
  INSTITUICOES,
  podeGerenciarUsuario,
  ROTULO_PAPEL,
  SENHA_PADRAO,
  type Instituicao,
  type Usuario,
} from "@/domain/auth/types";
import type { UsuarioListado } from "@/server/usuarios";

type Acao = "salvar" | "senha" | "situacao" | "excluir" | null;

export function ModalUsuario({
  ator,
  usuario,
  onFechar,
  onAtualizado,
  onExcluido,
}: {
  ator: Usuario;
  usuario: UsuarioListado;
  onFechar: () => void;
  onAtualizado: (u: UsuarioListado) => void;
  onExcluido: (id: number) => void;
}) {
  const gerenciavel = podeGerenciarUsuario(ator, usuario);
  const ehVendedor = usuario.papel === "vendedor";

  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([...usuario.instituicoes]);

  const [ocupado, setOcupado] = useState<Acao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const alterado =
    nome.trim() !== usuario.nome ||
    email.trim().toLowerCase() !== usuario.email.toLowerCase() ||
    (ehVendedor &&
      [...instituicoes].sort().join() !== [...usuario.instituicoes].sort().join());

  async function chamar(
    acao: Acao,
    caminho: string,
    opcoes: RequestInit,
  ): Promise<Record<string, unknown> | null> {
    setOcupado(acao);
    setErro(null);
    setAviso(null);
    try {
      const resposta = await fetch(caminho, {
        headers: { "Content-Type": "application/json" },
        ...opcoes,
      });
      const dados = (await resposta.json().catch(() => null)) as Record<string, unknown> | null;

      if (!resposta.ok) {
        const problemas = dados?.problemas as { mensagem: string }[] | undefined;
        setErro(
          problemas?.[0]?.mensagem ??
            (dados?.erro as string | undefined) ??
            "Não foi possível concluir a ação.",
        );
        return null;
      }
      return dados;
    } catch {
      setErro("Não foi possível conectar.");
      return null;
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    if (ehVendedor && instituicoes.length === 0) {
      setErro("O vendedor precisa de ao menos uma instituição.");
      return;
    }

    const dados = await chamar("salvar", `/api/usuarios/${usuario.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        nome: nome.trim(),
        email: email.trim(),
        ...(ehVendedor ? { instituicoes } : {}),
      }),
    });

    if (dados?.usuario) {
      onAtualizado(dados.usuario as UsuarioListado);
      setAviso("Alterações salvas.");
    }
  }

  async function trocarSituacao() {
    const dados = await chamar("situacao", `/api/usuarios/${usuario.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ativo: !usuario.ativo }),
    });
    if (dados?.usuario) {
      onAtualizado(dados.usuario as UsuarioListado);
      setAviso(usuario.ativo ? "Usuário desativado. As sessões dele caíram." : "Usuário reativado.");
    }
  }

  async function resetarSenha() {
    const dados = await chamar("senha", `/api/usuarios/${usuario.id}/resetar-senha`, {
      method: "POST",
    });
    if (dados?.usuario) {
      onAtualizado(dados.usuario as UsuarioListado);
      setAviso(
        `Senha redefinida para "${dados.senhaPadrao ?? SENHA_PADRAO}". ` +
          "Ele vai trocá-la no próximo acesso.",
      );
    }
  }

  async function excluir() {
    const dados = await chamar("excluir", `/api/usuarios/${usuario.id}`, { method: "DELETE" });
    if (dados?.ok) {
      onExcluido(usuario.id);
      onFechar();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-marca-texto/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-usuario"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-card border border-marca-borda bg-white shadow-xl">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-marca-borda p-5">
          <div className="flex items-center gap-3">
            <Avatar
              usuarioId={usuario.id}
              nome={usuario.nome}
              temFoto={usuario.temFoto}
              tamanho="lg"
            />
            <div className="min-w-0">
              <h2 id="titulo-usuario" className="truncate font-bold text-marca-texto">
                {usuario.nome}
              </h2>
              <p className="text-sm text-marca-texto-suave">
                {ROTULO_PAPEL[usuario.papel]}
                {usuario.id === ator.id ? " · você" : ""}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                  usuario.ativo
                    ? "bg-marca-verde-suave text-marca-verde-escuro"
                    : "bg-slate-100 text-marca-texto-suave"
                }`}
              >
                {usuario.ativo ? "Ativo" : "Inativo"}
              </span>
              {usuario.senhaProvisoria ? (
                <span className="ml-1.5 inline-block rounded-full bg-marca-amarelo-suave px-2 py-0.5 text-xs font-bold text-marca-laranja">
                  senha provisória
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1 text-marca-texto-suave hover:bg-slate-100"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
          {!gerenciavel ? (
            <p className="rounded-xl bg-marca-azul-suave px-3.5 py-2.5 text-sm text-marca-texto-suave">
              {usuario.id === ator.id
                ? "Você não altera a própria conta por aqui. Use o seu perfil."
                : "Você não tem permissão para gerenciar este usuário."}
            </p>
          ) : null}

          <Campo
            label="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={!gerenciavel || ocupado !== null}
          />

          <Campo
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!gerenciavel || ocupado !== null}
            ajuda="É com este e-mail que ele entra no sistema."
          />

          {ehVendedor ? (
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-marca-texto">
                Instituições
              </span>
              <div className="flex flex-wrap gap-2">
                {INSTITUICOES.map((i) => {
                  const marcada = instituicoes.includes(i);
                  return (
                    <label
                      key={i}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors ${
                        marcada
                          ? "border-marca-azul bg-marca-azul-suave text-marca-azul"
                          : "border-marca-borda bg-white text-marca-texto-suave hover:border-marca-azul-claro"
                      } ${!gerenciavel ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        disabled={!gerenciavel || ocupado !== null}
                        onChange={(e) =>
                          setInstituicoes((atual) =>
                            e.target.checked ? [...atual, i] : atual.filter((x) => x !== i),
                          )
                        }
                        className="size-4 accent-[#0F579F]"
                      />
                      {i}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-marca-texto-suave">
                Servem só para métricas. Pode marcar mais de uma.
              </p>
            </div>
          ) : null}

          {erro ? (
            <p
              role="alert"
              className="rounded-xl border-2 border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
            >
              {erro}
            </p>
          ) : null}

          {aviso ? (
            <p
              role="status"
              className="rounded-xl border-2 border-marca-verde/30 bg-marca-verde-suave px-3.5 py-2.5 text-sm font-medium text-marca-verde-escuro"
            >
              {aviso}
            </p>
          ) : null}

          {gerenciavel ? (
            <div className="space-y-3 border-t border-marca-borda pt-4">
              <Botao
                variante="sutil"
                onClick={resetarSenha}
                disabled={ocupado !== null}
                className="w-full"
              >
                {ocupado === "senha" ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <KeyRound aria-hidden="true" className="size-4" />
                )}
                Redefinir senha para a padrão
              </Botao>

              <Botao
                variante={usuario.ativo ? "perigo" : "sutil"}
                onClick={trocarSituacao}
                disabled={ocupado !== null}
                className="w-full"
              >
                {ocupado === "situacao" ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                {usuario.ativo ? "Desativar usuário" : "Reativar usuário"}
              </Botao>

              {/* Exclusão em dois passos: é irreversível. */}
              {!confirmandoExclusao ? (
                <Botao
                  variante="perigo"
                  onClick={() => setConfirmandoExclusao(true)}
                  disabled={ocupado !== null}
                  className="w-full"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Excluir usuário
                </Botao>
              ) : (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3.5">
                  <p className="flex items-start gap-2 text-sm font-semibold text-red-700">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    Excluir {usuario.nome} definitivamente?
                  </p>
                  <p className="mt-1.5 text-xs text-red-700/90">
                    A conta some e o acesso é encerrado. As propostas que ele emitiu{" "}
                    <strong>permanecem no histórico</strong>. Se você só quer bloquear o
                    acesso, prefira desativar.
                  </p>

                  <div className="mt-3 flex gap-2">
                    <Botao
                      variante="sutil"
                      onClick={() => setConfirmandoExclusao(false)}
                      disabled={ocupado !== null}
                      className="flex-1"
                    >
                      Cancelar
                    </Botao>
                    <Botao
                      variante="perigo"
                      onClick={excluir}
                      disabled={ocupado !== null}
                      className="flex-1"
                    >
                      {ocupado === "excluir" ? (
                        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <Trash2 aria-hidden="true" className="size-4" />
                      )}
                      Excluir
                    </Botao>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Rodapé */}
        <div className="flex gap-2 border-t border-marca-borda p-5">
          <Botao variante="sutil" onClick={onFechar} className="flex-1">
            Fechar
          </Botao>
          {gerenciavel ? (
            <Botao
              variante="secundario"
              onClick={salvar}
              disabled={!alterado || ocupado !== null}
              className="flex-1"
            >
              {ocupado === "salvar" ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="size-4" />
              )}
              Salvar
            </Botao>
          ) : null}
        </div>
      </div>
    </div>
  );
}
