import type { Rolagem } from "@tabletop/shared";
import { EyeOff } from "lucide-react";
import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { TipoDeDano } from "./danos";
import { useEstiloDasRolagens } from "./estilo";
import { IconeDoDano } from "./IconeDoDano";
import type { TotaisDaVantagem } from "./totais";

/** Quanto tempo o mouse fica parado em cima do cartão antes do balão dos dados aparecer. */
export const ESPERA_DO_BALAO_MS = 350;

/** Como o número do cartão aparece: normal, crítico (verde fixo) ou falha crítica (cinza apagado). */
export type TomDoCartao = "normal" | "critico" | "falha";

// --- o balão dos dados ---------------------------------------------------------------------------

/** "2d20, o maior +3": a fórmula do que foi rolado, em português. */
export function formulaDaRolagem(r: Rolagem): string {
  let saida = "";
  r.termos.forEach((t, i) => {
    if (t.tipo === "constante") {
      saida += `${i === 0 && t.sinal === 1 ? "" : t.sinal === -1 ? " −" : " +"}${t.valor}`;
      return;
    }
    const sinal = t.sinal === -1 ? "−" : i > 0 ? "+ " : "";
    const manter = t.manter
      ? t.manter.n === 1
        ? t.manter.modo === "kh"
          ? ", o maior"
          : ", o menor"
        : `, os ${t.manter.n} ${t.manter.modo === "kh" ? "maiores" : "menores"}`
      : "";
    saida += `${i > 0 ? " " : ""}${sinal}${t.quantidade}d${t.faces}${manter}`;
  });
  return saida.trim();
}

/** Os dados de uma rolagem, um chip por dado: o descartado riscado, o que vale com borda âmbar (quando houve descarte). */
export function ChipsDaRolagem({ rolagem }: { rolagem: Rolagem }) {
  let primeiroD20 = true;
  return (
    <span className="rc-chips">
      {rolagem.termos.flatMap((t, i) => {
        if (t.tipo !== "dados") return [];
        const decideTeste = t.faces === 20 && t.sinal === 1 && primeiroD20;
        if (decideTeste) primeiroD20 = false;
        return t.dados.map((d, j) => {
          const vale = !d.descartado;
          const classes = [
            "rc-chip",
            d.descartado ? "dim" : "",
            vale && t.manter ? "ok" : "",
            vale && decideTeste && d.valor === 20 ? "crit" : "",
            vale && decideTeste && d.valor === 1 ? "nat1" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a lista é montada de uma vez e não muda
              key={`${i}-${j}`}
              className={classes}
              data-testid={decideTeste ? "d20-chip" : "dado-rolado"}
              data-valor={d.valor}
              data-descartado={d.descartado ? "true" : undefined}
            >
              {d.valor}
            </span>
          );
        });
      })}
    </span>
  );
}

/** Uma linha do balão: os dados e a fórmula (e, se houver, um nome na frente: "acerto", "dano"). */
export function LinhaDoBalao({
  rolagem,
  nome,
  texto,
  testidDaFormula,
}: {
  rolagem: Rolagem;
  nome?: string;
  texto?: string;
  testidDaFormula?: string;
}) {
  return (
    <span className="rc-balao-parte">
      {nome && <span className="rc-balao-nome">{nome}</span>}
      <ChipsDaRolagem rolagem={rolagem} />
      <span className="rc-balao-formula" data-testid={testidDaFormula}>
        {texto ?? formulaDaRolagem(rolagem)}
      </span>
    </span>
  );
}

// --- o gesto: mouse parado, foco, toque ----------------------------------------------------------

/** Para que lado o balão abre: em cima, ou embaixo quando o cartão está colado no topo da lista. */
function ladoDoBalao(el: HTMLElement | null): "cima" | "baixo" {
  const lista = el?.closest(".mensagens-chat");
  if (!el || !lista) return "cima";
  return el.getBoundingClientRect().top - lista.getBoundingClientRect().top < 130
    ? "baixo"
    : "cima";
}

/** Esperinha ao sair de uma metade: se o mouse entra na outra nesse tempo, o balão troca sem esperar de novo. */
const TROCA_ENTRE_METADES_MS = 90;

/**
 * Quando o balão aparece (Q5, por metade no Q5b): com o mouse parado ~350 ms em cima da metade; no mesmo instante com
 * o foco do teclado (acessível); no toque, tocar abre e fecha; Esc fecha. Passar de uma metade para a outra troca o
 * balão sem esperar de novo. O balão só é montado enquanto aberto; `aberta` é o índice da metade com balão.
 */
