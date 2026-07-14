/**
 * Proposta comercial — layout A4 da aba "Proposta" da planilha.
 *
 * DECISÕES IMPORTANTES:
 *
 * 1. ESTILOS INLINE, sem Tailwind. Este componente é renderizado nos dois lados:
 *    no navegador (rota /proposta/preview) e no servidor via
 *    `renderToStaticMarkup` para o Puppeteer. Sem depender do pipeline de CSS,
 *    o PDF é garantidamente idêntico à pré-visualização.
 *
 * 2. As IMAGENS chegam por prop (`assets`). O preview passa caminhos `/img/...`;
 *    a rota de PDF passa data URIs em base64 lidos do disco. Nada de hotlink.
 *
 * 3. Gráficos em SVG puro — vetoriais, determinísticos, sem biblioteca.
 *
 * 4. Sem `position: absolute` para o conteúdo: o fluxo é natural e em mm, para
 *    que nada seja cortado nem transborde da página A4.
 */

import { CONFIG, type ConfiguracaoSimulador } from "@/domain/simulator/config";
import {
  formatarData,
  formatarDesconto,
  formatarDocumento,
  formatarKwh,
  formatarMoeda,
  formatarQuantidadeUCs,
  formatarTelefone,
  somarDias,
} from "@/domain/simulator/format";
import type { DadosCliente, ResultadoSimulacao } from "@/domain/simulator/types";

export interface AssetsProposta {
  readonly logoEmConta: string;
  readonly logoEmContaBranco: string;
  readonly logoCsiFiems: string;
  readonly mascote: string;
}

/** Caminhos usados no navegador (pré-visualização). */
export const ASSETS_WEB: AssetsProposta = {
  logoEmConta: "/img/logo-em-conta.png",
  logoEmContaBranco: "/img/logo-em-conta-branco.png",
  logoCsiFiems: "/img/logo-csi-fiems.png",
  mascote: "/img/mascote-heroi.png",
};

const AZUL = "#0F579F";
const AZUL_ESCURO = "#0A3D70";
const VERDE = "#3AAA35";
const VERDE_CLARO = "#95C11F";
const TEXTO = "#1C2B3A";
const CINZA = "#6B7A89";
const BORDA = "#D7E1EB";

/**
 * Identidade visual da conta da distribuidora, para a mini-fatura ILUSTRATIVA.
 *
 * Cores amostradas da conta real (faixa pêssego no topo, faixa turquesa à
 * esquerda, campos com borda azul). NÃO reproduzimos o logotipo deles: a
 * mini-fatura é um desenho explicativo, identificado como ilustrativo, e serve
 * só para o cliente reconhecer "esta é a conta que você já conhece".
 */
const DIST_PESSEGO = "#EFA96C";
const DIST_TURQUESA = "#2BA6C6";
const DIST_GRAFITE = "#3C3C3B";

const FONTE =
  '"Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", system-ui, sans-serif';

