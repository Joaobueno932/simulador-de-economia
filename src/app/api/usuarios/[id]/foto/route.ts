import { NextResponse } from "next/server";

import { exigirSessao, exigirUsuarioAtivo, ErroProibido } from "@/server/auth";
import { buscarFoto, ErroDeNegocio, MAX_FOTO_BYTES, salvarFoto } from "@/server/usuarios";
import { registrarEvento } from "@/server/eventos";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

function idDe(valor: string): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErroDeNegocio("Usuário inválido.");
  return id;
}

/**
 * Serve a foto. Qualquer pessoa logada pode ver o avatar de qualquer usuário —
 * é o que permite o gestor reconhecer o vendedor pela fotinha.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Basta ter sessão: nem exigimos senha já trocada, senão o avatar sumiria
    // da própria tela de troca de senha.
    await exigirSessao();

    const { id } = await params;
    const foto = await buscarFoto(idDe(id));

    if (!foto) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(foto.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": foto.mime,
        "Content-Length": String(foto.bytes.byteLength),
        // Privado: é foto de pessoa. Curto, porque o usuário pode trocá-la.
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (erro) {
    return responderErro(erro);
  }
}

/**
 * Envia a foto. **Só do próprio usuário** — ninguém troca o avatar de outro.
 *
 * O cliente já redimensiona a imagem antes de enviar; aqui conferimos tipo e
 * tamanho de novo, porque o navegador não é fonte confiável.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ator = await exigirUsuarioAtivo();

    const { id } = await params;
    const alvoId = idDe(id);

    if (alvoId !== ator.id) {
      throw new ErroProibido("Você só pode alterar a sua própria foto.");
    }

    const form = await request.formData();
    const arquivo = form.get("foto");

    if (!(arquivo instanceof File)) {
      throw new ErroDeNegocio("Envie um arquivo de imagem.");
    }
    if (arquivo.size > MAX_FOTO_BYTES) {
      throw new ErroDeNegocio("A foto é grande demais. Envie uma imagem menor.");
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    await salvarFoto(ator.id, bytes, arquivo.type);

    await registrarEvento({
      usuarioId: ator.id,
      tipo: "foto_alterada",
      descricao: "Alterou a foto de perfil",
    });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
