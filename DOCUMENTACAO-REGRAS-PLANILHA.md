# Regras extraídas da planilha `SIMULADOR DE ECONOMIA_Em Conta_ASSOCIAÇÃO- Atualizado (3) (1).xlsx`

Documento técnico produzido a partir da leitura direta do XML do arquivo (fórmulas + valores em cache),
não de uma interpretação visual. É a fonte de verdade do domínio de cálculo.

## 1. Estrutura do arquivo

| Aba | Papel |
|---|---|
| `Preencher` | Entradas do consultor + todas as fórmulas. 10 colunas fixas (`F`..`O`) = UC 01..UC 10. |
| `Dados` | Tabelas de tarifas, impostos, bandeiras e faixas de COSIP. |
| `Proposta` | **Só gráficos.** `sheetData` vazio: é uma imagem de fundo (`image1.png`) + ~14 caixas de texto sobrepostas ligadas à `Preencher`, + 2 gráficos. |
| `x Concorrente` | Mesma proposta em vetor + bloco de comparação com concorrente. |

## 2. Constantes (aba `Dados`)

### Tarifas — `Dados!I2:L6`

A tarifa "com imposto" é obtida com **gross-up**: `tarifa / (1 - ICMS) / (1 - PIS_COFINS)`.

| Tarifa | s/ imposto (J) | Fórmula da coluna K | c/ imposto (K) | Impostos (L = K - J) |
|---|---|---|---|---|
| Baixa Tensão | 0,98660 | `J3/(1-17%)/(1-SUM(N3:O3))` | **1,309834378837665** | **0,32323437883766493** |
| Fora Ponta | 0,48504 | `J4/(1-17%)/(1-SUM(N4:O4))` | 0,58438554216867478 | 0,09934554216867475 |
| Ponta | 2,38151 | `J5/(1-17%)/(1-SUM(N5:O5))` | 2,8692891566265062 | 0,48777915662650617 |
| Demanda FP | 35,79 | `J6/(1-17%)/(1-6,08%)` | 45,911927095092459 | 10,12192709509246 |

> ⚠️ **Inconsistência real da planilha, replicada fielmente:**
> - `N3=1,65%` (PIS) e `O3=7,6%` (COFINS) → soma **9,25%**, aplicada só à **Baixa Tensão**.
> - `N4:O4` e `N5:O5` estão **vazias** → Fora Ponta e Ponta recebem **apenas ICMS** (PIS/COFINS = 0).
> - Demanda usa a constante literal **6,08%** (o nome definido `PIS_COFINS`), diferente dos 9,25% da BT.
>
> Os três divisores diferentes são o que reproduz os números da planilha. Não foram "corrigidos".

- ICMS = **17%**
- Nomes definidos existentes mas **não usados** nas fórmulas de cálculo: `Tarifa_BT=0.87017`, `Fio_B_BT`,
  `GD_III_*`, `PAYBACK` (LAMBDA), etc. São resíduo de versões anteriores — ignorados.

### Bandeiras tarifárias — `Dados!I9:K12` (R$/kWh)

| Bandeira | Adicional |
|---|---|
| Verde | 0 |
| Amarela | 0,01885 |
| Vermelha P1 | 0,04463 |
| Vermelha P2 | 0,07877 |

### COSIP

Duas tabelas. A busca é `INDEX(...; MATCH(TRUE; faixaMáximo >= consumo; 0))` →
**primeira faixa cujo "Máximo" é ≥ o consumo BT/FP da UC** (não o compensável).

- **B1 → tabela RESIDENCIAL** (`Dados!D20:E33`)
- **B2 → COSIP = 0** (fixo na fórmula)
- **B3 e MT → tabela DEMAIS** (`Dados!D8:E17`)

RESIDENCIAL (máx → valor): 100→0 | 150→27,627396297284537 | 200→30,697106996982821 | 250→42,975949795775954 |
300→46,04566049547423 | 400→49,115371195172514 | 500→55,254792594569075 | 600→58,324503294267359 |
700→61,394213993965643 | 800→64,463924693663913 | 900→70,60334609306048 | 1000→76,742767492457048 |
1500→82,882188891853616 | 99999→92,09

DEMAIS (máx → valor): 100→3,07 | 150→58,32 | 200→85,951899591551907 | 400→138,13698148642268 |
600→159,62495638431068 | 800→174,97350988280206 | 1000→190,32206338129348 | 1500→208,74032757948319 |
5000→300,83164857043164 | 99999→362,22586256439723

