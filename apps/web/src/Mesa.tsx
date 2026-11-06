import {
  alcanceDeVisao,
  controlaToken,
  type Exportacao,
  ehPersonagemDeJogador,
  encaixarNoGrid,
  hashesPreparaveis,
  iluminacaoDinamicaLigada,
  podeMoverToken,
  type TipoDeParede,
  type Token,
  visaoPara,
} from "@tabletop/shared";
import { BookOpen, Crown, MessagesSquare, NotebookText, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AbaChat } from "./AbaChat";
import { AbaCompendio } from "./AbaCompendio";
import { AbaFichas } from "./AbaFichas";
import { AbaConfiguracoes } from "./abas";
import { lerItemArrastado } from "./arrasto";
import { CacheOpfs } from "./assets/cache";
import { Fontes } from "./assets/fontes";
import { ganchosDoTeste, instalarGanchoDeAssets } from "./assets/ganchoE2E";
import { type Canal, GerenteDeAssets } from "./assets/gerente";
import { Processador } from "./assets/processador";
import { BarraDeFerramentas } from "./BarraDeFerramentas";
import { BarraLateral } from "./BarraLateral";
import { type CamadaDeTrabalho, camadaDoNovoToken } from "./camadas";
import { FaixaDeCenas, type PedirImagem } from "./FaixaDeCenas";
import { MenuSuperior } from "./MenuSuperior";
import { Mapa } from "./mapa/Mapa";
import type {
  ConfigDeVisao,
  Ferramenta,
  ImagensDoMapa,
  MapaPixi,
  MedicaoNaTela,
  RetornosDoMapa,
} from "./mapa/mapaPixi";
import { OrdemDeTurno } from "./OrdemDeTurno";
import { PainelDasParedes } from "./PainelDasParedes";
import { PainelDoMestre } from "./PainelDoMestre";
import { PainelDoToken } from "./PainelDoToken";
import { gravarEncaixePadrao, lerEncaixePadrao } from "./preferencias";
import { SeletorDeImagem } from "./SeletorDeImagem";
import { useSala } from "./useSala";
import { ZoomFlutuante } from "./ZoomFlutuante";

const CORES_DE_TOKEN = ["#3cb44b", "#4363d8", "#f58231", "#911eb4", "#e6194b", "#42d4f4"];
const DURACAO_DO_AVISO_LOCAL_MS = 3500;

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

const semAssinatura = () => () => {};
const versaoZero = () => 0;

type Props = { aoSair: () => void; aoPerderSessao: () => void };

type PedidoDeImagem = {
  titulo: string;
  tipo: "mapa" | "token" | "retrato";
  aoUsar: (hash: string) => void;
};

