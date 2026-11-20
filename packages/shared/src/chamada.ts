import { z } from "zod";
import type { CodigoDeErro } from "./protocolo.ts";

// CH1: a chamada da mesa (voz e vídeo entre os navegadores). A sala só sinaliza: guarda quem está na chamada (na memória
// do socket da janela da chamada, que sobrevive à hibernação), repassa o "aperto de mão" do WebRTC (descrição e
// candidatos) entre dois participantes e esquece. Nada disto vai ao estado, ao banco, ao histórico, ao desfazer, à
// exportação nem ao snapshot guardado. O vídeo e a voz vão direto entre os computadores; nunca passam pela sala.

/** A malha é ponto a ponto: cada pessoa a mais cria uma conexão com cada uma das outras. O limite é 8 (assumido). */
export const MAXIMO_NA_CHAMADA = 8;
/** O maior SDP aceito (uma oferta com áudio e vídeo tem 3 a 8 mil caracteres). */
export const TAMANHO_MAXIMO_DO_SDP = 16_000;
export const TAMANHO_MAXIMO_DO_CANDIDATO = 1_000;
/** Chamar a mesma pessoa de novo só depois disto. */
export const INTERVALO_MINIMO_DO_CHAMADO_MS = 10_000;

export const FUNDOS_DA_CHAMADA = ["nenhum", "desfocar", "forte"] as const;
export const FundoDaChamadaSchema = z.enum(FUNDOS_DA_CHAMADA);
export type FundoDaChamada = z.infer<typeof FundoDaChamadaSchema>;

/** O que cada um mostra aos outros: aparece na janela da chamada, nunca decide nada na sala. */
export const EstadoNaChamadaSchema = z.object({
  microfone: z.boolean(),
  camera: z.boolean(),
  fundo: FundoDaChamadaSchema,
  /** "Parar de ouvir": silencia tudo o que chega e o próprio microfone. */
  surdo: z.boolean(),
});
export type EstadoNaChamada = z.infer<typeof EstadoNaChamadaSchema>;

export const DadosDeEntrarNaChamadaSchema = z.object({
  microfone: z.boolean(),
  camera: z.boolean(),
  /** Entrou "só ouvindo": sem enviar nada (a pessoa vê e ouve os outros). */
  soOuvindo: z.boolean(),
  /** CH3: "Não gravar a minha voz" já marcado na tela de antes de entrar (sem isto a voz começaria gravada). */
  naoGravar: z.boolean().optional(),
});
export type DadosDeEntrarNaChamada = z.infer<typeof DadosDeEntrarNaChamadaSchema>;

export const DescricaoDeSinalSchema = z.object({
  tipo: z.enum(["offer", "answer"]),
  sdp: z.string().max(TAMANHO_MAXIMO_DO_SDP),
});
export const CandidatoDeSinalSchema = z.object({
  candidate: z.string().max(TAMANHO_MAXIMO_DO_CANDIDATO),
  sdpMid: z.string().max(64).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
});

/** Um sinal do aperto de mão: exatamente uma das duas partes (`descricao` ou `candidato`). */
export const DadosDeSinalSchema = z
  .object({
    para: z.string().min(1).max(64),
    descricao: DescricaoDeSinalSchema.optional(),
    candidato: CandidatoDeSinalSchema.optional(),
  })
  .refine((d) => (d.descricao === undefined) !== (d.candidato === undefined), {
    message: "Mande a descrição ou o candidato, não os dois nem nenhum.",
  });
export type DadosDeSinal = z.infer<typeof DadosDeSinalSchema>;

/** Quem está na chamada, como todos da mesa o veem. */
export const ParticipanteDaChamadaSchema = EstadoNaChamadaSchema.extend({
  usuarioId: z.string().min(1).max(64),
  soOuvindo: z.boolean(),
  /**
   * CH3: o mestre desta conexão está gravando a sessão para a transcrição. Só vale para o mestre; a gravação existe
   * enquanto o mestre está na chamada com isto ligado (fechar a janela, sair ou recarregar a página a encerra).
   */
  gravando: z.boolean(),
  /** CH3: "Não gravar a minha voz": cada um tira só a própria voz da gravação. */
  naoGravar: z.boolean(),
});
export type ParticipanteDaChamada = z.infer<typeof ParticipanteDaChamadaSchema>;

/** Uma participação, como a sala a guarda no socket da janela da chamada (sobrevive à hibernação). */
export type EntradaNaChamada = ParticipanteDaChamada & { conexaoId: string };

