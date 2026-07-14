/**
 * Schema da configuração editável.
 *
 * O objeto de configuração vive no banco como JSONB. Ao ler, validamos com Zod
 * e completamos com os padrões de `CONFIG` — assim um campo novo no código não
 * quebra uma linha antiga do banco, e um JSON adulterado não entra no cálculo.
 *
 * O domínio não muda: `calcularSimulacao(sim, config)` já recebe a config como
 * parâmetro. Aqui só produzimos esse objeto a partir do banco.
 */

import { z } from "zod";
import { CONFIG, type ConfiguracaoSimulador } from "./config";

const positivo = (campo: string) =>
  z.number({ invalid_type_error: `${campo} deve ser um número.` }).finite().min(0, `${campo} não pode ser negativo.`);

const fracao = (campo: string) =>
  z
    .number({ invalid_type_error: `${campo} deve ser um número.` })
    .min(0, `${campo} não pode ser negativo.`)
    .lt(1, `${campo} deve ser menor que 100%.`);

const tarifaSchema = z.object({
  semImposto: positivo("A tarifa"),
  pisCofins: fracao("O PIS/COFINS"),
});

const faixaCosipSchema = z.object({
  minimo: positivo("O mínimo da faixa"),
  maximo: positivo("O máximo da faixa"),
  valor: positivo("O valor da COSIP"),
});

/** Faixas precisam estar em ordem crescente de `maximo` — a busca depende disso. */
const faixasCosipSchema = z
  .array(faixaCosipSchema)
  .min(1, "Informe ao menos uma faixa de COSIP.")
  .superRefine((faixas, ctx) => {
    for (let i = 1; i < faixas.length; i += 1) {
      if (faixas[i].maximo <= faixas[i - 1].maximo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "maximo"],
          message: "As faixas devem estar em ordem crescente de consumo máximo.",
        });
      }
    }
  });

export const configuracaoSchema = z.object({
  vigenciaTarifas: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de vigência inválida."),

  impostos: z.object({
    icms: fracao("O ICMS"),
    pis: fracao("O PIS"),
    cofins: fracao("O COFINS"),
    pisCofinsDemanda: fracao("O PIS/COFINS da demanda"),
  }),

  tarifas: z.object({
    baixaTensao: tarifaSchema,
    foraPonta: tarifaSchema,
    ponta: tarifaSchema,
    demanda: tarifaSchema,
  }),

  bandeiras: z.object({
    VERDE: positivo("A bandeira verde"),
    AMARELA: positivo("A bandeira amarela"),
    VERMELHA_P1: positivo("A bandeira vermelha P1"),
    VERMELHA_P2: positivo("A bandeira vermelha P2"),
  }),

  cosipResidencial: faixasCosipSchema,
  cosipDemais: faixasCosipSchema,

  consumoMinimo: z.object({
    MONOFASICO: positivo("O mínimo do monofásico"),
    BIFASICO: positivo("O mínimo do bifásico"),
    TRIFASICO: positivo("O mínimo do trifásico"),
    MEDIA_TENSAO: positivo("O mínimo da média tensão"),
  }),

  usina: z.object({
    capacidadeReferenciaKwhMes: z
      .number()
      .positive("A capacidade da usina deve ser maior que zero."),
    potenciaReferenciaKwp: z.number().positive("A potência da usina deve ser maior que zero."),
  }),

  projecao: z.object({
    reajusteAnual: z
      .number()
      .min(1, "O reajuste anual deve ser 1 ou maior (1,05 = 5% ao ano).")
      .max(2, "Reajuste anual acima de 100% ao ano não faz sentido."),
    anos: z.number().int().min(1, "A projeção precisa de ao menos 1 ano.").max(30),
  }),

  // Inteiro, como todo desconto. Salvar 20,5% aqui faria TODA simulação nova
  // nascer com um desconto que a validação da UC recusa.
  descontoPadrao: fracao("O desconto padrão").refine(
    (d) => Math.abs(d * 100 - Math.round(d * 100)) < 1e-9,
    "O desconto padrão deve ser um número inteiro de porcento (ex.: 20%).",
  ),
  validadePropostaDias: z
    .number()
    .int("A validade deve ser um número inteiro de dias.")
    .min(1, "A validade deve ser de pelo menos 1 dia.")
    .max(365, "A validade não pode passar de 365 dias."),

  institucional: z.object({
    nomeEmpresa: z.string().trim().min(1, "Informe o nome da empresa."),
    distribuidora: z.string().trim().min(1, "Informe a distribuidora."),
    whatsapp: z.string().trim().min(1, "Informe o WhatsApp."),
    whatsappLink: z.string().trim().url("Link do WhatsApp inválido."),
    site: z.string().trim().min(1, "Informe o site."),
  }),

  observacoesProposta: z
    .array(z.string().trim().min(1, "A observação não pode ficar vazia."))
    .min(1, "Mantenha ao menos uma observação na proposta."),
});

export type ConfiguracaoEditavel = z.infer<typeof configuracaoSchema>;

/**
 * Valida um JSON vindo do banco/formulário e devolve a config tipada.
 * Em caso de falha, a exceção do Zod sobe — quem chama decide o que fazer.
 */
export function validarConfiguracao(dados: unknown): ConfiguracaoSimulador {
  return configuracaoSchema.parse(dados) as ConfiguracaoSimulador;
}

/**
 * Config padrão (a da planilha), usada como semente do banco e como reserva
 * quando ainda não há linha salva.
 */
export function configuracaoPadrao(): ConfiguracaoSimulador {
  return CONFIG;
}
