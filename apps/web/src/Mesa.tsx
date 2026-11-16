import {
  type AvisoDeContas,
  alcanceDaMemoria,
  alcanceDeVisao,
  cenaEhCartao,
  controlaToken,
  type DesenhoEmAndamento,
  type DesenhoNovo,
  dentroDaAreaDaBandeira,
  type Exportacao,
  ehArquivoUniversalVtt,
  ehPersonagemDeJogador,
  encaixarNoGrid,
  type FonteDeLuz,
  hashesPreparaveis,
  iluminacaoDinamicaLigada,
  jogadoresDaMesa,
  jogadorVeABandeira,
  lerEntradaArrastada,
  limitarAlcance,
  limiteDeVisaoDoToken,
  membrosDaMesa,
  modInteligenciaDe,
  nevoaCobreAlgo,
  PASTA_NPCS_ID,
  personagemDoMonstro,
  pode,
  podeColocarProprioToken,
  podeEditarPersonagem,
  podeMoverToken,
  resumoDaImportacao,
  type TipoDeParede,
  type Token,
  visaoLimitadaNaCena,
  visaoNoEscuroDe,
  visaoPara,
  type Zona,
} from "@tabletop/shared";
import {
  BookOpen,
  MapPin,
  MessagesSquare,
  NotebookText,
  Pin,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AbaChat } from "./AbaChat";
import { AbaCompendio } from "./AbaCompendio";
import { AbaFichas } from "./AbaFichas";
import { AbaMesa, testidDaSecaoDaMesa } from "./AbaMesa";
import { AvisoDaImportacao, type EstadoDaImportacao } from "./AvisoDaImportacao";
import { AvisoDaPasta } from "./AvisoDaPasta";
import { AvisoPerto } from "./AvisoPerto";
import { AbaPreferencias } from "./abas";
import { type DadosDaMesa, marcarTourVisto } from "./api";
import { caixaDaArea } from "./area";
import { itemEmArrastoAgora, lerItemArrastado, ouvirArrasto } from "./arrasto";
import { CacheOpfs } from "./assets/cache";
import { Fontes } from "./assets/fontes";
import { ganchosDoTeste, instalarGanchoDeAssets } from "./assets/ganchoE2E";
import { type Canal, GerenteDeAssets } from "./assets/gerente";
import { Processador } from "./assets/processador";
import { BotoesDaBarra } from "./automacoes/ChipsDaBarra";
import { JanelaDasAutomacoes } from "./automacoes/JanelaDasAutomacoes";
import { BarraDeFerramentas } from "./BarraDeFerramentas";
import { BarraLateral, type PedidoDeAba } from "./BarraLateral";
import { BotaoComDica } from "./BotaoComDica";
import { AvisoDaCaixaDoClaude, copiarParaAPasta, useCaixaDoClaude } from "./caixaDoClaude";
import { type CamadaDeTrabalho, camadaDoNovoToken } from "./camadas";
import { RascunhosDoClaude } from "./claude/RascunhosDoClaude";
import { pedirTokenNoMapa, TEXTO_FORA_DA_BANDEIRA } from "./colocarNoMapa";
import { ATRASO_DA_DICA } from "./Dica";
import { EstadoDaMesa } from "./EstadoDaMesa";
import { FaixaDeCenas, type PedirImagem } from "./FaixaDeCenas";
import {
  abrirFichaEmJanela,
  abrirSomEmJanela,
  ID_DA_MESA_DE_SOM,
  TEXTO_DO_POPUP_BLOQUEADO,
  trazerFichaDeFora,
  useAcompanharFichasFora,
  useFichasFora,
} from "./ficha/foraDaMesa";
import { JanelaDaFicha } from "./ficha/JanelaDaFicha";
import { type AbaDaFicha, useJanelasDeFicha } from "./ficha/janelas";
import { useJanelasDeHandout } from "./handouts";
import { JanelaDoHandout } from "./JanelaDoHandout";
import { useLarguraDoPainel } from "./larguraDoPainel";
import { MarcasDoToken } from "./MarcasDoToken";
import { MenuDaTocha } from "./MenuDaTocha";
import { MenuDoToken } from "./MenuDoToken";
import { MenuSuperior } from "./MenuSuperior";
import { Mapa } from "./mapa/Mapa";
import {
  type ConfigDaNevoa,
  type ConfigDeVisao,
  type DicaDoMapa,
  type Ferramenta,
  type ImagensDoMapa,
  type MapaPixi,
  type MedicaoFixa,
  type MedicaoNaTela,
  NEVOA_PADRAO,
  type RetornosDoMapa,
} from "./mapa/mapaPixi";
import { menuNativoDeveSumir } from "./menuNativo";
import { NovoToken, type NovoTokenPedido } from "./NovoToken";
import { OrdemDeTurno } from "./OrdemDeTurno";
import { PainelDaNevoa } from "./PainelDaNevoa";
import { PainelDaRegua } from "./PainelDaRegua";
import { PainelDasParedes } from "./PainelDasParedes";
import { PainelDasZonas } from "./PainelDasZonas";
import { PainelDeFontesDeLuz } from "./PainelDeFontesDeLuz";
import { PainelDeIluminacao } from "./PainelDeIluminacao";
import { PainelDoSom } from "./PainelDoSom";
import { PainelDoToken } from "./PainelDoToken";
import { PertoDoPonto } from "./PertoDoPonto";
import { useFecharFora } from "./Popover";
import { PresencaNoTopo } from "./PresencaNoTopo";
import { type ConfigDoPincel, PINCEL_PADRAO } from "./pincel";
import {
  gravarEncaixePadrao,
  gravarReguaGrudar,
  lerEncaixePadrao,
  lerReguaGrudar,
} from "./preferencias";
import { tituloDaMesa } from "./rotas";
import { SeletorDeImagem } from "./SeletorDeImagem";
import { AvisoDoSom } from "./som/AvisoDoSom";
import { useSomDaMesa } from "./som/useSomDaMesa";
import { Topo } from "./Topo";
import { useTempoDaSala } from "./tempo";
import { passosDoPapel } from "./tour/passos";
import { Tour } from "./tour/Tour";
import { useUnidade } from "./unidade";
import { haDialogoAberto } from "./useDialogo";
import { useSala } from "./useSala";
import { ZoomFlutuante } from "./ZoomFlutuante";

// 7b-2: sem zonas (o jogador nunca as recebe); uma lista fixa para a tela não redesenhar à toa.
const SEM_ZONAS: Zona[] = [];
const CHAVE_COMO = "tabletop:chat:como:";

function lerComo(usuarioId: string): string {
  try {
    return localStorage.getItem(CHAVE_COMO + usuarioId) ?? "";
  } catch {
    return "";
  }
}

