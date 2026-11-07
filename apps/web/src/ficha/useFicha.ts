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
  const enviadas = useRef<{ ops: OperacaoDeFicha[]; ate: number }[]>([]);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [versao, setVersao] = useState(0);
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
    void versao;
    const agora = Date.now();
    const vivas = enviadas.current.filter((e) => e.ate > agora).flatMap((e) => e.ops);
    const todas = [...vivas, ...fila.current];
    if (todas.length === 0) return base;
    const r = aplicarOperacoes(base, todas);
    return r.ok ? r.ficha : base;
    // `versao` muda a cada mudança local: a fila e as enviadas vivem em refs
  }, [base, versao]);
  const atual = useRef(calculada);
  atual.current = calculada;

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
      setVersao((n) => n + 1);
    }, VALIDADE_DO_ENVIADO_MS + 50);
    setVersao((n) => n + 1);
  }, []);

  const alterar = useCallback(
    (operacoes: OperacaoDeFicha[]): boolean => {
      if (!podeEditar || operacoes.length === 0) return false;
      if (!aplicarOperacoes(atual.current, operacoes).ok) return false;
      for (const op of operacoes) {
        const anterior = fila.current[fila.current.length - 1];
        // Digitando num campo: a última mudança do mesmo caminho é substituída.
        if (anterior && anterior.caminho === op.caminho) fila.current[fila.current.length - 1] = op;
        else fila.current.push(op);
      }
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(enviarAgora, ATRASO_DA_GRAVACAO_MS);
      setVersao((n) => n + 1);
      return true;
    },
    [podeEditar, enviarAgora],
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