/** A mesa: o mapa ocupa a tela e as ferramentas flutuam em volta (PROJETO.md 4.13 e 4.13.1). */
export function Mesa({ aoSair, aoPerderSessao }: Props) {
  const {
    status,
    estado,
    eu,
    presenca,
    uso,
    aviso,
    preparos,
    enviar,
    enviarBinario,
    bufferizado,
    conectado,
    ouvir,
  } = useSala({
    aoExportar: baixarExportacao,
    aoPerderSessao,
  });

  const [ferramenta, setFerramenta] = useState<Ferramenta>("selecionar");
  const [camadaTrabalho, setCamadaTrabalho] = useState<CamadaDeTrabalho>("tokens");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [encaixe, setEncaixe] = useState(lerEncaixePadrao);
  const [zoom, setZoom] = useState(1);
  const [medicao, setMedicao] = useState<MedicaoNaTela | null>(null);
  const [lateralAberta, setLateralAberta] = useState(true);
  const [faixaAberta, setFaixaAberta] = useState(false);
  // Visão noturna do mestre: ligada por padrão; só da tela dele (nunca vai para a sala).
  const [visaoNoturna, setVisaoNoturna] = useState(true);
  const [paredeSelecionadaId, setParedeSelecionadaId] = useState<string | null>(null);
  const [tipoDaNovaParede, setTipoDaNovaParede] = useState<TipoDeParede>("parede");
  // "Ver como o jogador X" (só da tela do mestre): `null` = ele mesmo.
  const [verComoId, setVerComoId] = useState<string | null>(null);
  const [avisoLocal, setAvisoLocal] = useState<{ numero: number; texto: string } | null>(null);
  const [pedidoDeImagem, setPedidoDeImagem] = useState<PedidoDeImagem | null>(null);
  // A cena que o mestre olha (e edita) sem mover o grupo: estado local da tela dele. `null` = a do grupo.
  const [cenaVistaId, setCenaVistaId] = useState<string | null>(null);
  const mapa = useRef<MapaPixi | null>(null);

  // Arquivos locais (PROJETO.md 4.3): fontes (pasta, soltos), processador (worker) e o gerente
  // (cache OPFS, pedidos, envio). O gerente nasce quando sei quem sou.
  const processador = useMemo(() => new Processador(), []);
  const fontes = useMemo(() => new Fontes(), []);
  const [gerente, setGerente] = useState<GerenteDeAssets | null>(null);
  const canal = useRef<Canal>({ conectado, enviar, enviarBinario, bufferizado });
  canal.current = { conectado, enviar, enviarBinario, bufferizado };
  const estadoAtual = useRef(estado);
  estadoAtual.current = estado;
  const euAtual = useRef(eu);
  euAtual.current = eu;
  const euId = eu?.id;

  const euMestre = eu?.papel === "mestre";
  const permissoes = estado?.permissoes;
  const cenaAtivaId = estado?.cenaAtivaId;
  const personagens = estado?.personagens;

  // Atalhos de ferramenta (V, H, R), exceto enquanto escreve num campo.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target;
      if (alvo instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "v") setFerramenta("selecionar");
      else if (tecla === "h") setFerramenta("mao");
      else if (tecla === "r") setFerramenta("regua");
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // O aviso curto local (dados rápidos) some sozinho.
  useEffect(() => {
    if (!avisoLocal) return;
    const t = setTimeout(() => setAvisoLocal(null), DURACAO_DO_AVISO_LOCAL_MS);
    return () => clearTimeout(t);
  }, [avisoLocal]);

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
        else if (o.tipo === "erro") mapa.current?.ressincronizar();
      }),
    [ouvir],
  );

  // Cena do grupo e cena vista. O jogador só tem a do grupo (a sala não manda as outras).
  const cenaDoGrupo = estado?.cenas.find((c) => c.id === estado.cenaAtivaId) ?? estado?.cenas[0];
  // "Ver como o jogador X": o mestre passa a ver o que a sala mandaria a ele (o mesmo filtro), na cena do grupo.
  const usuarioVisto =
    euMestre && verComoId !== null
      ? (estado?.usuarios.find((u) => u.id === verComoId && u.papel === "jogador") ?? null)
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
  const selecionado =
    estado?.tokens.find((t) => t.id === selecionadoId && t.cenaId === cena?.id) ?? null;
  const paredeSelecionada =
    estado?.paredes.find((x) => x.id === paredeSelecionadaId && x.cenaId === cena?.id) ?? null;
  const pronto = status === "conectado" && estado !== null;

  // A visão é só de tela. Jogador (ou o mestre "vendo como" um): enxerga o que os tokens que ele
  // controla veem; o mestre com visão noturna: o que algum jogador vê aparece normal. Cena com a
  // iluminação dinâmica desligada, ou sem nenhum jogador (visão noturna), fica toda clara.
  const iluminada = cena ? iluminacaoDinamicaLigada(cena) : true;
  const visaoCalculada: ConfigDeVisao = (() => {
    if (!estado || !eu || !cena || !iluminada) return { modo: "claro", fontes: [] };
    const donos = modoMestre
      ? estado.usuarios.filter((u) => u.papel === "jogador")
      : [usuarioVisto ?? eu];
    const fontes = estado.tokens
      .filter(
        (t) => t.cenaId === cena.id && donos.some((u) => controlaToken(t, u, estado.personagens)),
      )
      .map((t) => ({ tokenId: t.id, alcanceM: alcanceDeVisao(t, estado.personagens) }));
    if (!modoMestre) return { modo: "jogador", fontes };
    return { modo: visaoNoturna && fontes.length > 0 ? "noturna" : "claro", fontes };
  })();
  const chaveDaVisao = JSON.stringify(visaoCalculada);
  const visao = useMemo(() => JSON.parse(chaveDaVisao) as ConfigDeVisao, [chaveDaVisao]);

  const retornos = useMemo<RetornosDoMapa>(
    () => ({
      mover: (id, x, y) => enviar("token.mover", { id, x, y }),
      soltar: (id, x, y) => enviar("token.soltar", { id, x, y }),
      chegada: (cenaId, x, y) => enviar("cena.editar", { cenaId, chegada: { x, y } }),
      selecionar: setSelecionadoId,
      zoom: setZoom,
      medir: setMedicao,
      criarParedes: (cenaId, segmentos, tipo) =>
        enviar("parede.criar", {
          cenaId,
          paredes: segmentos.map((seg) => ({
            id: `par-${crypto.randomUUID().slice(0, 8)}`,
            a: seg.a,
            b: seg.b,
            tipo,
          })),
        }),
      moverPonta: (id, ponta, ponto) => enviar("parede.editar", { id, [ponta]: ponto }),
      selecionarParede: setParedeSelecionadaId,
      apagarParede: (id) => {
        enviar("parede.apagar", { id });
        setParedeSelecionadaId(null);
      },
      alternarPorta: (id) => enviar("porta.alternar", { id }),
      trancarPorta: (id) => {
        const atual = estadoAtual.current?.paredes.find((x) => x.id === id);
        if (!atual) return;
        enviar("parede.editar", {
          id,
          estado: atual.estado === "trancada" ? "fechada" : "trancada",
        });
      },
    }),
    [enviar],
  );

  const opcoes = useMemo(
    () => ({
      ferramenta: ferramenta === "paredes" && !modoMestre ? ("selecionar" as const) : ferramenta,
      euMestre,
      modoMestre,
      paredeSelecionadaId: paredeSelecionada?.id ?? null,
      tipoDaNovaParede,
      visao,
      camadaTrabalho,
      encaixe,
      selecionadoId,
      // O mestre vê o grupo todo; o jogador só conhece os personagens dele (os outros não chegam).
      ehDoGrupo: (t: Token) => {
        if (euMestre) {
          const p = personagens?.find((x) => x.id === t.personagemId);
          return p !== undefined && ehPersonagemDeJogador(p);
        }
        return eu !== null && personagens !== undefined && controlaToken(t, eu, personagens);
      },
      podeMover: (t: Token) =>
        eu && permissoes && cenaAtivaId !== undefined && personagens
          ? podeMoverToken(t, eu, { permissoes, cenaAtivaId, personagens })
          : false,
    }),
    [
      ferramenta,
      euMestre,
      modoMestre,
      paredeSelecionada?.id,
      tipoDaNovaParede,
      visao,
      camadaTrabalho,
      encaixe,
      selecionadoId,
      eu,
      permissoes,
      cenaAtivaId,
      personagens,
    ],
  );

  function alternarParedes() {
    const entrando = ferramenta !== "paredes";
    setFerramenta(entrando ? "paredes" : "selecionar");
    setSelecionadoId(null);
    setParedeSelecionadaId(null);
  }

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
    assetsDoEstado,
    versaoDosProntos,
  ]);

  function escolherCamada(c: CamadaDeTrabalho) {
    setCamadaTrabalho(c);
    // Na camada errada o token não é selecionável: solta a seleção da outra camada.
    if (selecionado && selecionado.camada !== c) setSelecionadoId(null);
  }

  function criarToken() {
    if (!cena) return;
    const centro = mapa.current?.centroDaTelaEmMetros() ?? {
      x: cena.larguraM / 2,
      y: cena.alturaM / 2,
    };
    const { x, y } = encaixarNoGrid(centro, 1, cena.grid.quadradoM);
    const id = `tok-${crypto.randomUUID().slice(0, 8)}`;
    const cor = CORES_DE_TOKEN[Math.floor(Math.random() * CORES_DE_TOKEN.length)] ?? "#3cb44b";
    enviar("token.criar", {
      cenaId: cena.id,
      token: {
        id,
        nome: "Novo token",
        cor,
        tamanhoQuadrados: 1,
        x,
        y,
        camada: camadaDoNovoToken(camadaTrabalho),
        oculto: false,
        controladoPor: [],
      },
    });
    setSelecionadoId(id);
  }

  /** Um item das Fichas foi solto no mapa: o token dele nasce na cena que o mestre vê, onde soltou. */
  function soltarItemNoMapa(dados: string, x: number, y: number) {
    const item = lerItemArrastado(dados);
    if (!item || !euMestre || !cena) return;
    const p = personagens?.find((q) => q.id === item.id);
    if (!p) return;
    const ponto = encaixarNoGrid({ x, y }, p.tokenPadrao.tamanhoQuadrados, cena.grid.quadradoM);
    enviar("personagem.colocar", {
      personagemId: p.id,
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

  function mudarEncaixe(v: boolean) {
    setEncaixe(v);
    gravarEncaixePadrao(v);
  }

  const cenaVista = { id: cena?.id ?? estado?.cenaAtivaId ?? "", nome: cena?.nome ?? "" };

  const abas =
    estado && eu
      ? [
          {
            id: "chat",
            titulo: "Chat",
            icone: <MessagesSquare size={20} />,
            conteudo: <AbaChat estado={estado} presenca={presenca} euId={eu.id} />,
          },
          {
            id: "fichas",
            titulo: "Fichas",
            icone: <NotebookText size={20} />,
            conteudo: (
              <AbaFichas
                estado={estado}
                eu={eu}
                pronto={pronto}
                enviar={enviar}
                ouvir={ouvir}
                imagens={imagens}
                versaoDasImagens={versaoDosProntos}
                pedirImagem={pedirImagem}
                cenaVista={cenaVista}
              />
            ),
          },
          {
            id: "compendio",
            titulo: "Compêndio",
            icone: <BookOpen size={20} />,
            conteudo: <AbaCompendio />,
          },
          {
            id: "configuracoes",
            titulo: "Configurações",
            icone: <Settings size={20} />,
            indicador: transferindo,
            conteudo: (
              <AbaConfiguracoes
                nome={eu.nome}
                papel={eu.papel}
                encaixe={encaixe}
                aoMudarEncaixe={mudarEncaixe}
                aoSair={aoSair}
                fontes={fontes}
                gerente={gerente}
              />
            ),
          },
          ...(euMestre && cena
            ? [
                {
                  id: "mestre",
                  titulo: "Mestre",
                  icone: <Crown size={20} />,
                  conteudo: (
                    <PainelDoMestre estado={estado} cena={cena} uso={uso} enviar={enviar} />
                  ),
                },
              ]
            : []),
        ]
      : [];

  return (
    <div className="mesa" data-lateral={lateralAberta ? "aberta" : "fechada"}>
      {/* Sempre no DOM (para leitores de tela e testes); o selo visível só aparece sem conexão. */}
      <span className="so-leitor" data-testid="status-conexao">
        {status}
      </span>

      {estado && eu && cena ? (
        <>
          <Mapa
            cena={cena}
            tokens={estadoVisto?.tokens ?? estado.tokens}
            paredes={estadoVisto?.paredes ?? estado.paredes}
            opcoes={opcoes}
            retornos={retornos}
            imagens={imagens}
            versaoDasImagens={versaoDosProntos}
            aoSoltarItem={soltarItemNoMapa}
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
          {euMestre && (
            <MenuSuperior
              faixaAberta={faixaAberta}
              aoAlternarFaixa={() => setFaixaAberta(!faixaAberta)}
              camadaTrabalho={camadaTrabalho}
              aoEscolherCamada={escolherCamada}
              visaoNoturna={visaoNoturna}
              aoAlternarVisaoNoturna={() => setVisaoNoturna(!visaoNoturna)}
              aoNovoToken={criarToken}
              ordemVisivel={estado.ordemDeTurnoVisivel}
              aoAlternarOrdem={() =>
                enviar("ordemDeTurno.definir", { visivel: !estado.ordemDeTurnoVisivel })
              }
              iluminacaoDinamica={iluminada}
              aoAlternarIluminacao={() =>
                enviar("cena.configurarIluminacao", { cenaId: cena.id, dinamica: !iluminada })
              }
              paredesAtivas={ferramenta === "paredes" && modoMestre}
              aoAlternarParedes={alternarParedes}
              jogadores={estado.usuarios.filter((u) => u.papel === "jogador")}
              verComoId={usuarioVisto?.id ?? null}
              aoVerComo={(id) => {
                setVerComoId(id);
                setSelecionadoId(null);
                if (id !== null && ferramenta === "paredes") setFerramenta("selecionar");
              }}
            />
          )}
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
              pedirImagem={pedirImagem}
            />
          )}
          <BarraDeFerramentas
            ferramenta={ferramenta}
            aoEscolher={setFerramenta}
            aoRolar={(q, faces) =>
              setAvisoLocal({
                numero: (avisoLocal?.numero ?? 0) + 1,
                texto: `${q}d${faces} — os dados chegam com o chat`,
              })
            }
          />
          <ZoomFlutuante
            zoom={zoom}
            aoDefinir={(z) => mapa.current?.definirZoom(z)}
            aoPasso={(f) => mapa.current?.zoomPorPassos(f)}
            aoCentralizar={() => mapa.current?.centralizar()}
          />
          {medicao && (
            <div
              className="regua-rotulo"
              data-testid="regua-rotulo"
              style={{ left: medicao.x + 14, top: medicao.y + 14 }}
            >
              {medicao.medida.rotulo}
            </div>
          )}
          {estado.ordemDeTurnoVisivel && <OrdemDeTurno />}
          {modoMestre && ferramenta === "paredes" && (
            <PainelDasParedes
              tipoNovo={tipoDaNovaParede}
              aoEscolherTipoNovo={setTipoDaNovaParede}
              selecionada={paredeSelecionada}
              enviar={enviar}
              aoApagar={(id) => {
                enviar("parede.apagar", { id });
                setParedeSelecionadaId(null);
              }}
              aoFechar={alternarParedes}
            />
          )}
          {modoMestre && ferramenta !== "paredes" && selecionado && (
            <PainelDoToken
              token={selecionado}
              jogadores={estado.usuarios.filter((u) => u.papel === "jogador")}
              enviar={enviar}
              pedirImagem={pedirImagem}
              aoFechar={() => setSelecionadoId(null)}
            />
          )}
          <BarraLateral abas={abas} aoMudarAberta={setLateralAberta} />
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
      {avisoLocal && (
        <p className="aviso aviso-dados" role="status" data-testid="aviso-dados">
          {avisoLocal.texto}
        </p>
      )}
      {aviso && (
        <p className="aviso" role="alert" data-testid="aviso" data-codigo={aviso.codigo ?? ""}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
