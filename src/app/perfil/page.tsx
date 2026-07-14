import { redirect } from "next/navigation";

import { Perfil } from "@/components/Perfil";
import { usuarioAtual } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meu perfil | Simulador Em Conta",
};

export default async function PerfilPage() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.senhaProvisoria) redirect("/trocar-senha");

  return <Perfil usuario={usuario} />;
}
