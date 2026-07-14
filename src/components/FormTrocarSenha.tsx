"use client";

/**
 * Troca de senha.
 *
 * Serve para os dois casos:
 *  - obrigatório: usuário entrou com a senha padrão (primeiro acesso ou reset);
 *  - voluntário: usuário quer trocar a senha pelo próprio perfil.
 *
 * No caso obrigatório não há como escapar: o servidor recusa qualquer outra rota
 * enquanto a senha for provisória, então não adianta digitar a URL na mão.
 */

import { KeyRound, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao, Campo, Mascote } from "@/components/ui";
import { SENHA_PADRAO, type Usuario } from "@/domain/auth/types";

export function FormTrocarSenha({ usuario }: { usuario: Usuario }) {
  const router = useRouter();
  const obrigatorio = usuario.senhaProvisoria;

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Conferido aqui só para dar retorno imediato; o servidor valida de novo.
  const curta = novaSenha.length > 0 && novaSenha.length < 8;
  const naoConfere = confirmacao.length > 0 && novaSenha !== confirmacao;
  const igualPadrao = novaSenha === SENHA_PADRAO && novaSenha.length > 0;

  const podeEnviar =
    senhaAtual.length > 0 &&
    novaSenha.length >= 8 &&
    novaSenha === confirmacao &&
    !igualPadrao;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const resposta = await fetch("/api/auth/trocar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });

      const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null;

      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não foi possível trocar a senha.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Mascote variante="suporte-sem-fundo" className="h-28 w-auto" />
          <h1 className="mt-3 text-xl font-extrabold text-marca-texto">
            {obrigatorio ? "Escolha a sua senha" : "Trocar senha"}
          </h1>
          <p className="mt-1 text-sm text-marca-texto-suave">
            {obrigatorio
              ? "Você está usando a senha padrão. Defina uma senha só sua para continuar."
              : "Defina uma nova senha de acesso."}
          </p>
        </div>

        <div className="rounded-card border border-marca-borda/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,42,67,.04),0_8px_24px_-12px_rgba(16,42,67,.15)]">
          {obrigatorio ? (
            <p className="mb-4 flex items-start gap-2 rounded-xl border-2 border-marca-amarelo/50 bg-marca-amarelo-suave px-3 py-2.5 text-sm text-marca-texto">
              <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                Enquanto a senha padrão estiver ativa, o simulador fica bloqueado.
              </span>
            </p>
          ) : null}

          <form onSubmit={enviar} className="space-y-4" noValidate>
            <Campo
              label="Senha atual"
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              autoComplete="current-password"
              required
              ajuda={obrigatorio ? `É a senha padrão: ${SENHA_PADRAO}` : undefined}
            />

            <Campo
              label="Nova senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              autoComplete="new-password"
              required
              erro={
                curta
                  ? "A senha deve ter ao menos 8 caracteres."
                  : igualPadrao
                    ? "Escolha uma senha diferente da padrão."
                    : undefined
              }
              ajuda={!curta && !igualPadrao ? "Mínimo de 8 caracteres." : undefined}
            />

            <Campo
              label="Confirme a nova senha"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="new-password"
              required
              erro={naoConfere ? "As senhas não conferem." : undefined}
            />

            {erro ? (
              <p
                role="alert"
                className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
              >
                {erro}
              </p>
            ) : null}

            <Botao type="submit" disabled={!podeEnviar || enviando} className="w-full">
              {enviando ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <KeyRound aria-hidden="true" className="size-4" />
              )}
              {enviando ? "Salvando…" : "Salvar nova senha"}
            </Botao>
          </form>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={sair}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca-texto-suave hover:text-marca-texto"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}
