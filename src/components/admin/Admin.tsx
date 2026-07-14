"use client";

/**
 * Administração — três abas: Configurações, Usuários e Senhas de desconto.
 *
 * Toda ação bate numa rota de API que revalida a permissão no servidor. O que a
 * tela faz é apenas não oferecer o que o usuário não pode.
 */

import { ArrowLeft, KeyRound, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AbaConfiguracoes } from "./AbaConfiguracoes";
import { AbaSenhas } from "./AbaSenhas";
import { AbaUsuarios } from "./AbaUsuarios";
import type { ConfiguracaoSimulador } from "@/domain/simulator/config";
import { ROTULO_PAPEL, type Usuario } from "@/domain/auth/types";
import type { UsuarioListado } from "@/server/usuarios";

type Aba = "config" | "usuarios" | "senhas";

const ABAS: readonly { id: Aba; titulo: string; icone: React.ReactNode }[] = [
  {
    id: "config",
    titulo: "Configurações",
    icone: <SlidersHorizontal aria-hidden="true" className="size-4" />,
  },
  { id: "usuarios", titulo: "Usuários", icone: <Users aria-hidden="true" className="size-4" /> },
  {
    id: "senhas",
    titulo: "Senhas de desconto",
    icone: <KeyRound aria-hidden="true" className="size-4" />,
  },
];

export function Admin({
  usuario,
  configInicial,
  usuariosIniciais,
  metaConfig,
}: {
  usuario: Usuario;
  configInicial: ConfiguracaoSimulador;
  usuariosIniciais: readonly UsuarioListado[];
  metaConfig: { atualizadoEm: string | null; atualizadoPor: string | null };
}) {
  const [aba, setAba] = useState<Aba>("config");
  const [usuarios, setUsuarios] = useState<readonly UsuarioListado[]>(usuariosIniciais);

  const vendedores = usuarios.filter((u) => u.papel === "vendedor" && u.ativo);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-marca-borda bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-marca-borda px-3.5 py-2 text-sm font-bold text-marca-texto transition-colors hover:border-marca-azul-claro hover:bg-marca-azul-suave"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Simulador</span>
            </Link>
            <h1 className="text-lg font-extrabold text-marca-texto">Administração</h1>
          </div>

          <div className="text-right">
            <p className="text-sm font-bold leading-tight text-marca-texto">{usuario.nome}</p>
            <p className="text-xs font-medium text-marca-texto-suave">
              {ROTULO_PAPEL[usuario.papel]}
            </p>
          </div>
        </div>
      </header>

      <nav aria-label="Seções da administração" className="border-b border-marca-borda bg-white">
        <ul className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
          {ABAS.map((a) => {
            const atual = a.id === aba;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setAba(a.id)}
                  aria-current={atual ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold transition-colors sm:px-4 ${
                    atual
                      ? "border-marca-azul text-marca-azul"
                      : "border-transparent text-marca-texto-suave hover:text-marca-texto"
                  }`}
                >
                  {a.icone}
                  <span className="hidden sm:inline">{a.titulo}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {aba === "config" ? (
          <AbaConfiguracoes configInicial={configInicial} meta={metaConfig} />
        ) : null}

        {aba === "usuarios" ? (
          <AbaUsuarios ator={usuario} usuarios={usuarios} onMudou={setUsuarios} />
        ) : null}

        {aba === "senhas" ? <AbaSenhas vendedores={vendedores} /> : null}
      </main>
    </div>
  );
}
