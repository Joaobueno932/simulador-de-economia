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

import { CONFIG } from "@/domain/simulator/config";
import {
  formatarData,
  formatarDecimal,
  formatarDocumento,
  formatarKwh,
  formatarMoeda,
  formatarPercentual,
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
const LARANJA = "#F08120";
const TEXTO = "#1C2B3A";
const CINZA = "#6B7A89";
const BORDA = "#D7E1EB";

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
 * Composição da fatura — o `chart1` da planilha (colunas empilhadas).
 *
 * A coluna "com Em Conta" tem o MESMO total da fatura atual: Energisa + Locação
 * + Economia. É isso que mostra a economia como a fatia poupada.
 */
function GraficoComposicao({ r }: { r: ResultadoSimulacao }) {
  const total = r.faturaAtual;

  const W = 46;
  const H = 52;
  const larguraBarra = 14;
  const x1 = 4;
  const x2 = 27;

  const escala = (v: number) => (total > 0 ? (v / total) * H : 0);

  const hEnergisa = escala(r.valorPagoDistribuidora);
  const hLocacao = escala(r.valorPagoLocador);
  const hEconomia = escala(r.economiaMensal);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H + 6}`}
      role="img"
      aria-label={`Composição da fatura. Fatura atual ${formatarMoeda(
        r.faturaAtual,
      )}. Com Em Conta: Energisa ${formatarMoeda(
        r.valorPagoDistribuidora,
      )}, locação ${formatarMoeda(r.valorPagoLocador)}, economia ${formatarMoeda(
        r.economiaMensal,
      )}.`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Coluna 1 — fatura atual, bloco único */}
      <rect x={x1} y={0} width={larguraBarra} height={H} rx={1} fill={AZUL} />
      <text
        x={x1 + larguraBarra / 2}
        y={H + 4}
        textAnchor="middle"
        fontSize="2.6"
        fontWeight="700"
        fill={CINZA}
        fontFamily={FONTE}
      >
        ATUAL
      </text>

      {/* Coluna 2 — empilhada: economia (topo), locação, energisa (base) */}
      <rect x={x2} y={0} width={larguraBarra} height={hEconomia} rx={1} fill={VERDE} />
      <rect x={x2} y={hEconomia} width={larguraBarra} height={hLocacao} fill={LARANJA} />
      <rect
        x={x2}
        y={hEconomia + hLocacao}
        width={larguraBarra}
        height={hEnergisa}
        rx={1}
        fill={AZUL}
      />
      <text
        x={x2 + larguraBarra / 2}
        y={H + 4}
        textAnchor="middle"
        fontSize="2.6"
        fontWeight="700"
        fill={CINZA}
        fontFamily={FONTE}
      >
        EM CONTA
      </text>
    </svg>
  );
}

/** Projeção de 5 anos por bandeira — o `chart2` da planilha (barras horizontais). */
function GraficoBandeiras({ r }: { r: ResultadoSimulacao }) {
  const linhas = [
    { rotulo: "Verde", valor: r.projecaoCincoAnos.verde, cor: VERDE },
    { rotulo: "Amarela", valor: r.projecaoCincoAnos.amarela, cor: "#F2C200" },
    { rotulo: "Vermelha P1", valor: r.projecaoCincoAnos.vermelhaP1, cor: LARANJA },
    { rotulo: "Vermelha P2", valor: r.projecaoCincoAnos.vermelhaP2, cor: "#D42A21" },
  ];
  const maximo = Math.max(...linhas.map((l) => l.valor), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.6mm" }}>
      {linhas.map((l) => (
        <div key={l.rotulo}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "0.5mm",
            }}
          >
            <span style={{ fontSize: "6.2pt", color: TEXTO, fontWeight: 600 }}>{l.rotulo}</span>
            <span style={{ fontSize: "6.6pt", fontWeight: 800, color: TEXTO }}>
              {formatarMoeda(l.valor)}
            </span>
          </div>
          <div
            style={{
              height: "2mm",
              width: "100%",
              background: "#EDF1F5",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(l.valor / maximo) * 100}%`,
                background: l.cor,
                borderRadius: "999px",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Proposta({
  cliente,
  r,
  assets = ASSETS_WEB,
}: {
  cliente: DadosCliente;
  r: ResultadoSimulacao;
  assets?: AssetsProposta;
}) {
  const validade = somarDias(cliente.dataProposta, cliente.validadeDias);

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
              DESCONTO {formatarPercentual(r.descontoMedio, 1)}
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

          {/* Composição da fatura + bandeiras */}
          <div
            style={{
              display: "flex",
              gap: "4mm",
              marginTop: "4mm",
              alignItems: "flex-start",
            }}
          >
            {/* Esquerda: gráfico empilhado + legenda */}
            <div style={{ width: "42mm", flexShrink: 0 }}>
              <GraficoComposicao r={r} />
            </div>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2.5mm" }}>
              <div>
                <div style={{ fontSize: "8.4pt", fontWeight: 800, color: LARANJA }}>
                  FATURA EM CONTA
                </div>
                <div style={{ fontSize: "12pt", fontWeight: 800, color: LARANJA }}>
                  {formatarMoeda(r.valorPagoLocador)}
                </div>
                <div style={{ fontSize: "5.8pt", color: CINZA }}>
                  Energia compensada com desconto
                </div>
              </div>

              <div>
                <div style={{ fontSize: "8.4pt", fontWeight: 800, color: AZUL }}>
                  FATURA {CONFIG.institucional.distribuidora.toUpperCase()}
                </div>
                <div style={{ fontSize: "12pt", fontWeight: 800, color: AZUL }}>
                  {formatarMoeda(r.valorPagoDistribuidora)}
                </div>
                <div style={{ fontSize: "5.8pt", color: CINZA }}>Taxa mínima + impostos + COSIP</div>
              </div>

              <div>
                <div style={{ fontSize: "8.4pt", fontWeight: 800, color: VERDE }}>SUA ECONOMIA</div>
                <div style={{ fontSize: "12pt", fontWeight: 800, color: VERDE }}>
                  {formatarMoeda(r.economiaMensal)}
                </div>
                <div style={{ fontSize: "5.8pt", color: CINZA }}>
                  {formatarPercentual(r.economiaPercentualEfetiva)} da fatura atual
                </div>
              </div>
            </div>

            {/* Direita: custos com bandeiras evitados */}
            <div
              style={{
                width: "64mm",
                flexShrink: 0,
                border: `1.2px solid ${VERDE_CLARO}`,
                borderRadius: "3mm",
                padding: "2.5mm",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  fontSize: "6.4pt",
                  fontWeight: 800,
                  color: VERDE,
                  textTransform: "uppercase",
                  marginBottom: "0.5mm",
                }}
              >
                Custos com bandeiras tarifárias evitados
              </div>
              <div style={{ fontSize: "5.6pt", color: CINZA, marginBottom: "2mm" }}>
                Previsão de economia em 5 anos
              </div>
              <GraficoBandeiras r={r} />
            </div>
          </div>

          {/* Rodapé do card: kWp e quota-parte */}
          <div
            style={{
              display: "flex",
              gap: "4mm",
              marginTop: "3.5mm",
              paddingTop: "2.5mm",
              borderTop: `1px solid ${BORDA}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "6.4pt",
                  fontWeight: 700,
                  color: CINZA,
                  textTransform: "uppercase",
                }}
              >
                Participação na associação
              </div>
              <div style={{ fontSize: "11pt", fontWeight: 800, color: VERDE }}>
                {formatarDecimal(r.equivalenteKwp)} kWp
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "6.4pt",
                  fontWeight: 700,
                  color: CINZA,
                  textTransform: "uppercase",
                }}
              >
                Quota-parte da potência da usina
              </div>
              <div style={{ fontSize: "11pt", fontWeight: 800, color: VERDE }}>
                {formatarPercentual(r.percentualPotenciaUsina)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "6.4pt",
                  fontWeight: 700,
                  color: CINZA,
                  textTransform: "uppercase",
                }}
              >
                Consumo compensável
              </div>
              <div style={{ fontSize: "11pt", fontWeight: 800, color: AZUL }}>
                {formatarKwh(r.consumoCompensavelMensal)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= VANTAGENS =================
          Os mesmos três argumentos das peças originais da Em Conta
          (caixas de texto da aba "x Concorrente" da planilha). */}
      <section style={{ padding: "4mm 8mm 0" }}>
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
                padding: "2.5mm 3mm",
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
          {CONFIG.observacoesProposta.map((obs) => (
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
          <img src={assets.mascote} alt="" style={{ height: "38mm" }} />

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
              {CONFIG.institucional.whatsapp}
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
