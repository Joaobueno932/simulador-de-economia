"use client";

/**
 * Meu perfil: foto e senha.
 *
 * A foto é REDIMENSIONADA no navegador antes de subir (quadrado de 256 px,
 * WebP). Uma foto de celular tem 3–8 MB; assim ela vira ~20 KB. Isso mantém o
 * banco pequeno e a lista do gestor rápida. O servidor confere tipo e tamanho de
 * novo — o navegador não é fonte confiável.
 */

import { ArrowLeft, Camera, KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar } from "./Avatar";
import { Botao, Card, SectionTitle } from "./ui";
import { ROTULO_PAPEL, type Usuario } from "@/domain/auth/types";

const LADO = 256;

/** Recorta no centro, reduz para 256×256 e comprime. */
async function prepararImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);

  const lado = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - lado) / 2;
  const sy = (bitmap.height - lado) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, LADO, LADO);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  return blob;
}

export function Perfil({ usuario }: { usuario: Usuario }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [temFoto, setTemFoto] = useState(usuario.temFoto);
  const [versao, setVersao] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function enviarFoto(arquivo: File) {
    setErro(null);
    setOk(null);
    setEnviando(true);

    try {
      if (!arquivo.type.startsWith("image/")) {
        setErro("Escolha um arquivo de imagem.");
        return;
      }

      const blob = await prepararImagem(arquivo);

      const form = new FormData();
      form.append("foto", new File([blob], "perfil.webp", { type: "image/webp" }));

      const resposta = await fetch(`/api/usuarios/${usuario.id}/foto`, {
        method: "POST",
        body: form,
      });

      const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null;

      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não foi possível enviar a foto.");
        return;
      }

      setTemFoto(true);
      // Furar o cache: a URL é a mesma, o conteúdo mudou.
      setVersao((v) => v + 1);
      setOk("Foto atualizada.");
      router.refresh();
    } catch {
      setErro("Não foi possível processar a imagem.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-marca-borda bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-marca-borda px-3.5 py-2 text-sm font-bold text-marca-texto hover:bg-marca-azul-suave"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Simulador
          </Link>
          <h1 className="text-lg font-extrabold text-marca-texto">Meu perfil</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <Card>
          <SectionTitle
            icon={<Camera aria-hidden="true" className="size-5" />}
            descricao="A sua foto aparece para o gestor no dashboard e no histórico."
          >
            Foto de perfil
          </SectionTitle>

          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <Avatar
              usuarioId={usuario.id}
              nome={usuario.nome}
              temFoto={temFoto}
              versao={versao}
              tamanho="xl"
            />

            <div className="flex-1 text-center sm:text-left">
              <p className="font-bold text-marca-texto">{usuario.nome}</p>
              <p className="text-sm text-marca-texto-suave">
                {ROTULO_PAPEL[usuario.papel]}
                {usuario.instituicoes.length > 0
                  ? ` · ${usuario.instituicoes.join(", ")}`
                  : ""}
              </p>
              <p className="text-sm text-marca-texto-suave">{usuario.email}</p>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) enviarFoto(arquivo);
                  // Permite reenviar o MESMO arquivo depois de um erro.
                  e.target.value = "";
                }}
              />

              <Botao
                variante="sutil"
                onClick={() => inputRef.current?.click()}
                disabled={enviando}
                className="mt-3"
              >
                {enviando ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden="true" className="size-4" />
                )}
                {enviando ? "Enviando…" : temFoto ? "Trocar foto" : "Enviar foto"}
              </Botao>

              <p className="mt-2 text-xs text-marca-texto-suave">
                PNG, JPEG ou WebP. A imagem é recortada em quadrado e reduzida
                automaticamente.
              </p>
            </div>
          </div>

          {erro ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
            >
              {erro}
            </p>
          ) : null}

          {ok ? (
            <p
              role="status"
              className="mt-4 rounded-xl border-2 border-marca-verde/30 bg-marca-verde-suave px-3 py-2 text-sm font-medium text-marca-verde-escuro"
            >
              {ok}
            </p>
          ) : null}
        </Card>

        <Card>
          <SectionTitle
            icon={<KeyRound aria-hidden="true" className="size-5" />}
            descricao="Trocar a sua senha de acesso."
          >
            Senha
          </SectionTitle>

          <Link
            href="/trocar-senha"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-marca-borda bg-white px-5 py-2.5 text-sm font-bold text-marca-texto hover:border-marca-azul-claro hover:bg-marca-azul-suave"
          >
            <KeyRound aria-hidden="true" className="size-4" />
            Trocar senha
          </Link>
        </Card>
      </main>
    </div>
  );
}
