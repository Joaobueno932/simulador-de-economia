/**
 * "Meus clientes" — server component.
 *
 * Lista os clientes salvos do usuário logado (vendedor vê só os seus;
 * admin/gestor veem todos). A permissão de exclusão é decidida no servidor e
 * de novo na rota de API — o botão some para o vendedor, mas quem garante é o
 * back-end.
 */

import { redirect } from "next/navigation";

import { MeusClientes } from "@/components/MeusClientes";
import { podeExcluirCliente } from "@/domain/auth/types";
import { usuarioAtual } from "@/server/auth";
import { listarSimulacoes } from "@/server/simulacoes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meus clientes | Simulador Em Conta",
};

export default async function ClientesPage() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.senhaProvisoria) redirect("/trocar-senha");

  const clientes = await listarSimulacoes(usuario);

  return (
    <MeusClientes
      papel={usuario.papel}
      clientesIniciais={clientes}
      podeExcluir={podeExcluirCliente(usuario.papel)}
    />
  );
}
