# Simulador de Economia — Em Conta

Substitui a planilha `SIMULADOR DE ECONOMIA_Em Conta_ASSOCIAÇÃO- Atualizado (3) (1).xlsx`.
O consultor cadastra o cliente, adiciona as unidades consumidoras, vê os cálculos em tempo
real e baixa a proposta comercial em PDF (A4, uma página, texto vetorial).

As regras extraídas da planilha estão em **[DOCUMENTACAO-REGRAS-PLANILHA.md](DOCUMENTACAO-REGRAS-PLANILHA.md)** —
leia antes de mexer nas fórmulas.

## Comandos

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de produção
npm start          # serve o build
npm test           # 103 testes (Vitest)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

### Chromium para o PDF

O PDF é gerado com Puppeteer. Normalmente o `npm install` já baixa o Chromium.
Se o antivírus da máquina bloquear esse download (comum em Windows corporativo), aponte
para um Chrome/Edge já instalado:

```bash
# .env.local
PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Sem essa variável, o sistema tenta nesta ordem: Chromium do Puppeteer →
`@sparticuz/chromium` (se estiver em Vercel/Lambda) → Chrome/Edge do sistema.

## Onde ficam as coisas

| Caminho | Papel |
|---|---|
| `src/domain/simulator/config.ts` | **Todas** as tarifas, impostos, bandeiras, faixas de COSIP e constantes da usina. É aqui que se atualiza tarifa. |
| `src/domain/simulator/calculations.ts` | Motor de cálculo. Funções puras, uma por fórmula da planilha. |
| `src/domain/simulator/tariffs.ts` | Buscas em tabela (COSIP, gross-up de imposto, bandeiras). |
| `src/domain/simulator/validation.ts` | Schemas Zod — usados no formulário **e** no servidor. |
| `src/domain/simulator/format.ts` | Formatação pt-BR. Único lugar que arredonda. |
| `src/domain/simulator/calculations.test.ts` | 103 testes, incluindo o caso de regressão da planilha. |
| `src/components/Proposta.tsx` | **O componente do PDF.** Estilos inline; renderiza igual no navegador e no servidor. |
| `src/app/proposta/preview/page.tsx` | Pré-visualização da proposta. |
| `src/app/api/proposta/pdf/route.ts` | **A rota do PDF.** Revalida e recalcula no servidor. |
| `src/server/pdf.ts` | Puppeteer + `renderToStaticMarkup` + assets em base64. |

## Como atualizar tarifas

Não existe tela de configuração — é **de propósito**. Tarifa, imposto, bandeira, faixa de
COSIP, desconto padrão, validade da proposta e dados da usina vivem todos em
`src/domain/simulator/config.ts`, num único objeto tipado. Edite lá, rode `npm test` para
conferir que o caso de regressão continua fechando, e o simulador, os testes e o PDF passam
a usar os novos valores juntos.

## Decisões que valem saber

**Precisão.** O Excel calcula em IEEE-754 double, igual ao `number` do JavaScript. Usar
`decimal.js` afastaria o resultado da planilha em vez de aproximá-lo. Cálculo interno em
`number`; arredondamento só na exibição.

**COSIP.** Na planilha, a célula `Preencher!F9` do exemplo **não tem fórmula** — tem o
literal `48,58` digitado por cima. A fórmula da tabela devolveria `42,98` para B1/218 kWh.
Todos os valores esperados do caso de regressão derivam de `48,58`. Portanto: a COSIP é
calculada pela tabela **por padrão**, mas é editável por UC (o consultor copia o valor real
da conta). Os dois caminhos têm teste.

**Consumo compensável negativo.** A planilha faz `consumo - 100` sem proteção; um trifásico
com 80 kWh geraria −20 kWh e contaminaria impostos e custos. Aplicamos `max(0, …)`. É o
único desvio numérico intencional em relação à planilha.

**PIS/COFINS.** A planilha usa três alíquotas diferentes: 9,25% na baixa tensão, 0% em fora
ponta e ponta (as células estão vazias) e 6,08% na demanda. Incoerente, mas é o que
reproduz os números. Preservado e sinalizado no código.

**O PDF não é screenshot.** O componente é renderizado para HTML e impresso pelo Chromium
em A4 — o texto sai vetorial e selecionável.

## Verificação feita

- 103/103 testes passando, incluindo o caso de regressão completo da planilha.
- TypeScript e ESLint sem erros; build de produção OK.
- PDF gerado pela rota real: 1 página, 595,0 × 841,9 pt (A4 exato), 64 itens de texto
  vetorial, todos os valores da planilha conferidos.
- App dirigido de ponta a ponta no navegador: as 3 etapas, sem rolagem horizontal a 390 px,
  sem erro de console, sem 404.
- Servidor rejeita desconto de 100%, consumo negativo e CPF inválido (HTTP 400).
