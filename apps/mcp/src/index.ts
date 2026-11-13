#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Estado, Usuario } from "@tabletop/shared";
import { z } from "zod";
import { CompendioLocal } from "./compendioLocal.ts";
import { type Config, lerConfig } from "./config.ts";
import { ErroDoMcp } from "./erros.ts";
import { Sala } from "./sala.ts";
import { criarServidor } from "./servidor.ts";

// As mensagens de validação do zod saem em português (valem só neste processo).
z.config(z.locales.ptBR());

/** Escreve em stderr (o stdout é do protocolo MCP). Nunca recebe o token. */
function registrar(texto: string): void {
  console.error(`[tavola-mcp] ${texto}`);
}

/** Sem configuração válida o servidor sobe do mesmo jeito: a ferramenta `panorama` responde o que falta ajustar. */
function conexaoQuebrada(erro: ErroDoMcp) {
  const falhar = (): never => {
    throw erro;
  };
  return {
    estado: falhar as () => Estado,
    eu: falhar as () => Usuario,
    lotes: () => [],
    enviar: async () => {
      throw erro;
    },
    esperarPronto: async () => {
      throw erro;
    },
    estadoOuNulo: () => null,
    parar: () => undefined,
  };
}

async function principal(): Promise<void> {
  let config: Config | null = null;
  let falha: ErroDoMcp | null = null;
  try {
    config = lerConfig(process.env);
  } catch (e) {
    if (!(e instanceof ErroDoMcp)) throw e;
    falha = e;
    registrar(e.message);
  }
  const compendio = CompendioLocal.carregar(
    config?.compendio ?? process.env.TAVOLA_COMPENDIO ?? null,
  );

  let avisar: () => void = () => undefined;
  const conexao =
    config !== null
      ? new Sala(config, { registrar, aoMudar: () => avisar() })
      : conexaoQuebrada(falha as ErroDoMcp);
  const { servidor, avisarMudanca } = criarServidor(conexao, compendio);
  avisar = avisarMudanca;

  await servidor.connect(new StdioServerTransport());
  if (conexao instanceof Sala) conexao.iniciar();

  const encerrar = () => {
    conexao.parar();
    process.exit(0);
  };
  process.stdin.on("close", encerrar);
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}

principal().catch((e: unknown) => {
  registrar(`falhou ao iniciar: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
