-- Esquema do Simulador de Economia — Em Conta
--
-- Idempotente: pode rodar quantas vezes quiser (npm run db:migrate).
-- Postgres (Neon / Supabase / qualquer instância).

CREATE TABLE IF NOT EXISTS usuarios (
  id            BIGSERIAL PRIMARY KEY,
  nome          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  senha_hash    TEXT        NOT NULL,
  papel         TEXT        NOT NULL CHECK (papel IN ('admin', 'gestor', 'vendedor')),
  -- Instituição só se aplica a vendedor (SEMAPA, FIEMS, ADILSON).
  instituicao   TEXT        CHECK (instituicao IN ('SEMAPA', 'FIEMS', 'ADILSON')),
  ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_por    BIGINT      REFERENCES usuarios (id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um vendedor precisa de instituição; admin e gestor não têm.
  CONSTRAINT instituicao_coerente CHECK (
    (papel = 'vendedor' AND instituicao IS NOT NULL)
    OR (papel <> 'vendedor' AND instituicao IS NULL)
  )
);

-- E-mail único, sem depender de o app lembrar de normalizar.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico ON usuarios (LOWER(email));

-- Sessões. Guardamos apenas o HASH do token: vazar o banco não dá acesso a
-- nenhuma sessão viva.
CREATE TABLE IF NOT EXISTS sessoes (
  id          BIGSERIAL PRIMARY KEY,
  token_hash  TEXT        NOT NULL UNIQUE,
  usuario_id  BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  criada_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em   TIMESTAMPTZ NOT NULL,

  -- Liberação do desconto conquistada com a senha de uso único.
  --
  -- Fica na SESSÃO, não no navegador: destravar o campo na tela não bastaria,
  -- porque o vendedor poderia mandar qualquer desconto direto para a API do PDF.
  -- É este campo que a rota do PDF confere.
  desconto_liberado BOOLEAN NOT NULL DEFAULT FALSE
);

-- Para bancos que já existiam antes desta coluna.
ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS desconto_liberado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes (usuario_id);
CREATE INDEX IF NOT EXISTS sessoes_expira ON sessoes (expira_em);

-- Configuração do simulador: uma linha só (id = 1), com o objeto inteiro em
-- JSONB. O app valida com Zod ao ler, então um campo novo no código não quebra
-- uma linha antiga do banco.
CREATE TABLE IF NOT EXISTS configuracao (
  id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  dados         JSONB       NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por BIGINT     REFERENCES usuarios (id) ON DELETE SET NULL
);

-- Senhas de uso único para liberar a edição do desconto.
--
-- Guardamos o hash do código, nunca o código em claro. A senha é emitida por um
-- admin/gestor PARA UM VENDEDOR específico e morre no primeiro uso ou em 15 min,
-- o que vier antes.
CREATE TABLE IF NOT EXISTS senhas_desconto (
  id          BIGSERIAL PRIMARY KEY,
  codigo_hash TEXT        NOT NULL,
  vendedor_id BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  emitida_por BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  criada_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em   TIMESTAMPTZ NOT NULL,
  usada_em    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS senhas_vendedor_ativas
  ON senhas_desconto (vendedor_id)
  WHERE usada_em IS NULL;