### Usina (aba `Preencher`)
- Capacidade de referência: **24.000 kWh/mês** (`C35 = C11/24000`)
- Potência de referência: **198 kWp** (`C34 = 198*C35`)
- Reajuste anual da projeção: **5% (1,05)**

## 3. Fórmulas por UC (coluna `F` = UC 01)

| Linha | Campo | Fórmula original | Tradução |
|---|---|---|---|
| 5 | Consumo FP/BT | *entrada* | kWh |
| 6 | Consumo Ponta | *entrada* | kWh |
| 7 | Demanda Contratada | *entrada* | kW |
| 9 | **COSIP** | `IFS(F3="B1"; INDEX(residencial; MATCH(TRUE; maxRes>=F5;0)); F3="B2"; 0; OR(F3="B3";F3="MT"); INDEX(demais; MATCH(TRUE; maxDem>=F5;0)))` | ver §2 |
| 10 | **Faturamento Mínimo** | `IFS(F4="MONOFÁSICO";30*K3; "BIFÁSICO";50*K3; "TRIFÁSICO";100*K3; "MÉDIA TENSÃO";0)` | mínimo × tarifa BT c/ imposto |
| 11 | **Impostos** | `F17 * Dados!$L$3` | compensável × delta de imposto da **BT** |
| 13 | **Custo de Demanda** | `IF(F4="MÉDIA TENSÃO"; F7*K6; 0)` | demanda × tarifa demanda c/ imposto |
| 15 | **Valor Residual** | `SUM(F9:F13)` | COSIP + FatMín + Impostos + CustoDemanda |
| 17 | **Consumo Compensável** | `IFS("MONOFÁSICO";F5-30; "BIFÁSICO";F5-50; "TRIFÁSICO";F5-100; "MÉDIA TENSÃO";F5+F6)` | ver §5 |
| 18 | Desconto | *entrada*, padrão 0,20 | |
| 19 | **Custo s/ Locação** | `IF(F4="MÉDIA TENSÃO"; F5*K4 + F6*K5; F17*K3) - F11` | |
| 20 | **Custo c/ Locação** | `F19*(1-F18)` | |
| 23 | Fatura s/ Locação | `F15+F19` | |
| 24 | Fatura c/ Locação | `F15+F20` | |
| 25 | **Economia** | `F19-F20` | |
| 26 | Economia % Efetiva | `F25/F23` | |
| 28 | Custo/kWh Concorrente | *entrada* | |
| 29 | Economia Concorrente | `(Dados!$J$3 - F28) * F17 * 12` | usa tarifa BT **s/ imposto** (0,9866) |
| 30 | Economia x Concorrente | `F25*12 - F29` | |
| 32/33/34 | Bandeiras evitadas | `F17 * K10 / K11 / K12` | compensável × adicional |

> ⚠️ **Impostos (linha 11) usa `L3` (delta da BT) mesmo para Média Tensão.** Tecnicamente
> incoerente (MT deveria usar `L4`/`L5`), mas é o que a planilha faz e é o que reproduz os
> números. Replicado como está e sinalizado no código.

## 4. Totais (coluna `C` da `Preencher`)

| Célula | Campo | Fórmula |
|---|---|---|
| C7 | Economia Anual | `C17*12` |
| C8 | Consumo Anual | `SUM(F5:O5)*12` |
| C9 | Qtd. de UCs | `COUNT(F5:O5)` |
| C10 | Consumo Médio Mensal | `C8/12` |
| C11 | Compensável Médio Mensal | `SUM(F17:O17)` |
| C14 | **Conta de Luz Atual** | `SUM(F15:O15; F19:O19)` = Σ residual + Σ custo s/ locação |
| C17 | Sua Economia (mensal) | `SUM(F25:O25)` |
| C18 | Fatura paga ao Locador | `SUM(F20:O20)` |
| C19 | Fatura paga à Distribuidora | `SUM(F15:O15)` |
| C41 | Conta de Luz com Locação | `SUM(F24:O24)` |
| C34 | Equivalente em kWp | `198 * C35` |
| C35 | % da potência da usina | `C11 / 24000` |

### Projeção de 5 anos (reajuste 5% a.a.)

Fator geométrico: `1 + 1,05 + 1,05² + 1,05³ + 1,05⁴ = 5,52563125`

- `C25` Verde = `economiaMensal * 12 * 5,52563125`
- `C26` Amarela = `C25 + ΣbandeiraAmarela * 12 * 5,52563125`
- `C27` Vermelha P1 = `C25 + ΣbandeiraP1 * 12 * 5,52563125`
- `C28` Vermelha P2 = `C25 + ΣbandeiraP2 * 12 * 5,52563125`

