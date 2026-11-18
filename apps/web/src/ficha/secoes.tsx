import type { Ficha, FichaDerivada } from "@tabletop/shared";
import { type ComponentType, memo } from "react";

/**
 * Q14: as seções da ficha em `memo`, cada uma com as fatias que lê. A ficha de cada tecla compartilha estrutura com a
 * anterior (`compartilharEstrutura`, em `@tabletop/shared`), então `ficha.atributos`, `ficha.itens` etc. mantêm a
 * mesma referência enquanto não mudam, e `d` (as derivadas) também. A seção só se redesenha quando muda uma das
 * chaves declaradas ou uma prop que não seja `ficha` nem `d` (por isso `alterar`, `rolador`, `ordem`... entram na
 * janela com identidade estável).
 *
 * Frágil: quem passar a ler outra chave da ficha ou de `d` dentro de uma seção precisa acrescentá-la à declaração
 * dela; senão a seção fica velha ao mudar só essa chave.
 */

type Props = {
  ficha?: Ficha | undefined;
  d?: FichaDerivada | undefined;
  [chave: string]: unknown;
};

export type Fatias<P extends Props = Props> = {
  /**
   * As chaves da ficha que a seção lê. Aceita um caminho de um nível dentro do NPC ("npc.sentidos": só muda quando
   * aquele campo muda, e não quando outro campo de `npc` muda; Q15).
   */
  ficha?: readonly (keyof Ficha | `npc.${string}`)[];
  /** Em vez de listar: lê tudo, menos estas chaves (texto livre que ela não mostra). */
  fichaExceto?: readonly (keyof Ficha)[];
  /** As chaves de `d` que a seção lê; `"todo"` para as derivadas inteiras. */
  d?: readonly (keyof FichaDerivada)[] | "todo";
  /** Props que se comparam por dentro, em vez de por identidade (ex.: `luz`, que carrega a mesa inteira). */
  comparar?: Record<string, (a: unknown, b: unknown) => boolean>;
  /**
   * Q15: uma fatia que não cabe numa chave (ex.: "só as magias deste círculo"). Devolve `true` se a seção precisa
   * redesenhar. Roda além das chaves declaradas; quem a usa tira a chave inteira da declaração.
   */
  mudou?: (a: P, b: P) => boolean;
};

/** Desliga o `memo` (só para medir o "antes"): toda seção redesenha a cada render do pai. */
const MEMO_LIGADO = true;

type ContadorDeRenders = Record<string, number>;

/** Só no modo de teste (`e2e`): conta quantas vezes cada seção redesenhou, em `window.__rendersDaFicha`. */
export function contarRender(nome: string) {
  if (import.meta.env.MODE !== "e2e") return;
  const w = window as unknown as { __rendersDaFicha?: ContadorDeRenders };
  const c = w.__rendersDaFicha ?? {};
  w.__rendersDaFicha = c;
  c[nome] = (c[nome] ?? 0) + 1;
}

function valorDe(o: Record<string, unknown> | undefined, chave: string): unknown {
  const ponto = chave.indexOf(".");
  if (ponto < 0) return o?.[chave];
  const dentro = o?.[chave.slice(0, ponto)] as Record<string, unknown> | undefined;
  return dentro?.[chave.slice(ponto + 1)];
}

function mudou(a: object | undefined, b: object | undefined, chaves: readonly string[]) {
  const x = a as Record<string, unknown> | undefined;
  const y = b as Record<string, unknown> | undefined;
  for (const k of chaves) if (!Object.is(valorDe(x, k), valorDe(y, k))) return true;
  return false;
}

function chavesDe(a: object | undefined, b: object | undefined, exceto: readonly string[]) {
  const todas = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of exceto) todas.delete(k);
  return [...todas];
}

function primeiraChave(a: object | undefined, b: object | undefined, chaves: readonly string[]) {
  return chaves.find((k) => mudou(a, b, [k]));
}

/** Por que a seção tem de redesenhar: o nome da prop ou "ficha.<chave>" / "d.<chave>"; `null` se pode ficar como está. */
function motivoDaMudanca(a: Props, b: Props, f: Fatias<never>, raiz = true): string | null {
  if (!MEMO_LIGADO) return "sem memo";
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === "ficha" || k === "d") continue;
    // Q15: as seções que recebem o conjunto todo em `props` (as da aba Magias e do NPC) valem pelo que há dentro dele
    // (cada chave por identidade; a ficha e `d` pelas fatias), não pelo objeto, que é novo a cada render da janela.
    if (k === "props" && a.props && b.props && typeof a.props === "object") {
      const dentro = motivoDaMudanca(a.props as Props, b.props as Props, f, false);
      if (dentro !== null) return `props.${dentro}`;
      continue;
    }
    // `luz` carrega a mesa inteira (muda a cada evento): só quem a lê a declara em `comparar` (o equipamento)
    if (k === "luz" && !f.comparar?.luz) continue;
    const comparar = f.comparar?.[k];
    if (comparar ? !comparar(a[k], b[k]) : !Object.is(a[k], b[k])) return k;
  }
  if (f.fichaExceto) {
    const k = primeiraChave(a.ficha, b.ficha, chavesDe(a.ficha, b.ficha, f.fichaExceto));
    if (k) return `ficha.${k}`;
  } else if (f.ficha) {
    const k = primeiraChave(a.ficha, b.ficha, f.ficha);
    if (k) return `ficha.${k}`;
  } else if (a.ficha !== b.ficha) {
    // sem declaração, a seção vale pela ficha inteira
    return "ficha";
  }
  if (f.d === "todo") {
    if (a.d !== b.d) return "d";
  } else if (f.d) {
    const k = primeiraChave(a.d, b.d, f.d);
    if (k) return `d.${k}`;
  }
  if (raiz && f.mudou?.(a as never, b as never)) return "fatia";
  return null;
}

/** Só no modo de teste: por que cada seção redesenhou (`window.__motivosDaFicha`), para achar a prop instável. */
function anotarMotivo(nome: string, motivo: string) {
  if (import.meta.env.MODE !== "e2e") return;
  const w = window as unknown as { __motivosDaFicha?: Record<string, number> };
  const c = w.__motivosDaFicha ?? {};
  w.__motivosDaFicha = c;
  c[`${nome}<-${motivo}`] = (c[`${nome}<-${motivo}`] ?? 0) + 1;
}

/** `Componente` em `memo`, com as fatias da ficha que ele lê (e o contador de renders do modo de teste). */
export function secao<P extends Props>(
  nome: string,
  Componente: ComponentType<P>,
  fatias: Fatias<P>,
): ComponentType<P> {
  function Secao(props: P) {
    contarRender(nome);
    return <Componente {...props} />;
  }
  Secao.displayName = nome;
  return memo(Secao, (a, b) => {
    const motivo = motivoDaMudanca(a as Props, b as Props, fatias as Fatias<never>);
    if (motivo !== null) anotarMotivo(nome, motivo);
    return motivo === null;
  }) as unknown as ComponentType<P>;
}
