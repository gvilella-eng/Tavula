import {
  aplicarOperacoes,
  type Ficha,
  fichaNova,
  MAXIMO_DE_OPERACOES,
  type OperacaoDeFicha,
  type Personagem,
} from "@tabletop/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Enviar = (tipo: string, dados: object) => string | null;

/** O navegador junta as mudanças por este tempo antes de mandar `ficha.alterar` (Lote 9). */
export const ATRASO_DA_GRAVACAO_MS = 400;
/** Quanto tempo o que já foi enviado continua valendo na tela enquanto o eco da sala não chega. */
const VALIDADE_DO_ENVIADO_MS = 2500;
const FICHA_VAZIA = fichaNova(0);

/**
 * A fila de operações com as `operacoes` novas no fim (sem alterar a de entrada). Digitando num campo, a nova operação
 * com o mesmo `caminho` da última da fila a substitui, em vez de se somar a ela.
 */
export function filaCom(
  fila: readonly OperacaoDeFicha[],
  operacoes: readonly OperacaoDeFicha[],
): OperacaoDeFicha[] {
  const nova = [...fila];
  for (const op of operacoes) {
    const anterior = nova[nova.length - 1];
    if (anterior && anterior.caminho === op.caminho) nova[nova.length - 1] = op;
    else nova.push(op);
  }
  return nova;
}

type Enviada = { ops: OperacaoDeFicha[]; ate: number };

/** As operações já enviadas que ainda valem por cima da ficha da sala (o eco ainda não chegou). */
export function vivasDe(enviadas: readonly Enviada[], agora: number): OperacaoDeFicha[] {
  return enviadas.filter((e) => e.ate > agora).flatMap((e) => e.ops);
}

/**
 * Tenta registrar `operacoes`: monta a fila nova e aplica UMA vez (`vivas` + fila) sobre a ficha da sala, que é o que a
 * tela vai mostrar. Se o resultado for inválido, recusa e a fila de entrada fica como estava.
 */
export function proporOperacoes(
  base: Ficha,
  vivas: readonly OperacaoDeFicha[],
  fila: readonly OperacaoDeFicha[],
  operacoes: readonly OperacaoDeFicha[],
): { ok: true; fila: OperacaoDeFicha[]; ficha: Ficha } | { ok: false } {
  const nova = filaCom(fila, operacoes);
  const r = aplicarOperacoes(base, [...vivas, ...nova]);
  return r.ok ? { ok: true, fila: nova, ficha: r.ficha } : { ok: false };
}

export type FichaEditavel = {
  /** A ficha como a tela mostra: a da sala com as mudanças ainda não confirmadas por cima. */
  ficha: Ficha;
  /**
   * Registra mudanças. Devolve `false` (e não registra nada) se o resultado seria uma ficha inválida:
   * assim um campo meio digitado nunca derruba o lote inteiro na sala.
   */
  alterar: (operacoes: OperacaoDeFicha[]) => boolean;
  /** Manda agora o que está esperando. */
  enviarAgora: () => void;
  /** Há mudanças esperando para ir ou ainda sem confirmação da sala? */
  pendente: boolean;
};

/**
 * Edição da ficha com gravação agrupada: cada mudança aparece na hora (aplicada sobre a ficha da sala)
 * e, depois de ~400 ms sem novas mudanças, vai numa única `ficha.alterar` com a lista de operações.
 * Duas pessoas no mesmo campo: vale a última a chegar na sala.
 */
export function useFichaEditavel(
  personagem: Personagem,
  enviar: Enviar,
  podeEditar: boolean,
): FichaEditavel {
  const base = personagem.ficha ?? FICHA_VAZIA;
  const baseRef = useRef(base);
  const fila = useRef<OperacaoDeFicha[]>([]);
  const enviadas = useRef<Enviada[]>([]);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [versao, setVersao] = useState(0);
  // A versão que o próximo render terá (o `setVersao` sempre grava este valor): a prévia de `alterar` se prende a ela.
  const versaoRef = useRef(0);
  // A ficha que `alterar` já calculou ao validar: o `useMemo` a reaproveita (uma validação por tecla, não duas).
  const previa = useRef<{ base: Ficha; versao: number; ficha: Ficha } | null>(null);
  const subirAVersao = useCallback(() => {
    versaoRef.current += 1;
    setVersao(versaoRef.current);
    return versaoRef.current;
  }, []);
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;
  const idRef = useRef(personagem.id);
  idRef.current = personagem.id;

  // A sala devolveu a ficha (o eco do que mandei ou a mudança de outra pessoa): o que foi enviado já
  // está nela, então deixa de valer por cima.
  if (baseRef.current !== base) {
    baseRef.current = base;
    enviadas.current = [];
  }

  const calculada = useMemo(() => {
    // Prévia de `alterar` para esta base e esta versão: já é o resultado de `vivas + fila`, sem validar de novo.
    const p = previa.current;
    if (p && p.base === base && p.versao === versao) return p.ficha;
    const vivas = vivasDe(enviadas.current, Date.now());
    const todas = [...vivas, ...fila.current];
    if (todas.length === 0) return base;
    const r = aplicarOperacoes(base, todas);
    return r.ok ? r.ficha : base;
    // `versao` muda a cada mudança local: a fila e as enviadas vivem em refs
  }, [base, versao]);
  const enviarAgora = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = undefined;
    const ops = fila.current;
    if (ops.length === 0) return;
    fila.current = [];
    for (let i = 0; i < ops.length; i += MAXIMO_DE_OPERACOES) {
      const lote = ops.slice(i, i + MAXIMO_DE_OPERACOES);
      enviarRef.current("ficha.alterar", { personagemId: idRef.current, operacoes: lote });
    }
    enviadas.current = [...enviadas.current, { ops, ate: Date.now() + VALIDADE_DO_ENVIADO_MS }];
    // Se a sala recusar (ou o eco não vier), o que foi enviado deixa de valer e a tela volta ao dela.
    setTimeout(() => {
      enviadas.current = enviadas.current.filter((e) => e.ate > Date.now());
      subirAVersao();
    }, VALIDADE_DO_ENVIADO_MS + 50);
    subirAVersao();
  }, [subirAVersao]);

  const alterar = useCallback(
    (operacoes: OperacaoDeFicha[]): boolean => {
      if (!podeEditar || operacoes.length === 0) return false;
      // Uma validação só por tecla: o resultado vira a prévia que o próximo render mostra.
      const r = proporOperacoes(
        baseRef.current,
        vivasDe(enviadas.current, Date.now()),
        fila.current,
        operacoes,
      );
      if (!r.ok) return false;
      fila.current = r.fila;
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(enviarAgora, ATRASO_DA_GRAVACAO_MS);
      previa.current = { base: baseRef.current, versao: subirAVersao(), ficha: r.ficha };
      return true;
    },
    [podeEditar, enviarAgora, subirAVersao],
  );

  // Fechar a janela (ou trocar de personagem) manda o que sobrou.
  useEffect(() => () => enviarAgora(), [enviarAgora]);

  return {
    ficha: calculada,
    alterar,
    enviarAgora,
    pendente: fila.current.length > 0 || enviadas.current.length > 0,
  };
}
