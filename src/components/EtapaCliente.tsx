"use client";

/** Etapa 1 — Dados do cliente. Máscaras + validação em português. */

import { UserRound } from "lucide-react";
import { useState } from "react";

import { Campo, Card, SectionTitle } from "./ui";
import { CONFIG } from "@/domain/simulator/config";
import { formatarData, formatarDocumento, formatarTelefone, somarDias } from "@/domain/simulator/format";
import { dadosClienteSchema } from "@/domain/simulator/validation";
import type { DadosCliente } from "@/domain/simulator/types";

type Campos = keyof DadosCliente;

export function EtapaCliente({
  cliente,
  onChange,
  tentouAvancar,
}: {
  cliente: DadosCliente;
  onChange: (patch: Partial<DadosCliente>) => void;
  /** Mostra os erros só depois da 1ª tentativa de avançar — não hostiliza quem está digitando. */
  tentouAvancar: boolean;
}) {
  const [tocados, setTocados] = useState<Partial<Record<Campos, boolean>>>({});

  const resultado = dadosClienteSchema.safeParse(cliente);
  const erros: Partial<Record<Campos, string>> = {};
  if (!resultado.success) {
    for (const issue of resultado.error.issues) {
      const campo = issue.path[0] as Campos;
      if (campo && !erros[campo]) erros[campo] = issue.message;
    }
  }

  const erroDe = (campo: Campos) =>
    tocados[campo] || tentouAvancar ? erros[campo] : undefined;

  const marcarTocado = (campo: Campos) => setTocados((t) => ({ ...t, [campo]: true }));

  const validade = somarDias(cliente.dataProposta, cliente.validadeDias);

  return (
    <Card>
      <SectionTitle
        icon={<UserRound aria-hidden="true" className="size-5" />}
        descricao="Estes dados aparecem no cabeçalho da proposta em PDF."
      >
        Dados do cliente
      </SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Nome do cliente ou empresa"
          value={cliente.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          onBlur={() => marcarTocado("nome")}
          erro={erroDe("nome")}
          autoComplete="organization"
          className="sm:col-span-2"
        />

        <Campo
          label="CPF ou CNPJ"
          value={formatarDocumento(cliente.documento)}
          onChange={(e) => onChange({ documento: e.target.value.replace(/\D/g, "").slice(0, 14) })}
          onBlur={() => marcarTocado("documento")}
          erro={erroDe("documento")}
          inputMode="numeric"
          placeholder="000.000.000-00"
          ajuda="Aceita CPF ou CNPJ. A pontuação é aplicada automaticamente."
        />

        <Campo
          label="Telefone"
          value={formatarTelefone(cliente.telefone)}
          onChange={(e) => onChange({ telefone: e.target.value.replace(/\D/g, "").slice(0, 11) })}
          onBlur={() => marcarTocado("telefone")}
          erro={erroDe("telefone")}
          inputMode="tel"
          placeholder="(67) 99999-9999"
        />

        <Campo
          label="E-mail (opcional)"
          type="email"
          value={cliente.email}
          onChange={(e) => onChange({ email: e.target.value })}
          onBlur={() => marcarTocado("email")}
          erro={erroDe("email")}
          autoComplete="email"
          placeholder="cliente@email.com"
        />

        <Campo
          label="Consultor responsável"
          value={cliente.consultor}
          onChange={(e) => onChange({ consultor: e.target.value })}
          onBlur={() => marcarTocado("consultor")}
          erro={erroDe("consultor")}
        />

        <Campo
          label="Data da proposta"
          type="date"
          value={cliente.dataProposta}
          onChange={(e) => onChange({ dataProposta: e.target.value })}
          onBlur={() => marcarTocado("dataProposta")}
          erro={erroDe("dataProposta")}
        />

        <Campo
          label="Validade da proposta"
          type="number"
          min={1}
          step={1}
          value={String(cliente.validadeDias)}
          onChange={(e) => onChange({ validadeDias: Number(e.target.value) })}
          onBlur={() => marcarTocado("validadeDias")}
          erro={erroDe("validadeDias")}
          sufixo="dias"
          ajuda={`Válida até ${formatarData(validade)}. Padrão: ${CONFIG.validadePropostaDias} dias.`}
        />
      </div>
    </Card>
  );
}
