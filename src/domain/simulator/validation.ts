/**
 * Validação — usada tanto no formulário (React Hook Form) quanto no servidor,
 * antes de recalcular para o PDF. O servidor NUNCA confia em valores calculados
 * enviados pelo navegador: recebe apenas as entradas e refaz a conta.
 */

import { z } from "zod";
import { CONFIG } from "./config";

/** Remove tudo que não é dígito. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Validação de CPF pelos dígitos verificadores. */
export function isCPFValido(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digito = (fatiaAte: number, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < fatiaAte; i += 1) {
      soma += Number(d[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9, 10) === Number(d[9]) && digito(10, 11) === Number(d[10]);
}

/** Validação de CNPJ pelos dígitos verificadores. */
export function isCNPJValido(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const digito = (fatiaAte: number): number => {
    let peso = fatiaAte - 7;
    let soma = 0;
    for (let i = 0; i < fatiaAte; i += 1) {
      soma += Number(d[i]) * peso;
      peso -= 1;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(12) === Number(d[12]) && digito(13) === Number(d[13]);
}

/** CPF (11) ou CNPJ (14), validado pelos dígitos verificadores. */
export function isDocumentoValido(documento: string): boolean {
  const d = apenasDigitos(documento);
  if (d.length === 11) return isCPFValido(d);
  if (d.length === 14) return isCNPJValido(d);
  return false;
}

const naoNegativo = (campo: string) =>
  z
    .number({ invalid_type_error: `Informe ${campo}.` })
    .finite(`${campo} deve ser um número válido.`)
    .min(0, `${campo} não pode ser negativo.`);

export const ligacaoSchema = z.enum(["MONOFASICO", "BIFASICO", "TRIFASICO", "MEDIA_TENSAO"], {
  errorMap: () => ({ message: "Selecione o tipo de ligação." }),
});

export const classificacaoSchema = z.enum(["B1", "B2", "B3", "MT"], {
  errorMap: () => ({ message: "Selecione a classificação." }),
});

export const unidadeConsumidoraSchema = z
  .object({
    id: z.string().min(1),
    nome: z.string().trim().min(1, "Informe o nome da unidade."),
    classificacao: classificacaoSchema,
    ligacao: ligacaoSchema,
    consumoForaPonta: naoNegativo("o consumo"),
    consumoPonta: naoNegativo("o consumo de ponta"),
    demandaContratada: naoNegativo("a demanda contratada"),
    desconto: z
      .number({ invalid_type_error: "Informe o desconto." })
      .min(0, "O desconto não pode ser negativo.")
      .lt(1, "O desconto deve ser menor que 100%.")
      // O desconto é um número INTEIRO de porcentos: 20%, não 20,5%.
      // A fração 0,205 não é permitida — e a checagem é feita com tolerância
      // porque 0,2 * 100 em ponto flutuante não dá exatamente 20.
      .refine(
        (d) => Math.abs(d * 100 - Math.round(d * 100)) < 1e-9,
        "O desconto deve ser um número inteiro de porcento (ex.: 20%).",
      ),
    cosipOverride: naoNegativo("a COSIP").nullable(),
    custoKwhConcorrente: naoNegativo("o custo do concorrente").nullable(),
  })
  .superRefine((uc, ctx) => {
    // Coerência entre classificação e ligação: MT anda com MÉDIA TENSÃO.
    const ehMT = uc.ligacao === "MEDIA_TENSAO";
    if (uc.classificacao === "MT" && !ehMT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ligacao"],
        message: "A classificação MT exige ligação em média tensão.",
      });
    }
    if (ehMT && uc.classificacao !== "MT") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["classificacao"],
        message: "A ligação em média tensão exige a classificação MT.",
      });
    }
    // Em baixa tensão, ponta e demanda não existem.
    if (!ehMT && uc.consumoPonta > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consumoPonta"],
        message: "Consumo de ponta só se aplica à média tensão.",
      });
    }
    if (!ehMT && uc.demandaContratada > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["demandaContratada"],
        message: "Demanda contratada só se aplica à média tensão.",
      });
    }
  });

export const dadosClienteSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome do cliente ou da empresa."),
  documento: z
    .string()
    .transform(apenasDigitos)
    .refine((d) => d.length > 0, "Informe o CPF ou CNPJ.")
    .refine(isDocumentoValido, "CPF ou CNPJ inválido."),
  telefone: z
    .string()
    .transform(apenasDigitos)
    .refine((d) => d.length >= 10 && d.length <= 11, "Telefone inválido. Use DDD + número."),
  email: z
    .union([z.literal(""), z.string().email("E-mail inválido.")])
    .default(""),
  consultor: z.string().trim().min(3, "Informe o consultor responsável."),
  dataProposta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data da proposta inválida."),
  validadeDias: z
    .number({ invalid_type_error: "Informe a validade." })
    .int("A validade deve ser um número inteiro de dias.")
    .min(1, "A validade deve ser de pelo menos 1 dia.")
    .default(CONFIG.validadePropostaDias),
});

/** Máximo de unidades consumidoras por simulação nova. */
export const MAX_UNIDADES = 3;

/** Schema de uma simulação NOVA, vinda do formulário. */
export const simulacaoSchema = z.object({
  cliente: dadosClienteSchema,
  unidades: z
    .array(unidadeConsumidoraSchema)
    .min(1, "Adicione ao menos uma unidade consumidora.")
    .max(MAX_UNIDADES, `O simulador comporta até ${MAX_UNIDADES} unidades consumidoras.`),
});

/**
 * Schema de uma simulação JÁ GRAVADA, relida do banco para regerar o PDF.
 *
 * Igual ao de entrada, mas SEM o teto de unidades: uma proposta emitida quando o
 * limite era outro continua sendo uma proposta válida, e o gestor tem que
 * conseguir reabrir o PDF dela. Baixar o limite de hoje não pode invalidar o
 * passado.
 */
export const simulacaoArmazenadaSchema = z.object({
  cliente: dadosClienteSchema,
  unidades: z.array(unidadeConsumidoraSchema).min(1),
});

export type SimulacaoInput = z.infer<typeof simulacaoSchema>;
export type UnidadeConsumidoraInput = z.infer<typeof unidadeConsumidoraSchema>;
export type DadosClienteInput = z.infer<typeof dadosClienteSchema>;
