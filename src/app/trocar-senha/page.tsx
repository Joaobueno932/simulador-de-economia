import { redirect } from "next/navigation";

import { FormTrocarSenha } from "@/components/FormTrocarSenha";
import { usuarioParaCliente } from "@/domain/auth/types";
import { usuarioAtual } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trocar senha | Simulador Em Conta",
};

export default async function TrocarSenhaPage() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");

  // Sem as instituições, se for vendedor — ver `usuarioParaCliente`.
  return <FormTrocarSenha usuario={usuarioParaCliente(usuario)} />;
}