function useBalao() {
  const [aberta, setAberta] = useState<number | null>(null);
  const [lado, setLado] = useState<"cima" | "baixo">("cima");
  const raiz = useRef<HTMLDivElement>(null);
  const relogio = useRef<number | undefined>(undefined);
  const saida = useRef<number | undefined>(undefined);
  const id = useId();

  const limpar = useCallback(() => {
    if (relogio.current !== undefined) window.clearTimeout(relogio.current);
    relogio.current = undefined;
    if (saida.current !== undefined) window.clearTimeout(saida.current);
    saida.current = undefined;
  }, []);
  useEffect(() => limpar, [limpar]);

  const abrir = useCallback(
    (i: number) => {
      limpar();
      setLado(ladoDoBalao(raiz.current));
      setAberta(i);
    },
    [limpar],
  );
  const fechar = useCallback(() => {
    limpar();
    setAberta(null);
  }, [limpar]);

  const propsDa = (i: number) => ({
    onMouseEnter: () => {
      const veioDeOutra = saida.current !== undefined;
      limpar();
      if (veioDeOutra) abrir(i);
      else relogio.current = window.setTimeout(() => abrir(i), ESPERA_DO_BALAO_MS);
    },
    onMouseLeave: () => {
      limpar();
      if (aberta === null) return;
      saida.current = window.setTimeout(fechar, TROCA_ENTRE_METADES_MS);
    },
    onFocus: () => abrir(i),
    onBlur: fechar,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberta !== null) {
        e.stopPropagation();
        fechar();
      }
    },
    onPointerUp: (e: { pointerType: string }) => {
      if (e.pointerType !== "touch") return;
      if (aberta === i) fechar();
      else abrir(i);
    },
  });
  return { aberta, lado, raiz, id, propsDa };
}

// --- as peças do cartão --------------------------------------------------------------------------

/** O número grande de um cartão. */
export function Numero({
  valor,
  tom = "normal",
  pequeno,
  testid = "rolagem-total",
}: {
  valor: number | string;
  tom?: TomDoCartao;
  /** O total que não valeu (o descartado da vantagem): menor e esmaecido. */
  pequeno?: boolean;
  testid?: string;
}) {
  return (
    <span
      className="rc-num"
      data-tom={tom}
      data-pequeno={pequeno || undefined}
      data-testid={testid}
    >
      {valor}
    </span>
  );
}

/** Vantagem e desvantagem sempre visíveis: o descartado pequeno e esmaecido, um traço e o que vale, grande. */
export function NumeroDuplo({
  totais,
  tom = "normal",
}: {
  totais: TotaisDaVantagem;
  tom?: TomDoCartao;
}) {
  return (
    <span className="rc-duplo" data-testid="rolagem-duplo">
      <Numero valor={totais.descartado} pequeno testid="rolagem-total-descartado" />{" "}
      <i className="rc-traco" aria-hidden="true" /> <Numero valor={totais.vale} tom={tom} />
    </span>
  );
}

/** Número e só o ícone do tipo de dano (o nome vai no aria-label). */
export function NumeroDeDano({
  valor,
  tipos,
  tom = "normal",
}: {
  valor: number;
  tipos: TipoDeDano[];
  tom?: TomDoCartao;
}) {
  return (
    <span className="rc-dano">
      <Numero valor={valor} tom={tom} testid="rolagem-total" />
      {tipos.map((t) => (
        <IconeDoDano key={t} tipo={t} />
      ))}
    </span>
  );
}

/** Uma metade do cartão dividido: o rótulo pequeno em cima, o conteúdo e um complemento. */
export function Coluna({
  rotulo,
  children,
  complemento,
  testid,
}: {
  rotulo?: ReactNode;
  children: ReactNode;
  complemento?: ReactNode;
  testid?: string;
}) {
  return (
    <div className="rc-coluna" data-testid={testid}>
      {rotulo && <div className="rc-rotulo">{rotulo} </div>}
      {children}
      {complemento && <div className="rc-complemento"> {complemento}</div>}
    </div>
  );
}

/** O rótulo "vantagem"/"desvantagem": pequeno, em âmbar, sempre visível. */
export function RotuloDaVantagem({ vantagem }: { vantagem: "vantagem" | "desvantagem" }) {
  return (
    <div className="rc-vantagem" data-testid="rolagem-vantagem">
      {vantagem}
    </div>
  );
}

