"use client";

/**
 * Etapa 1 — Dados do cliente.
 *
 * Três campos deixaram de ser livres:
 *  - CONSULTOR: vendedor emite sempre em nome próprio (campo travado);
 *    admin/gestor escolhem entre os vendedores cadastrados (dropdown).
 *  - DATA DA PROPOSTA: sempre hoje. Não se edita.
 *  - VALIDADE: vem da configuração, alterável só por admin/gestor.
 *
 * A tela apenas reflete isso. Quem garante é a rota do PDF, que sobrescreve os
 * três no servidor — mexer no HTML aqui não muda o que sai no PDF.
 */

import { CalendarDays, Lock, UserRound } from "lucide-react";
import { useState } from "react";

import { Campo, Card, SectionTitle, Select } from "./ui";
import type { ConfiguracaoSimulador } from "@/domain/simulator/config";
import {
  formatarData,
  formatarDocumento,
  formatarTelefone,
  somarDias,
} from "@/domain/simulator/format";
import { dadosClienteSchema } from "@/domain/simulator/validation";
import type { DadosCliente } from "@/domain/simulator/types";
import { podeEscolherConsultor, type Papel } from "@/domain/auth/types";

type Campos = keyof DadosCliente;

export interface VendedorOpcao {
  readonly id: number;
  readonly nome: string;
  readonly instituicao: string | null;
}

export function EtapaCliente({
  cliente,
  onChange,
  tentouAvancar,
  papel,
  vendedores,
  config,
}: {
  cliente: DadosCliente;
  onChange: (patch: Partial<DadosCliente>) => void;
  /** Mostra os erros só depois da 1ª tentativa de avançar — não hostiliza quem está digitando. */
  tentouAvancar: boolean;
  papel: Papel;
  /** Vendedores ativos — só usado por admin/gestor. */
  vendedores: readonly VendedorOpcao[];
  config: ConfiguracaoSimulador;
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

  const erroDe = (campo: Campos) => (tocados[campo] || tentouAvancar ? erros[campo] : undefined);
  const marcarTocado = (campo: Campos) => setTocados((t) => ({ ...t, [campo]: true }));

  const escolheConsultor = podeEscolherConsultor(papel);
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

        {/* Consultor: dropdown para admin/gestor, travado para vendedor. */}
        {escolheConsultor ? (
          <Select
            label="Consultor responsável"
            value={cliente.consultor}
            onChange={(e) => onChange({ consultor: e.target.value })}
            onBlur={() => marcarTocado("consultor")}
            erro={erroDe("consultor")}
            opcoes={[
              { value: "", label: "Selecione o vendedor…" },
              ...vendedores.map((v) => ({
                value: v.nome,
                label: v.instituicao ? `${v.nome} — ${v.instituicao}` : v.nome,
              })),
            ]}
            ajuda={
              vendedores.length === 0
                ? "Nenhum vendedor cadastrado. Cadastre em Administração."
                : "A proposta sai em nome do vendedor selecionado."
            }
          />
        ) : (
          <Campo
            label="Consultor responsável"
            value={cliente.consultor}
            readOnly
            disabled
            icone={<Lock aria-hidden="true" className="size-3.5" />}
            ajuda="A proposta sai automaticamente no seu nome."
          />
        )}

        {/* Data: sempre hoje. Campo somente leitura. */}
        <Campo
          label="Data da proposta"
          value={formatarData(cliente.dataProposta)}
          readOnly
          disabled
          icone={<CalendarDays aria-hidden="true" className="size-3.5" />}
          ajuda={`Válida até ${formatarData(validade)} (${cliente.validadeDias} dias).`}
        />
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-marca-azul-suave px-3 py-2.5 text-xs text-marca-texto-suave">
        <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          A data é sempre a de hoje e a validade de {config.validadePropostaDias} dias vem da
          configuração — só administradores e gestores alteram.
        </span>
      </p>
    </Card>
  );
}