> As bandeiras **somam-se** à economia verde (são custos evitados adicionais), não a substituem.

## 5. Correções aplicadas (desvios conscientes da planilha)

1. **Consumo compensável negativo.** A planilha faz `F5-100` sem proteção: um trifásico com 80 kWh
   gera compensável de **−20 kWh**, propagando impostos e custos negativos. Aplicado `max(0, ...)`,
   conforme exigido no briefing. É o único desvio numérico intencional.
2. **`IFERROR(...;"-")`** vira `0`/`null` tipado em vez de string `"-"`.
3. **Concorrente vazio.** Na planilha, `F28` vazio faz `(0,9866 - 0) * compensável * 12` — uma
   "economia do concorrente" fictícia e enorme. No sistema, o bloco concorrente só é calculado
   quando o custo/kWh do concorrente é informado.

## 6. Ponto crítico: COSIP do caso de regressão

A célula `F9` (COSIP da UC 01) **não contém fórmula** — contém o literal **48,58** digitado por cima.
A fórmula da tabela, para B1 / 218 kWh, retornaria a faixa 201–250 → **42,98**.

Todos os valores esperados do caso de regressão (residual 217,71; fatura 334,12; etc.) derivam de
**48,58**, não de 42,98. Ou seja: na prática o consultor **sobrescreve a COSIP com o valor real da
conta do cliente**.

**Decisão:** a COSIP é calculada pela tabela por padrão, mas é um campo **editável por UC**
(`cosipOverride`). O caso de regressão da planilha é reproduzido informando 48,58 — exatamente como
a planilha faz. Ambos os caminhos são cobertos por teste.

## 7. Layout da aba `Proposta` (referência do PDF)

Fundo `image1.png` (1355×2000) + caixas de texto. Blocos, de cima para baixo:

1. **Cabeçalho** — "SIMULAÇÃO DE ECONOMIA" (verde) + logo EM CONTA.
2. **DADOS DO CLIENTE** (pílula azul) — nome, telefone, CPF/CNPJ, qtd. de UCs, consumo médio,
   consultor, data da proposta.
3. **RESULTADO DA SIMULAÇÃO** (pílula azul) + **DESCONTO** "sobre a tarifa do consumo compensável".
4. `VOCÊ VAI ECONOMIZAR **R$ x** POR ANO` (destaque verde).
5. **Card principal:** FATURA ATUAL (pílula azul) → FATURA COM EM CONTA (pílula verde);
   ECONOMIA MENSAL; gráfico empilhado de composição; FATURA EM CONTA (laranja);
   FATURA ENERGISA (azul, "taxa mínima + impostos"); sub-card
   "CUSTOS COM BANDEIRAS TARIFÁRIAS EVITADOS" (gráfico de barras da projeção de 5 anos);
   rodapé do card: PARTICIPAÇÃO NA ASSOCIAÇÃO (kWp) e QUOTA-PARTE DA POTÊNCIA DA USINA (%).
6. **Observações** (3 bullets verdes) — textos obrigatórios.
7. **Rodapé** — mascote + "FALE COM A GENTE E COMECE A ECONOMIZAR" + WhatsApp (67) 99731-4368;
   barra azul com logos EM CONTA e CSI | Sistema FIEMS.

### Gráficos

- `chart1` — colunas **empilhadas**, 2 categorias:
  - Fatura Atual → um bloco único de **334,12**
  - Com Em Conta → **217,71** (Energisa) + **93,14** (Locação) + **23,28** (Economia)
  - Os totais coincidem, então a economia aparece como a fatia "poupada" no topo.
- `chart2` — barras horizontais: projeção de 5 anos por bandeira (Verde/Amarela/Verm. P1/Verm. P2).

## 8. Paleta institucional (amostrada do `image1.png`)

| Cor | Hex |
|---|---|
| Azul institucional | `#0F579F` |
| Verde Em Conta | `#3AAA35` |
| Verde claro (logo) | `#95C11F` |
| Laranja (badge "Associação") | `#F08120` |
| Amarelo mascote | `#FFD400` |

## 9. Precisão numérica

O Excel calcula em **IEEE-754 double**. Todos os valores esperados batem bit-a-bit com aritmética
`number` do JavaScript (verificado). Usar `decimal.js` **afastaria** o resultado da planilha em vez
de aproximá-lo. Portanto: cálculo interno em `number` (double), arredondamento **apenas na
apresentação** (`Intl.NumberFormat` pt-BR, 2 casas). Tela, testes e PDF consomem exatamente o mesmo
objeto de resultado.
