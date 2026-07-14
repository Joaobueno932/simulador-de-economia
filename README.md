# Simulador de Economia — Em Conta

Substitui a planilha `SIMULADOR DE ECONOMIA_Em Conta_ASSOCIAÇÃO- Atualizado (3) (1).xlsx`.
O consultor cadastra o cliente, adiciona as unidades consumidoras, vê os cálculos em tempo
real e baixa a proposta comercial em PDF (A4, uma página, texto vetorial).

As regras extraídas da planilha estão em **[DOCUMENTACAO-REGRAS-PLANILHA.md](DOCUMENTACAO-REGRAS-PLANILHA.md)** —
leia antes de mexer nas fórmulas.

## Acesso e papéis

O sistema tem login. Três papéis:

| Papel | Simula | Configurações | Cria usuários | Desconto | Consultor da proposta |
|---|---|---|---|---|---|
| **Admin** | sim | edita | admin, gestor e vendedor | edita livre | escolhe o vendedor |
| **Gestor** | sim | edita | **só vendedores** | edita livre | escolhe o vendedor |
| **Vendedor** | sim | não vê | não | **travado** — precisa de senha | sempre ele mesmo |

Vendedores são vinculados a uma instituição: **SEMAPA**, **FIEMS** ou **ADILSON**.

### Senha de uso único do desconto

O desconto é travado para o vendedor. Para alterá-lo, um admin/gestor gera em
**Administração → Senhas de desconto** um código de 6 dígitos **para aquele vendedor**. O
código:

- vale **15 minutos**;
- **morre no primeiro uso**;
- só funciona **para o vendedor escolhido**;
- é substituído se uma nova senha for gerada para o mesmo vendedor.

A liberação fica registrada **na sessão, no servidor**. Isso é o que importa: destravar o
campo no navegador não adianta nada, porque a rota do PDF recusa (HTTP 403) qualquer
desconto fora do padrão sem a liberação na sessão.

## Primeira execução

```bash
npm install
cp .env.example .env.local     # preencha DATABASE_URL, ADMIN_EMAIL e ADMIN_SENHA

npm run db:migrate             # cria as tabelas (idempotente — pode repetir)
npm run db:seed-admin          # cria o seu usuário admin

npm run dev                    # http://localhost:3000
```

### Banco de dados

Postgres. Em produção (Vercel), use **Neon** ou **Supabase** e a string do **pooler** — em
serverless o número de conexões estoura rápido com a conexão direta.

Para desenvolver na sua máquina, sobe um Postgres em Docker:

```bash
docker run -d --name simulador-pg \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_USER=simulador -e POSTGRES_DB=simulador \
  -p 55433:5432 postgres:16-alpine
```

Sempre que o esquema mudar, rode `npm run db:migrate` de novo — ele usa
`CREATE TABLE IF NOT EXISTS` e `ADD COLUMN IF NOT EXISTS`, então não destrói dado nenhum.

## Comandos

