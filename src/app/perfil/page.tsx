import { redirect } from "next/navigation";

import { Perfil } from "@/components/Perfil";
import { usuarioParaCliente } from "@/domain/auth/types";
import { usuarioAtual } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meu perfil | Simulador Em Conta",
};

export default async function PerfilPage() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.senhaProvisoria) redirect("/trocar-senha");

  // Sem as instituições, se for vendedor — ver `usuarioParaCliente`.
  return <Perfil usuario={usuarioParaCliente(usuario)} />;
}
