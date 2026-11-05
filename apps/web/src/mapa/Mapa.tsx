import type { Cena, Token } from "@tabletop/shared";
import { useEffect, useRef } from "react";
import { MapaPixi, type OpcoesDoMapa, type RetornosDoMapa } from "./mapaPixi";

type Props = {
  cena: Cena;
  tokens: Token[];
  opcoes: OpcoesDoMapa;
  retornos: RetornosDoMapa;
  /** Entrega o controlador (zoom, centralizar, movimento ao vivo) quando ele existe. */
  aoCriar: (mapa: MapaPixi | null) => void;
};

/** Ponte React ↔ Pixi: cria o controlador uma vez e empurra dados e opções para ele. */
export function Mapa({ cena, tokens, opcoes, retornos, aoCriar }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaPixi | null>(null);
  const retornosAtuais = useRef(retornos);
  retornosAtuais.current = retornos;
  const dadosIniciais = useRef({ cena, tokens, opcoes });
  const aoCriarAtual = useRef(aoCriar);
  aoCriarAtual.current = aoCriar;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { cena, tokens, opcoes } = dadosIniciais.current;
    const m = new MapaPixi(el, () => retornosAtuais.current, opcoes);
    m.definirCena(cena);
    m.definirTokens(tokens);
    mapa.current = m;
    m.iniciar().catch((e) => console.error("Falha ao iniciar o mapa", e));
    aoCriarAtual.current(m);
    return () => {
      aoCriarAtual.current(null);
      mapa.current = null;
      m.destruir();
    };
  }, []);

  useEffect(() => mapa.current?.definirCena(cena), [cena]);
  useEffect(() => mapa.current?.definirTokens(tokens), [tokens]);
  useEffect(() => mapa.current?.definirOpcoes(opcoes), [opcoes]);

  return <div ref={host} className="mapa" data-testid="mapa" />;
}
