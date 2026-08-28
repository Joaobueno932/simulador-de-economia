/**
 * Constantes de LAYOUT da proposta (não são regra de negócio — nada aqui vem da
 * planilha).
 *
 * Fica num módulo próprio porque duas telas precisam do mesmo número: a
 * proposta (que pagina as unidades) e a etapa de unidades do simulador (que
 * avisa o vendedor de como elas vão sair no PDF). Importar `Proposta.tsx` só
 * para ler uma constante arrastaria o componente inteiro para o bundle do
 * simulador.
 */

/**
 * Unidades consumidoras por página do PDF.
 *
 * Com mais de três por folha o bloco de barras vira um amontoado ilegível — foi
 * o motivo de existir a paginação. O número de UCs em si não tem limite.
 */
export const UCS_POR_PAGINA = 3;