/** Rótulo em pílula com contorno azul (como na planilha). */
function PilulaRotulo({ children, largura }: { children: React.ReactNode; largura?: string }) {
  return (
    <div
      style={{
        border: `1.2px solid ${AZUL}`,
        borderRadius: "999px",
        padding: "1.1mm 2.5mm",
        fontSize: "6pt",
        fontWeight: 700,
        color: AZUL,
        textTransform: "uppercase",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        width: largura,
        // Sem encolher: a pílula tem que caber o rótulo inteiro, senão invade o valor.
        flexShrink: 0,
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

/** Caixa em pílula com o valor. */
function PilulaValor({ children, flex = 1 }: { children: React.ReactNode; flex?: number }) {
  return (
    <div
      style={{
        border: `1.2px solid ${AZUL}`,
        borderRadius: "999px",
        padding: "1.1mm 3mm",
        fontSize: "7.4pt",
        fontWeight: 600,
        color: TEXTO,
        flex,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
      }}
    >
      {children || " "}
    </div>
  );
}

/** Faixa de seção: pílula azul preenchida. */
function TituloSecao({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-block",
        background: AZUL,
        color: "#fff",
        borderRadius: "999px",
        padding: "1.4mm 5mm",
        fontSize: "8.2pt",
        fontWeight: 800,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Mini-fatura ILUSTRATIVA.
 *
 * O ponto que o cliente precisa entender é que ele passa a ter DUAS contas — e
 * que a soma das duas é menor do que a única conta de hoje. Texto sozinho não
 * resolve isso; o cliente reconhece a conta pela cara dela. Então desenhamos as
 * duas: uma com a identidade da distribuidora (pêssego + turquesa), outra com a
 * da Em Conta (azul + verde).
 *
 * Não há reprodução de logotipo de terceiro — é um desenho explicativo, marcado
 * como ilustrativo.
 */
function MiniFatura({
  emissor,
  subtitulo,
  valor,
  descricao,
  corFaixa,
  corLateral,
  corTexto,
  corValor,
}: {
  emissor: string;
  subtitulo: string;
  valor: number;
  descricao: string;
  corFaixa: string;
  corLateral: string;
  corTexto: string;
  corValor: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        border: `1px solid ${BORDA}`,
        borderRadius: "2.5mm",
        overflow: "hidden",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Faixa superior — é o que dá a "cara" da conta. */}
      <div
        style={{
          background: corFaixa,
          padding: "1.6mm 2.5mm",
          display: "flex",
          alignItems: "center",
          gap: "1.5mm",
        }}
      >
        <span
          style={{
            width: "1.5mm",
            height: "5mm",
            background: corLateral,
            borderRadius: "1mm",
            display: "block",
            flexShrink: 0,
          }}
        />
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "7.6pt",
              fontWeight: 800,
              color: corTexto,
              lineHeight: 1.1,
              letterSpacing: "0.02em",
            }}
          >
            {emissor}
          </span>
          <span
            style={{
              display: "block",
              fontSize: "5pt",
              fontWeight: 600,
              color: corTexto,
              opacity: 0.85,
            }}
          >
            {subtitulo}
          </span>
        </span>
      </div>

      {/* Corpo */}
      <div style={{ padding: "2mm 2.5mm", flex: 1 }}>
        <div style={{ fontSize: "5.2pt", color: CINZA, textTransform: "uppercase" }}>
          Total a pagar
        </div>
        <div
          style={{
            fontSize: "12.5pt",
            fontWeight: 800,
            color: corValor,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          {formatarMoeda(valor)}
        </div>
        <div style={{ fontSize: "5.4pt", color: TEXTO, marginTop: "0.8mm", lineHeight: 1.3 }}>
          {descricao}
        </div>
      </div>
    </div>
  );
}

/** Sinal grande (+ ou =) entre as mini-faturas. */
function Sinal({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      style={{
        fontSize: "13pt",
        fontWeight: 800,
        color: CINZA,
        flexShrink: 0,
        alignSelf: "center",
        padding: "0 0.5mm",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Barra HORIZONTAL de uma unidade consumidora.
 *
 * Duas linhas na mesma escala:
 *   HOJE      — a conta única de hoje (barra cheia)
 *   COM EM CONTA — Energisa + Em Conta + a fatia poupada (verde)
 *
 * As duas barras têm o mesmo comprimento total, então a fatia verde é
 * literalmente "o pedaço que sai do bolso hoje e deixa de sair". É o mesmo
 * raciocínio do gráfico da planilha, na horizontal e por unidade.
 */
function BarraUC({
  nome,
  faturaAtual,
  residual,
  locacao,
  economia,
  altura,
  compacto,
}: {
  nome: string;
  faturaAtual: number;
  residual: number;
  locacao: number;
  economia: number;
  altura: string;
  compacto: boolean;
}) {
  const pct = (v: number) => (faturaAtual > 0 ? (v / faturaAtual) * 100 : 0);

  /**
   * Com muitas unidades, duas barras por UC não cabem na página — o rodapé era
   * empurrado para fora. Neste caso usamos UMA barra empilhada por unidade: o
   * comprimento total continua sendo a conta de hoje, a parte clara no fim é o
   * que ele deixa de pagar, e o valor economizado de cada unidade segue visível
   * (que é o ponto).
   */
  if (compacto) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "1.5mm" }}>
        <span
          style={{
            width: "11mm",
            flexShrink: 0,
            fontSize: "5.6pt",
            fontWeight: 800,
            color: TEXTO,
          }}
        >
          {nome}
        </span>

        <span
          style={{
            flex: 1,
            height: altura,
            display: "flex",
            borderRadius: "1mm",
            overflow: "hidden",
            background: "#EDF1F5",
          }}
        >
          <span style={{ width: `${pct(residual)}%`, background: DIST_TURQUESA, display: "block" }} />
          <span style={{ width: `${pct(locacao)}%`, background: VERDE, display: "block" }} />
          <span
            style={{
              width: `${pct(economia)}%`,
              background: "#D8EFD7",
              display: "block",
              borderLeft: `0.4mm solid ${VERDE}`,
            }}
          />
        </span>

        <span
          style={{
            width: "16mm",
            flexShrink: 0,
            fontSize: "5.4pt",
            color: CINZA,
            textAlign: "right",
          }}
        >
          {formatarMoeda(faturaAtual)}
        </span>
        <span style={{ fontSize: "5.4pt", color: CINZA, flexShrink: 0 }}>→</span>
        <span
          style={{
            width: "16mm",
            flexShrink: 0,
            fontSize: "5.6pt",
            fontWeight: 800,
            color: TEXTO,
            textAlign: "right",
          }}
        >
          {formatarMoeda(residual + locacao)}
        </span>
        <span
          style={{
            width: "21mm",
            flexShrink: 0,
            fontSize: "5.6pt",
            fontWeight: 800,
            color: VERDE,
            textAlign: "right",
          }}
        >
          −{formatarMoeda(economia)}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "0.8mm",
        }}
      >
        <span style={{ fontSize: "6.6pt", fontWeight: 800, color: TEXTO }}>{nome}</span>
        <span style={{ fontSize: "6.6pt", fontWeight: 800, color: VERDE }}>
          economiza {formatarMoeda(economia)}/mês
        </span>
      </div>

      {/* HOJE */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5mm", marginBottom: "0.8mm" }}>
        <span
          style={{
            width: "14mm",
            flexShrink: 0,
            fontSize: "5pt",
            fontWeight: 700,
            color: CINZA,
            textAlign: "right",
          }}
        >
          HOJE
        </span>
        <span
          style={{
            flex: 1,
            height: altura,
            background: DIST_TURQUESA,
            borderRadius: "1mm",
            display: "block",
          }}
        />
        <span
          style={{
            width: "17mm",
            flexShrink: 0,
            fontSize: "5.8pt",
            fontWeight: 700,
            color: TEXTO,
            textAlign: "right",
          }}
        >
          {formatarMoeda(faturaAtual)}
        </span>
      </div>

      {/* COM EM CONTA — mesma largura total, repartida */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5mm" }}>
        <span
          style={{
            width: "14mm",
            flexShrink: 0,
            fontSize: "5pt",
            fontWeight: 700,
            color: CINZA,
            textAlign: "right",
          }}
        >
          COM EM CONTA
        </span>

        <span
          style={{
            flex: 1,
            height: altura,
            display: "flex",
            borderRadius: "1mm",
            overflow: "hidden",
            background: "#EDF1F5",
          }}
        >
          <span style={{ width: `${pct(residual)}%`, background: DIST_TURQUESA, display: "block" }} />
          <span style={{ width: `${pct(locacao)}%`, background: VERDE, display: "block" }} />
          {/* A fatia poupada aparece hachurada/clara: é o que ele NÃO paga mais. */}
          <span
            style={{
              width: `${pct(economia)}%`,
              background: "#D8EFD7",
              display: "block",
              borderLeft: `0.4mm solid ${VERDE}`,
            }}
          />
        </span>

        <span
          style={{
            width: "17mm",
            flexShrink: 0,
            fontSize: "5.8pt",
            fontWeight: 800,
            color: VERDE,
            textAlign: "right",
          }}
        >
          {formatarMoeda(residual + locacao)}
        </span>
      </div>
    </div>
  );
}

export function Proposta({
  cliente,
  r,
  config = CONFIG,
  assets = ASSETS_WEB,
}: {
  cliente: DadosCliente;
  r: ResultadoSimulacao;
  /** Config vigente (vem do banco no servidor). */
  config?: ConfiguracaoSimulador;
  assets?: AssetsProposta;
}) {
  const validade = somarDias(cliente.dataProposta, cliente.validadeDias);

  /**
   * A proposta tem que caber em UMA página A4, com 1 ou com 10 unidades.
   *
   * O bloco de barras é o único que cresce com o número de UCs, então é ele que
   * se ajusta: com poucas unidades as barras ficam altas (e preenchem a folha),
   * com muitas ficam finas (e nada transborda). Sem isso, 3 UCs já empurravam o
   * rodapé para fora da página.
   */
  const qtdUCs = r.unidades.length;

  // Até 4 unidades cabem as duas barras (HOJE / COM EM CONTA), que é a leitura
  // mais clara. De 5 em diante, uma barra empilhada por unidade — senão o
  // rodapé é empurrado para fora da folha.
  const compacto = qtdUCs > 4;

  const alturaBarra =
    qtdUCs === 1 ? "5mm" : qtdUCs === 2 ? "3.6mm" : qtdUCs <= 4 ? "2.6mm" : qtdUCs <= 7 ? "3mm" : "2.4mm";
  const espacoBarras =
    qtdUCs === 1 ? "3mm" : qtdUCs === 2 ? "2.5mm" : qtdUCs <= 4 ? "1.8mm" : "1.4mm";

  return (
    <div
      style={{
        width: "210mm",
        height: "297mm",
        background: "#fff",
        color: TEXTO,
        fontFamily: FONTE,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* ================= CABEÇALHO ================= */}
      <div style={{ borderTop: `2.5px solid ${AZUL}`, margin: "6mm 8mm 0" }} />
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6mm",
          padding: "3mm 8mm 3mm",
          borderBottom: `2.5px solid ${AZUL}`,
          margin: "0 8mm",
        }}
      >
        <h1
          style={{
            fontSize: "25pt",
            lineHeight: 0.98,
            fontWeight: 800,
            color: VERDE,
            letterSpacing: "-0.01em",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Simulação
          <br />
          de Economia
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assets.logoEmConta} alt="Em Conta — Energia Renovável" style={{ height: "17mm" }} />
      </header>

      {/* ================= DADOS DO CLIENTE ================= */}
      <section style={{ padding: "4mm 8mm 0" }}>
        <TituloSecao>Dados do cliente</TituloSecao>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.6mm", marginTop: "2.5mm" }}>
          <div style={{ display: "flex", gap: "2mm", alignItems: "center" }}>
            <PilulaRotulo largura="38mm">Nome do cliente</PilulaRotulo>
            <PilulaValor>{cliente.nome}</PilulaValor>
          </div>

          <div style={{ display: "flex", gap: "2mm", alignItems: "center" }}>
            <PilulaRotulo largura="38mm">Telefone</PilulaRotulo>
            <PilulaValor>{formatarTelefone(cliente.telefone)}</PilulaValor>
            <PilulaRotulo largura="30mm">CPF / CNPJ</PilulaRotulo>
            <PilulaValor>{formatarDocumento(cliente.documento)}</PilulaValor>
          </div>

          <div style={{ display: "flex", gap: "2mm", alignItems: "center" }}>
            <PilulaRotulo largura="38mm">Quantidade de UCs</PilulaRotulo>
            <PilulaValor>{formatarQuantidadeUCs(r.quantidadeUCs)}</PilulaValor>
            <PilulaRotulo largura="30mm">Consumo médio</PilulaRotulo>
            <PilulaValor>{formatarKwh(r.consumoMedioMensal)}</PilulaValor>
          </div>

          <div style={{ display: "flex", gap: "2mm", alignItems: "center" }}>
            <PilulaRotulo largura="38mm">Consultor responsável</PilulaRotulo>
            <PilulaValor>{cliente.consultor}</PilulaValor>
            <PilulaRotulo largura="30mm">Data da proposta</PilulaRotulo>
            <PilulaValor>{formatarData(cliente.dataProposta)}</PilulaValor>
          </div>
        </div>
      </section>

      {/* ================= RESULTADO ================= */}
      <section style={{ padding: "4mm 8mm 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "4mm",
          }}
        >
          <TituloSecao>Resultado da simulação</TituloSecao>

          <div style={{ textAlign: "right", lineHeight: 1 }}>
            <div
              style={{
                fontSize: "17pt",
                fontWeight: 800,
                color: AZUL,
                letterSpacing: "-0.01em",
              }}
            >
              DESCONTO {formatarDesconto(r.descontoMedio)}
            </div>
            <div style={{ fontSize: "6pt", fontWeight: 700, color: AZUL, marginTop: "0.6mm" }}>
              sobre a tarifa do consumo compensável
            </div>
          </div>
        </div>

        {/* Você vai economizar R$ X por ano */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "3mm",
            marginTop: "3mm",
          }}
        >
          <span
            style={{
              fontSize: "16pt",
              fontWeight: 800,
              color: VERDE,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
            }}
          >
            Você vai economizar
          </span>
          <span
            style={{
              fontSize: "27pt",
              fontWeight: 800,
              color: VERDE,
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
            }}
          >
            {formatarMoeda(r.economiaAnual)}
          </span>
          <span
            style={{
              fontSize: "16pt",
              fontWeight: 800,
              color: VERDE,
              textTransform: "uppercase",
            }}
          >
            por ano
          </span>
        </div>
      </section>

      {/* ================= CARD PRINCIPAL ================= */}
      {/* Altura natural: nada de `flex: 1` aqui, senão o card estica e abre um
          vazio no meio da página. O rodapé é que se apoia no fim da folha. */}
      <section style={{ padding: "3mm 8mm 0" }}>
        <div
          style={{
            border: `1.5px solid ${VERDE_CLARO}`,
            borderRadius: "4mm",
            padding: "4mm",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Fatura atual -> Fatura com Em Conta */}
          <div style={{ display: "flex", alignItems: "center", gap: "4mm" }}>
            <div>
              <div style={{ fontSize: "9pt", fontWeight: 800, color: AZUL, marginBottom: "1mm" }}>
                FATURA ATUAL
              </div>
              <div
                style={{
                  background: AZUL,
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "1.6mm 5mm",
                  fontSize: "11pt",
                  fontWeight: 800,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {formatarMoeda(r.faturaAtual)}
              </div>
            </div>

            <div
              aria-hidden="true"
              style={{ fontSize: "16pt", color: VERDE, fontWeight: 800, marginTop: "4mm" }}
            >
              →
            </div>

            <div>
              <div style={{ fontSize: "9pt", fontWeight: 800, color: VERDE, marginBottom: "1mm" }}>
                FATURA COM EM CONTA
              </div>
              <div
                style={{
                  background: VERDE,
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "1.6mm 5mm",
                  fontSize: "11pt",
                  fontWeight: 800,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {formatarMoeda(r.faturaComEmConta)}
              </div>
            </div>

            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: "9pt", fontWeight: 800, color: VERDE }}>ECONOMIA MENSAL</div>
              <div
                style={{
                  fontSize: "17pt",
                  fontWeight: 800,
                  color: VERDE,
                  letterSpacing: "-0.01em",
                }}
              >
                {formatarMoeda(r.economiaMensal)}
              </div>
            </div>
          </div>

          {/* ===== AS DUAS FATURAS =====
              O ponto que mais gera dúvida: o cliente passa a receber DUAS
              contas. Mostramos as duas com a cara de cada emissor e a soma
              explícita, comparada com o que ele paga hoje. */}
          <div
            style={{
              marginTop: "3.5mm",
              paddingTop: "3mm",
              borderTop: `1px solid ${BORDA}`,
            }}
          >
            <div
              style={{
                fontSize: "8.4pt",
                fontWeight: 800,
                color: TEXTO,
                marginBottom: "0.6mm",
              }}
            >
              A partir de agora você recebe DUAS faturas por mês:
            </div>
            <div style={{ fontSize: "6pt", color: CINZA, marginBottom: "2.5mm" }}>
              Somadas, elas custam menos do que a conta única que você paga hoje. Imagens
              ilustrativas.
            </div>

            <div style={{ display: "flex", alignItems: "stretch", gap: "1.5mm" }}>
              <MiniFatura
                emissor={config.institucional.distribuidora.toUpperCase()}
                subtitulo="Continua vindo, mas bem menor"
                valor={r.valorPagoDistribuidora}
                descricao="Taxa mínima + impostos + COSIP"
                corFaixa={DIST_PESSEGO}
                corLateral={DIST_TURQUESA}
                corTexto={DIST_GRAFITE}
                corValor={DIST_GRAFITE}
              />

              <Sinal>+</Sinal>

              <MiniFatura
                emissor="EM CONTA"
                subtitulo="Sua energia renovável"
                valor={r.valorPagoLocador}
                descricao="Energia compensada com desconto"
                corFaixa={VERDE}
                corLateral={AZUL}
                corTexto="#FFFFFF"
                corValor={VERDE}
              />

              <Sinal>=</Sinal>

              {/* Total: o que ele passa a pagar, contra o que paga hoje. */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: `1.5px solid ${VERDE}`,
                  borderRadius: "2.5mm",
                  background: "#F2FAF1",
                  padding: "2.5mm",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "5.4pt",
                    color: VERDE,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Você passa a pagar
                </div>
                <div
                  style={{
                    fontSize: "12.5pt",
                    fontWeight: 800,
                    color: VERDE,
                    lineHeight: 1.15,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatarMoeda(r.faturaComEmConta)}
                </div>
                <div style={{ fontSize: "5.4pt", color: CINZA, marginTop: "0.8mm" }}>
                  Hoje você paga{" "}
                  <span
                    style={{
                      color: DIST_GRAFITE,
                      fontWeight: 700,
                      textDecoration: "line-through",
                    }}
                  >
                    {formatarMoeda(r.faturaAtual)}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: "1.2mm",
                    background: VERDE,
                    color: "#fff",
                    borderRadius: "999px",
                    padding: "0.8mm 2mm",
                    fontSize: "6.2pt",
                    fontWeight: 800,
                    textAlign: "center",
                  }}
                >
                  Economia de {formatarMoeda(r.economiaMensal)}/mês
                </div>
              </div>
            </div>
          </div>

          {/* ===== ECONOMIA POR UNIDADE (barras horizontais) ===== */}
          <div
            style={{
              marginTop: "3.5mm",
              paddingTop: "3mm",
              borderTop: `1px solid ${BORDA}`,
            }}
          >
            <div
              style={{
                fontSize: "7pt",
                fontWeight: 800,
                color: TEXTO,
                textTransform: "uppercase",
                marginBottom: "0.6mm",
              }}
            >
              {r.unidades.length > 1
                ? "Economia em cada unidade consumidora"
                : "Sua economia na prática"}
            </div>
            <div style={{ fontSize: "5.6pt", color: CINZA, marginBottom: "2.5mm" }}>
              <span style={{ color: DIST_TURQUESA, fontWeight: 700 }}>■</span>{" "}
              {config.institucional.distribuidora} &nbsp;
              <span style={{ color: VERDE, fontWeight: 700 }}>■</span> Em Conta &nbsp;
              <span style={{ color: "#B7DFB4", fontWeight: 700 }}>■</span> o que você deixa de
              pagar
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: espacoBarras }}>
              {r.unidades.map((u) => (
                <BarraUC
                  key={u.id}
                  nome={u.nome}
                  faturaAtual={u.faturaSemLocacao}
                  residual={u.valorResidual}
                  locacao={u.custoComLocacao}
                  economia={u.economia}
                  altura={alturaBarra}
                  compacto={compacto}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= VANTAGENS =================
          Os mesmos três argumentos das peças originais da Em Conta
          (caixas de texto da aba "x Concorrente" da planilha). */}
      <section style={{ padding: "3mm 8mm 0" }}>
        <div style={{ display: "flex", gap: "3mm" }}>
          {[
            {
              titulo: "SEM INVESTIMENTO",
              texto: "Nenhuma obra e nenhum equipamento na sua unidade.",
            },
            {
              titulo: "SEM CUSTO DE ADESÃO",
              texto: "Contratação sem taxa e sem fidelidade de instalação.",
            },
            {
              titulo: "MAIOR ECONOMIA",
              texto: "Mais de 100 usinas em operação em Mato Grosso do Sul.",
            },
          ].map((v) => (
            <div
              key={v.titulo}
              style={{
                flex: 1,
                border: `1.2px solid ${BORDA}`,
                borderRadius: "3mm",
                padding: "2mm 3mm",
                display: "flex",
                gap: "2mm",
                alignItems: "flex-start",
                boxSizing: "border-box",
              }}
            >
              {/* Selo de "check" — vetorial, sem dependência de fonte de ícone. */}
              <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0, marginTop: "0.6mm" }}>
                <circle cx="8" cy="8" r="8" fill={VERDE} />
                <path
                  d="M4.2 8.3l2.5 2.5 5-5.4"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <div style={{ fontSize: "7pt", fontWeight: 800, color: AZUL }}>{v.titulo}</div>
                <div style={{ fontSize: "6pt", color: CINZA, lineHeight: 1.35 }}>{v.texto}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= OBSERVAÇÕES ================= */}
      <section style={{ padding: "3mm 8mm 0" }}>
        <ul style={{ margin: 0, paddingLeft: "4mm", listStyle: "none" }}>
          {config.observacoesProposta.map((obs) => (
            <li
              key={obs}
              style={{
                fontSize: "6.4pt",
                color: TEXTO,
                lineHeight: 1.5,
                position: "relative",
                paddingLeft: "3mm",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  top: "1.1mm",
                  width: "1.4mm",
                  height: "1.4mm",
                  borderRadius: "999px",
                  background: VERDE,
                  display: "block",
                }}
              />
              {obs}
            </li>
          ))}
        </ul>
      </section>

      {/* ================= RODAPÉ ================= */}
      <footer style={{ marginTop: "auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            padding: "0 8mm",
            gap: "4mm",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assets.mascote} alt="" style={{ height: "33mm" }} />

          <div style={{ textAlign: "right", paddingBottom: "3mm" }}>
            <div
              style={{
                fontSize: "9.5pt",
                fontWeight: 800,
                color: AZUL,
                lineHeight: 1.15,
                textTransform: "uppercase",
              }}
            >
              Fale com a gente e<br />
              comece a economizar
            </div>
            <div
              style={{
                display: "inline-block",
                marginTop: "1.5mm",
                background: AZUL,
                color: "#fff",
                borderRadius: "999px",
                padding: "1.6mm 6mm",
                fontSize: "13pt",
                fontWeight: 800,
                letterSpacing: "0.02em",
              }}
            >
              {config.institucional.whatsapp}
            </div>
            <div style={{ fontSize: "5.8pt", color: CINZA, marginTop: "1.5mm" }}>
              Emitida em {formatarData(cliente.dataProposta)} · Válida até{" "}
              {formatarData(validade)} ({cliente.validadeDias} dias)
            </div>
          </div>
        </div>

        {/* Barra azul com os logotipos */}
        <div
          style={{
            background: AZUL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10mm",
            padding: "3mm 8mm",
            marginTop: "2mm",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assets.logoEmContaBranco} alt="Em Conta" style={{ height: "8mm" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assets.logoCsiFiems} alt="CSI — Sistema FIEMS" style={{ height: "7mm" }} />
        </div>
      </footer>

      {/* Fio decorativo inferior */}
      <div style={{ height: "1.5mm", background: AZUL_ESCURO }} />
    </div>
  );
}
