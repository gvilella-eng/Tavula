import {
  type Cena,
  type Desenho,
  type FonteDeLuz,
  type ModeloDeObjeto,
  type Parede,
  type PontoDeLuz,
  TIPO_DO_ARRASTO_DO_COMPENDIO,
  type Token,
  type Zona,
} from "@tabletop/shared";
import { useEffect, useRef } from "react";
import { TIPO_DE_ARRASTO_DA_FICHA } from "../arrasto";
import { type ImagensDoMapa, MapaPixi, type OpcoesDoMapa, type RetornosDoMapa } from "./mapaPixi";

type Props = {
  cena: Cena;
  tokens: Token[];
  paredes: Parede[];
  /** 7b-2: as zonas da cena; só o mestre as recebe (o jogador passa lista vazia). */
  zonas: Zona[];
  luzes: FonteDeLuz[];
  pontos: PontoDeLuz[];
  /** FG1: os modelos de objeto (tamanho e animações da chama). */
  modelos: ModeloDeObjeto[];
  desenhos: Desenho[];
  opcoes: OpcoesDoMapa;
  retornos: RetornosDoMapa;
  /** As imagens locais (mapa e tokens). `versaoDasImagens` muda quando algo novo chega ao cache. */
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  /** Entrega o controlador (zoom, centralizar, movimento ao vivo) quando ele existe. */
  aoCriar: (mapa: MapaPixi | null) => void;
  /** Um item das Fichas foi solto no mapa (dados do arrasto e a posição em metros). */
  aoSoltarItem?: (dados: string, x: number, y: number) => void;
  /** N3a: uma entrada do Compêndio (um monstro) foi solta no mapa: o texto do arrasto e a posição em metros. */
  aoSoltarDoCompendio?: ((dados: string, x: number, y: number) => void) | undefined;
};

/** Ponte React ↔ Pixi: cria o controlador uma vez e empurra dados e opções para ele. */
export function Mapa({
  cena,
  tokens,
  paredes,
  zonas,
  luzes,
  pontos,
  modelos,
  desenhos,
  opcoes,
  retornos,
  imagens,
  versaoDasImagens,
  aoCriar,
  aoSoltarItem,
  aoSoltarDoCompendio,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaPixi | null>(null);
  const retornosAtuais = useRef(retornos);
  retornosAtuais.current = retornos;
  const dadosIniciais = useRef({
    cena,
    tokens,
    paredes,
    zonas,
    luzes,
    pontos,
    modelos,
    desenhos,
    opcoes,
    imagens,
  });
  const aoCriarAtual = useRef(aoCriar);
  aoCriarAtual.current = aoCriar;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { cena, tokens, paredes, zonas, luzes, pontos, modelos, desenhos, opcoes, imagens } =
      dadosIniciais.current;
    const m = new MapaPixi(el, () => retornosAtuais.current, opcoes);
    if (imagens) m.definirImagens(imagens);
    m.definirCena(cena);
    m.definirTokens(tokens);
    m.definirParedes(paredes);
    m.definirZonas(zonas);
    m.definirLuzes(luzes);
    m.definirModelos(modelos);
    m.definirPontos(pontos);
    m.definirDesenhos(desenhos);
    mapa.current = m;
    m.iniciar().catch((e) => console.error("Falha ao iniciar o mapa", e));
    aoCriarAtual.current(m);
    return () => {
      aoCriarAtual.current(null);
      mapa.current = null;
      m.destruir();
    };
  }, []);

  // V10: o anel de foco do mapa só vale quando o foco chegou pelo teclado (Tab ou um atalho que leva ao mapa), nunca
  // depois de um clique seguido de tecla (Delete, Espaço, setas).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let pelaTeclado = false;
    const aoTeclar = (e: KeyboardEvent) => {
      if (["Tab", "Escape", "Enter", "F10", "ContextMenu"].includes(e.key)) pelaTeclado = true;
    };
    const aoApertar = () => {
      pelaTeclado = false;
      el.removeAttribute("data-foco-teclado");
    };
    const aoFocar = () => {
      if (pelaTeclado) el.setAttribute("data-foco-teclado", "");
      else el.removeAttribute("data-foco-teclado");
    };
    const aoPerder = () => el.removeAttribute("data-foco-teclado");
    window.addEventListener("keydown", aoTeclar, true);
    window.addEventListener("pointerdown", aoApertar, true);
    el.addEventListener("focus", aoFocar);
    el.addEventListener("blur", aoPerder);
    return () => {
      window.removeEventListener("keydown", aoTeclar, true);
      window.removeEventListener("pointerdown", aoApertar, true);
      el.removeEventListener("focus", aoFocar);
      el.removeEventListener("blur", aoPerder);
    };
  }, []);

  useEffect(() => mapa.current?.definirCena(cena), [cena]);
  useEffect(() => mapa.current?.definirTokens(tokens), [tokens]);
  useEffect(() => mapa.current?.definirParedes(paredes), [paredes]);
  useEffect(() => mapa.current?.definirZonas(zonas), [zonas]);
  useEffect(() => mapa.current?.definirLuzes(luzes), [luzes]);
  useEffect(() => mapa.current?.definirPontos(pontos), [pontos]);
  useEffect(() => mapa.current?.definirModelos(modelos), [modelos]);
  useEffect(() => mapa.current?.definirDesenhos(desenhos), [desenhos]);
  useEffect(() => mapa.current?.definirOpcoes(opcoes), [opcoes]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a versão avisa que o cache de imagens mudou
  useEffect(() => {
    if (imagens) mapa.current?.definirImagens(imagens);
  }, [imagens, versaoDasImagens]);

  return (
    <div
      ref={host}
      className="mapa"
      data-testid="mapa"
      role="application"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: o mapa é um canvas; recebe foco (R6a) para o atalho do menu do token e para devolver o foco quando o menu fecha
      tabIndex={0}
      aria-label="Mapa da cena. Com um token selecionado, Shift+F10 ou a tecla de menu abre o menu dele."
      onDragOver={(e) => {
        const tipos = e.dataTransfer.types;
        if (tipos.includes(TIPO_DE_ARRASTO_DA_FICHA)) e.preventDefault();
        else if (aoSoltarDoCompendio && tipos.includes(TIPO_DO_ARRASTO_DO_COMPENDIO)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        const dados = e.dataTransfer.getData(TIPO_DE_ARRASTO_DA_FICHA);
        if (dados) {
          e.preventDefault();
          const p = mapa.current?.pontoDaPaginaEmMetros(e.clientX, e.clientY);
          if (p) aoSoltarItem?.(dados, p.x, p.y);
          return;
        }
        const doCompendio = e.dataTransfer.getData(TIPO_DO_ARRASTO_DO_COMPENDIO);
        if (!doCompendio || !aoSoltarDoCompendio) return;
        e.preventDefault();
        const p = mapa.current?.pontoDaPaginaEmMetros(e.clientX, e.clientY);
        if (p) aoSoltarDoCompendio(doCompendio, p.x, p.y);
      }}
    />
  );
}
