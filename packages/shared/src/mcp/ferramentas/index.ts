import type { Estado, Usuario } from "../../index.ts";
import { arquivos } from "./arquivos.ts";
import { automacoes } from "./automacoes.ts";
import type { QualquerFerramenta } from "./base.ts";
import { cenas } from "./cenas.ts";
import { chat } from "./chat.ts";
import { combate } from "./combate.ts";
import { compendio } from "./compendio.ts";
import { desfazer } from "./desfazer.ts";
import { fichas } from "./fichas.ts";
import { ler } from "./ler.ts";
import { mapa } from "./mapa.ts";
import { mesa } from "./mesa.ts";
import { musica } from "./musica.ts";
import { notas } from "./notas.ts";
import { objetos } from "./objetos.ts";
import { panorama } from "./panorama.ts";
import { rascunhos } from "./rascunhos.ts";
import { rolar } from "./rolar.ts";
import { som } from "./som.ts";
import { tokens } from "./tokens.ts";

/** Todas as ferramentas do MCP, na ordem em que aparecem para a IA. Não há ferramenta genérica ("mande qualquer intenção"). */
export const TODAS_AS_FERRAMENTAS: readonly QualquerFerramenta[] = [
  panorama,
  ler,
  fichas,
  compendio,
  notas,
  objetos,
  cenas,
  mapa,
  tokens,
  automacoes,
  combate,
  mesa,
  som,
  musica,
  chat,
  rolar,
  rascunhos,
  arquivos,
  desfazer,
];

/** As ferramentas que este usuário pode usar, pelo papel e pelas capacidades que a sala mostrou a ele. */
export function ferramentasVisiveis(estado: Estado, eu: Usuario): QualquerFerramenta[] {
  return TODAS_AS_FERRAMENTAS.filter((f) => f.visivel(estado, eu));
}

/** Só o panorama: o que aparece enquanto a conexão não está pronta (ou foi recusada) para a resposta dizer o porquê. */
export const FERRAMENTAS_SEM_CONEXAO: readonly QualquerFerramenta[] = [panorama];
