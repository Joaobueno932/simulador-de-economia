"use client";

/**
 * Aba de usuários — a base de vendedores do gestor.
 *
 * A tabela só LISTA. Clicar na linha abre a ficha (`ModalUsuario`), que concentra
 * editar, redefinir senha, ativar/desativar e excluir — em vez de encher cada
 * linha de botões.
 *
 * Gestor cria apenas vendedores; admin cria qualquer papel. A tela só oferece o
 * que o papel permite, mas quem decide de fato é o servidor.
 */

import { Loader2, Plus, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { Avatar } from "../Avatar";
import { ModalUsuario } from "./ModalUsuario";
import { Botao, Campo, Card, SectionTitle, Select } from "../ui";
import {
  INSTITUICOES,
  papeisQuePodeCriar,
  podeGerenciarUsuario,
  ROTULO_PAPEL,
  SENHA_PADRAO,
  type Instituicao,
  type Papel,
  type Usuario,
} from "@/domain/auth/types";
import type { UsuarioListado } from "@/server/usuarios";

function FormNovoUsuario({
  ator,
  onCriado,
  onFechar,
}: {
  ator: Usuario;
  onCriado: (u: UsuarioListado) => void;
  onFechar: () => void;
}) {
  const papeis = papeisQuePodeCriar(ator.papel);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>(papeis[papeis.length - 1] ?? "vendedor");
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>(["SEMAPA"]);
  const [usarSenhaPadrao, setUsarSenhaPadrao] = useState(true);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const resposta = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          papel,
          instituicoes: papel === "vendedor" ? instituicoes : [],
          usarSenhaPadrao,
          senha: usarSenhaPadrao ? null : senha,
        }),
      });

      const dados = (await resposta.json().catch(() => null)) as
        | { usuario?: UsuarioListado; erro?: string; problemas?: { mensagem: string }[] }
        | null;

      if (!resposta.ok || !dados?.usuario) {
        setErro(dados?.problemas?.[0]?.mensagem ?? dados?.erro ?? "Não foi possível criar.");
        return;
      }

      onCriado(dados.usuario);
      onFechar();
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between">
        <SectionTitle
          icon={<UserPlus aria-hidden="true" className="size-5" />}
          descricao={
            ator.papel === "gestor"
              ? "Como gestor, você cadastra vendedores."
              : "Cadastre administradores, gestores ou vendedores."
          }
        >
          Novo usuário
        </SectionTitle>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="rounded-lg p-1 text-marca-texto-suave hover:bg-slate-100"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <form onSubmit={criar} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo
          label="Nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="sm:col-span-2"
        />
        <Campo
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
        />

        <Select
          label="Papel"
          value={papel}
          onChange={(e) => setPapel(e.target.value as Papel)}
          opcoes={papeis.map((p) => ({ value: p, label: ROTULO_PAPEL[p] }))}
          ajuda={papeis.length === 1 ? "Gestor só cadastra vendedores." : undefined}
        />

        {papel === "vendedor" ? (
          <div className="sm:col-span-2">
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
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
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

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-marca-borda p-3">
            <input
              type="checkbox"
              checked={usarSenhaPadrao}
              onChange={(e) => setUsarSenhaPadrao(e.target.checked)}
              className="mt-0.5 size-4 accent-[#0F579F]"
            />
            <span>
              <span className="block text-sm font-semibold text-marca-texto">
                Usar a senha padrão ({SENHA_PADRAO})
              </span>
              <span className="block text-xs text-marca-texto-suave">
                O usuário entra com ela e é obrigado a escolher uma nova no primeiro acesso.
              </span>
            </span>
          </label>
        </div>

        {!usarSenhaPadrao ? (
          <Campo
            label="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            autoComplete="new-password"
            ajuda="Mínimo de 8 caracteres."
            className="sm:col-span-2"
          />
        ) : null}

        {erro ? (
          <p
            role="alert"
            className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2"
          >
            {erro}
          </p>
        ) : null}

        <div className="flex gap-2 sm:col-span-2">
          <Botao type="button" variante="sutil" onClick={onFechar} className="flex-1">
            Cancelar
          </Botao>
          <Botao type="submit" variante="secundario" disabled={enviando} className="flex-1">
            {enviando ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {enviando ? "Criando…" : "Criar usuário"}
          </Botao>
        </div>
      </form>
    </Card>
  );
}

export function AbaUsuarios({
  ator,
  usuarios,
  onMudou,
}: {
  ator: Usuario;
  usuarios: readonly UsuarioListado[];
  onMudou: (u: readonly UsuarioListado[]) => void;
}) {
  const [criando, setCriando] = useState(false);
  const [selecionado, setSelecionado] = useState<UsuarioListado | null>(null);

  return (
    <div className="space-y-4">
      {criando ? (
        <FormNovoUsuario
          ator={ator}
          onCriado={(u) => onMudou([...usuarios, u])}
          onFechar={() => setCriando(false)}
        />
      ) : (
        <Botao variante="secundario" onClick={() => setCriando(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Novo usuário
        </Botao>
      )}

      <Card>
        <SectionTitle
          descricao={`${usuarios.length} usuário(s). Clique em um deles para editar, redefinir a senha ou excluir.`}
        >
          Usuários
        </SectionTitle>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-marca-borda text-left">
                {["Usuário", "Papel", "Instituições", "Situação"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-marca-texto-suave"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const gerenciavel = podeGerenciarUsuario(ator, u);

                return (
                  <tr
                    key={u.id}
                    // A linha inteira abre a ficha. `tabIndex` + Enter/Espaço
                    // para quem navega por teclado — não é um clique só de mouse.
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir ficha de ${u.nome}`}
                    onClick={() => setSelecionado(u)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelecionado(u);
                      }
                    }}
                    className="cursor-pointer border-b border-marca-borda/60 transition-colors hover:bg-marca-azul-suave focus-visible:bg-marca-azul-suave"
                  >
                    <th scope="row" className="px-2 py-2.5 text-left font-semibold">
                      <span className="flex items-center gap-2.5">
                        <Avatar
                          usuarioId={u.id}
                          nome={u.nome}
                          temFoto={u.temFoto}
                          tamanho="md"
                        />
                        <span className="min-w-0">
                          <span className="block truncate">
                            {u.nome}
                            {u.id === ator.id ? (
                              <span className="ml-1.5 text-xs font-normal text-marca-texto-suave">
                                (você)
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs font-normal text-marca-texto-suave">
                            {u.email}
                          </span>
                          {u.senhaProvisoria ? (
                            <span className="mt-0.5 inline-block rounded-full bg-marca-amarelo-suave px-1.5 py-0.5 text-[10px] font-bold text-marca-laranja">
                              senha provisória
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </th>

                    <td className="px-2 py-2.5">{ROTULO_PAPEL[u.papel]}</td>

                    <td className="px-2 py-2.5 text-xs text-marca-texto-suave">
                      {u.instituicoes.length > 0 ? u.instituicoes.join(", ") : "—"}
                    </td>

                    <td className="px-2 py-2.5">
                      {/* Situação em texto, não só cor. */}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          u.ativo
                            ? "bg-marca-verde-suave text-marca-verde-escuro"
                            : "bg-slate-100 text-marca-texto-suave"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                      {!gerenciavel ? (
                        <span className="ml-1.5 text-xs text-marca-texto-suave">
                          (somente leitura)
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selecionado ? (
        <ModalUsuario
          ator={ator}
          usuario={selecionado}
          onFechar={() => setSelecionado(null)}
          onAtualizado={(u) => {
            onMudou(usuarios.map((x) => (x.id === u.id ? u : x)));
            setSelecionado(u);
          }}
          onExcluido={(id) => onMudou(usuarios.filter((x) => x.id !== id))}
        />
      ) : null}
    </div>
  );
}