type Erro = { codigo: CodigoDeErro; mensagem: string };
export type SaidaDaChamada<T> =
  | ({ erro: Erro } & { [K in keyof T]?: undefined })
  | ({ erro?: undefined } & T);

// biome-ignore lint/suspicious/noExplicitAny: a forma de erro serve a qualquer saída (os campos do sucesso ficam ausentes)
const erro = (codigo: CodigoDeErro, mensagem: string): any => ({
  erro: { codigo, mensagem },
});

/** O que a sala difunde: sem a conexão, só a pessoa e o estado dela, na ordem de entrada. */
export function visaoDaChamada(entradas: readonly EntradaNaChamada[]): ParticipanteDaChamada[] {
  return entradas.map(({ conexaoId: _c, ...resto }) => resto);
}

/**
 * Entrar na chamada. Só membro da mesa. Quem já está (em outra janela ou aparelho) é substituído: a conexão antiga sai e
 * recebe o aviso. A 9ª pessoa leva "chamada cheia". Entrar de novo pela mesma conexão só atualiza o estado.
 */
export function entrarNaChamada(
  entradas: readonly EntradaNaChamada[],
  quem: { usuarioId: string; conexaoId: string; membro: boolean; claude?: boolean },
  dados: DadosDeEntrarNaChamada,
): SaidaDaChamada<{ entradas: EntradaNaChamada[]; substituidas: string[] }> {
  if (quem.claude || !quem.membro) {
    return erro("sem_permissao", "Só quem é da mesa entra na chamada.");
  }
  const substituidas = entradas
    .filter((e) => e.usuarioId === quem.usuarioId && e.conexaoId !== quem.conexaoId)
    .map((e) => e.conexaoId);
  const restantes = entradas.filter((e) => !substituidas.includes(e.conexaoId));
  const jaEstava = restantes.some((e) => e.conexaoId === quem.conexaoId);
  if (!jaEstava && restantes.length >= MAXIMO_NA_CHAMADA) {
    return erro("chamada_cheia", `A chamada está cheia (${MAXIMO_NA_CHAMADA}).`);
  }
  const nova: EntradaNaChamada = {
    conexaoId: quem.conexaoId,
    usuarioId: quem.usuarioId,
    microfone: dados.soOuvindo ? false : dados.microfone,
    camera: dados.soOuvindo ? false : dados.camera,
    fundo: "nenhum",
    surdo: false,
    soOuvindo: dados.soOuvindo,
    // Quem entra começa gravado (se a gravação está ligada), a menos que já tenha marcado "Não gravar" na tela de antes de entrar.
    gravando: false,
    naoGravar: dados.naoGravar === true,
  };
  const novas = jaEstava
    ? restantes.map((e) => (e.conexaoId === quem.conexaoId ? nova : e))
    : [...restantes, nova];
  return { entradas: novas, substituidas };
}

/** Mudar o próprio estado (microfone, câmera, fundo, surdo): só de quem está na chamada. */
export function mudarEstadoNaChamada(
  entradas: readonly EntradaNaChamada[],
  conexaoId: string,
  estado: EstadoNaChamada,
): SaidaDaChamada<{ entradas: EntradaNaChamada[] }> {
  if (!entradas.some((e) => e.conexaoId === conexaoId)) {
    return erro("fora_da_chamada", "Você não está na chamada.");
  }
  return {
    entradas: entradas.map((e) =>
      e.conexaoId === conexaoId
        ? e.soOuvindo
          ? { ...e, fundo: "nenhum", surdo: estado.surdo }
          : { ...e, ...estado }
        : e,
    ),
  };
}

// --- a gravação para a transcrição (CH3) -------------------------------------------------------------------------

/** A gravação está ligada? (O mestre na chamada com `gravando`.) Quem não está na chamada, ou entrou depois, também vê. */
export function gravacaoLigada(
  participantes: readonly Pick<ParticipanteDaChamada, "gravando">[],
): boolean {
  return participantes.some((p) => p.gravando);
}

/** Os ids de quem ficou de fora da gravação (não tem a voz gravada). */
export function quemFicouDeFora(
  participantes: readonly Pick<ParticipanteDaChamada, "usuarioId" | "naoGravar">[],
): string[] {
  return participantes.filter((p) => p.naoGravar).map((p) => p.usuarioId);
}

/**
 * Ligar ou desligar a gravação: **só o mestre**, e só de dentro da chamada. A sala confere o papel (`ehMestre`); o cliente
 * nunca decide. Só uma conexão grava por vez: ligar numa conexão desliga a de outra (a mesma pessoa em duas janelas).
 */
