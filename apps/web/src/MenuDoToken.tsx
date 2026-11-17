import {
  type Camada,
  CONDICOES,
  type Condicao,
  type Estado,
  NIVEIS_DE_EXAUSTAO,
  NOME_DA_CONDICAO,
  resumoDaExaustao,
} from "@tabletop/shared";
import {
  Backpack,
  Check,
  Copy,
  CopyPlus,
  FileText,
  Flame,
  FlameKindling,
  Layers,
  ListPlus,
  ListX,
  Pencil,
  Skull,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { caixaDaArea, dentroDaArea } from "./area";
import { ATALHOS } from "./atalhos";
import { BotaoComDica } from "./BotaoComDica";
import { ICONE_DA_CONDICAO } from "./condicoesIcones";
import { Teclas } from "./Dica";
import { useFecharFora } from "./Popover";
import { useMenuPorTeclado } from "./useMenuPorTeclado";

type Props = {
  estado: Estado;
  tokenId: string;
  /** Posição do clique na página. */
  x: number;
  y: number;
  /** O mestre gerencia a ordem de turno e o painel do token; quem só edita o personagem vê o resto. */
  euMestre: boolean;
  enviar: (tipo: string, dados: object) => string | null;
  /** Aberto pelo teclado (Shift+F10 ou a tecla de menu): o foco vai para o primeiro item. */
  teclado?: boolean;
  /** Q1: "Abrir ficha": abre a janela da ficha do personagem do token. */
  aoAbrirFicha: (personagemId: string, aba?: undefined, tokenId?: string) => void;
  /** Q10: "Duplicar" e "Copiar" (só o mestre): agem na seleção quando este token faz parte dela. */
  aoDuplicar: () => void;
  aoCopiar: () => void;
  /** "Editar token…": seleciona o token e abre o painel dele (só o mestre). */
  aoEditar: () => void;
  aoFechar: () => void;
};

/** O ícone da condição (V11), o mesmo do token no mapa; na cor do texto do tema. */
function Icone({ nome }: { nome: keyof typeof ICONE_DA_CONDICAO }) {
  const Componente = ICONE_DA_CONDICAO[nome];
  return <Componente size={14} aria-hidden className="mt-icone-condicao" data-icone={nome} />;
}

/** N1: as camadas do clique direito (só o mestre), com o nome do painel do token. */
const CAMADAS_DO_MENU: readonly (readonly [Camada, string])[] = [
  ["mapa", "Mapa"],
  ["tokens", "Tokens"],
  ["mestre", "Mestre"],
];

/** Altura que o menu pede (px), para caber na área do mapa; o que passar disso rola. */
function alturaDoMenu(mestre: boolean, tochas: number): number {
  return (
    44 +
    31 +
    31 +
    (mestre ? 76 + 62 + 28 + 3 * 31 : 0) +
    (tochas > 0 ? 28 + tochas * 76 : 0) +
    28 +
    7 * 31 +
    66 +
    76
  );
}

/**
 * Menu do botão direito num token (Lote 11; R5a): para o mestre, "Editar token…" e a iniciativa; para
 * quem carrega tochas, o grupo "Tocha" (apagar, acender, guardar na mochila); e as condições do 5e
 * direto como itens de marcar, a exaustão e a concentração. Quem pode é o mestre e quem edita o
 * personagem do token (a sala confere); nenhuma regra é aplicada sozinha. As condições vão na hora e o
 * menu continua aberto; Esc ou um clique fora fecha.
 */
export function MenuDoToken({
  estado,
  tokenId,
  x,
  y,
  euMestre,
  enviar,
  teclado,
  aoAbrirFicha,
  aoEditar,
  aoDuplicar,
  aoCopiar,
  aoFechar,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, aoFechar);
  const aoTeclarNoMenu = useMenuPorTeclado(ref, teclado === true);
  const token = estado.tokens.find((t) => t.id === tokenId);
  const [magia, setMagia] = useState(token?.concentracao ?? "");
  if (!token) return null;
  const naOrdem = estado.combate?.entradas.find((e) => e.tokenId === tokenId);
  const ativas = new Set<Condicao>(token.condicoes ?? []);
  // Q1: com ficha que esta pessoa vê (a sala só manda ao jogador as que ele pode ver).
  const temFicha =
    token.personagemId !== undefined && estado.personagens.some((p) => p.id === token.personagemId);
  // As tochas na mão do personagem deste token.
  const tochas = estado.luzes.filter(
    (l) =>
      l.portador.tipo === "mao" &&
      token.personagemId !== undefined &&
      l.portador.personagemId === token.personagemId,
  );
  const area = caixaDaArea();
  const alturaMaxima = area.base - area.topo - 16;
  const altura = Math.min(alturaDoMenu(euMestre, tochas.length), alturaMaxima);
  const { left: esquerda, top: topo } = dentroDaArea(x, y, 292, altura);

  function alternar(c: Condicao) {
    const novas = new Set(ativas);
    if (novas.has(c)) novas.delete(c);
    else novas.add(c);
    enviar("token.condicoes", { id: tokenId, condicoes: CONDICOES.filter((k) => novas.has(k)) });
  }

  function marcarConcentracao() {
    const nome = magia.trim();
    if (nome) enviar("token.condicoes", { id: tokenId, concentracao: nome });
  }

  return (
    <div
      ref={ref}
      className="menu-contexto menu-token"
      role="menu"
      aria-label={`Token: ${token.nome}`}
      data-testid="menu-token"
      style={{ left: esquerda, top: topo, maxHeight: alturaMaxima }}
      onKeyDown={aoTeclarNoMenu}
    >
      <div className="nota menu-titulo">{token.nome}</div>
      {temFicha && token.personagemId !== undefined && (
        <button
          type="button"
          role="menuitem"
          className="item-menu"
          data-testid="menu-token-abrir-ficha"
          onClick={() => {
            const id = token.personagemId;
            aoFechar();
            if (id !== undefined) aoAbrirFicha(id, undefined, tokenId);
          }}
        >
          <FileText size={16} />
          <span>Abrir ficha</span>
        </button>
      )}
      {euMestre && (
        <>
          <button
            type="button"
            role="menuitem"
            className="item-menu"
            data-testid="menu-token-editar"
            onClick={() => {
              aoFechar();
              aoEditar();
            }}
          >
            <Pencil size={16} />
            <span>Editar token…</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="item-menu"
            data-testid="menu-token-duplicar"
            aria-keyshortcuts="Control+D"
            onClick={() => {
              aoFechar();
              aoDuplicar();
            }}
          >
            <CopyPlus size={16} />
            <span>Duplicar</span>
            <span className="item-atalho">
              <Teclas teclas={ATALHOS.duplicarToken.teclas} />
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="item-menu"
            data-testid="menu-token-copiar"
            aria-keyshortcuts="Control+C"
            onClick={() => {
              aoFechar();
              aoCopiar();
            }}
          >
            <Copy size={16} />
            <span>Copiar</span>
            <span className="item-atalho">
              <Teclas teclas={ATALHOS.copiarToken.teclas} />
            </span>
          </button>
          {naOrdem ? (
            <button
              type="button"
              role="menuitem"
              className="item-menu"
              data-testid="menu-token-sair-iniciativa"
              onClick={() => {
                aoFechar();
                enviar("combate.tirar", { id: naOrdem.id });
              }}
            >
              <ListX size={16} />
              <span>Sair da iniciativa</span>
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="item-menu"
              data-testid="menu-token-iniciativa"
              onClick={() => {
                aoFechar();
                enviar("combate.adicionar", {
                  entradas: [{ id: `ent-${crypto.randomUUID().slice(0, 8)}`, tokenId }],
                });
              }}
            >
              <ListPlus size={16} />
              <span>Entrar na iniciativa</span>
            </button>
          )}
        </>
      )}
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={token.morto === true}
        className="item-menu"
        data-testid="menu-token-morto"
        onClick={() => {
          aoFechar();
          enviar("token.condicoes", { id: tokenId, morto: token.morto !== true });
        }}
      >
        <Skull size={16} />
        <span>{token.morto ? "Tirar a marca de morto" : "Marcar como morto"}</span>
      </button>
      {euMestre && (
        <fieldset className="mt-grupo" data-testid="menu-token-grupo-camada">
          <legend className="nota mt-grupo-titulo">Camada</legend>
          {CAMADAS_DO_MENU.map(([camada, nome]) => (
            <button
              key={camada}
              type="button"
              role="menuitemradio"
              aria-checked={token.camada === camada}
              className="item-menu"
              data-testid={`menu-token-camada-${camada}`}
              onClick={() => {
                aoFechar();
                if (token.camada !== camada) {
                  enviar("token.editar", { id: tokenId, mudancas: { camada } });
                }
              }}
            >
              <Layers size={16} />
              <span>{nome}</span>
            </button>
          ))}
        </fieldset>
      )}
      {tochas.length > 0 && (
        <fieldset className="mt-grupo" data-testid="menu-token-grupo-tocha">
          <legend className="nota mt-grupo-titulo">Tocha</legend>
          {tochas.map((luz) => {
            const acesa = luz.estado === "acesa";
            return (
              <div key={luz.id} className="mt-tocha" data-testid={`menu-token-tocha-${luz.id}`}>
                {tochas.length > 1 && <span className="nota mt-tocha-nome">{luz.nome}</span>}
                <button
                  type="button"
                  role="menuitem"
                  className="item-menu"
                  data-testid={`menu-token-tocha-alternar-${luz.id}`}
                  data-acesa={acesa}
                  onClick={() => enviar("tocha.alternar", { id: luz.id })}
                >
                  {acesa ? <FlameKindling size={16} /> : <Flame size={16} />}
                  <span>{acesa ? "Apagar a tocha" : "Acender a tocha"}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="item-menu"
                  data-testid={`menu-token-tocha-guardar-${luz.id}`}
                  onClick={() => {
                    aoFechar();
                    enviar("tocha.guardar", { id: luz.id });
                  }}
                >
                  <Backpack size={16} />
                  <span>Guardar na mochila</span>
                </button>
              </div>
            );
          })}
        </fieldset>
      )}
      <fieldset className="mt-condicoes" data-testid="menu-token-painel-condicoes">
        <legend className="nota mt-grupo-titulo">Condições (um clique liga ou desliga)</legend>
        <div className="mt-grade">
          {CONDICOES.map((c) => (
            <button
              key={c}
              type="button"
              role="menuitemcheckbox"
              aria-checked={ativas.has(c)}
              className="item-menu mt-condicao"
              data-testid={`condicao-${c}`}
              onClick={() => alternar(c)}
            >
              <span className="mt-caixa" aria-hidden>
                {ativas.has(c) && <Check size={12} />}
              </span>
              <Icone nome={c} />
              <span>{NOME_DA_CONDICAO[c]}</span>
            </button>
          ))}
        </div>
        <div className="mt-bloco">
          <span className="nota mt-rotulo-icone">
            <Icone nome="exaustao" /> Exaustão
          </span>
          <fieldset className="chips mt-fieldset" aria-label="Nível de exaustão">
            <button
              type="button"
              className="chip"
              data-testid="exaustao-0"
              aria-pressed={token.exaustao === undefined}
              onClick={() => enviar("token.condicoes", { id: tokenId, exaustao: 0 })}
            >
              0
            </button>
            {NIVEIS_DE_EXAUSTAO.map((n) => (
              <BotaoComDica
                key={n}
                className="chip"
                testid={`exaustao-${n}`}
                nome={resumoDaExaustao(n)}
                aria-pressed={token.exaustao === n}
                onClick={() => enviar("token.condicoes", { id: tokenId, exaustao: n })}
              >
                {n}
              </BotaoComDica>
            ))}
          </fieldset>
        </div>
        <div className="mt-bloco mt-ultimo">
          <label className="nota" htmlFor="concentracao-magia">
            <Icone nome="concentracao" /> Concentração (nome da magia)
          </label>
          <div className="mt-linha">
            <input
              id="concentracao-magia"
              type="text"
              data-testid="concentracao-input"
              maxLength={64}
              placeholder="Bênção"
              value={magia}
              onChange={(e) => setMagia(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && marcarConcentracao()}
            />
            <button
              type="button"
              data-testid="concentracao-aplicar"
              disabled={magia.trim() === ""}
              onClick={marcarConcentracao}
            >
              <Sparkles size={14} /> Marcar
            </button>
            <button
              type="button"
              data-testid="concentracao-tirar"
              disabled={token.concentracao === undefined}
              onClick={() => {
                setMagia("");
                enviar("token.condicoes", { id: tokenId, concentracao: null });
              }}
            >
              Tirar
            </button>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
