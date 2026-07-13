"use client";

/**
 * Primitivos de UI compartilhados.
 *
 * Regras de acessibilidade aplicadas aqui, de uma vez, para todo o app:
 * - todo campo tem <label htmlFor> associado;
 * - erro ligado ao input por aria-describedby + aria-invalid;
 * - o erro é texto, nunca só cor;
 * - alvos de toque com altura mínima confortável no celular.
 */

import { AlertCircle } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-marca-borda bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  icon,
  descricao,
}: {
  children: ReactNode;
  icon?: ReactNode;
  descricao?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-marca-azul">
        {icon}
        {children}
      </h2>
      {descricao ? <p className="mt-1 text-sm text-marca-texto-suave">{descricao}</p> : null}
    </div>
  );
}

/** Mensagem de erro: ícone + texto (nunca comunica estado só por cor). */
export function MensagemErro({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

const baseInput =
  "w-full rounded-lg border bg-white px-3 py-2.5 text-base text-marca-texto " +
  "placeholder:text-marca-texto-suave/60 transition-colors " +
  "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-marca-texto-suave";

interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  erro?: string;
  /** Texto de apoio — ex.: a unidade do campo. */
  ajuda?: string;
  /** Sufixo visual dentro do campo, ex.: "kWh". */
  sufixo?: string;
}

export function Campo({ label, erro, ajuda, sufixo, className = "", ...props }: CampoProps) {
  const id = useId();
  const erroId = `${id}-erro`;
  const ajudaId = `${id}-ajuda`;

  const describedBy = [erro ? erroId : null, ajuda ? ajudaId : null].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-marca-texto">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${baseInput} ${sufixo ? "pr-14" : ""} ${
            erro
              ? "border-red-500 focus:border-red-600"
              : "border-marca-borda focus:border-marca-azul"
          }`}
          {...props}
        />
        {sufixo ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-marca-texto-suave"
          >
            {sufixo}
          </span>
        ) : null}
      </div>

      {ajuda && !erro ? (
        <p id={ajudaId} className="mt-1.5 text-xs text-marca-texto-suave">
          {ajuda}
        </p>
      ) : null}
      {erro ? <MensagemErro id={erroId}>{erro}</MensagemErro> : null}
    </div>
  );
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  erro?: string;
  ajuda?: string;
  opcoes: readonly { readonly value: string; readonly label: string }[];
}

export function Select({ label, erro, ajuda, opcoes, className = "", ...props }: SelectProps) {
  const id = useId();
  const erroId = `${id}-erro`;
  const ajudaId = `${id}-ajuda`;
  const describedBy = [erro ? erroId : null, ajuda ? ajudaId : null].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-marca-texto">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`${baseInput} ${
          erro ? "border-red-500 focus:border-red-600" : "border-marca-borda focus:border-marca-azul"
        }`}
        {...props}
      >
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {ajuda && !erro ? (
        <p id={ajudaId} className="mt-1.5 text-xs text-marca-texto-suave">
          {ajuda}
        </p>
      ) : null}
      {erro ? <MensagemErro id={erroId}>{erro}</MensagemErro> : null}
    </div>
  );
}

type Variante = "primario" | "secundario" | "sutil" | "perigo";

const variantes: Record<Variante, string> = {
  primario: "bg-marca-azul text-white hover:bg-marca-azul-escuro",
  secundario: "bg-marca-verde text-white hover:bg-marca-verde-escuro",
  sutil: "border border-marca-borda bg-white text-marca-texto hover:bg-marca-azul-suave",
  perigo: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

export function Botao({
  children,
  variante = "primario",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantes[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Imagem do mascote — sempre local, nunca hotlink. */
export function Mascote({
  variante,
  className = "",
  alt = "",
}: {
  variante:
    | "aceno"
    | "confiante"
    | "feliz"
    | "heroi"
    | "fatura"
    | "fatura-sem-fundo"
    | "suporte-sem-fundo"
    | "voando";
  className?: string;
  /** Vazio = decorativo. Preencha só quando o mascote transmitir informação. */
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/img/mascote-${variante}.png`}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      className={className}
      draggable={false}
    />
  );
}
