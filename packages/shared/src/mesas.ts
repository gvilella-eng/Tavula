import type { Estado, Usuario } from "./estado.ts";
import { CENA_PADRAO } from "./mapa.ts";
import { estadoInicial } from "./semente.ts";

/**
 * Id amigável da mesa (C1): 12 caracteres de um alfabeto sem ambíguos (minúsculas e dígitos, sem
 * `0 o 1 l i`), em 3 grupos de 4: `k7m2-qx9p-4tdn`. 31 símbolos ≈ 59 bits: não dá para adivinhar
 * (quem sabe o id entra na porta da mesa, a conta vem no C2).
 */
export const ALFABETO_DO_ID_DE_MESA = "abcdefghjkmnpqrstuvwxyz23456789";
const TAMANHO_DO_ID = 12;

/** Id fixo da mesa legada em `MODO=teste` (os E2E sabem qual é). Válido no formato. */
export const ID_DA_MESA_LEGADA_DE_TESTE = "t3st-m3sa-e2e7";
/** Nome do Durable Object da campanha de sempre: a "mesa legada". Nunca muda. */
export const DO_DA_MESA_LEGADA = "campanha";
/** Nome que a mesa legada recebe no diretório (assumido; o mestre pode renomear). */
export const NOME_DA_MESA_LEGADA = "Campanha";
/** Prefixo do nome do Durable Object de uma mesa criada pelo diretório. */
export const PREFIXO_DO_DE_MESA = "mesa:";
export const TAMANHO_MAXIMO_DO_NOME_DA_MESA = 60;

/** Fonte de bytes aleatórios (`crypto.getRandomValues` por padrão); os testes passam uma sequência fixa. */
export type BytesAleatorios = (quantidade: number) => Uint8Array;

const bytesDoCrypto: BytesAleatorios = (n) => crypto.getRandomValues(new Uint8Array(n));

/**
 * Sorteia um id de mesa, sem viés: um byte só vale se for menor que o maior múltiplo de 31 que cabe em
 * 256 (248); senão é descartado e sorteia outro.
 */
export function gerarIdDeMesa(aleatorio: BytesAleatorios = bytesDoCrypto): string {
  const base = ALFABETO_DO_ID_DE_MESA.length;
  const limite = 256 - (256 % base);
  let letras = "";
  while (letras.length < TAMANHO_DO_ID) {
    for (const b of aleatorio(TAMANHO_DO_ID * 2)) {
      if (b >= limite) continue;
      letras += ALFABETO_DO_ID_DE_MESA[b % base];
      if (letras.length === TAMANHO_DO_ID) break;
    }
  }
  return formatarId(letras);
}

function formatarId(letras: string): string {
  return `${letras.slice(0, 4)}-${letras.slice(4, 8)}-${letras.slice(8)}`;
}

const SO_LETRAS_DO_ALFABETO = new RegExp(`^[${ALFABETO_DO_ID_DE_MESA}]{${TAMANHO_DO_ID}}$`);

/**
 * Aceita o id como o jogador o digita ou cola: maiúsculas, espaços, sem hífens ou o link inteiro
 * (`http://.../m/k7m2-qx9p-4tdn`). Devolve a forma canônica ou `null`.
 */
export function normalizarIdDeMesa(texto: string): string | null {
  if (typeof texto !== "string" || texto.length > 2000) return null;
  let t = texto.trim().toLowerCase();
  const i = t.lastIndexOf("/m/");
  if (i >= 0) t = t.slice(i + 3);
  t = t.split(/[?#/]/)[0] ?? "";
  const letras = t.replace(/[\s-]/g, "");
  return SO_LETRAS_DO_ALFABETO.test(letras) ? formatarId(letras) : null;
}

/** O texto já está na forma canônica de um id de mesa? */
export function ehIdDeMesa(texto: string): boolean {
  return typeof texto === "string" && normalizarIdDeMesa(texto) === texto;
}

/** Nome da mesa: sem espaços nas pontas nem caracteres de controle, de 1 a 60 caracteres; senão `null`. */
export function nomeDeMesaValido(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const semControles = [...texto]
    .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c))
    .join("");
  const limpo = semControles.replace(/\s+/g, " ").trim();
  return limpo.length >= 1 && limpo.length <= TAMANHO_MAXIMO_DO_NOME_DA_MESA ? limpo : null;
}

/** O que o Worker e a tela sabem de uma mesa (nunca mais que isso numa consulta pelo id). */
export type ResumoDaMesa = { id: string; nome: string };

/** Usuários de uma mesa nova: só o mestre; cada jogador entra com a conta dele (V7, 2026-11-12). */
export const USUARIOS_DA_MESA_NOVA: Usuario[] = [
  { id: "mestre", nome: "Mestre", papel: "mestre", cor: "#d4a017" },
];

/** Estado de uma mesa nova: vazia (cena em branco, sem fichas nem tokens), não a semente de exemplo. */
export function estadoDeMesaNova(agoraMs: number = Date.now()): Estado {
  return estadoInicial({ usuarios: USUARIOS_DA_MESA_NOVA, cenas: [CENA_PADRAO] }, agoraMs);
}