```bash
npm run dev            # desenvolvimento
npm run build          # build de produção
npm start              # serve o build
npm test               # 130 testes (Vitest)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run db:migrate     # aplica o esquema
npm run db:seed-admin  # cria/atualiza o admin
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

### Domínio (puro, sem React, sem banco)

| Caminho | Papel |
|---|---|
| `src/domain/simulator/config.ts` | Valores **padrão** das tarifas (os da planilha). Semente do banco. |
| `src/domain/simulator/configSchema.ts` | Zod da configuração. Nada inválido entra no cálculo. |
| `src/domain/simulator/calculations.ts` | Motor de cálculo. Funções puras, uma por fórmula da planilha. |
| `src/domain/simulator/tariffs.ts` | Buscas em tabela (COSIP, gross-up de imposto, bandeiras). |
| `src/domain/simulator/validation.ts` | Schemas Zod — usados no formulário **e** no servidor. |
| `src/domain/simulator/format.ts` | Formatação pt-BR. Único lugar que arredonda. |
| `src/domain/auth/types.ts` | **Papéis e permissões.** Quem pode o quê. Servidor e UI usam as mesmas funções. |

### Servidor (só roda no Node — `server-only`)

| Caminho | Papel |
|---|---|
| `src/server/db/schema.sql` | Esquema do Postgres. |
| `src/server/auth.ts` | Login, sessão, hash de senha, liberação do desconto. |
| `src/server/configuracao.ts` | Lê/grava a config no banco, sempre validando. |
| `src/server/usuarios.ts` | CRUD de usuários, com as permissões aplicadas. |
| `src/server/senhasDesconto.ts` | Senhas de uso único (emissão e consumo). |
| `src/server/pdf.ts` | Puppeteer + `renderToStaticMarkup` + assets em base64. |
| `src/app/api/proposta/pdf/route.ts` | **A rota do PDF.** Revalida, recalcula e impõe as regras. |
| `src/middleware.ts` | Corte rápido por cookie. **Não** é a autorização de verdade. |

### Interface

| Caminho | Papel |
|---|---|
| `src/components/Proposta.tsx` | **O componente do PDF.** Estilos inline; renderiza igual no navegador e no servidor. |
| `src/components/Simulador.tsx` | O assistente de 3 etapas. |
| `src/components/admin/` | Configurações, usuários e senhas de desconto. |

## Como atualizar tarifas

Pela tela: **Administração → Configurações** (admin ou gestor). Tarifas, impostos,
bandeiras, faixas de COSIP, desconto padrão, validade da proposta, dados da usina e do
rodapé — tudo editável, validado com Zod antes de gravar, e passa a valer na hora para a
tela, o cálculo e o PDF.

Os valores de `src/domain/simulator/config.ts` continuam sendo os **padrões da planilha**:
servem de semente e de rede de segurança (se a config do banco ficar inválida, o sistema cai
neles em vez de quebrar). O botão *Restaurar padrão* volta para eles.

## Decisões que valem saber

**A UI não protege nada.** Esconder um botão é conveniência. Toda regra — papel, desconto,
consultor, data — é imposta de novo no servidor. O caso concreto: um vendedor pode mandar
`desconto: 0.9` direto para `/api/proposta/pdf`; a rota responde **403** porque a sessão
dele não tem liberação. Há teste ponta a ponta exatamente para isso.

**Data e validade não vêm do formulário.** A rota do PDF sobrescreve com a data de hoje
(servidor) e a validade da configuração. Mexer no HTML não muda o que sai no PDF.

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

**Senhas nunca são recuperáveis.** No banco só existe o hash (bcrypt para senha de usuário,
SHA-256 para o código de 6 dígitos). O código aparece **uma vez** para quem o gerou. Não há
tela que o mostre de novo — porque não há como.

## Verificação feita

- **130/130 testes** (Vitest), incluindo o caso de regressão completo da planilha e a
  matriz de permissões dos três papéis.
- **34 checagens ponta a ponta** contra Postgres real e o build de produção, cobrindo o
  abuso e não só o caminho feliz:
  - vendedor forjando `desconto: 0.9` direto na API → **403**;
  - senha de uso único **reutilizada** → 400;
  - senha de um vendedor usada por **outro** → 400;
  - senha **expirada** (linha envelhecida no banco) → 400, e o desconto segue travado;
  - gestor tentando criar gestor/admin → 403; tentando desativar o admin → 403;
  - desativar um usuário **derruba a sessão dele** na hora;
  - e-mail inexistente e senha errada devolvem a **mesma** mensagem (não vaza quem existe);
  - config inválida (desconto de 150%) → 400, não entra no banco.
- TypeScript e ESLint sem erros; build de produção OK.
- PDF: 1 página, 595,0 × 841,9 pt (A4 exato), texto vetorial, valores da planilha conferidos.
- Telas conferidas no navegador em cada papel, sem erro de console.
