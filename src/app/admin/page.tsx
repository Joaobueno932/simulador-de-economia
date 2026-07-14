/**
 * Área de administração — server component.
 *
 * Só admin e gestor entram. A checagem acontece aqui (servidor) e de novo em
 * cada rota de API: esconder o link no menu não é proteção.
 */

import { redirect } from "next/navigation";

import { Admin } from "@/components/admin/Admin";
import { podeAdministrar } from "@/domain/auth/types";
import { usuarioAtual } from "@/server/auth";
import { carregarConfiguracao, metadadosConfiguracao } from "@/server/configuracao";
import { listarUsuarios } from "@/server/usuarios";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administração | Simulador Em Conta",
};

export default async function AdminPage() {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  if (!podeAdministrar(usuario.papel)) redirect("/");

  const [config, usuarios, meta] = await Promise.all([
    carregarConfiguracao(),
    listarUsuarios(),
    metadadosConfiguracao(),
  ]);

  return (
    <Admin
      usuario={usuario}
      configInicial={config}
      usuariosIniciais={usuarios}
      metaConfig={meta}
    />
  );
}
