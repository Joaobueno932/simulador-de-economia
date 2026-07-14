"use client";

/**
 * Aba de senhas de desconto.
 *
 * O gestor escolhe o vendedor e gera um código de 6 dígitos. O código aparece
 * UMA vez — no banco só existe o hash, então não há como recuperá-lo depois.
 * Ele morre no primeiro uso ou em 15 minutos, o que vier antes.
 */

import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

import { Botao, Card, SectionTitle, Select } from "../ui";
import type { UsuarioListado } from "@/server/usuarios";

interface SenhaEmitida {
  codigo: string;
  vendedorNome: string;
  expiraEm: string;
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function AbaSenhas({ vendedores }: { vendedores: readonly UsuarioListado[] }) {
  const [vendedorId, setVendedorId] = useState<string>(
    vendedores.length > 0 ? String(vendedores[0].id) : "",
  );
  const [senha, setSenha] = useState<SenhaEmitida | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setGerando(true);
    setErro(null);
    setSenha(null);
    setCopiado(false);

    try {
      const resposta = await fetch("/api/senha-desconto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendedorId: Number(vendedorId) }),
      });

      const dados = (await resposta.json().catch(() => null)) as
        | { senha?: SenhaEmitida; erro?: string }
        | null;

      if (!resposta.ok || !dados?.senha) {
        setErro(dados?.erro ?? "Não foi possível gerar a senha.");
        return;
      }

      setSenha(dados.senha);
    } catch {
      setErro("Não foi possível conectar.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    if (!senha) return;
    try {
      await navigator.clipboard.writeText(senha.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem clipboard (http, permissão negada): o código está na tela, dá para ditar.
      setErro("Não foi possível copiar. Anote o código da tela.");
    }
  }

  if (vendedores.length === 0) {
    return (
      <Card>
        <SectionTitle icon={<KeyRound aria-hidden="true" className="size-5" />}>
          Senhas de desconto
        </SectionTitle>
        <p className="text-sm text-marca-texto-suave">
          Nenhum vendedor ativo cadastrado. Cadastre um vendedor na aba{" "}
          <strong className="font-semibold">Usuários</strong> para poder emitir senhas.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle
          icon={<KeyRound aria-hidden="true" className="size-5" />}
          descricao="Libera o vendedor a alterar o desconto em uma simulação."
        >
          Gerar senha de liberação
        </SectionTitle>

        <Select
          label="Vendedor"
          value={vendedorId}
          onChange={(e) => {
            setVendedorId(e.target.value);
            setSenha(null);
          }}
          opcoes={vendedores.map((v) => ({
            value: String(v.id),
            label: v.instituicao ? `${v.nome} — ${v.instituicao}` : v.nome,
          }))}
          ajuda="A senha só funciona para o vendedor escolhido."
        />

        <Botao
          variante="secundario"
          onClick={gerar}
          disabled={gerando || !vendedorId}
          className="mt-4 w-full"
        >
          {gerando ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <KeyRound aria-hidden="true" className="size-4" />
          )}
          {gerando ? "Gerando…" : "Gerar senha"}
        </Botao>

        {erro ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {erro}
          </p>
        ) : null}

        <p className="mt-4 rounded-lg bg-marca-azul-suave px-3 py-2 text-xs text-marca-texto-suave">
          Gerar uma nova senha invalida a anterior daquele vendedor, se ainda estiver pendente.
        </p>
      </Card>

      {/* O código aparece uma única vez. */}
      {senha ? (
        <Card className="border-marca-verde/40 bg-marca-verde-suave">
          <SectionTitle descricao={`Para ${senha.vendedorNome}. Válida até ${horaDe(senha.expiraEm)}.`}>
            Senha gerada
          </SectionTitle>

          <p
            className="rounded-xl border-2 border-dashed border-marca-verde/50 bg-white py-5 text-center text-4xl font-extrabold tracking-[0.3em] tabular-nums text-marca-texto"
            aria-label={`Código: ${senha.codigo.split("").join(" ")}`}
          >
            {senha.codigo}
          </p>

          <Botao variante="sutil" onClick={copiar} className="mt-4 w-full">
            {copiado ? (
              <Check aria-hidden="true" className="size-4 text-marca-verde" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copiado ? "Copiado" : "Copiar código"}
          </Botao>

          <p className="mt-4 text-sm font-medium text-marca-texto">
            Passe este código ao vendedor agora.
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-marca-texto-suave">
            <li>Vale por 15 minutos.</li>
            <li>Só pode ser usada uma vez.</li>
            <li>Não é possível vê-la de novo depois de sair desta tela.</li>
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
