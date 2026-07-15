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
  ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
  criado_por    BIGINT      REFERENCES usuarios (id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Senha provisória: o usuário entra com a senha padrão e é obrigado a trocá-la
-- antes de fazer qualquer outra coisa.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_provisoria BOOLEAN NOT NULL DEFAULT FALSE;

-- Foto de perfil. Guardada no banco (avatar pequeno, já redimensionado no
-- cliente) — evita depender de storage externo em serverless.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto BYTEA;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_mime TEXT;

-- ---------------------------------------------------------------------------
-- Instituições do vendedor.
--
-- Passou a ser N:N: um vendedor pode pertencer a mais de uma instituição.
-- Serve apenas para MÉTRICAS — não altera cálculo, permissão nem proposta.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_instituicoes (
  usuario_id  BIGINT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  instituicao TEXT   NOT NULL CHECK (instituicao IN ('SEMAPA', 'FIEMS', 'ADILSON')),
  PRIMARY KEY (usuario_id, instituicao)
);

-- Migração da coluna única antiga -> tabela de vínculo. Roda uma vez só;
-- depois a coluna não existe mais e o bloco é ignorado.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'usuarios' AND column_name = 'instituicao'
  ) THEN
    INSERT INTO usuario_instituicoes (usuario_id, instituicao)
      SELECT id, instituicao FROM usuarios WHERE instituicao IS NOT NULL
      ON CONFLICT DO NOTHING;

    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS instituicao_coerente;
    ALTER TABLE usuarios DROP COLUMN instituicao;
  END IF;
END $$;

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

-- ---------------------------------------------------------------------------
-- Propostas emitidas.
--
-- Guardamos as ENTRADAS da simulação + a CONFIG usada naquele momento, não os
-- bytes do PDF. Com os dois, o PDF é regerado idêntico quando o gestor quiser
-- rever — e, principalmente, os números não mudam mesmo que a tarifa seja
-- alterada depois. Guardar ~1 MB de PDF por proposta encheria o banco à toa.
--
-- Os campos numéricos ficam desnormalizados para o dashboard não precisar
-- recalcular tudo a cada consulta.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS propostas (
  id                 BIGSERIAL PRIMARY KEY,
  -- Quem estava logado (pode ser um gestor emitindo em nome de um vendedor).
  --
  -- SET NULL, não CASCADE: excluir um usuário NÃO pode apagar as propostas que
  -- ele emitiu. O histórico do gestor é justamente o registro do que foi feito —
  -- e o nome do consultor fica gravado em texto na própria linha, então a
  -- proposta continua legível mesmo sem a conta.
  usuario_id         BIGINT      REFERENCES usuarios (id) ON DELETE SET NULL,
  -- O vendedor que aparece na proposta. Base das métricas.
  vendedor_id        BIGINT      REFERENCES usuarios (id) ON DELETE SET NULL,
  consultor          TEXT        NOT NULL,

  cliente_nome       TEXT        NOT NULL,
  cliente_documento  TEXT        NOT NULL,
  cliente_telefone   TEXT        NOT NULL,

  quantidade_ucs     INTEGER     NOT NULL,
  consumo_medio      NUMERIC     NOT NULL,
  fatura_atual       NUMERIC     NOT NULL,
  fatura_com_em_conta NUMERIC    NOT NULL,
  economia_mensal    NUMERIC     NOT NULL,
  economia_anual     NUMERIC     NOT NULL,
  desconto_medio     NUMERIC     NOT NULL,

  simulacao          JSONB       NOT NULL,
  configuracao       JSONB       NOT NULL,

  criada_em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bancos criados antes desta mudança tinham `usuario_id NOT NULL ... ON DELETE
-- CASCADE`: excluir um vendedor levaria junto TODAS as propostas dele. Trocamos
-- para SET NULL, preservando o histórico.
ALTER TABLE propostas ALTER COLUMN usuario_id DROP NOT NULL;

DO $$
DECLARE
  nome_constraint TEXT;
BEGIN
  SELECT conname INTO nome_constraint
    FROM pg_constraint
   WHERE conrelid = 'propostas'::regclass
     AND contype = 'f'
     AND conkey = ARRAY[
       (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'propostas'::regclass AND attname = 'usuario_id')
     ]::smallint[];

  IF nome_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE propostas DROP CONSTRAINT %I', nome_constraint);
  END IF;

  ALTER TABLE propostas
    ADD CONSTRAINT propostas_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL;
END $$;

CREATE INDEX IF NOT EXISTS propostas_vendedor ON propostas (vendedor_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS propostas_data ON propostas (criada_em DESC);

-- ---------------------------------------------------------------------------
-- Histórico de eventos.
--
-- Trilha de auditoria do que cada um fez: login, proposta gerada, senha de
-- desconto emitida E usada, senha resetada, usuário criado, config alterada.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
  id              BIGSERIAL PRIMARY KEY,
  -- Quem fez. NULL só se o usuário for apagado.
  usuario_id      BIGINT      REFERENCES usuarios (id) ON DELETE SET NULL,
  tipo            TEXT        NOT NULL,
  descricao       TEXT        NOT NULL,
  -- Sobre quem/o quê a ação foi feita, quando se aplica.
  alvo_usuario_id BIGINT      REFERENCES usuarios (id) ON DELETE SET NULL,
  proposta_id     BIGINT      REFERENCES propostas (id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eventos_usuario ON eventos (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS eventos_data ON eventos (criado_em DESC);
CREATE INDEX IF NOT EXISTS eventos_tipo ON eventos (tipo, criado_em DESC);

-- ---------------------------------------------------------------------------
-- Simulações salvas ("Meus clientes").
--
-- Diferente de `propostas`: proposta é o registro imutável de um PDF emitido;
-- isto aqui é um RASCUNHO editável, gravado assim que o consultor chega à etapa
-- 2, para ele reabrir e continuar o atendimento do cliente depois.
--
-- Guardamos a simulação inteira (cliente + unidades) em JSONB. O consultor que
-- criou é o dono; um vendedor só vê as suas.
--
-- ON DELETE CASCADE: são rascunhos de trabalho, saem junto com a conta do dono.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS simulacoes (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  cliente_nome      TEXT        NOT NULL DEFAULT '',
  cliente_documento TEXT        NOT NULL DEFAULT '',
  quantidade_ucs    INTEGER     NOT NULL DEFAULT 1,
  dados             JSONB       NOT NULL,
  criada_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS simulacoes_usuario ON simulacoes (usuario_id, atualizada_em DESC);
