import type { Cena, Parede, Token } from "@tabletop/shared";
import { useEffect, useRef } from "react";
import { TIPO_DE_ARRASTO_DA_FICHA } from "../arrasto";
import { type ImagensDoMapa, MapaPixi, type OpcoesDoMapa, type RetornosDoMapa } from "./mapaPixi";

type Props = {
  cena: Cena;
  tokens: Token[];
  paredes: Parede[];
  opcoes: OpcoesDoMapa;
  retornos: RetornosDoMapa;
  /** As imagens locais (mapa e tokens). `versaoDasImagens` muda quando algo novo chega ao cache. */
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  /** Entrega o controlador (zoom, centralizar, movimento ao vivo) quando ele existe. */
  aoCriar: (mapa: MapaPixi | null) => void;
  /** Um item das Fichas foi solto no mapa (dados do arrasto e a posição em metros). */
  aoSoltarItem?: (dados: string, x: number, y: number) => void;
};

/** Ponte React ↔ Pixi: cria o controlador uma vez e empurra dados e opções para ele. */
export function Mapa({
  cena,
  tokens,
  paredes,
  opcoes,
  retornos,
  imagens,
  versaoDasImagens,
  aoCriar,
  aoSoltarItem,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaPixi | null>(null);
  const retornosAtuais = useRef(retornos);
  retornosAtuais.current = retornos;
  const dadosIniciais = useRef({ cena, tokens, paredes, opcoes, imagens });
  const aoCriarAtual = useRef(aoCriar);
  aoCriarAtual.current = aoCriar;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { cena, tokens, paredes, opcoes, imagens } = dadosIniciais.current;
    const m = new MapaPixi(el, () => retornosAtuais.current, opcoes);
    if (imagens) m.definirImagens(imagens);
    m.definirCena(cena);
    m.definirTokens(tokens);
    m.definirParedes(paredes);
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
  useEffect(() => mapa.current?.definirParedes(paredes), [paredes]);
  useEffect(() => mapa.current?.definirOpcoes(opcoes), [opcoes]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a versão avisa que o cache de imagens mudou
  useEffect(() => {
    if (imagens) mapa.current?.definirImagens(imagens);
  }, [imagens, versaoDasImagens]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: o mapa é um canvas; o arrasto das Fichas só precisa de dragover e drop
    <div
      ref={host}
      className="mapa"
      data-testid="mapa"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(TIPO_DE_ARRASTO_DA_FICHA)) e.preventDefault();
      }}
      onDrop={(e) => {
        const dados = e.dataTransfer.getData(TIPO_DE_ARRASTO_DA_FICHA);
        if (!dados) return;
        e.preventDefault();
        const p = mapa.current?.pontoDaPaginaEmMetros(e.clientX, e.clientY);
        if (p) aoSoltarItem?.(dados, p.x, p.y);
      }}
    />
  );
}
