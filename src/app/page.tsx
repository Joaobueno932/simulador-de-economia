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
import { podeEscolherConsultor, usuarioParaCliente } from "@/domain/auth/types";

// Sessão e config mudam por requisição: nada de cache estático.
export const dynamic = "force-dynamic";

export default async function Page() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");

  const { usuario, descontoLiberado } = sessao;

  // Quem está com a senha padrão não usa o sistema antes de trocá-la.
  if (usuario.senhaProvisoria) redirect("/trocar-senha");

  // Vendedor não escolhe consultor — não precisa da lista.
  const [config, vendedores] = await Promise.all([
    carregarConfiguracao(),
    podeEscolherConsultor(usuario.papel) ? listarVendedoresAtivos() : Promise.resolve([]),
  ]);

  return (
    <Simulador
      // `usuarioParaCliente` apaga as instituições quando o usuário é vendedor:
      // elas servem só às métricas do gestor. Apagar aqui (e não esconder na
      // tela) é o que impede o dado de aparecer no payload da página.
      usuario={usuarioParaCliente(usuario)}
      config={config}
      // A lista de vendedores só existe para admin/gestor (que PODEM ver as
      // instituições), então aqui elas seguem normalmente.
      vendedores={vendedores.map((v) => ({
        id: v.id,
        nome: v.nome,
        instituicoes: v.instituicoes,
      }))}
      descontoJaLiberado={descontoLiberado}
    />
  );
}
