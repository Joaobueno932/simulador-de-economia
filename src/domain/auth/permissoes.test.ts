import { describe, expect, it } from "vitest";

import {
  INSTITUICOES,
  papeisQuePodeCriar,
  podeAdministrar,
  podeCriarPapel,
  podeEditarConfiguracoes,
  podeEditarDescontoLivremente,
  podeEmitirSenhaDesconto,
  podeEscolherConsultor,
  podeGerenciarUsuario,
  podeResetarSenha,
  podeVerHistoricoDeTodos,
  podeVerProposta,
  SENHA_PADRAO,
  type Papel,
  type Usuario,
} from "./types";

function usuario(papel: Papel, id = 1, over: Partial<Usuario> = {}): Usuario {
  return {
    id,
    nome: `Usuário ${id}`,
    email: `u${id}@emconta.com.br`,
    papel,
    instituicoes: papel === "vendedor" ? ["SEMAPA"] : [],
    ativo: true,
    senhaProvisoria: false,
    temFoto: false,
    ...over,
  };
}

describe("papéis", () => {
  it("admin e gestor administram; vendedor não", () => {
    expect(podeAdministrar("admin")).toBe(true);
    expect(podeAdministrar("gestor")).toBe(true);
    expect(podeAdministrar("vendedor")).toBe(false);
  });

  it("as instituições são exatamente SEMAPA, FIEMS e ADILSON", () => {
    expect([...INSTITUICOES]).toEqual(["SEMAPA", "FIEMS", "ADILSON"]);
  });
});

describe("criação de usuários", () => {
  it("admin cria qualquer papel", () => {
    expect(papeisQuePodeCriar("admin")).toEqual(["admin", "gestor", "vendedor"]);
    expect(podeCriarPapel("admin", "gestor")).toBe(true);
    expect(podeCriarPapel("admin", "admin")).toBe(true);
  });

  it("gestor cria SOMENTE vendedores — não pode se promover nem criar pares", () => {
    expect(papeisQuePodeCriar("gestor")).toEqual(["vendedor"]);
    expect(podeCriarPapel("gestor", "vendedor")).toBe(true);
    expect(podeCriarPapel("gestor", "gestor")).toBe(false);
    expect(podeCriarPapel("gestor", "admin")).toBe(false);
  });

  it("vendedor não cria ninguém", () => {
    expect(papeisQuePodeCriar("vendedor")).toEqual([]);
    expect(podeCriarPapel("vendedor", "vendedor")).toBe(false);
  });
});

describe("gestão de usuários existentes", () => {
  const admin = usuario("admin", 1);
  const gestor = usuario("gestor", 2);
  const outroGestor = usuario("gestor", 3);
  const vendedor = usuario("vendedor", 4);

  it("ninguém altera a própria conta por essa tela", () => {
    expect(podeGerenciarUsuario(admin, admin)).toBe(false);
    expect(podeGerenciarUsuario(gestor, gestor)).toBe(false);
  });

  it("admin gerencia qualquer um (menos ele mesmo)", () => {
    expect(podeGerenciarUsuario(admin, gestor)).toBe(true);
    expect(podeGerenciarUsuario(admin, vendedor)).toBe(true);
  });

  it("gestor gerencia só vendedores", () => {
    expect(podeGerenciarUsuario(gestor, vendedor)).toBe(true);
    expect(podeGerenciarUsuario(gestor, outroGestor)).toBe(false);
    expect(podeGerenciarUsuario(gestor, admin)).toBe(false);
  });

  it("vendedor não gerencia ninguém", () => {
    expect(podeGerenciarUsuario(vendedor, usuario("vendedor", 5))).toBe(false);
    expect(podeGerenciarUsuario(vendedor, gestor)).toBe(false);
  });
});

describe("configurações", () => {
  it("só admin e gestor editam", () => {
    expect(podeEditarConfiguracoes("admin")).toBe(true);
    expect(podeEditarConfiguracoes("gestor")).toBe(true);
    expect(podeEditarConfiguracoes("vendedor")).toBe(false);
  });
});

describe("desconto", () => {
  it("admin e gestor editam livremente; vendedor não", () => {
    expect(podeEditarDescontoLivremente("admin")).toBe(true);
    expect(podeEditarDescontoLivremente("gestor")).toBe(true);
    expect(podeEditarDescontoLivremente("vendedor")).toBe(false);
  });

  it("só admin e gestor emitem a senha de liberação", () => {
    expect(podeEmitirSenhaDesconto("admin")).toBe(true);
    expect(podeEmitirSenhaDesconto("gestor")).toBe(true);
    expect(podeEmitirSenhaDesconto("vendedor")).toBe(false);
  });
});

describe("consultor da proposta", () => {
  it("admin e gestor escolhem o vendedor; vendedor emite em nome próprio", () => {
    expect(podeEscolherConsultor("admin")).toBe(true);
    expect(podeEscolherConsultor("gestor")).toBe(true);
    expect(podeEscolherConsultor("vendedor")).toBe(false);
  });
});

describe("dashboard e histórico", () => {
  it("só admin e gestor veem a trilha de todos", () => {
    expect(podeVerHistoricoDeTodos("admin")).toBe(true);
    expect(podeVerHistoricoDeTodos("gestor")).toBe(true);
    expect(podeVerHistoricoDeTodos("vendedor")).toBe(false);
  });

  it("só admin e gestor redefinem senha", () => {
    expect(podeResetarSenha("admin")).toBe(true);
    expect(podeResetarSenha("gestor")).toBe(true);
    expect(podeResetarSenha("vendedor")).toBe(false);
  });
});

describe("acesso a uma proposta emitida", () => {
  const admin = usuario("admin", 1);
  const gestor = usuario("gestor", 2);
  const vendedor = usuario("vendedor", 4);
  const outroVendedor = usuario("vendedor", 5);

  it("admin e gestor veem qualquer proposta", () => {
    const alheia = { usuarioId: 99, vendedorId: 98 };
    expect(podeVerProposta(admin, alheia)).toBe(true);
    expect(podeVerProposta(gestor, alheia)).toBe(true);
  });

  it("vendedor vê a proposta que ele mesmo gerou", () => {
    expect(podeVerProposta(vendedor, { usuarioId: 4, vendedorId: 4 })).toBe(true);
  });

  it("vendedor vê a proposta que o gestor emitiu EM NOME DELE", () => {
    // O gestor (id 2) gerou, mas a proposta saiu no nome do vendedor (id 4).
    expect(podeVerProposta(vendedor, { usuarioId: 2, vendedorId: 4 })).toBe(true);
  });

  it("vendedor NÃO vê a proposta de outro vendedor", () => {
    expect(podeVerProposta(outroVendedor, { usuarioId: 4, vendedorId: 4 })).toBe(false);
  });
});

describe("senha padrão", () => {
  it("é 'senha123' e tem o mínimo de 8 caracteres exigido no cadastro", () => {
    expect(SENHA_PADRAO).toBe("senha123");
    expect(SENHA_PADRAO.length).toBeGreaterThanOrEqual(8);
  });
});

describe("instituições", () => {
  it("um vendedor pode ter mais de uma", () => {
    const v = usuario("vendedor", 7, { instituicoes: ["SEMAPA", "FIEMS"] });
    expect(v.instituicoes).toHaveLength(2);
  });

  it("admin e gestor não têm instituição", () => {
    expect(usuario("admin").instituicoes).toEqual([]);
    expect(usuario("gestor").instituicoes).toEqual([]);
  });
});
