/**
 * Página do simulador — server component.
 *
 * Carrega no SERVIDOR o que a tela não pode inventar: quem está logado, a
 * configuração vigente (tarifas) e a lista de vendedores. Só então entrega ao
 * componente cliente.
 */

import { redirect } from "next/navigation";

import { Simulador } from "@/components/Simulador";
import { sessaoAtual } from "@/server/auth";
import { carregarConfiguracao } from "@/server/configuracao";
import { listarVendedoresAtivos } from "@/server/usuarios";
import { podeEscolherConsultor } from "@/domain/auth/types";

// Sessão e config mudam por requisição: nada de cache estático.
export const dynamic = "force-dynamic";

export default async function Page() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");

  const { usuario, descontoLiberado } = sessao;

  // Vendedor não escolhe consultor — não precisa da lista.
  const [config, vendedores] = await Promise.all([
    carregarConfiguracao(),
    podeEscolherConsultor(usuario.papel) ? listarVendedoresAtivos() : Promise.resolve([]),
  ]);

  return (
    <Simulador
      usuario={usuario}
      config={config}
      vendedores={vendedores.map((v) => ({
        id: v.id,
        nome: v.nome,
        instituicao: v.instituicao,
      }))}
      descontoJaLiberado={descontoLiberado}
    />
  );
}