type PropsDoCartao = {
  testid: string;
  /** O nome da rolagem, na fita (ou no alto da moldura). */
  nome: ReactNode;
  tom?: TomDoCartao;
  /** Rolagem oculta: vira uma linha pequena em itálico, sem caixa. */
  secreta?: boolean;
  /** A linha da rolagem oculta (o que a pessoa que pode ver precisa ler). */
  resumoSecreto?: ReactNode;
  /** As metades do cartão (uma só, ou duas: o resto vai no balão). */
  colunas: ReactNode[];
  /** Linhas pequenas embaixo: o espaço usado, a CD, o PV. */
  rodape?: ReactNode;
  /**
   * O conteúdo do balão dos dados, um por metade (`null`: a metade não tem dados). Com uma metade só, o balão é do
   * cartão todo. Só é montado com o balão aberto.
   */
  baloes: (null | (() => ReactNode))[];
  /** O nome de cada metade para o leitor de tela ("acerto", "dano"), quando o balão é por metade. */
  nomesDasMetades?: string[];
  dados?: Record<string, string | undefined>;
};

/**
 * O cartão de uma rolagem no chat (Q5), em dois estilos que só mudam no CSS: a Fita (padrão) e a Moldura de grimório.
 * Os dados só aparecem num balão, com o mouse parado ou o foco; o balão não empurra o chat.
 */
export function CartaoNoChat({
  testid,
  nome,
  tom = "normal",
  secreta,
  resumoSecreto,
  colunas,
  rodape,
  baloes,
  nomesDasMetades,
  dados,
}: PropsDoCartao) {
  const estilo = useEstiloDasRolagens();
  const { aberta, lado, raiz, id, propsDa } = useBalao();
  const dividido = colunas.length > 1;
  const aberto = aberta !== null;
  const conteudo = (): ReactNode => {
    if (!dividido || secreta || aberta === null)
      // biome-ignore lint/suspicious/noArrayIndexKey: os balões são fixos
      return baloes.map((b, i) => b && <Fragment key={i}>{b()}</Fragment>);
    return baloes[aberta]?.();
  };
  const posicao =
    !dividido || secreta || aberta === null
      ? "todo"
      : aberta === 0
        ? "primeira"
        : aberta === colunas.length - 1
          ? "ultima"
          : "meio";
  const balaoAberto = aberto && (
    <div
      className="rc-balao"
      id={id}
      role="tooltip"
      data-lado={lado}
      data-metade={posicao}
      data-testid="rolagem-balao"
    >
      {conteudo()}
    </div>
  );
  if (secreta) {
    return (
      <div
        ref={raiz}
        className="rc rc-secreta"
        data-estilo={estilo}
        data-tom={tom}
        data-testid={testid}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: o foco mostra os dados, como o mouse
        tabIndex={0}
        aria-describedby={aberto ? id : undefined}
        {...dados}
        {...propsDa(0)}
      >
        <EyeOff size={12} aria-hidden="true" />
        <em className="rc-secreta-texto">
          <span data-testid="etiqueta-oculta">Rolagem oculta</span> · {resumoSecreto}
        </em>
        {balaoAberto}
      </div>
    );
  }
  return (
    <div
      ref={raiz}
      className="rc"
      data-estilo={estilo}
      data-tom={tom}
      data-testid={testid}
      tabIndex={dividido ? undefined : 0}
      aria-describedby={!dividido && aberto ? id : undefined}
      {...dados}
      {...(dividido ? {} : propsDa(0))}
    >
      <div className="rc-borda">
        <div className="rc-miolo">
          <div className="rc-fita">{nome}</div>
          <div className="rc-regra" aria-hidden="true">
            <b />
            <i />
            <b />
          </div>
          <div className="rc-corpo">
            {colunas.map((c, i) => {
              const comBalao = dividido && !!baloes[i];
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: as metades são fixas
                  key={i}
                  className="rc-metade"
                  data-testid={comBalao ? "rolagem-metade" : undefined}
                  aria-describedby={comBalao && aberta === i ? id : undefined}
                  {...(comBalao
                    ? { tabIndex: 0, role: "group", "aria-label": nomesDasMetades?.[i] }
                    : {})}
                  {...(comBalao ? propsDa(i) : {})}
                >
                  {c}
                </div>
              );
            })}
          </div>
          {rodape && <div className="rc-rodape">{rodape}</div>}
        </div>
      </div>
      {balaoAberto}
    </div>
  );
}
