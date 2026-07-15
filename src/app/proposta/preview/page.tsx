/**
 * Pré-visualização da proposta — server component.
 *
 * Carrega a config do banco (as tarifas vigentes) e a sessão. O rascunho da
 * simulação está no navegador, então quem monta a folha é o componente cliente.
 */

import { redirect } from "next/navigation";

import { PreviewProposta } from "@/components/PreviewProposta";
import { sessaoAtual } from "@/server/auth";
import { carregarConfiguracao } from "@/server/configuracao";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");
  if (sessao.usuario.senhaProvisoria) redirect("/trocar-senha");

  const config = await carregarConfiguracao();

  return (
    <PreviewProposta
      config={config}
      consultorPadrao={sessao.usuario.nome}
      usuarioId={sessao.usuario.id}
    />
  );
}
