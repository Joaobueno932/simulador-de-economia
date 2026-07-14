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
  type Papel,
  type Usuario,
} from "./types";

function usuario(papel: Papel, id = 1, over: Partial<Usuario> = {}): Usuario {
  return {
    id,
    nome: `Usuário ${id}`,
    email: `u${id}@emconta.com.br`,
    papel,
    instituicao: papel === "vendedor" ? "SEMAPA" : null,
    ativo: true,
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
