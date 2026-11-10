import {
  CONDICOES,
  type Condicao,
  type Estado,
  NIVEIS_DE_EXAUSTAO,
  NOME_DA_CONDICAO,
  RESUMO_DA_CONDICAO,
  resumoDaExaustao,
} from "@tabletop/shared";
import { Check, HeartPulse, ListPlus, ListX, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { dentroDaArea } from "./area";
import { useFecharFora } from "./Popover";

type Props = {
  estado: Estado;
  tokenId: string;
  /** Posição do clique na página. */
  x: number;
  y: number;
  /** O mestre gerencia a ordem de turno; quem só edita o personagem vê só as condições. */
  euMestre: boolean;
  enviar: (tipo: string, dados: object) => string | null;
  aoFechar: () => void;
};

/**
 * Menu do botão direito num token (Lote 11): entrar na iniciativa (mestre) e as condições do 5e, a
 * exaustão e a concentração. Quem pode é o mestre e quem edita o personagem do token (a sala confere);
 * nenhuma regra é aplicada sozinha. As mudanças vão na hora e o menu continua aberto.
 */
export function MenuDoToken({ estado, tokenId, x, y, euMestre, enviar, aoFechar }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, aoFechar);
  const [vista, setVista] = useState<"inicio" | "condicoes">(euMestre ? "inicio" : "condicoes");
  const token = estado.tokens.find((t) => t.id === tokenId);
  const [magia, setMagia] = useState(token?.concentracao ?? "");
  if (!token) return null;
  const naOrdem = estado.combate?.entradas.find((e) => e.tokenId === tokenId);
  const ativas = new Set<Condicao>(token.condicoes ?? []);
  const { left: esquerda, top: topo } = dentroDaArea(x, y, 292, vista === "condicoes" ? 552 : 142);

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
      data-vista={vista}
      style={{ left: esquerda, top: topo }}
    >
      <div className="nota menu-titulo">{token.nome}</div>
      {vista === "inicio" && (
        <>
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
          <button
            type="button"
            role="menuitem"
            className="item-menu"
            data-testid="menu-token-condicoes"
            onClick={() => setVista("condicoes")}
          >
            <HeartPulse size={16} />
            <span>Condições…</span>
          </button>
        </>
      )}
      {vista === "condicoes" && (
        <div className="mt-condicoes" data-testid="menu-token-painel-condicoes">
          <div className="mt-grade">
            {CONDICOES.map((c) => (
              <button
                key={c}
                type="button"
                role="menuitemcheckbox"
                aria-checked={ativas.has(c)}
                className="item-menu mt-condicao"
                data-testid={`condicao-${c}`}
                title={RESUMO_DA_CONDICAO[c]}
                onClick={() => alternar(c)}
              >
                <span className="mt-caixa" aria-hidden>
                  {ativas.has(c) && <Check size={12} />}
                </span>
                <span>{NOME_DA_CONDICAO[c]}</span>
              </button>
            ))}
          </div>
          <div className="mt-bloco">
            <span className="nota">Exaustão</span>
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
                <button
                  key={n}
                  type="button"
                  className="chip"
                  data-testid={`exaustao-${n}`}
                  aria-pressed={token.exaustao === n}
                  title={resumoDaExaustao(n)}
                  onClick={() => enviar("token.condicoes", { id: tokenId, exaustao: n })}
                >
                  {n}
                </button>
              ))}
            </fieldset>
          </div>
          <div className="mt-bloco">
            <label className="nota" htmlFor="concentracao-magia">
              Concentração (nome da magia)
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
          <div className="mt-linha mt-rodape">
            {euMestre && (
              <button type="button" onClick={() => setVista("inicio")}>
                Voltar
              </button>
            )}
            <button type="button" data-testid="menu-token-fechar" onClick={aoFechar}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
