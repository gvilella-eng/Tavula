import { type Magia, opcoesDeEspaco } from "@tabletop/shared";
import { MessageSquareShare } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { BotaoComDica } from "../BotaoComDica";
import { MenuDeContexto } from "../MenuDeContexto";
import type { PropsDaAba } from "./AbaPrincipal";
import { conjurar, magiaDoCompendio, type OpcaoDeConjuracao, pingarMagia } from "./conjurar";

/**
 * Conjurar com escolha de espaço (V6). `pedir` vai no clique do botão Conjurar: truque conjura direto; magia de
 * nível 1 ou mais abre o menu "Conjurar <nome> com espaço de:" preso ao botão, com um item por nível de espaço que
 * a pessoa tem (do nível da magia ao 9º) e o de pacto; sem nenhum, avisa. `menu` é o elemento a pôr na tela.
 */
export function useConjurar(
  props: PropsDaAba,
  m: Magia | undefined,
): { pedir: (gatilho: HTMLElement) => void; menu: ReactNode } {
  const [aberto, setAberto] = useState<{ x: number; y: number } | null>(null);
  const { rolador, d, avisar } = props;
  const opcoes = opcoesDeEspaco(m?.nivel ?? 0, d.espacos, d.pacto);
  // N2: a magia com a marca Ritual (na ficha ou no compêndio) ganha "Ritual · sem espaço" no menu.
  const ehRitual =
    !!m &&
    m.nivel > 0 &&
    (m.ritual === true || !!magiaDoCompendio(props.compendio, m.nome)?.ritual);

  function pedir(gatilho: HTMLElement) {
    if (!m || !rolador.podeRolar) return;
    if (m.nivel === 0) return conjurar(props, m);
    if (opcoes.length === 0 && !ehRitual) {
      avisar(`Sem espaços de ${m.nivel}º nível ou maior para ${m.nome}.`);
      return;
    }
    const r = gatilho.getBoundingClientRect();
    setAberto({ x: r.left, y: r.bottom + 2 });
  }

  const escolher = (opcao: OpcaoDeConjuracao) => {
    setAberto(null);
    if (m) conjurar(props, m, opcao);
  };

  function aoTeclar(e: KeyboardEvent<HTMLElement>) {
    if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "r" && ehRitual) {
      e.preventDefault();
      e.stopPropagation();
      escolher("ritual");
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || !/^[1-9]$/.test(e.key)) return;
    const opcao = opcoes.find((o) => o.tipo === "comum" && o.nivel === Number(e.key));
    if (!opcao) return;
    e.preventDefault();
    e.stopPropagation();
    escolher(opcao);
  }

  const menu =
    aberto && m
      ? createPortal(
          <MenuDeContexto
            testid="menu-espaco"
            titulo={`Conjurar ${m.nome} com espaço de:`}
            x={aberto.x}
            y={aberto.y}
            teclado
            aoFechar={() => setAberto(null)}
            aoTeclar={aoTeclar}
            itens={[
              ...opcoes.map((o) => ({
                id: o.id,
                rotulo: o.rotulo,
                aoClicar: () => escolher(o),
              })),
              ...(ehRitual
                ? [
                    {
                      id: "ritual",
                      rotulo: "Ritual · sem espaço (+10 min)",
                      aoClicar: () => escolher("ritual"),
                    },
                  ]
                : []),
            ]}
          />,
          document.body,
        )
      : null;
  return { pedir, menu };
}

/** O ícone ao lado do Conjurar: manda o cartão da magia ao chat, sem gastar espaço nem rolar (V6). */
export function BotaoPingarMagia({
  props,
  m,
  testid,
}: {
  props: PropsDaAba;
  m: Magia;
  testid: string;
}) {
  return (
    <BotaoComDica
      className="fl-ib fl-ping"
      testid={testid}
      nome="Mandar ao chat"
      aria-label={`Mandar ${m.nome} ao chat`}
      motivo={props.rolador.podeRolar ? null : "Só quem pode conjurar esta ficha manda ao chat"}
      onClick={() => pingarMagia(props, m)}
    >
      <MessageSquareShare size={17} aria-hidden />
    </BotaoComDica>
  );
}
