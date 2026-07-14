"use client";

import { LogIn, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Botao, Campo, Mascote } from "@/components/ui";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = params.get("de") ?? "/";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);

    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null;
        setErro(dados?.erro ?? "Não foi possível entrar.");
        return;
      }

      // `replace` para o login não ficar no histórico do navegador.
      router.replace(destino.startsWith("/") ? destino : "/");
      router.refresh();
    } catch {
      setErro("Não foi possível conectar. Verifique sua internet.");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="space-y-4" noValidate>
      <Campo
        label="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="username"
        required
        placeholder="voce@emconta.com.br"
      />

      <Campo
        label="Senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="current-password"
        required
      />

      {erro ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
        >
          {erro}
        </p>
      ) : null}

      <Botao type="submit" disabled={entrando} className="w-full">
        {entrando ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <LogIn aria-hidden="true" className="size-4" />
        )}
        {entrando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Mascote variante="aceno" className="h-28 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-em-conta.png"
            alt="Em Conta — Energia Renovável"
            className="mt-2 h-12 w-auto"
          />
          <h1 className="mt-4 text-xl font-extrabold text-marca-texto">
            Simulador de Economia
          </h1>
          <p className="text-sm text-marca-texto-suave">Entre para começar a simular.</p>
        </div>

        <div className="rounded-card border border-marca-borda/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,42,67,.04),0_8px_24px_-12px_rgba(16,42,67,.15)]">
          <Suspense
            fallback={
              <p className="text-center text-sm text-marca-texto-suave">Carregando…</p>
            }
          >
            <Formulario />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-marca-texto-suave">
          Esqueceu a senha? Peça a redefinição ao seu gestor.
        </p>
      </div>
    </main>
  );
}
