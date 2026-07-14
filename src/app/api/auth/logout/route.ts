import { NextResponse } from "next/server";

import { encerrarSessao } from "@/server/auth";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

export async function POST() {
  try {
    await encerrarSessao();
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