export function ligarGravacao(
  entradas: readonly EntradaNaChamada[],
  conexaoId: string,
  ehMestre: boolean,
  ligada: boolean,
): SaidaDaChamada<{ entradas: EntradaNaChamada[] }> {
  if (!entradas.some((e) => e.conexaoId === conexaoId)) {
    return erro("fora_da_chamada", "Você não está na chamada.");
  }
  if (!ehMestre) return erro("sem_permissao", "Só o mestre liga a gravação.");
  return {
    entradas: entradas.map((e) => ({
      ...e,
      gravando: e.conexaoId === conexaoId ? ligada : false,
    })),
  };
}

/** "Não gravar a minha voz": cada um muda só a própria marca (a da conexão que pediu). */
export function tirarMinhaVoz(
  entradas: readonly EntradaNaChamada[],
  conexaoId: string,
  fora: boolean,
): SaidaDaChamada<{ entradas: EntradaNaChamada[] }> {
  if (!entradas.some((e) => e.conexaoId === conexaoId)) {
    return erro("fora_da_chamada", "Você não está na chamada.");
  }
  return {
    entradas: entradas.map((e) => (e.conexaoId === conexaoId ? { ...e, naoGravar: fora } : e)),
  };
}

export function sairDaChamada(
  entradas: readonly EntradaNaChamada[],
  conexaoId: string,
): EntradaNaChamada[] {
  return entradas.filter((e) => e.conexaoId !== conexaoId);
}

/**
 * Quem recebe o sinal: a conexão de quem está na chamada com o usuário `para`. Barra quem manda de fora da chamada, o
 * sinal para si mesmo e o sinal para quem não está na chamada. A sala carimba o `de`; o cliente nunca o escolhe.
 */
export function destinoDoSinal(
  entradas: readonly EntradaNaChamada[],
  de: { conexaoId: string },
  para: string,
): SaidaDaChamada<{ destino: EntradaNaChamada; origem: EntradaNaChamada }> {
  const origem = entradas.find((e) => e.conexaoId === de.conexaoId);
  if (!origem) return erro("fora_da_chamada", "Você não está na chamada.");
  if (origem.usuarioId === para) return erro("dados_invalidos", "Sinal para si mesmo.");
  const destino = entradas.find((e) => e.usuarioId === para);
  if (!destino) return erro("fora_da_chamada", "Essa pessoa não está na chamada.");
  return { destino, origem };
}

/** Chamar quem está na mesa e fora da chamada: de dentro da chamada, a um membro que não está nela. */
export function podeChamar(
  entradas: readonly EntradaNaChamada[],
  de: { conexaoId: string },
  para: { usuarioId: string; membro: boolean },
): SaidaDaChamada<{ de: EntradaNaChamada }> {
  const origem = entradas.find((e) => e.conexaoId === de.conexaoId);
  if (!origem) return erro("fora_da_chamada", "Você não está na chamada.");
  if (!para.membro || para.usuarioId === origem.usuarioId) {
    return erro("dados_invalidos", "Essa pessoa não pode ser chamada.");
  }
  if (entradas.some((e) => e.usuarioId === para.usuarioId)) {
    return erro("dados_invalidos", "Essa pessoa já está na chamada.");
  }
  return { de: origem };
}

/** Chamar a mesma pessoa de novo só depois do intervalo. `ultimoMs`: o último chamado a ela (por quem chamou). */
export function chamadoDentroDoLimite(ultimoMs: number | undefined, agoraMs: number): boolean {
  return ultimoMs === undefined || agoraMs - ultimoMs >= INTERVALO_MINIMO_DO_CHAMADO_MS;
}

// --- o limite de frequência dos sinais (um balde por conexão) ---------------------------------------------------

/** Rajada e ritmo: um aperto de mão com 7 pessoas manda dezenas de candidatos de uma vez. */
export const LIMITE_DE_SINAIS = { rajada: 120, porSegundo: 60 } as const;
export type BaldeDeSinais = { fichas: number; em: number };

export function gastarSinal(
  balde: BaldeDeSinais | undefined,
  agoraMs: number,
): { ok: boolean; balde: BaldeDeSinais } {
  const antes = balde ?? { fichas: LIMITE_DE_SINAIS.rajada, em: agoraMs };
  const passou = Math.max(0, agoraMs - antes.em) / 1000;
  const fichas = Math.min(
    LIMITE_DE_SINAIS.rajada,
    antes.fichas + passou * LIMITE_DE_SINAIS.porSegundo,
  );
  if (fichas < 1) return { ok: false, balde: { fichas, em: agoraMs } };
  return { ok: true, balde: { fichas: fichas - 1, em: agoraMs } };
}
