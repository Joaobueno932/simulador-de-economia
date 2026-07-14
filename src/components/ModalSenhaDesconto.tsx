"use client";

/**
 * Modal da senha de uso único que libera a edição do desconto.
 *
 * A tela só pede o código: quem valida é o servidor, que consome a senha (uso
 * único, 15 minutos, vinculada àquele vendedor) e marca a liberação NA SESSÃO.
 * Por isso destravar o campo aqui não adianta nada sozinho — a rota do PDF
 * confere a sessão antes de aceitar um desconto fora do padrão.
 */

import { KeyRound, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Botao } from "./ui";

export function ModalSenhaDesconto({
  aberto,
  onFechar,
  onLiberado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onLiberado: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setCodigo("");
      setErro(null);
      // Foco no campo assim que abre — teclado, sem mouse.
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [aberto]);

  // Esc fecha.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const resposta = await fetch("/api/senha-desconto/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });

      const dados = (await resposta.json().catch(() => null)) as
        | { liberado?: boolean; erro?: string }
        | null;

      if (!resposta.ok || !dados?.liberado) {
        setErro(dados?.erro ?? "Não foi possível validar a senha.");
        return;
      }

      onLiberado();
      onFechar();
    } catch {
      setErro("Não foi possível conectar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-marca-texto/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-senha-desconto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="w-full max-w-sm rounded-card border border-marca-borda bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-amarelo-suave text-marca-laranja">
              <KeyRound aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 id="titulo-senha-desconto" className="font-bold text-marca-texto">
                Liberar edição do desconto
              </h2>
              <p className="mt-0.5 text-sm text-marca-texto-suave">
                Peça ao seu gestor uma senha de liberação.
              </p>
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

        <form onSubmit={enviar} noValidate>
          <label
            htmlFor="codigo-desconto"
            className="mb-1.5 block text-sm font-semibold text-marca-texto"
          >
            Senha de liberação
          </label>
          <input
            id="codigo-desconto"
            ref={inputRef}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "erro-codigo-desconto" : undefined}
            className={`w-full rounded-xl border-2 bg-white px-3.5 py-2.5 text-center text-2xl font-bold tracking-[0.4em] tabular-nums text-marca-texto focus:ring-4 focus:ring-marca-azul/10 ${
              erro ? "border-red-500" : "border-marca-borda focus:border-marca-azul"
            }`}
          />

          {erro ? (
            <p
              id="erro-codigo-desconto"
              role="alert"
              className="mt-2 text-sm font-medium text-red-700"
            >
              {erro}
            </p>
          ) : null}

          <p className="mt-2 text-xs text-marca-texto-suave">
            A senha vale por 15 minutos e só pode ser usada uma vez.
          </p>

          <div className="mt-5 flex gap-2">
            <Botao type="button" variante="sutil" onClick={onFechar} className="flex-1">
              Cancelar
            </Botao>
            <Botao
              type="submit"
              disabled={codigo.length !== 6 || enviando}
              className="flex-1"
            >
              {enviando ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {enviando ? "Validando…" : "Liberar"}
            </Botao>
          </div>
        </form>
      </div>
    </div>
  );
}
