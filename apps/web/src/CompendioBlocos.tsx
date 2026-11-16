import type { GrupoDoCompendio } from "@tabletop/shared";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { gravarBlocoDoCompendio, lerBlocosDoCompendio } from "./preferencias";

/** Seção com poucas entradas (o exemplo do SRD, um arquivo curto) abre tudo; as grandes começam fechadas (assumido). */
export const LIMITE_PARA_ABRIR_TUDO = 24;

/**
 * Q2: um bloco recolhível do compêndio, no desenho da sanfona das Preferências (título com a contagem, seta,
 * `aria-expanded`). O corpo só existe na tela com o bloco aberto: a lista de mais de mil entradas abre rápido.
 */
export function BlocoRecolhivel({
  id,
  titulo,
  contagem,
  aberto,
  aoAlternar,
  nivel = 1,
  children,
}: {
  id: string;
  titulo: string;
  contagem: number;
  aberto: boolean;
  aoAlternar: () => void;
  /** 1 = bloco de seção ("Magias"), 2 = bloco de dentro ("3º nível"). */
  nivel?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <section
      className="bloco-do-compendio"
      data-nivel={nivel}
      data-aberto={aberto ? "true" : "false"}
      data-testid={`compendio-bloco-${id}`}
    >
      <button
        type="button"
        className="bloco-do-compendio-cabeca"
        aria-expanded={aberto}
        data-testid={`compendio-bloco-${id}-titulo`}
        onClick={aoAlternar}
      >
        <b>{titulo}</b>
        <span
          className="bloco-do-compendio-contagem"
          data-testid={`compendio-bloco-${id}-contagem`}
        >
          {contagem}
        </span>
        <ChevronDown className="bloco-do-compendio-seta" size={14} aria-hidden="true" />
      </button>
      {aberto && <div className="bloco-do-compendio-corpo">{children}</div>}
    </section>
  );
}

/**
 * Quem está aberto: o que a pessoa abriu ou fechou fica lembrado neste navegador. Com busca ou filtro (`forcar`) os
 * blocos com resultado abrem sozinhos, e o que se fecha nessa hora vale só até a busca mudar.
 */
export function useBlocosAbertos(forcar: boolean, abertoPorPadrao: boolean) {
  const [lembrados, setLembrados] = useState(lerBlocosDoCompendio);
  const [naBusca, setNaBusca] = useState<Record<string, boolean>>({});
  return {
    aberto: (chave: string): boolean =>
      forcar ? (naBusca[chave] ?? true) : (lembrados[chave] ?? abertoPorPadrao),
    alternar: (chave: string) => {
      if (forcar) {
        setNaBusca((m) => ({ ...m, [chave]: !(m[chave] ?? true) }));
        return;
      }
      const agora = !(lembrados[chave] ?? abertoPorPadrao);
      setLembrados((m) => ({ ...m, [chave]: agora }));
      gravarBlocoDoCompendio(chave, agora);
    },
  };
}

/**
 * Os blocos de uma seção: cada grupo (nível, ND, raridade...) vira um bloco recolhível, com a contagem no título.
 * `renderEntrada` desenha uma linha (só dos blocos abertos).
 */
export function BlocosDoCompendio<T>({
  escopo,
  grupos,
  forcar,
  total,
  renderEntrada,
  testid,
  testidDaLista,
}: {
  /** A seção ("magias"): prefixo das chaves lembradas. */
  escopo: string;
  grupos: readonly GrupoDoCompendio<T>[];
  /** Busca ou filtro ativo: abre os blocos que têm resultado. */
  forcar: boolean;
  /** Quantas entradas a seção tem no total (decide se abre tudo por padrão). */
  total: number;
  renderEntrada: (e: T) => ReactNode;
  testid?: string;
  testidDaLista?: string;
}) {
  const blocos = useBlocosAbertos(forcar, total <= LIMITE_PARA_ABRIR_TUDO);
  return (
    <div className="blocos-do-compendio" {...(testid ? { "data-testid": testid } : {})}>
      {grupos.map((g) => {
        const chave = `${escopo}:${g.chave}`;
        return (
          <BlocoRecolhivel
            key={chave}
            id={`${escopo}-${g.chave.replace(/[^a-z0-9]+/gi, "_")}`}
            titulo={g.rotulo}
            contagem={g.entradas.length}
            aberto={blocos.aberto(chave)}
            aoAlternar={() => blocos.alternar(chave)}
            nivel={2}
          >
            <ul
              className="lista-de-magias"
              {...(testidDaLista ? { "data-testid": testidDaLista } : {})}
            >
              {g.entradas.map((e) => renderEntrada(e))}
            </ul>
          </BlocoRecolhivel>
        );
      })}
    </div>
  );
}

/** O nome em inglês, pequeno ao lado do nome (Q2), quando o arquivo traz. */
export function NomeOriginal({ nome }: { nome: string | undefined }) {
  return nome ? (
    <span className="nome-original" lang="en">
      {nome}
    </span>
  ) : null;
}
