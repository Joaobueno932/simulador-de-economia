"use client";

/**
 * Aba de usuários — a base de vendedores do gestor.
 *
 * Gestor cria apenas vendedores; admin cria qualquer papel. A tela só oferece o
 * que o papel permite, mas quem decide de fato é o servidor.
 */

import { Loader2, Plus, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { Botao, Campo, Card, SectionTitle, Select } from "../ui";
import {
  INSTITUICOES,
  papeisQuePodeCriar,
  podeGerenciarUsuario,
  ROTULO_PAPEL,
  type Instituicao,
  type Papel,
  type Usuario,
} from "@/domain/auth/types";
import type { UsuarioListado } from "@/server/usuarios";

interface Erro {
  campo?: string;
  mensagem: string;
}

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
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>(papeis[papeis.length - 1] ?? "vendedor");
  const [instituicao, setInstituicao] = useState<Instituicao>("SEMAPA");
  const [erro, setErro] = useState<Erro | null>(null);
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
          senha,
          papel,
          instituicao: papel === "vendedor" ? instituicao : null,
        }),
      });

      const dados = (await resposta.json().catch(() => null)) as
        | { usuario?: UsuarioListado; erro?: string; problemas?: Erro[] }
        | null;

      if (!resposta.ok || !dados?.usuario) {
        const p = dados?.problemas?.[0];
        setErro({ mensagem: p?.mensagem ?? dados?.erro ?? "Não foi possível criar o usuário." });
        return;
      }

      onCriado(dados.usuario);
      onFechar();
    } catch {
      setErro({ mensagem: "Não foi possível conectar." });
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
        <Campo
          label="Senha provisória"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          autoComplete="new-password"
          ajuda="Mínimo de 8 caracteres."
        />

        <Select
          label="Papel"
          value={papel}
          onChange={(e) => setPapel(e.target.value as Papel)}
          opcoes={papeis.map((p) => ({ value: p, label: ROTULO_PAPEL[p] }))}
          ajuda={papeis.length === 1 ? "Gestor só cadastra vendedores." : undefined}
        />

        {papel === "vendedor" ? (
          <Select
            label="Instituição"
            value={instituicao}
            onChange={(e) => setInstituicao(e.target.value as Instituicao)}
            opcoes={INSTITUICOES.map((i) => ({ value: i, label: i }))}
            ajuda="A qual instituição este vendedor pertence."
          />
        ) : null}

        {erro ? (
          <p
            role="alert"
            className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2"
          >
            {erro.mensagem}
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
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function alterar(alvo: UsuarioListado, patch: Record<string, unknown>) {
    setOcupado(alvo.id);
    setErro(null);
    try {
      const resposta = await fetch(`/api/usuarios/${alvo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const dados = (await resposta.json().catch(() => null)) as
        | { usuario?: UsuarioListado; erro?: string }
        | null;

      if (!resposta.ok || !dados?.usuario) {
        setErro(dados?.erro ?? "Não foi possível alterar o usuário.");
        return;
      }

      const atualizado = dados.usuario;
      onMudou(usuarios.map((u) => (u.id === atualizado.id ? atualizado : u)));
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setOcupado(null);
    }
  }

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

      {erro ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {erro}
        </p>
      ) : null}

      <Card>
        <SectionTitle descricao={`${usuarios.length} usuário(s) cadastrado(s).`}>
          Usuários
        </SectionTitle>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-marca-borda text-left">
                {["Nome", "E-mail", "Papel", "Instituição", "Situação", "Ações"].map((h) => (
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
                const ehVendedor = u.papel === "vendedor";

                return (
                  <tr key={u.id} className="border-b border-marca-borda/60">
                    <th scope="row" className="px-2 py-2.5 text-left font-semibold">
                      {u.nome}
                      {u.id === ator.id ? (
                        <span className="ml-1.5 text-xs font-normal text-marca-texto-suave">
                          (você)
                        </span>
                      ) : null}
                    </th>
                    <td className="px-2 py-2.5 text-marca-texto-suave">{u.email}</td>
                    <td className="px-2 py-2.5">{ROTULO_PAPEL[u.papel]}</td>

                    <td className="px-2 py-2.5">
                      {ehVendedor ? (
                        gerenciavel ? (
                          <select
                            aria-label={`Instituição de ${u.nome}`}
                            value={u.instituicao ?? ""}
                            disabled={ocupado === u.id}
                            onChange={(e) =>
                              alterar(u, { instituicao: e.target.value as Instituicao })
                            }
                            className="rounded-lg border-2 border-marca-borda px-2 py-1 text-sm focus:border-marca-azul disabled:opacity-50"
                          >
                            {INSTITUICOES.map((i) => (
                              <option key={i} value={i}>
                                {i}
                              </option>
                            ))}
                          </select>
                        ) : (
                          (u.instituicao ?? "—")
                        )
                      ) : (
                        <span className="text-marca-texto-suave">—</span>
                      )}
                    </td>

                    <td className="px-2 py-2.5">
                      {/* Situação com texto, não só cor. */}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${
                          u.ativo
                            ? "bg-marca-verde-suave text-marca-verde-escuro"
                            : "bg-slate-100 text-marca-texto-suave"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="px-2 py-2.5">
                      {gerenciavel ? (
                        <Botao
                          variante={u.ativo ? "perigo" : "sutil"}
                          onClick={() => alterar(u, { ativo: !u.ativo })}
                          disabled={ocupado === u.id}
                        >
                          {ocupado === u.id ? (
                            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                          ) : null}
                          {u.ativo ? "Desativar" : "Reativar"}
                        </Botao>
                      ) : (
                        <span className="text-xs text-marca-texto-suave">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-marca-texto-suave">
          Desativar um usuário encerra as sessões dele imediatamente.
        </p>
      </Card>
    </div>
  );
}