function baixarExportacao(exportacao: Exportacao) {
  const blob = new Blob([JSON.stringify(exportacao, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `campanha-${exportacao.exportadoEm.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "1 pedido de entrada", "2 pedidos de entrada" e, se houver, "1 pedido de redefinição". */
function textoDoAvisoDeContas(aviso: AvisoDeContas | null): string {
  const partes: string[] = [];
  const p = aviso?.pendentes ?? 0;
  const r = aviso?.redefinicoes ?? 0;
  if (p > 0) partes.push(`${p} ${p === 1 ? "pedido" : "pedidos"} de entrada`);
  if (r > 0) partes.push(`${r} ${r === 1 ? "pedido" : "pedidos"} de redefinição`);
  return partes.join(" e ");
}

const semAssinatura = () => () => {};
const versaoZero = () => 0;

type Props = {
  /** A mesa (id, nome e se é a legada) a que esta tela está ligada. */
  mesa: DadosDaMesa;
  /** O login da conta de quem está na mesa (falta no login solto de teste); a troca de senha usa. */
  login?: string | undefined;
  /** O tour de introdução abre sozinho (primeiro acesso desta conta a esta mesa). */
  tourAutomatico?: boolean;
  aoSair: () => void;
  aoPerderSessao: () => void;
  /** Vai para a tela inicial (`/`). */
  aoTrocarDeMesa: () => void;
  /** O mestre mudou o nome da mesa (o título da aba e a lista local acompanham). */
  aoRenomear: (nome: string) => void;
};

type PedidoDeImagem = {
  titulo: string;
  tipo: "mapa" | "token" | "retrato";
  aoUsar: (hash: string) => void;
};

/**
 * A mesa: quatro regiões fixas (topo, ferramentas, painel direito e, no meio, a área do mapa). Tudo o
 * que abre sobre o mapa fica dentro da área dele, sem cobrir as barras (REDESIGN.md, R2).
 */
export function Mesa({
  mesa,
  login,
  tourAutomatico = false,
  aoSair,
  aoPerderSessao,
  aoTrocarDeMesa,
  aoRenomear,
}: Props) {
  const {
    status,
    estado,
    eu,
    presenca,
    uso,
    aviso,
    avisar,
    dispensarAviso,
    preparos,
    chatTemMais,
    avisoDeContas,
    pendentesDaCaixa,
    claudeConectado,
    enviar,
    enviarBinario,
    bufferizado,
    conectado,
    ouvir,
  } = useSala({
    mesaId: mesa.id,
    aoExportar: baixarExportacao,
    aoPerderSessao,
    aoRenomear,
  });

  const [ferramenta, setFerramenta] = useState<Ferramenta>("selecionar");
  const [camadaTrabalho, setCamadaTrabalho] = useState<CamadaDeTrabalho>("tokens");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  // O jogador fecha a ordem de turno só na tela dele; reaparece quando o mestre a reabre (V2).
  const [ordemFechadaAqui, setOrdemFechadaAqui] = useState(false);
  const ordemAbertaNaSala = estado?.ordemDeTurnoVisivel === true;
  // biome-ignore lint/correctness/useExhaustiveDependencies: o gatilho é a mudança do mestre
  useEffect(() => setOrdemFechadaAqui(false), [ordemAbertaNaSala]);
  // Pincel (Lote 13): o que ele faz agora e o desenho selecionado (só da tela de quem desenha).
  const [pincel, setPincel] = useState<ConfigDoPincel>(PINCEL_PADRAO);
  const [desenhoSelecionadoId, setDesenhoSelecionadoId] = useState<string | null>(null);
  const [encaixe, setEncaixe] = useState(lerEncaixePadrao);
  // V13: a régua gruda no grid (preferência desta pessoa) e a unidade das distâncias (metros ou pés).
  const [reguaGrudar, setReguaGrudar] = useState(lerReguaGrudar);
  const unidade = useUnidade();
  const [zoom, setZoom] = useState(1);
  const [medicao, setMedicao] = useState<MedicaoNaTela | null>(null);
  // Régua (R5a): as medidas fixadas na tela (só de quem mediu).
  const [reguasFixas, setReguasFixas] = useState<MedicaoFixa[]>([]);
  // O painel do token só abre por "Editar token…" ou por dois cliques; selecionar só seleciona (R5a).
  const [painelDoTokenAberto, setPainelDoTokenAberto] = useState(false);
  // "Novo token": o formulário (nome, cor, tamanho) e, depois dele, o modo de clicar no mapa para pôr.
  const [formNovoToken, setFormNovoToken] = useState(false);
  const [tokenParaPor, setTokenParaPor] = useState<NovoTokenPedido | null>(null);
  // A regra de uma condição aberta por clique no marcador (popover).
  const [regraAberta, setRegraAberta] = useState<DicaDoMapa | null>(null);
  const [lateralAberta, setLateralAberta] = useState(true);
  const {
    largura: larguraDoPainel,
    limites: limitesDoPainel,
    definir: ajustarPainel,
  } = useLarguraDoPainel();
  const [faixaAberta, setFaixaAberta] = useState(false);
  // Visão do mestre (V5, antes "Visão noturna"): ligada por padrão; só da tela dele (nunca vai para a sala).
  // Ligada: a visão noturna e os contornos das paredes e portas. Desligada: o mapa claro, sem contornos.
  const [visaoDoMestre, setVisaoDoMestre] = useState(true);
  // V5: a tecla A da ferramenta de paredes (linha ou arco), só para o painel mostrar.
  const [arcoLigado, setArcoLigado] = useState(false);
  const [paredeSelecionadaId, setParedeSelecionadaId] = useState<string | null>(null);
  const [tipoDaNovaParede, setTipoDaNovaParede] = useState<TipoDeParede>("parede");
  // 7b-2: a zona selecionada na ferramenta Zonas (só do mestre).
  const [zonaSelecionadaId, setZonaSelecionadaId] = useState<string | null>(null);
  // N4: a ferramenta Névoa (só do mestre): cobrir ou revelar, a forma e o raio do pincel. Só da tela dele.
  const [nevoa, setNevoa] = useState<ConfigDaNevoa>(NEVOA_PADRAO);
  // Painéis do mestre (menu da lanterna): fontes de luz e configurações de iluminação.
  const [fontesAbertas, setFontesAbertas] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);
  // 7b-3: o editor das automações (janela aberta pela aba Mesa; só do mestre).
  const [automacoesAbertas, setAutomacoesAbertas] = useState(false);
  // N5: o painel de Som do mestre.
  const [somAberto, setSomAberto] = useState(false);
  const [luzSelecionadaId, setLuzSelecionadaId] = useState<string | null>(null);
  // Pontos de luz (suporte e inflamável): o que o mestre edita e o tipo que a ferramenta cria.
  const [pontoSelecionadoId, setPontoSelecionadoId] = useState<string | null>(null);
  const [tipoDoNovoPonto, setTipoDoNovoPonto] = useState<"suporte" | "inflamavel">("suporte");
  // O menu do botão direito na alça da tocha (posição na página).
  const [menuDaTocha, setMenuDaTocha] = useState<{ luzId: string; x: number; y: number } | null>(
    null,
  );
  // O menu do botão direito no token (posição na página) e a dica do marcador de condição sob o mouse.
  const [menuDoToken, setMenuDoToken] = useState<{
    tokenId: string;
    x: number;
    y: number;
    teclado?: boolean;
  } | null>(null);
  const [dicaDoMapa, setDicaDoMapa] = useState<DicaDoMapa | null>(null);
  // A dica de um marcador é conteúdo, não dica de botão, mas espera o mesmo atraso (V3b): o mapa avisa a cada
  // movimento do mouse e a dica só abre se o ponteiro ficar sobre o marcador; aberta, acompanha o ponteiro.
  const esperaDaDicaDoMapa = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dicaDoMapaAberta = useRef(false);
  const pedidaDaDicaDoMapa = useRef<DicaDoMapa | null>(null);
  const mostrarDicaDoMapa = useCallback((d: DicaDoMapa | null) => {
    pedidaDaDicaDoMapa.current = d;
    if (d === null) {
      if (esperaDaDicaDoMapa.current !== null) clearTimeout(esperaDaDicaDoMapa.current);
      esperaDaDicaDoMapa.current = null;
      dicaDoMapaAberta.current = false;
      setDicaDoMapa(null);
      return;
    }
    if (dicaDoMapaAberta.current) {
      setDicaDoMapa(d);
      return;
    }
    if (esperaDaDicaDoMapa.current !== null) return;
    esperaDaDicaDoMapa.current = setTimeout(() => {
      esperaDaDicaDoMapa.current = null;
      dicaDoMapaAberta.current = true;
      setDicaDoMapa(pedidaDaDicaDoMapa.current);
    }, ATRASO_DA_DICA);
  }, []);
  // "Ver como o jogador X" (só da tela do mestre): `null` = ele mesmo.
  const [verComoId, setVerComoId] = useState<string | null>(null);
  // Chat: de quem estou falando (vale também para os dados rápidos), a aba à vista e até onde já li.
  const [comoId, setComoId] = useState("");
  const [abaVisivel, setAbaVisivel] = useState<string | null>("chat");
  // Pedido de abrir uma aba do painel direito (o atalho "Modelos de tocha…" do menu de Luz).
  const [pedidoDeAba, setPedidoDeAba] = useState<PedidoDeAba | null>(null);
  // O tour de introdução: abre sozinho no primeiro acesso da conta (o servidor guarda "já viu") e em "Fazer o tour de novo".
  const [tourAberto, setTourAberto] = useState(tourAutomatico);
  const abrirAbaDoTour = useCallback(
    (abaId: string) => setPedidoDeAba((antes) => ({ n: (antes?.n ?? 0) + 1, abaId })),
    [],
  );
  const fecharTour = useCallback(() => {
    setTourAberto(false);
    if (login) void marcarTourVisto(mesa.id);
  }, [login, mesa.id]);
  const [vistoAteSeq, setVistoAteSeq] = useState<number | null>(null);
  const [pedidoDeImagem, setPedidoDeImagem] = useState<PedidoDeImagem | null>(null);
  // A cena que o mestre olha (e edita) sem mover o grupo: estado local da tela dele. `null` = a do grupo.
  const [cenaVistaId, setCenaVistaId] = useState<string | null>(null);
  const mapa = useRef<MapaPixi | null>(null);
  const colocarTokenAtual = useRef<((x: number, y: number) => void) | null>(null);
  // As fichas abertas em janelas flutuantes (várias ao mesmo tempo).
  const {
    janelas: janelasDeFicha,
    abrir: abrirFicha,
    fechar: fecharFicha,
    atualizar: atualizarFicha,
  } = useJanelasDeFicha();
  // V9: as fichas que estão numa janela própria do navegador saem da pilha desta tela; abrir uma delas traz a janela.
  useAcompanharFichasFora(mesa.id);
  const fichasFora = useFichasFora();
  const abrirOuTrazerFicha = useCallback(
    (personagemId: string, aba?: AbaDaFicha) => {
      if (fichasFora.has(personagemId) && trazerFichaDeFora(mesa.id, personagemId)) return;
      abrirFicha(personagemId, aba);
    },
    [fichasFora, mesa.id, abrirFicha],
  );
  const abrirFichaEmOutraJanela = useCallback(
    (personagemId: string) => {
      const el = document.querySelector<HTMLElement>(
        `[data-testid="janela-ficha"][data-personagem-id="${personagemId}"]`,
      );
      const r = el?.getBoundingClientRect();
      const medida = { largura: r?.width ?? 880, altura: r?.height ?? 700 };
      if (!abrirFichaEmJanela(mesa.id, personagemId, medida)) avisar(TEXTO_DO_POPUP_BLOQUEADO);
    },
    [mesa.id, avisar],
  );

  // Q4b: a mesa de som numa janela própria (o mesmo caminho da ficha): sai da tela daqui e volta quando a janela fecha.
  const somFora = fichasFora.has(ID_DA_MESA_DE_SOM);
  const alternarSom = useCallback(() => {
    if (somFora) {
      // Com a janela aberta, o botão do som a traz para a frente (se ela sumiu, a mesa de som volta para cá).
      if (!trazerFichaDeFora(mesa.id, ID_DA_MESA_DE_SOM)) setSomAberto(true);
      return;
    }
    setSomAberto((v) => !v);
  }, [somFora, mesa.id]);
  const abrirSomEmOutraJanela = useCallback(() => {
    // O tamanho da primeira vez (depois a janela lembra o dela): estreita e alta, como o painel do som.
    if (!abrirSomEmJanela(mesa.id, { largura: 460, altura: 720 })) avisar(TEXTO_DO_POPUP_BLOQUEADO);
  }, [mesa.id, avisar]);

  // Os handouts abertos em janelas (V3): os que a pessoa abre e os que o mestre manda abrir ("Mostrar agora").
  const {
    abertos: handoutsAbertos,
    abrir: abrirHandout,
    fechar: fecharHandout,
  } = useJanelasDeHandout();

  // Arquivos locais (PROJETO.md 4.3): fontes (pasta, soltos), processador (worker) e o gerente
  // (cache OPFS, pedidos, envio). O gerente nasce quando sei quem sou.
  const processador = useMemo(() => new Processador(), []);
  const fontes = useMemo(() => new Fontes(mesa.id, mesa.legada), [mesa.id, mesa.legada]);
  const [gerente, setGerente] = useState<GerenteDeAssets | null>(null);
  const canal = useRef<Canal>({ conectado, enviar, enviarBinario, bufferizado });
  canal.current = { conectado, enviar, enviarBinario, bufferizado };
  const estadoAtual = useRef(estado);
  estadoAtual.current = estado;
  const euAtual = useRef(eu);
  euAtual.current = eu;
  const euId = eu?.id;

  const euMestre = eu?.papel === "mestre";
  // C2: quantos pedidos de entrada e de redefinição de senha esperam o mestre (a sala avisa só a ele).
  const pedidosDeConta = (avisoDeContas?.pendentes ?? 0) + (avisoDeContas?.redefinicoes ?? 0);
  // Algum mestre online? Enquanto a presença não chegou, supõe que sim (para não avisar à toa).
  const mestreOnline =
    Object.keys(presenca).length === 0 ||
    (estado?.usuarios.some((u) => u.papel === "mestre" && presenca[u.id] === "online") ?? true);
  // Pausa automática (R2b) vista por quem joga: pausada e sem mestre online. Na hora em que isso acontece, um aviso.
  const pausadaSemMestre = !euMestre && estado?.relogio.pausada === true && !mestreOnline;
  const avisouSemMestre = useRef(false);
  useEffect(() => {
    if (pausadaSemMestre && !avisouSemMestre.current) {
      avisar("Mesa pausada: o mestre saiu. Ela volta quando o mestre retomar.");
    }
    avisouSemMestre.current = pausadaSemMestre;
  }, [pausadaSemMestre, avisar]);
  // O tempo restante das luzes e o relógio da sala: a sala manda, a tela só anima entre os envios.
  const tempo = useTempoDaSala(estado);
  const permissoes = estado?.permissoes;
  const cenaAtivaId = estado?.cenaAtivaId;
  const personagens = estado?.personagens;
  const handoutsDoEstado = estado?.handouts;

  // 7b-2: o atalho Z (ferramenta Zonas) só vale para o mestre vendo como mestre; os valores vêm de refs.
  const modoMestreAtual = useRef(false);
  const alternarZonasAtual = useRef<() => void>(() => {});
  const alternarNevoaAtual = useRef<() => void>(() => {});
  const apagarZonaAtual = useRef<(id: string) => void>(() => {});
  // Atalhos de ferramenta (V, H, R, Z), exceto enquanto escreve num campo.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target;
      if (alvo instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "v") setFerramenta("selecionar");
      else if (tecla === "h") setFerramenta("mao");
      else if (tecla === "r") setFerramenta("regua");
      else if (tecla === "z" && !e.shiftKey && modoMestreAtual.current)
        alternarZonasAtual.current();
      else if (tecla === "n" && !e.shiftKey && modoMestreAtual.current)
        alternarNevoaAtual.current();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // Esc (R5a): solta a seleção, fecha os menus e a regra aberta e cancela o modo "pôr token". Não age com o
  // foco num campo de texto nem dentro de uma janela (Esc não fecha janelas, decisão do R3; soltar a seleção
  // fecharia o painel do token). O mapa cancela os gestos dele por conta própria.
  useEffect(() => {
    function aoTeclarEsc(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const alvo = e.target;
      if (
        alvo instanceof HTMLElement &&
        (alvo.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) ||
          alvo.closest(".janela") !== null)
      ) {
        return;
      }
      setSelecionadoId(null);
      setDesenhoSelecionadoId(null);
      setMenuDoToken(null);
      setMenuDaTocha(null);
      setRegraAberta(null);
      mostrarDicaDoMapa(null);
      setTokenParaPor(null);
    }
    window.addEventListener("keydown", aoTeclarEsc);
    return () => window.removeEventListener("keydown", aoTeclarEsc);
  }, [mostrarDicaDoMapa]);

  const chatDaMesa = estado?.chat;
  const ultimoSeqDoChat = chatDaMesa?.[chatDaMesa.length - 1]?.seq ?? 0;
  // O que já estava no chat ao abrir não conta como "não lida"; depois, vale o que chega com a aba fechada.
  useEffect(() => {
    if (!chatDaMesa) return;
    if (vistoAteSeq === null || (abaVisivel === "chat" && ultimoSeqDoChat > vistoAteSeq)) {
      setVistoAteSeq(ultimoSeqDoChat);
    }
  }, [chatDaMesa, ultimoSeqDoChat, abaVisivel, vistoAteSeq]);
  const naoLidas =
    vistoAteSeq === null
      ? 0
      : (chatDaMesa ?? []).filter((m) => m.seq > vistoAteSeq && m.autorId !== euId).length;

  // Lembra o "Como:" deste usuário neste navegador.
  useEffect(() => {
    if (euId) setComoId(lerComo(euId));
  }, [euId]);
  function mudarComo(id: string) {
    setComoId(id);
    try {
      if (euId) localStorage.setItem(CHAVE_COMO + euId, id);
    } catch {
      // sem localStorage: vale só nesta sessão
    }
  }

  useEffect(() => {
    void fontes.iniciar();
  }, [fontes]);

  useEffect(() => {
    if (!euId) return;
    const g = new GerenteDeAssets({
      cache: new CacheOpfs(),
      processador,
      canal: () => canal.current,
      meuId: euId,
      euMestre: () => euAtual.current?.papel === "mestre",
      nomeDoUsuario: (id) => estadoAtual.current?.usuarios.find((u) => u.id === id)?.nome,
      destinoDeCopia: () => fontes.destinoDeCopia(),
      pastaDosArquivos: () => fontes.pastaDosArquivos(),
      ganchos: ganchosDoTeste,
    });
    let vivo = true;
    const desinstalar = instalarGanchoDeAssets(g, fontes);
    g.iniciar()
      .then(() => {
        if (!vivo) return;
        setGerente(g);
        g.aoConectar();
      })
      .catch((e) => console.error("Falha ao iniciar os arquivos locais", e));
    return () => {
      vivo = false;
      desinstalar();
      g.encerrar();
      setGerente(null);
    };
  }, [euId, fontes, processador]);

  // O vaivém de arquivos: mensagens da sala, frames binários e reconexões vão para o gerente.
  useEffect(() => {
    if (!gerente) return;
    return ouvir((o) => {
      if (o.tipo === "asset") gerente.aoMensagem(o.mensagem);
      else if (o.tipo === "binario") gerente.aoPedaco(o.dados);
      else if (o.tipo === "conectado") gerente.aoConectar();
      else if (o.tipo === "erro") gerente.aoErro(o.idPedido, o.codigo);
    });
  }, [gerente, ouvir]);

  const versaoDosProntos = useSyncExternalStore(
    gerente?.assinarProntos ?? semAssinatura,
    gerente?.versaoDeProntos ?? versaoZero,
  );
  const versaoDoGerente = useSyncExternalStore(
    gerente?.assinar ?? semAssinatura,
    gerente?.versaoAtual ?? versaoZero,
  );
  // N5: o som da mesa (trilha, efeitos, zonas); o aviso "Clique para ativar" e o cartão das Preferências usam o `bloqueado`.
  const som = useSomDaMesa({
    estado,
    gerente,
    versaoDosProntos,
    ouvir,
    euMestre,
    selecionadoId,
  });
  // M1: os arquivos que o Claude mandou (só o mestre): baixa da caixa da sala, processa como o botão de subir e conclui.
  const andamentoDaCaixa = useCaixaDoClaude({
    mesaId: mesa.id,
    euMestre,
    gerente,
    fontes,
    pendentes: pendentesDaCaixa,
    enviar,
  });
  const registrarSom = useCallback(
    (arquivo: File) => {
      if (!gerente) return Promise.reject(new Error("Os arquivos da mesa ainda estão abrindo."));
      return gerente.registrarSom(arquivo);
    },
    [gerente],
  );
  // Q3: importar um mapa do Dungeondraft (Universal VTT) pelo botão do painel de cenas ou arrastando o arquivo para a mesa.
  const [importacao, setImportacao] = useState<EstadoDaImportacao | null>(null);
  const importarMapaUvtt = useCallback(
    async (arquivo: File) => {
      if (!euMestre) return;
      if (!gerente) {
        setImportacao({ fase: "erro", texto: "os arquivos da mesa ainda estão abrindo." });
        return;
      }
      setImportacao({ fase: "lendo", nome: arquivo.name });
      try {
        const lido = await gerente.lerMapaUniversalVtt(arquivo);
        await copiarParaAPasta(fontes, "mapa-uvtt", lido.imagem);
        if (enviar("cena.importarMapa", { ...lido.importacao, assetHash: lido.hash }) === null) {
          throw new Error("Sem conexão com a sala.");
        }
        setImportacao({ fase: "pronto", texto: resumoDaImportacao(lido.importacao) });
      } catch (e) {
        setImportacao({
          fase: "erro",
          texto: e instanceof Error ? e.message : "o arquivo não serviu.",
        });
      }
    },
    [euMestre, gerente, fontes, enviar],
  );
  useEffect(() => {
    if (!euMestre) return;
    const temArquivo = (e: DragEvent) => e.dataTransfer?.types.includes("Files") === true;
    const sobre = (e: DragEvent) => {
      if (temArquivo(e)) e.preventDefault();
    };
    const soltou = (e: DragEvent) => {
      const arquivo = [...(e.dataTransfer?.files ?? [])].find((f) => ehArquivoUniversalVtt(f.name));
      if (!arquivo) return;
      e.preventDefault();
      void importarMapaUvtt(arquivo);
    };
    window.addEventListener("dragover", sobre);
    window.addEventListener("drop", soltou);
    return () => {
      window.removeEventListener("dragover", sobre);
      window.removeEventListener("drop", soltou);
    };
  }, [euMestre, importarMapaUvtt]);
  const imagens = useMemo<ImagensDoMapa | null>(
    () =>
      gerente
        ? {
            meta: (h) => gerente.meta(h),
            pronto: (h) => gerente.estaPronto(h),
            blob: (h) => gerente.blobDe(h),
          }
        : null,
    [gerente],
  );
  const transferindo =
    gerente !== null &&
    versaoDoGerente >= 0 &&
    gerente.listarStatus().some((s) => s.estado === "pedindo" || s.estado === "baixando");

  // Movimento ao vivo dos outros e recusas da sala vão direto para o mapa (sem re-renderizar).
  useEffect(
    () =>
      ouvir((o) => {
        if (o.tipo === "movendo") mapa.current?.movendo(o.id, o.x, o.y);
        else if (o.tipo === "rascunho") mapa.current?.rascunhoRecebido(o.desenho);
        else if (o.tipo === "rascunhoFim") mapa.current?.rascunhoEncerrado(o.id);
        else if (o.tipo === "ping") mapa.current?.pingRecebido(o.ping);
        else if (o.tipo === "conectado") mapa.current?.limparRascunhos();
        else if (o.tipo === "erro") mapa.current?.ressincronizar();
      }),
    [ouvir],
  );

  // "Mostrar agora" (V3): a sala só manda este evento a quem vê o handout; quem o mandou já está com ele aberto.
  useEffect(
    () =>
      ouvir((o) => {
        if (o.tipo !== "evento" || o.evento.tipo !== "handout.mostrado") return;
        if (o.evento.origem.usuarioId === euAtual.current?.id) return;
        abrirHandout(o.evento.dados.id);
      }),
    [ouvir, abrirHandout],
  );

  // Cena do grupo e cena vista. O jogador só tem a do grupo (a sala não manda as outras).
  const cenaDoGrupo = estado?.cenas.find((c) => c.id === estado.cenaAtivaId) ?? estado?.cenas[0];
  // "Ver como o jogador X": o mestre passa a ver o que a sala mandaria a ele (o mesmo filtro), na cena do grupo.
  const usuarioVisto =
    euMestre && verComoId !== null
      ? ((estado ? jogadoresDaMesa(estado) : []).find((u) => u.id === verComoId) ?? null)
      : null;
  const modoMestre = euMestre && usuarioVisto === null;
  const cena =
    (usuarioVisto
      ? undefined
      : euMestre && cenaVistaId
        ? estado?.cenas.find((c) => c.id === cenaVistaId)
        : undefined) ?? cenaDoGrupo;
  const estadoVisto = useMemo(
    () => (estado && usuarioVisto ? visaoPara(estado, usuarioVisto) : estado),
    [estado, usuarioVisto],
  );
  // O anel da vez: a entrada da vez que quem olha recebe (o filtro da sala já tirou as que ele não vê).
  const combateVisto = estadoVisto?.combate;
  const tokenDaVezId =
    combateVisto?.entradas.find((e) => e.id === combateVisto.atualId)?.tokenId ?? null;
  const selecionado =
    estado?.tokens.find((t) => t.id === selecionadoId && t.cenaId === cena?.id) ?? null;
  // N1: as marcas de vida e CA do token selecionado: o mestre vê em todos; o jogador, só no token que controla.
  const personagemDoSelecionado =
    selecionado?.personagemId !== undefined
      ? estado?.personagens.find((p) => p.id === selecionado.personagemId)
      : undefined;
  const marcasDoTokenVisiveis =
    selecionado !== null &&
    estado !== null &&
    eu !== null &&
    usuarioVisto === null &&
    (euMestre || controlaToken(selecionado, eu, estado.personagens));
  // Menu do token pelo teclado (R6a): com um token selecionado e o foco no mapa (ou em nada), Shift+F10 ou a tecla
  // de menu abre o mesmo menu do botão direito junto do token, e o foco vai para o primeiro item. Quem pode abrir
  // é a mesma regra do botão direito: o mestre sempre, o jogador no token que controla.
  const menuDoTokenAberto = menuDoToken !== null;
  const cenaDoMenuId = cena?.id;
  useEffect(() => {
    let abriuNoTeclado = 0;
    function aoTeclarMenu(e: KeyboardEvent) {
      const porF10 = e.key === "F10" && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
      if (!porF10 && e.key !== "ContextMenu") return;
      const alvo = e.target;
      const noMapa =
        alvo === document.body ||
        (alvo instanceof HTMLElement && alvo.matches("[data-testid='mapa']"));
      if (!noMapa || menuDoTokenAberto || usuarioVisto !== null) return;
      const quem = euAtual.current;
      const sala = estadoAtual.current;
      const m = mapa.current;
      if (!quem || !sala || !m) return;
      // Com um token selecionado (o jogador seleciona os que controla, V2) a tecla abre o menu dele; sem seleção, o
      // jogador cai no token que controla na cena (o primeiro, se forem vários) (assumido).
      const alvoDoMenu =
        selecionado ??
        (quem.papel === "mestre"
          ? null
          : (sala.tokens.find(
              (t) => t.cenaId === cenaDoMenuId && controlaToken(t, quem, sala.personagens),
            ) ?? null));
      if (!alvoDoMenu) return;
      if (quem.papel !== "mestre" && !controlaToken(alvoDoMenu, quem, sala.personagens)) return;
      e.preventDefault();
      abriuNoTeclado = performance.now();
      const p = m.pontoDoMundoNaPagina(alvoDoMenu.x, alvoDoMenu.y);
      document.querySelector<HTMLElement>("[data-testid='mapa']")?.focus({ preventScroll: true });
      setMenuDaTocha(null);
      setMenuDoToken({ tokenId: alvoDoMenu.id, x: p.x + 28, y: p.y, teclado: true });
    }
    // A tecla de menu também dispara o menu nativo do navegador: some quando fomos nós a abrir o nosso.
    function aoMenuNativo(e: MouseEvent) {
      if (performance.now() - abriuNoTeclado < 700) e.preventDefault();
    }
    window.addEventListener("keydown", aoTeclarMenu);
    window.addEventListener("contextmenu", aoMenuNativo);
    return () => {
      window.removeEventListener("keydown", aoTeclarMenu);
      window.removeEventListener("contextmenu", aoMenuNativo);
    };
  }, [menuDoTokenAberto, selecionado, usuarioVisto, cenaDoMenuId]);
  // V10: o clique direito em qualquer ponto da área do mapa (token, menus, nomes, popups) nunca abre o menu do
  // navegador. Na captura e uma vez só: nenhum outro ouvinte (nem a ordem em que foram registrados) muda isso.
  useEffect(() => {
    const aoMenuNativoNaArea = (e: MouseEvent) => {
      if (menuNativoDeveSumir(e.target)) e.preventDefault();
    };
    window.addEventListener("contextmenu", aoMenuNativoNaArea, true);
    return () => window.removeEventListener("contextmenu", aoMenuNativoNaArea, true);
  }, []);
  // V10: com um token selecionado e o foco no mapa (ou em nada), Delete tira o token do mapa e as setas o andam
  // um quadrado. Tudo pelas intenções de sempre (`token.apagar`, `token.soltar`): a sala confere permissão e parede.
  const aoTeclarNoMapa = useRef<(e: KeyboardEvent) => void>(() => {});
  const ultimoPassoDeSeta = useRef(0);
  const seguirOToken = useRef(0);
  aoTeclarNoMapa.current = (e) => {
    const ehSeta = e.key.startsWith("Arrow");
    const ehApagar = e.key === "Delete" || e.key === "Backspace";
    if ((!ehSeta && !ehApagar) || e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    const alvo = e.target;
    const noMapa =
      alvo === document.body ||
      (alvo instanceof HTMLElement && alvo.matches("[data-testid='mapa']"));
    if (!noMapa || haDialogoAberto() || tourAberto || menuDoTokenAberto || menuDaTocha) return;
    if (!selecionado || ferramenta !== "selecionar" || usuarioVisto !== null) return;
    const sala = estadoAtual.current;
    const quem = euAtual.current;
    if (!sala || !quem) return;

    if (ehApagar) {
      e.preventDefault();
      if (e.repeat) return;
      const meu =
        quem.papel === "mestre" ||
        (selecionado.camada === "tokens" && controlaToken(selecionado, quem, sala.personagens));
      if (!meu) {
        avisar("Você só pode tirar do mapa os tokens que controla.");
        return;
      }
      const id = selecionado.id;
      enviar("token.apagar", { id });
      setSelecionadoId(null);
      // A sala guarda o token por uns segundos: o "Desfazer" o traz de volta (a ficha nunca foi tocada).
      avisar("Token removido do mapa.", {
        rotulo: "Desfazer",
        aoClicar: () => enviar("token.restaurar", { id }),
      });
      return;
    }

    // As setas: um toque, um quadrado. Segurar repete, no máximo ~8 passos por segundo.
    e.preventDefault();
    e.stopPropagation();
    const agora = performance.now();
    if (e.repeat && agora - ultimoPassoDeSeta.current < 125) return;
    if (!podeMoverToken(selecionado, quem, sala)) return;
    const q = cena?.grid.quadradoM ?? 1.5;
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    const alvoM = encaixarNoGrid(
      { x: selecionado.x + dx * q, y: selecionado.y + dy * q },
      selecionado.tamanhoQuadrados,
      q,
    );
    if (alvoM.x === selecionado.x && alvoM.y === selecionado.y) return;
    ultimoPassoDeSeta.current = agora;
    seguirOToken.current = agora;
    enviar("token.soltar", { id: selecionado.id, x: alvoM.x, y: alvoM.y });
  };
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => aoTeclarNoMapa.current(e);
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, []);
  // A câmera acompanha o token andado pelas setas: se ele sair da tela, o mapa desliza até mantê-lo à vista.
  const selecionadoX = selecionado?.x;
  const selecionadoY = selecionado?.y;
  useEffect(() => {
    if (selecionadoX === undefined || selecionadoY === undefined) return;
    if (performance.now() - seguirOToken.current < 1500) {
      mapa.current?.manterVisivel(selecionadoX, selecionadoY);
    }
  }, [selecionadoX, selecionadoY]);
  const paredeSelecionada =
    estado?.paredes.find((x) => x.id === paredeSelecionadaId && x.cenaId === cena?.id) ?? null;
  const zonaSelecionada =
    estado?.zonas?.find((x) => x.id === zonaSelecionadaId && x.cenaId === cena?.id) ?? null;
  const reacoesDaZona = zonaSelecionada
    ? (estado?.automacoes?.reacoes ?? []).filter(
        (r) => r.fica.tipo === "zona" && r.fica.id === zonaSelecionada.id,
      ).length
    : 0;
  const pronto = status === "conectado" && estado !== null;
  // O pincel: quem tem `desenho.criar` (o mestre sempre); o mestre "vendo como" um jogador só olha.
  const podeDesenhar =
    eu !== null &&
    permissoes !== undefined &&
    usuarioVisto === null &&
    pode(eu, "desenho.criar", permissoes);

  // V12: quem tem `mapa.pingar` (o mestre sempre) pinga segurando o clique ou com a tecla P; o "Ver como" não muda isso.
  const podePingar = eu !== null && permissoes !== undefined && pode(eu, "mapa.pingar", permissoes);

  // O painel do token fecha sozinho quando não há mais token selecionado (a próxima seleção não o abre).
  const haSelecionado = selecionado !== null;
  useEffect(() => {
    if (!haSelecionado) setPainelDoTokenAberto(false);
  }, [haSelecionado]);

  // O modo "pôr token" e o formulário valem só para o mestre, na ferramenta de seleção e na cena em que começaram.
  const cenaIdAtual = cena?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a cena trocada cancela o que estava em andamento
  useEffect(() => {
    setTokenParaPor(null);
    setFormNovoToken(false);
    setRegraAberta(null);
  }, [cenaIdAtual]);
  useEffect(() => {
    if (ferramenta !== "selecionar" || !modoMestre) {
      setTokenParaPor(null);
      setFormNovoToken(false);
    }
  }, [ferramenta, modoMestre]);

  // Sem `desenho.criar` (o mestre desligou) o pincel fecha na hora; fora do pincel não há desenho selecionado.
  useEffect(() => {
    if (ferramenta === "pincel" && !podeDesenhar) setFerramenta("selecionar");
    if (ferramenta !== "pincel") setDesenhoSelecionadoId(null);
  }, [ferramenta, podeDesenhar]);

  // A visão é só de tela. Jogador (ou o mestre "vendo como" um): enxerga o que os tokens que ele
  // controla veem; o mestre com a visão do mestre: o que algum jogador vê aparece normal. Cena com a
  // iluminação dinâmica desligada, ou sem nenhum jogador (visão do mestre), fica toda clara.
  // V10c: a cena-cartão nunca tem névoa nem limite de visão (a configuração de luz fica guardada).
  const cartao = cena ? cenaEhCartao(cena) : false;
  const iluminada = cena ? visaoLimitadaNaCena(cena) : true;
  const visaoCalculada: ConfigDeVisao = (() => {
    const semMemoria = {
      ligada: false,
      tom: "#56627a",
      usuarioId: "",
      esquecimento: 0,
      mesaId: mesa.id,
      legada: mesa.legada,
    };
    if (!estado || !eu || !cena || !iluminada) {
      return { modo: "claro", fontes: [], memoria: semMemoria };
    }
    const configLuz = estado.config.iluminacao;
    const memoria = {
      ligada: configLuz.memoriaLigada,
      tom: configLuz.tomDaMemoria,
      usuarioId: (usuarioVisto ?? eu).id,
      esquecimento: estado.memoriaEsquecida?.[cena.id] ?? 0,
      mesaId: mesa.id,
      legada: mesa.legada,
    };
    const donos = modoMestre
      ? estado.usuarios.filter((u) => u.papel === "jogador")
      : [usuarioVisto ?? eu];
    const fontes = estado.tokens
      .filter(
        (t) => t.cenaId === cena.id && donos.some((u) => controlaToken(t, u, estado.personagens)),
      )
      .map((t) => ({
        tokenId: t.id,
        // 7b-1: o limite de visão de uma automação (efeito com prazo) vale por cima da visão base.
        alcanceM: limitarAlcance(
          alcanceDeVisao(t, estado.personagens),
          limiteDeVisaoDoToken(estado.efeitos, t.id),
        ),
        visaoNoEscuroM: Math.min(
          visaoNoEscuroDe(t, estado.personagens),
          limiteDeVisaoDoToken(estado.efeitos, t.id) ?? Number.POSITIVE_INFINITY,
        ),
        memoriaM: alcanceDaMemoria(configLuz, modInteligenciaDe(t, estado.personagens)),
      }));
    if (!modoMestre) return { modo: "jogador", fontes, memoria };
    return { modo: visaoDoMestre && fontes.length > 0 ? "noturna" : "claro", fontes, memoria };
  })();
  const chaveDaVisao = JSON.stringify(visaoCalculada);
  const visao = useMemo(() => JSON.parse(chaveDaVisao) as ConfigDeVisao, [chaveDaVisao]);

  const retornos = useMemo<RetornosDoMapa>(
    () => ({
      mover: (id, x, y) => enviar("token.mover", { id, x, y }),
      soltar: (id, x, y) => enviar("token.soltar", { id, x, y }),
      chegada: (cenaId, x, y) => enviar("cena.editar", { cenaId, chegada: { x, y } }),
      selecionar: setSelecionadoId,
      criarDesenho: (desenho: DesenhoNovo) => enviar("desenho.criar", { desenho }),
      moverDesenho: (id, dx, dy) => enviar("desenho.mover", { id, dx, dy }),
      apagarDesenhos: (ids) => enviar("desenho.apagar", { ids }),
      selecionarDesenho: setDesenhoSelecionadoId,
      rascunhoDeDesenho: (id: string, desenho: DesenhoEmAndamento | null) =>
        enviar("desenho.rascunho", { id, desenho }),
      pingar: (x, y, centralizar) => {
        const cenaId = cenaIdAtual;
        if (cenaId !== undefined) enviar("mapa.ping", { cenaId, x, y, centralizar });
      },
      zoom: setZoom,
      medir: setMedicao,
      reguasFixas: setReguasFixas,
      colocarToken: (x, y) => colocarTokenAtual.current?.(x, y),
      editarToken: (id) => {
        setSelecionadoId(id);
        setPainelDoTokenAberto(true);
      },
      abrirRegra: setRegraAberta,
      criarParedes: (cenaId, segmentos, tipo) =>
        enviar("parede.criar", {
          cenaId,
          paredes: segmentos.map((seg) => ({
            id: `par-${crypto.randomUUID().slice(0, 8)}`,
            a: seg.a,
            b: seg.b,
            ...(seg.meio ? { meio: seg.meio } : {}),
            tipo,
          })),
        }),
      modoDeArco: setArcoLigado,
      moverPonta: (id, ponta, ponto) => enviar("parede.editar", { id, [ponta]: ponto }),
      selecionarParede: setParedeSelecionadaId,
      apagarParede: (id) => {
        enviar("parede.apagar", { id });
        setParedeSelecionadaId(null);
      },
      criarZona: (cenaId, pontos) => {
        const id = `zona-${crypto.randomUUID().slice(0, 8)}`;
        const n = (estadoAtual.current?.zonas ?? []).filter((z) => z.cenaId === cenaId).length + 1;
        enviar("zona.criar", { zona: { id, cenaId, nome: `Zona ${n}`, pontos } });
        setZonaSelecionadaId(id);
      },
      nevoaTracar: (cenaId, traco) => enviar("nevoa.tracar", { cenaId, traco }),
      nevoaDesfazer: (cenaId) => enviar("nevoa.desfazer", { cenaId }),
      selecionarZona: setZonaSelecionadaId,
      moverZona: (id, pontos) => enviar("zona.editar", { id, mudancas: { pontos } }),
      apagarZona: (id) => apagarZonaAtual.current(id),
      alternarPorta: (id) => enviar("porta.alternar", { id }),
      colocarLuz: (cenaId, x, y) => {
        const id = `luz-${crypto.randomUUID().slice(0, 8)}`;
        enviar("fonte.criar", {
          cenaId,
          fonte: {
            id,
            nome: "Luz fixa",
            portador: { tipo: "cena", x, y },
            luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: true },
            intensidade: 1,
            estado: "acesa",
          },
        });
        setLuzSelecionadaId(id);
        setFerramenta("selecionar");
      },
      colocarPonto: (cenaId, tipo, x, y) => {
        const id = `pt-${crypto.randomUUID().slice(0, 8)}`;
        const modelos = estadoAtual.current?.modelos ?? [];
        const fogueira = modelos.find((m) => !m.ocupaMao) ?? modelos[0];
        enviar("ponto.criar", {
          cenaId,
          ponto: {
            id,
            nome: tipo === "suporte" ? "Suporte" : "Inflamável",
            x,
            y,
            tipo,
            visivelParaJogadores: true,
            ...(tipo === "suporte" ? { capacidade: 1 } : {}),
            ...(tipo === "inflamavel" && fogueira ? { modeloId: fogueira.id, segurarS: 3 } : {}),
          },
        });
        setPontoSelecionadoId(id);
        setFerramenta("selecionar");
      },
      moverPonto: (id, x, y) => enviar("ponto.editar", { id, mudancas: { x, y } }),
      selecionarPonto: setPontoSelecionadoId,
      entregarTocha: (id, tokenId) => enviar("tocha.entregar", { id, tokenId }),
      posarTocha: (id, pontoId) => enviar("tocha.posar", { id, pontoId }),
      alternarTocha: (id) => enviar("tocha.alternar", { id }),
      acenderPontoInicio: (pontoId, objetoId) =>
        enviar("ponto.acenderInicio", { pontoId, objetoId }),
      acenderPontoFim: (pontoId, objetoId) => enviar("ponto.acenderFim", { pontoId, objetoId }),
      menuDaTocha: (luzId, x, y) => setMenuDaTocha({ luzId, x, y }),
      menuDoToken: (tokenId, x, y) => {
        // O mestre sempre; o jogador só no token que ele controla (a sala confere de novo).
        const e = estadoAtual.current;
        const eu = euAtual.current;
        const t = e?.tokens.find((k) => k.id === tokenId);
        if (!e || !eu || !t) return;
        if (eu.papel === "mestre" || controlaToken(t, eu, e.personagens)) {
          setMenuDoToken({ tokenId, x, y });
        }
      },
      dica: mostrarDicaDoMapa,
      moverLuz: (id, x, y) =>
        enviar("fonte.editar", { id, mudancas: { portador: { tipo: "cena", x, y } } }),
      selecionarLuz: setLuzSelecionadaId,
      trancarPorta: (id) => {
        const atual = estadoAtual.current?.paredes.find((x) => x.id === id);
        if (!atual) return;
        enviar("parede.editar", {
          id,
          estado: atual.estado === "trancada" ? "fechada" : "trancada",
        });
      },
    }),
    [enviar, mostrarDicaDoMapa, cenaIdAtual],
  );

  // V10b: o jogador vê a bandeira quando não tem token dele na cena; arrastando a ficha de um personagem que pode pôr
  // no mapa, a área em volta dela se acende. O mestre segue a regra do V10 (faixa de Cenas aberta).
  const itemEmArrasto = useSyncExternalStore(ouvirArrasto, itemEmArrastoAgora);
  const bandeiraDoJogador = !euMestre && estado && eu ? jogadorVeABandeira(estado, eu) : false;
  const areaAcesa: boolean =
    !euMestre &&
    estado !== null &&
    eu !== null &&
    itemEmArrasto?.tipo === "personagem" &&
    estado.personagens.some(
      (q) => q.id === itemEmArrasto.id && podeColocarProprioToken(estado, eu, q),
    );

  const opcoes = useMemo(
    () => ({
      ferramenta:
        (ferramenta === "paredes" ||
          ferramenta === "zonas" ||
          ferramenta === "nevoa" ||
          ferramenta === "luz" ||
          ferramenta === "ponto") &&
        !modoMestre
          ? ("selecionar" as const)
          : ferramenta,
      mostrarLuzes: fontesAbertas,
      mostrarBandeira: euMestre ? faixaAberta : bandeiraDoJogador,
      acenderAreaDaBandeira: areaAcesa,
      luzSelecionadaId,
      pontoSelecionadoId,
      tipoDoNovoPonto,
      alcanceInteracaoM: estado?.config.alcanceInteracaoM ?? 1.5,
      restanteDe: tempo.restanteDe,
      duracaoDe: (luz: FonteDeLuz) => {
        if (luz.duracaoMs) return luz.duracaoMs;
        const m = estado?.modelos.find((x) => x.id === luz.modeloId);
        return m?.duracaoS ? m.duracaoS * 1000 : undefined;
      },
      podeMexerNaTocha: (luz: FonteDeLuz) => {
        if (!eu || usuarioVisto !== null) return false;
        if (euMestre) return true;
        if (luz.portador.tipo !== "mao") return true; // objeto num ponto: a sala decide
        const personagemId = luz.portador.personagemId;
        const p = personagens?.find((x) => x.id === personagemId);
        return (
          p !== undefined &&
          (podeEditarPersonagem(p, eu) ||
            (estado?.tokens ?? []).some(
              (t) => t.personagemId === personagemId && t.controladoPor.includes(eu.id),
            ))
        );
      },
      euMestre,
      modoMestre,
      paredeSelecionadaId: paredeSelecionada?.id ?? null,
      zonaSelecionadaId: zonaSelecionada?.id ?? null,
      nevoa,
      tipoDaNovaParede,
      // V5: o mestre vê os contornos com a Visão do mestre ligada; quem joga (ou o mestre "vendo como"),
      // só se a cena pedir.
      contornos: modoMestre ? visaoDoMestre : cena?.mostrarParedesAosJogadores === true,
      visao,
      camadaTrabalho,
      encaixe,
      reguaGrudar,
      unidade,
      selecionadoId,
      // O mestre vê o grupo todo; o jogador só conhece os personagens dele (os outros não chegam).
      tokenDaVezId,
      pincel,
      podeDesenhar,
      podePingar,
      usuarioId: euId ?? "",
      desenhoSelecionadoId,
      tokenParaPor,
      ehDoGrupo: (t: Token) => {
        if (euMestre) {
          const p = personagens?.find((x) => x.id === t.personagemId);
          return p !== undefined && ehPersonagemDeJogador(p);
        }
        return eu !== null && personagens !== undefined && controlaToken(t, eu, personagens);
      },
      controla: (t: Token) =>
        eu !== null && personagens !== undefined && controlaToken(t, eu, personagens),
      // N4: de quem é o token na névoa: de quem a tela representa (o mestre "vendo como" um jogador vê pelos olhos dele).
      controlaNaVisao: (t: Token) => {
        const quem = usuarioVisto ?? eu;
        return quem !== null && personagens !== undefined && controlaToken(t, quem, personagens);
      },
      podeMover: (t: Token) =>
        eu && permissoes && cenaAtivaId !== undefined && personagens
          ? podeMoverToken(t, eu, { permissoes, cenaAtivaId, personagens })
          : false,
    }),
    [
      bandeiraDoJogador,
      areaAcesa,
      ferramenta,
      fontesAbertas,
      luzSelecionadaId,
      pontoSelecionadoId,
      tipoDoNovoPonto,
      estado?.config.alcanceInteracaoM,
      estado?.tokens,
      tempo.restanteDe,
      estado?.modelos,
      euMestre,
      modoMestre,
      usuarioVisto,
      paredeSelecionada?.id,
      zonaSelecionada?.id,
      nevoa,
      tipoDaNovaParede,
      visaoDoMestre,
      cena?.mostrarParedesAosJogadores,
      visao,
      camadaTrabalho,
      encaixe,
      reguaGrudar,
      unidade,
      selecionadoId,
      tokenDaVezId,
      pincel,
      podeDesenhar,
      podePingar,
      euId,
      desenhoSelecionadoId,
      tokenParaPor,
      eu,
      permissoes,
      cenaAtivaId,
      personagens,
      faixaAberta,
    ],
  );

  function alternarFontes() {
    const abrindo = !fontesAbertas;
    setFontesAbertas(abrindo);
    setLuzSelecionadaId(null);
    setPontoSelecionadoId(null);
    if (!abrindo && (ferramenta === "luz" || ferramenta === "ponto")) setFerramenta("selecionar");
  }

  function alternarParedes() {
    const entrando = ferramenta !== "paredes";
    setFerramenta(entrando ? "paredes" : "selecionar");
    setSelecionadoId(null);
    setParedeSelecionadaId(null);
    setZonaSelecionadaId(null);
  }

  function alternarZonas() {
    const entrando = ferramenta !== "zonas";
    setFerramenta(entrando ? "zonas" : "selecionar");
    setSelecionadoId(null);
    setParedeSelecionadaId(null);
    setZonaSelecionadaId(null);
  }
  alternarZonasAtual.current = alternarZonas;

  function alternarNevoa() {
    const entrando = ferramenta !== "nevoa";
    setFerramenta(entrando ? "nevoa" : "selecionar");
    setSelecionadoId(null);
    setParedeSelecionadaId(null);
    setZonaSelecionadaId(null);
  }
  alternarNevoaAtual.current = alternarNevoa;
  modoMestreAtual.current = modoMestre;

  // Apagar a zona (Delete ou o botão do painel): a sala a guarda só no estado, então o "Desfazer" a recria com o
  // mesmo id e as reações que ela levava (o mesmo caminho do `zona.criar`).
  apagarZonaAtual.current = (id) => {
    const zona = estadoAtual.current?.zonas?.find((z) => z.id === id);
    if (!zona) return;
    const reacoes = (estadoAtual.current?.automacoes?.reacoes ?? []).filter(
      (r) => r.fica.tipo === "zona" && r.fica.id === id,
    );
    enviar("zona.apagar", { id });
    setZonaSelecionadaId(null);
    avisar(`Zona "${zona.nome}" apagada.`, {
      rotulo: "Desfazer",
      aoClicar: () => {
        enviar("zona.criar", { zona });
        for (const reacao of reacoes) enviar("reacao.criar", { reacao });
        setZonaSelecionadaId(id);
      },
    });
  };

  // Pede o que a mesa usa (mapa da cena, imagens dos tokens, retratos e tokens padrão das fichas).
  // O mestre também recolhe o que os jogadores subiram, para guardar cópia em recebidos/<jogador>/.
  const hashDoMapa = cena?.mapa?.assetHash;
  const tokensDoEstado = estado?.tokens.filter((t) => t.cenaId === cena?.id);
  const assetsDoEstado = estado?.assets;
  // biome-ignore lint/correctness/useExhaustiveDependencies: roda quando mudam o mapa, os tokens, as fichas ou as metas
  useEffect(() => {
    if (!gerente || !pronto || !euId) return;
    if (hashDoMapa) gerente.garantir(hashDoMapa);
    for (const t of tokensDoEstado ?? []) if (t.assetHash) gerente.garantir(t.assetHash);
    for (const p of personagens ?? []) {
      if (p.retratoHash) gerente.garantir(p.retratoHash);
      if (p.tokenPadrao.assetHash) gerente.garantir(p.tokenPadrao.assetHash);
    }
    for (const h of handoutsDoEstado ?? []) if (h.imagemHash) gerente.garantir(h.imagemHash);
    if (!euMestre) return;
    for (const a of assetsDoEstado ?? []) {
      gerente.conhecerMeta(a);
      if (a.donoId === euId || a.tiles) continue;
      gerente.garantir(a.hash);
      void gerente.copiarSePreciso(a);
    }
  }, [
    gerente,
    pronto,
    euId,
    euMestre,
    hashDoMapa,
    tokensDoEstado,
    personagens,
    handoutsDoEstado,
    assetsDoEstado,
    versaoDosProntos,
  ]);

  // Q1: o mestre com a pasta liberada: traz dela o que a mesa usa e este navegador não tem, e guarda nela o que só o cache
  // tem. Roda ao abrir, ao escolher ou reautorizar a pasta e quando chegam arquivos novos à mesa.
  const versaoDasFontes = useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `versaoDasFontes` avisa que a pasta mudou; `assetsDoEstado` que a mesa ganhou arquivos
  useEffect(() => {
    if (!gerente || !pronto || !euMestre || !assetsDoEstado) return;
    void gerente.sincronizarComAPasta(assetsDoEstado);
  }, [gerente, pronto, euMestre, assetsDoEstado, versaoDasFontes, conectado]);

  /** O personagem que mexe nas tochas: o do token selecionado ou o primeiro que eu controlo. */
  function meuPersonagemId(): string | undefined {
    if (!estado || !eu) return undefined;
    const doSelecionado = selecionado?.personagemId;
    if (
      selecionado &&
      doSelecionado &&
      (euMestre || controlaToken(selecionado, eu, estado.personagens))
    ) {
      return doSelecionado;
    }
    return estado.tokens.find(
      (t) =>
        t.cenaId === estado.cenaAtivaId &&
        t.personagemId !== undefined &&
        controlaToken(t, eu, estado.personagens),
    )?.personagemId;
  }

  function escolherCamada(c: CamadaDeTrabalho) {
    setCamadaTrabalho(c);
    // Na camada errada o token não é selecionável: solta a seleção da outra camada.
    if (selecionado && selecionado.camada !== c) setSelecionadoId(null);
  }

  /** "Novo token": abre o formulário (nome, cor, tamanho). O token só nasce no clique no mapa. */
  function abrirNovoToken() {
    setTokenParaPor(null);
    setFormNovoToken(true);
  }

  /** O clique no mapa do modo "pôr token": cria o token que o formulário descreveu, onde se clicou. */
  function colocarToken(x: number, y: number) {
    if (!cena || !tokenParaPor) return;
    const id = `tok-${crypto.randomUUID().slice(0, 8)}`;
    enviar("token.criar", {
      cenaId: cena.id,
      token: {
        id,
        nome: tokenParaPor.nome,
        cor: tokenParaPor.cor,
        tamanhoQuadrados: tokenParaPor.tamanhoQuadrados,
        x,
        y,
        camada: camadaDoNovoToken(camadaTrabalho),
        oculto: false,
        controladoPor: [],
      },
    });
    setSelecionadoId(id);
    setTokenParaPor(null);
  }
  colocarTokenAtual.current = colocarToken;

  /** Um item das Fichas foi solto no mapa: o token dele nasce na cena que o mestre vê, onde soltou. */
  function soltarItemNoMapa(dados: string, x: number, y: number) {
    const item = lerItemArrastado(dados);
    if (item?.tipo !== "personagem" || !cena) return;
    const p = personagens?.find((q) => q.id === item.id);
    if (!p) return;
    if (!euMestre) {
      // V10b: o jogador só solta o token dele na área da bandeira; a sala confere de novo.
      if (!estado || !eu || !podeColocarProprioToken(estado, eu, p)) return;
      if (!dentroDaAreaDaBandeira(cena, { x, y })) {
        avisar(TEXTO_FORA_DA_BANDEIRA);
        return;
      }
      pedirTokenNoMapa(enviar, p.id, { x, y });
      return;
    }
    const ponto = encaixarNoGrid({ x, y }, p.tokenPadrao.tamanhoQuadrados, cena.grid.quadradoM);
    enviar("personagem.colocar", {
      personagemId: p.id,
      cenaId: cena.id,
      tokenId: `tok-${crypto.randomUUID().slice(0, 8)}`,
      ...(encaixe ? ponto : { x, y }),
    });
  }

  /**
   * N3a: um monstro do Compêndio foi solto no mapa (só o mestre): nasce a ficha de NPC dele na pasta NPCs e, logo depois,
   * o token na cena que ele vê, onde soltou. As duas mensagens seguem em ordem pela mesma conexão.
   */
  function soltarDoCompendioNoMapa(dados: string, x: number, y: number) {
    if (!euMestre || !cena || !estado) return;
    const entrada = lerEntradaArrastada(dados);
    if (entrada?.tipo !== "monstro") return;
    const pastaId = estado.pastas.some((p) => p.id === PASTA_NPCS_ID)
      ? PASTA_NPCS_ID
      : estado.pastas[0]?.id;
    if (!pastaId) return;
    const id = `pers-${crypto.randomUUID().slice(0, 8)}`;
    const { personagem } = personagemDoMonstro(entrada.monstro, {
      id,
      pastaId,
      magias: entrada.magias ?? [],
    });
    if (enviar("personagem.criar", { personagem }) === null) return;
    const ponto = encaixarNoGrid(
      { x, y },
      personagem.tokenPadrao.tamanhoQuadrados,
      cena.grid.quadradoM,
    );
    enviar("personagem.colocar", {
      personagemId: id,
      cenaId: cena.id,
      tokenId: `tok-${crypto.randomUUID().slice(0, 8)}`,
      ...(encaixe ? ponto : { x, y }),
    });
  }

  /** Preparo cifrado da cena: só o que ainda falta (o que já está preparado não repete). */
  async function prepararCena(cenaId: string): Promise<string | null> {
    if (!gerente || !estado) return "Os arquivos locais ainda não estão prontos.";
    const ja = new Set(preparos.find((p) => p.cenaId === cenaId)?.hashesOriginais ?? []);
    const hashes = hashesPreparaveis(estado, cenaId).filter((h) => !ja.has(h));
    if (hashes.length === 0) return "Nada novo para preparar.";
    try {
      const pacotes = await gerente.cifrarParaPreparo(hashes);
      if (enviar("cena.preparar", { cenaId, pacotes }) === null) return "Sem conexão com a sala.";
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  const pedirImagem: PedirImagem = (titulo, tipo, aoUsar) =>
    setPedidoDeImagem({ titulo, tipo, aoUsar });

  function mudarReguaGrudar(v: boolean) {
    setReguaGrudar(v);
    gravarReguaGrudar(v);
  }

  function mudarEncaixe(v: boolean) {
    setEncaixe(v);
    gravarEncaixePadrao(v);
  }

  // Título da aba: "Távola · nome da mesa" e, com a mesa aberta, o nome da cena do grupo.
  const nomeDaCenaDoGrupo = cenaDoGrupo?.nome;
  const nomeDaMesa = mesa.nome;
  useEffect(() => {
    const titulo = tituloDaMesa(nomeDaMesa);
    document.title = nomeDaCenaDoGrupo ? `${titulo} · ${nomeDaCenaDoGrupo}` : titulo;
    return () => {
      document.title = titulo;
    };
  }, [nomeDaCenaDoGrupo, nomeDaMesa]);

  const cenaVista = { id: cena?.id ?? estado?.cenaAtivaId ?? "", nome: cena?.nome ?? "" };

  // Jogador sem token na cena (ou o mestre vendo como ele): a visão vem dos tokens dele, então o mapa fica
  // preto. O estado vazio explica o porquê e o que fazer; some quando o token aparece.
  const semTokenNaCena = (() => {
    if (!pronto || !estado || !eu || !cena || !iluminada || modoMestre) return null;
    if (visao.modo !== "jogador" || visao.fontes.length > 0) return null;
    const quem = usuarioVisto ?? eu;
    const meus = estado.personagens.filter((p) => podeEditarPersonagem(p, quem));
    if (usuarioVisto) {
      return {
        titulo: "Sem token nesta cena",
        texto: `${usuarioVisto.nome} ainda não tem um personagem nesta cena, por isso o mapa fica escuro para ele. A visão vem dos tokens do jogador.`,
      };
    }
    if (meus.length > 0) {
      const nomes = meus.map((p) => p.nome).join(", ");
      return {
        titulo: "Seu personagem não está nesta cena",
        texto: bandeiraDoJogador
          ? `O token de ${nomes} não está nesta cena, por isso o mapa fica escuro. Use "Colocar no mapa" na sua ficha ou arraste a ficha até a bandeira (o ponto de chegada). Também dá para pedir ao mestre para levar seu token até aqui.`
          : `O token de ${nomes} não está nesta cena, por isso o mapa fica escuro. Peça ao mestre para levar seu token até aqui ou para mover o grupo.`,
      };
    }
    return {
      titulo: "Sem token nesta cena",
      texto:
        "Você ainda não tem um personagem nesta cena. Peça ao mestre para pôr o seu token no mapa.",
    };
  })();

  const abas =
    estado && eu
      ? [
          {
            id: "chat",
            titulo: "Chat",
            icone: <MessagesSquare size={20} />,
            cheia: true,
            selo: abaVisivel === "chat" ? 0 : naoLidas,
            conteudo: (
              <AbaChat
                estado={estado}
                eu={eu}
                enviar={enviar}
                imagens={imagens}
                versaoDasImagens={versaoDosProntos}
                comoId={comoId}
                aoMudarComo={mudarComo}
                temMais={chatTemMais}
                pedirAnteriores={() => {
                  const primeiro = estado.chat?.[0]?.seq;
                  if (primeiro !== undefined) enviar("chat.anteriores", { antesDoSeq: primeiro });
                }}
                visivel={abaVisivel === "chat"}
              />
            ),
          },
          {
            id: "fichas",
            titulo: "Fichas",
            icone: <NotebookText size={20} />,
            conteudo: (
              <AbaFichas
                estado={estado}
                eu={eu}
                enviar={enviar}
                imagens={imagens}
                versaoDasImagens={versaoDosProntos}
                aoAbrirFicha={abrirOuTrazerFicha}
                aoAbrirHandout={abrirHandout}
              />
            ),
          },
          {
            id: "compendio",
            titulo: "Compêndio",
            icone: <BookOpen size={20} />,
            conteudo: (
              <AbaCompendio
                estado={estado}
                eu={eu}
                conectado={status === "conectado"}
                gerente={gerente}
                fontes={fontes}
                enviar={enviar}
                comoId={comoId}
                aoMudarComo={mudarComo}
                aoAbrirFicha={abrirOuTrazerFicha}
              />
            ),
          },
          {
            id: "preferencias",
            titulo: "Preferências",
            icone: <SlidersHorizontal size={20} />,
            indicador: transferindo,
            conteudo: (
              <AbaPreferencias
                nome={eu.nome}
                papel={eu.papel}
                encaixe={encaixe}
                aoMudarEncaixe={mudarEncaixe}
                aoSair={aoSair}
                aoTrocarDeMesa={aoTrocarDeMesa}
                aoFazerOTour={() => setTourAberto(true)}
                mesaId={mesa.id}
                login={login}
                fontes={fontes}
                gerente={gerente}
                claudeConectado={claudeConectado.includes(eu.id)}
                somBloqueado={som.bloqueado}
                aoAtivarSom={() => som.motor.ativar()}
              />
            ),
          },
          // A aba Mesa é a última e só do mestre (V1).
          ...(euMestre
            ? [
                {
                  id: "mesa",
                  titulo: "Mesa",
                  icone: <Settings2 size={20} />,
                  selo: pedidosDeConta,
                  conteudo: (
                    <AbaMesa
                      mesa={mesa}
                      aoRenomear={aoRenomear}
                      estado={estado}
                      uso={uso}
                      avisoDeContas={avisoDeContas}
                      enviar={enviar}
                      aoAbrirAutomacoes={() => setAutomacoesAbertas(true)}
                    />
                  ),
                },
              ]
            : []),
        ]
      : [];

  return (
    <div
      className="mesa"
      data-lateral={lateralAberta ? "aberta" : "fechada"}
      style={{ "--largura-painel": `${larguraDoPainel}px` } as CSSProperties}
    >
      {/* Sempre no DOM (para leitores de tela e testes); o selo visível só aparece sem conexão. */}
      <span className="so-leitor" data-testid="status-conexao">
        {status}
      </span>

      {estado && eu && cena ? (
        <>
          <Topo
            cena={cenaDoGrupo?.nome ?? cena.nome}
            botoes={
              euMestre && !modoMestre ? undefined : (
                <BotoesDaBarra
                  estado={estado}
                  euMestre={euMestre}
                  enviar={enviar}
                  salaMs={tempo.salaMs}
                />
              )
            }
            menus={
              euMestre ? (
                <MenuSuperior
                  faixaAberta={faixaAberta}
                  aoAlternarFaixa={() => setFaixaAberta(!faixaAberta)}
                  camadaTrabalho={camadaTrabalho}
                  aoEscolherCamada={escolherCamada}
                  visaoDoMestre={visaoDoMestre}
                  aoAlternarVisaoDoMestre={() => setVisaoDoMestre(!visaoDoMestre)}
                  aoNovoToken={abrirNovoToken}
                  aoLimparDesenhos={() => enviar("desenho.limpar", { cenaId: cena.id })}
                  desenhosNaCena={estado.desenhos.filter((d) => d.cenaId === cena.id).length}
                  ordemVisivel={estado.ordemDeTurnoVisivel}
                  aoAlternarOrdem={() =>
                    enviar("ordemDeTurno.definir", { visivel: !estado.ordemDeTurnoVisivel })
                  }
                  iluminacaoDinamica={iluminacaoDinamicaLigada(cena)}
                  cenaCartao={cartao}
                  aoAlternarIluminacao={() =>
                    enviar("cena.configurarIluminacao", {
                      cenaId: cena.id,
                      dinamica: !iluminacaoDinamicaLigada(cena),
                    })
                  }
                  fontesAbertas={fontesAbertas}
                  aoAlternarFontes={alternarFontes}
                  configAberta={configAberta}
                  aoAlternarConfig={() => setConfigAberta(!configAberta)}
                  aoAbrirModelosDeTocha={() =>
                    setPedidoDeAba((antes) => ({
                      n: (antes?.n ?? 0) + 1,
                      abaId: "mesa",
                      secaoTestid: testidDaSecaoDaMesa("luz"),
                    }))
                  }
                  jogadores={jogadoresDaMesa(estado)}
                  verComoId={usuarioVisto?.id ?? null}
                  aoVerComo={(id) => {
                    setVerComoId(id);
                    setSelecionadoId(null);
                    if (
                      id !== null &&
                      (ferramenta === "paredes" || ferramenta === "zonas" || ferramenta === "nevoa")
                    ) {
                      setFerramenta("selecionar");
                    }
                  }}
                />
              ) : undefined
            }
          >
            {euMestre && pedidosDeConta > 0 && (
              <button
                type="button"
                className="aviso-de-contas"
                data-testid="aviso-de-contas"
                onClick={() =>
                  setPedidoDeAba((antes) => ({
                    n: (antes?.n ?? 0) + 1,
                    abaId: "mesa",
                    secaoTestid: testidDaSecaoDaMesa("contas"),
                  }))
                }
              >
                {textoDoAvisoDeContas(avisoDeContas)}
              </button>
            )}
            {euMestre && <RascunhosDoClaude estado={estado} enviar={enviar} />}
            <PresencaNoTopo
              usuarios={membrosDaMesa(estado)}
              presenca={presenca}
              euId={eu.id}
              claude={claudeConectado}
            />
            <EstadoDaMesa
              pausada={estado.relogio.pausada}
              euMestre={euMestre}
              aoAlternarPausa={() =>
                enviar(estado.relogio.pausada ? "mesa.retomar" : "mesa.pausar", {})
              }
              salaMs={tempo.salaMs}
              marcoMs={estado.relogio.marcoMs ?? 0}
              aoZerarRelogio={() => enviar("mesa.zerarRelogio", {})}
              mestreOnline={mestreOnline}
            />
          </Topo>
          <BarraDeFerramentas
            ferramenta={ferramenta}
            podeParedes={modoMestre}
            aoAlternarParedes={alternarParedes}
            podeZonas={modoMestre}
            aoAlternarZonas={alternarZonas}
            aoAlternarNevoa={alternarNevoa}
            aoAlternarSom={alternarSom}
            somAberto={somAberto}
            aoEscolher={setFerramenta}
            pincel={pincel}
            aoMudarPincel={setPincel}
            podeDesenhar={podeDesenhar}
            aoVoltarDesenho={() => enviar("desenho.voltar", { cenaId: cena.id })}
            podeOculta={pode(eu, "dado.rolarOculto", estado.permissoes)}
            aoRolar={(q, faces, oculta) =>
              enviar("dado.rolar", {
                expressao: `${q}d${faces}`,
                ...(oculta ? { oculta: true } : {}),
                ...(comoId ? { como: comoId } : {}),
              })
            }
          />
          <div className="area-mapa" data-area-do-mapa="" data-testid="area-do-mapa">
            <Mapa
              cena={cena}
              tokens={estadoVisto?.tokens ?? estado.tokens}
              paredes={estadoVisto?.paredes ?? estado.paredes}
              zonas={modoMestre ? (estado.zonas ?? SEM_ZONAS) : SEM_ZONAS}
              luzes={estadoVisto?.luzes ?? estado.luzes}
              pontos={estadoVisto?.pontos ?? estado.pontos}
              desenhos={estadoVisto?.desenhos ?? estado.desenhos}
              opcoes={opcoes}
              retornos={retornos}
              imagens={imagens}
              versaoDasImagens={versaoDosProntos}
              aoSoltarItem={soltarItemNoMapa}
              aoSoltarDoCompendio={euMestre ? soltarDoCompendioNoMapa : undefined}
              aoCriar={(m) => {
                mapa.current = m;
              }}
            />
            {/* A etiqueta sobre o mapa saiu: quem sou eu e onde estamos ficam só para leitores de tela. */}
            <div className="so-leitor" data-testid="etiqueta-mesa">
              <span data-testid="cena-nome">{cena.nome}</span>
              {euMestre && cenaDoGrupo && <span data-testid="grupo-em">{cenaDoGrupo.nome}</span>}
              <strong data-testid="eu-nome">{eu.nome}</strong>
              <span data-testid="eu-papel">{eu.papel}</span>
            </div>
            {usuarioVisto && (
              <div className="selo-ver-como" data-testid="ver-como-selo">
                <span>
                  Vendo como <strong>{usuarioVisto.nome}</strong>
                </span>
                <button
                  type="button"
                  data-testid="ver-como-voltar"
                  onClick={() => setVerComoId(null)}
                >
                  Voltar a mim
                </button>
              </div>
            )}
            {modoMestre && ferramenta === "paredes" && (
              <div className="selo-modo" data-testid="modo-paredes-selo" role="status">
                <span>
                  Modo <strong>Paredes e portas</strong>
                </span>
                <button type="button" data-testid="modo-paredes-sair" onClick={alternarParedes}>
                  Sair do modo
                </button>
              </div>
            )}
            {modoMestre && ferramenta === "zonas" && (
              <div className="selo-modo" data-testid="modo-zonas-selo" role="status">
                <span>
                  Modo <strong>Zonas</strong>
                </span>
                <button type="button" data-testid="modo-zonas-sair" onClick={alternarZonas}>
                  Sair do modo
                </button>
              </div>
            )}
            {modoMestre && ferramenta === "nevoa" && (
              <div className="selo-modo" data-testid="modo-nevoa-selo" role="status">
                <span>
                  Modo <strong>Névoa</strong>
                </span>
                <button type="button" data-testid="modo-nevoa-sair" onClick={alternarNevoa}>
                  Sair do modo
                </button>
              </div>
            )}
            {euMestre && faixaAberta && (
              <FaixaDeCenas
                estado={estado}
                cenaVistaId={cena.id}
                preparos={preparos}
                imagens={imagens}
                versaoDasImagens={versaoDosProntos}
                enviar={enviar}
                aoIrPara={(id) => setCenaVistaId(id === estado.cenaAtivaId ? null : id)}
                aoLevarGrupo={(id) => {
                  enviar("grupo.moverPara", { cenaId: id });
                  setCenaVistaId(null);
                }}
                aoPreparar={prepararCena}
                aoImportarMapa={(arquivo) => void importarMapaUvtt(arquivo)}
                pedirImagem={pedirImagem}
              />
            )}
            {aviso && <AvisoPerto aviso={aviso} aoDispensar={dispensarAviso} />}
            <ZoomFlutuante
              zoom={zoom}
              aoDefinir={(z) => mapa.current?.definirZoom(z)}
              aoPasso={(f) => mapa.current?.zoomPorPassos(f)}
              aoCentralizar={() => mapa.current?.centralizar()}
            />
            {/* N1: vida e CA em cima do token selecionado (o mestre, e quem controla o token). */}
            {selecionado && personagemDoSelecionado?.ficha && marcasDoTokenVisiveis && (
              <MarcasDoToken
                key={selecionado.id}
                mapa={mapa}
                token={selecionado}
                personagem={personagemDoSelecionado}
                enviar={enviar}
                aoAbrirFicha={abrirOuTrazerFicha}
              />
            )}
            {/* V14: cada rótulo da régua fica dentro da área visível do mapa (PertoDoPonto). */}
            {medicao && (
              <PertoDoPonto x={medicao.x} y={medicao.y} dx={14} dy={14} evitarTrechos>
                <div className="regua-rotulo" data-testid="regua-rotulo">
                  {medicao.medida.rotulo}
                </div>
              </PertoDoPonto>
            )}
            {medicao?.pontos.map((q) => (
              <PertoDoPonto key={`${q.x}:${q.y}`} x={q.x} y={q.y} dx={8} dy={8} trecho>
                <div className="regua-rotulo regua-trecho" data-testid="regua-trecho">
                  {q.rotulo}
                </div>
              </PertoDoPonto>
            ))}
            {medicao?.solta && (
              <PertoDoPonto x={medicao.x} y={medicao.y} dx={14} dy={46} evitarTrechos>
                <button
                  type="button"
                  className="regua-fixar"
                  data-testid="regua-fixar"
                  onClick={() => mapa.current?.fixarRegua()}
                >
                  <Pin size={13} /> Fixar
                </button>
              </PertoDoPonto>
            )}
            {reguasFixas.flatMap((f) =>
              f.pontos.map((q) => (
                <PertoDoPonto key={`${f.id}:${q.x}:${q.y}`} x={q.x} y={q.y} dx={8} dy={8} trecho>
                  <div
                    className="regua-rotulo regua-trecho regua-fixa"
                    data-testid="regua-fixa-trecho"
                  >
                    {q.rotulo}
                  </div>
                </PertoDoPonto>
              )),
            )}
            {reguasFixas.map((f) => (
              <PertoDoPonto key={f.id} x={f.x} y={f.y} dx={14} dy={14} evitarTrechos>
                <BotaoComDica
                  className="regua-rotulo regua-fixa"
                  testid="regua-fixa-rotulo"
                  nome="Tirar esta medida"
                  onClick={() => mapa.current?.removerReguaFixa(f.id)}
                >
                  <Pin size={12} /> {f.medida.rotulo}
                </BotaoComDica>
              </PertoDoPonto>
            ))}
            {modoMestre && tokenParaPor && (
              <div className="selo-modo" data-testid="modo-pondo-token-selo" role="status">
                <span>
                  <MapPin size={14} /> Clique no mapa para pôr <strong>{tokenParaPor.nome}</strong>
                  <span className="selo-dica"> · Esc cancela · Alt inverte o encaixe</span>
                </span>
                <button
                  type="button"
                  data-testid="modo-pondo-token-cancelar"
                  onClick={() => setTokenParaPor(null)}
                >
                  Cancelar
                </button>
              </div>
            )}
            {modoMestre && formNovoToken && (
              <NovoToken
                aoConfirmar={(pedido) => {
                  setFormNovoToken(false);
                  setTokenParaPor(pedido);
                }}
                aoCancelar={() => setFormNovoToken(false)}
              />
            )}
            {semTokenNaCena && (
              <div
                className="estado-vazio-mapa"
                data-testid="sem-token"
                // O cartão sai do centro (onde está a bandeira) e deixa o mouse passar: o jogador solta a ficha na área.
                data-no-alto={bandeiraDoJogador || undefined}
                role="status"
              >
                <strong>{semTokenNaCena.titulo}</strong>
                <p>{semTokenNaCena.texto}</p>
              </div>
            )}
            {estado.ordemDeTurnoVisivel && (euMestre || !ordemFechadaAqui) && (
              <OrdemDeTurno
                aoFecharAqui={() => setOrdemFechadaAqui(true)}
                estado={estadoVisto ?? estado}
                eu={eu}
                enviar={enviar}
                somenteLeitura={usuarioVisto !== null}
                dividirColuna={
                  modoMestre && ferramenta !== "paredes" && !!selecionado && painelDoTokenAberto
                }
              />
            )}
            {ferramenta === "regua" && (
              <PainelDaRegua
                grudar={reguaGrudar}
                aoMudarGrudar={mudarReguaGrudar}
                aoFechar={() => setFerramenta("selecionar")}
              />
            )}
            {modoMestre && ferramenta === "paredes" && (
              <PainelDasParedes
                tipoNovo={tipoDaNovaParede}
                aoEscolherTipoNovo={setTipoDaNovaParede}
                arco={arcoLigado}
                selecionada={paredeSelecionada}
                enviar={enviar}
                aoApagar={(id) => {
                  enviar("parede.apagar", { id });
                  setParedeSelecionadaId(null);
                }}
                aoFechar={alternarParedes}
              />
            )}
            {modoMestre && ferramenta === "nevoa" && (
              <PainelDaNevoa
                config={nevoa}
                aoMudar={setNevoa}
                temNevoa={nevoaCobreAlgo(cena.nevoa)}
                tracos={cena.nevoa?.length ?? 0}
                aoTracarTudo={(modo) =>
                  enviar("nevoa.tracar", {
                    cenaId: cena.id,
                    traco: { forma: "tudo", modo, pontos: [] },
                  })
                }
                aoDesfazer={() => enviar("nevoa.desfazer", { cenaId: cena.id })}
                aoFechar={alternarNevoa}
              />
            )}
            {modoMestre && somAberto && !somFora && (
              <PainelDoSom
                aoAbrirEmJanela={abrirSomEmOutraJanela}
                estado={estado}
                cena={cena}
                efeitosEmAndamento={som.motor.efeitosEmAndamento()}
                ouvir={(hash, volume) => som.motor.tocarEfeito(hash, volume)}
                fontes={fontes}
                registrar={registrarSom}
                enviar={enviar}
                aoFechar={() => setSomAberto(false)}
              />
            )}
            <AvisoDoSom bloqueado={som.bloqueado} aoAtivar={() => som.motor.ativar()} />
            <AvisoDaCaixaDoClaude andamento={andamentoDaCaixa} />
            <AvisoDaImportacao estado={importacao} aoDispensar={() => setImportacao(null)} />
            <AvisoDaPasta euMestre={euMestre} fontes={fontes} gerente={gerente} />
            {modoMestre && ferramenta === "zonas" && (
              <PainelDasZonas
                fontes={fontes}
                registrarSom={registrarSom}
                selecionada={zonaSelecionada}
                reacoes={reacoesDaZona}
                enviar={enviar}
                aoApagar={(id) => apagarZonaAtual.current(id)}
                aoFechar={alternarZonas}
              />
            )}
            {modoMestre && fontesAbertas && (
              <PainelDeFontesDeLuz
                cena={cena}
                estado={estado}
                tempo={tempo}
                selecionadaId={luzSelecionadaId}
                aoSelecionar={setLuzSelecionadaId}
                colocando={ferramenta === "luz"}
                aoColocar={() => setFerramenta(ferramenta === "luz" ? "selecionar" : "luz")}
                pontoSelecionadoId={pontoSelecionadoId}
                aoSelecionarPonto={setPontoSelecionadoId}
                colocandoPonto={ferramenta === "ponto" ? tipoDoNovoPonto : null}
                aoColocarPonto={(tipo) => {
                  if (ferramenta === "ponto" && tipoDoNovoPonto === tipo)
                    setFerramenta("selecionar");
                  else {
                    setTipoDoNovoPonto(tipo);
                    setFerramenta("ponto");
                  }
                }}
                enviar={enviar}
                aoFechar={alternarFontes}
              />
            )}
            {modoMestre && automacoesAbertas && (
              <JanelaDasAutomacoes
                estado={estado}
                enviar={enviar}
                salaMs={tempo.salaMs}
                fontes={fontes}
                registrarSom={registrarSom}
                aoFechar={() => setAutomacoesAbertas(false)}
              />
            )}
            {modoMestre && configAberta && (
              <PainelDeIluminacao
                cena={cena}
                config={estado.config.iluminacao}
                enviar={enviar}
                aoFechar={() => setConfigAberta(false)}
              />
            )}
            {modoMestre && ferramenta !== "paredes" && selecionado && painelDoTokenAberto && (
              <PainelDoToken
                token={selecionado}
                jogadores={jogadoresDaMesa(estado)}
                enviar={enviar}
                pedirImagem={pedirImagem}
                aoFechar={() => {
                  setPainelDoTokenAberto(false);
                  setSelecionadoId(null);
                }}
              />
            )}
            {menuDoToken && usuarioVisto === null && (
              <MenuDoToken
                estado={estado}
                tokenId={menuDoToken.tokenId}
                x={menuDoToken.x}
                y={menuDoToken.y}
                euMestre={euMestre}
                enviar={enviar}
                teclado={menuDoToken.teclado === true}
                aoAbrirFicha={abrirOuTrazerFicha}
                aoEditar={() => {
                  setSelecionadoId(menuDoToken.tokenId);
                  setPainelDoTokenAberto(true);
                }}
                aoFechar={() => setMenuDoToken(null)}
              />
            )}
            {regraAberta && (
              <RegraDaCondicao regra={regraAberta} aoFechar={() => setRegraAberta(null)} />
            )}
            {dicaDoMapa && !regraAberta && (
              <div
                className="dica-condicao"
                role="tooltip"
                data-testid={
                  dicaDoMapa.tipo === "tocha"
                    ? "dica-tocha"
                    : dicaDoMapa.tipo === "bandeira"
                      ? "dica-bandeira"
                      : "dica-condicao"
                }
                style={{
                  left: Math.min(dicaDoMapa.x + 14, caixaDaArea().direita - 300),
                  top: Math.min(
                    dicaDoMapa.y + (dicaDoMapa.tipo === "tocha" ? 52 : 16),
                    caixaDaArea().base - 150,
                  ),
                }}
              >
                <strong>{dicaDoMapa.titulo}</strong>
                <p>{dicaDoMapa.texto}</p>
              </div>
            )}
            {menuDaTocha && (
              <MenuDaTocha
                estado={estado}
                luzId={menuDaTocha.luzId}
                x={menuDaTocha.x}
                y={menuDaTocha.y}
                personagemId={meuPersonagemId()}
                restanteDe={tempo.restanteDe}
                enviar={enviar}
                aoFechar={() => setMenuDaTocha(null)}
              />
            )}
            {handoutsAbertos.map((id, cascata) => {
              const handout = estado.handouts.find((x) => x.id === id);
              if (!handout) return null;
              return (
                <JanelaDoHandout
                  key={id}
                  handout={handout}
                  cascata={cascata}
                  estado={estado}
                  eu={eu}
                  enviar={enviar}
                  pronto={pronto}
                  ouvir={ouvir}
                  imagens={imagens}
                  versaoDasImagens={versaoDosProntos}
                  pedirImagem={pedirImagem}
                  aoFechar={() => fecharHandout(id)}
                />
              );
            })}
            {janelasDeFicha.map((j, cascata) => {
              const personagem = estado.personagens.find((p) => p.id === j.personagemId);
              if (!personagem || fichasFora.has(j.personagemId)) return null;
              return (
                <JanelaDaFicha
                  key={j.personagemId}
                  janela={j}
                  cascata={cascata}
                  personagem={personagem}
                  estado={estado}
                  eu={eu}
                  enviar={enviar}
                  selecionadoId={selecionadoId}
                  imagens={imagens}
                  versaoDasImagens={versaoDosProntos}
                  pedirImagem={pedirImagem}
                  cenaVista={cenaVista}
                  tempo={tempo}
                  fontes={fontes}
                  gerente={gerente}
                  avisar={avisar}
                  aoFechar={() => fecharFicha(j.personagemId)}
                  aoMudar={(mudancas) => atualizarFicha(j.personagemId, mudancas)}
                  aoAbrirEmJanela={() => abrirFichaEmOutraJanela(j.personagemId)}
                />
              );
            })}
          </div>
          <BarraLateral
            abas={abas}
            pedido={pedidoDeAba}
            aoMudarAberta={setLateralAberta}
            aoMudarVisivel={setAbaVisivel}
            largura={larguraDoPainel}
            limites={limitesDoPainel}
            aoAjustar={ajustarPainel}
          />
          {tourAberto && (
            <Tour
              passos={passosDoPapel(euMestre ? "mestre" : "jogador")}
              abrirAba={abrirAbaDoTour}
              aoFechar={fecharTour}
            />
          )}
          {pedidoDeImagem && gerente && (
            <SeletorDeImagem
              titulo={pedidoDeImagem.titulo}
              fontes={fontes}
              processador={processador}
              aoEscolher={async (arquivo) => {
                const hash = await gerente.usarArquivo(arquivo, pedidoDeImagem.tipo);
                pedidoDeImagem.aoUsar(hash);
              }}
              aoFechar={() => setPedidoDeImagem(null)}
            />
          )}
        </>
      ) : (
        <p className="carregando">Carregando a mesa…</p>
      )}

      {status !== "conectado" && (
        <div className="selo-conexao" role="status">
          {status}
        </div>
      )}
    </div>
  );
}

/** A regra de uma condição aberta por clique no marcador: popover que fecha com Esc ou clique fora. */
function RegraDaCondicao({ regra, aoFechar }: { regra: DicaDoMapa; aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, aoFechar);
  const area = caixaDaArea();
  return (
    <div
      ref={ref}
      className="regra-condicao"
      role="dialog"
      aria-label={`Regra: ${regra.titulo}`}
      data-testid="regra-condicao"
      style={{
        left: Math.max(area.esquerda + 8, Math.min(regra.x + 14, area.direita - 308)),
        top: Math.max(area.topo + 8, Math.min(regra.y + 16, area.base - 170)),
      }}
    >
      <strong>{regra.titulo}</strong>
      <p>{regra.texto}</p>
      <button
        type="button"
        className="regra-condicao-fechar"
        data-testid="regra-condicao-fechar"
        onClick={aoFechar}
      >
        Fechar
      </button>
    </div>
  );
}
