import {
  type Camada,
  type Exportacao,
  encaixarNoGrid,
  hashesPreparaveis,
  podeMoverToken,
  type Token,
} from "@tabletop/shared";
import { Clapperboard, Crown, Images, Settings, StickyNote, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AbaCenas } from "./AbaCenas";
import { AbaPersonagens } from "./AbaPersonagens";
import { AbaConfiguracoes, AbaJogadores, AbaNotas } from "./abas";
import { CacheOpfs } from "./assets/cache";
import { Fontes } from "./assets/fontes";
import { ganchosDoTeste, instalarGanchoDeAssets } from "./assets/ganchoE2E";
import { type Canal, GerenteDeAssets } from "./assets/gerente";
import { Processador } from "./assets/processador";
import { BarraDeFerramentas } from "./BarraDeFerramentas";
import { BarraLateral } from "./BarraLateral";
import { Biblioteca } from "./Biblioteca";
import { Mapa } from "./mapa/Mapa";
import type {
  Ferramenta,
  ImagensDoMapa,
  MapaPixi,
  MedicaoNaTela,
  RetornosDoMapa,
} from "./mapa/mapaPixi";
import { PainelDoMestre } from "./PainelDoMestre";
import { PainelDoToken } from "./PainelDoToken";
import { gravarEncaixePadrao, lerEncaixePadrao } from "./preferencias";
import { useSala } from "./useSala";
import { ZoomFlutuante } from "./ZoomFlutuante";

const CORES_DE_TOKEN = ["#3cb44b", "#4363d8", "#f58231", "#911eb4", "#e6194b", "#42d4f4"];

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

/** A mesa: o mapa ocupa a tela e as ferramentas flutuam em volta (PROJETO.md 4.13). */
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
  const [camadaTrabalho, setCamadaTrabalho] = useState<Camada>("tokens");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [encaixe, setEncaixe] = useState(lerEncaixePadrao);
  const [zoom, setZoom] = useState(1);
  const [medicao, setMedicao] = useState<MedicaoNaTela | null>(null);
  const [lateralAberta, setLateralAberta] = useState(true);
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

  const retornos = useMemo<RetornosDoMapa>(
    () => ({
      mover: (id, x, y) => enviar("token.mover", { id, x, y }),
      soltar: (id, x, y) => enviar("token.soltar", { id, x, y }),
      selecionar: setSelecionadoId,
      zoom: setZoom,
      medir: setMedicao,
    }),
    [enviar],
  );

  const opcoes = useMemo(
    () => ({
      ferramenta,
      euMestre,
      camadaTrabalho,
      encaixe,
      selecionadoId,
      podeMover: (t: Token) =>
        eu && permissoes && cenaAtivaId !== undefined && personagens
          ? podeMoverToken(t, eu, { permissoes, cenaAtivaId, personagens })
          : false,
    }),
    [
      ferramenta,
      euMestre,
      camadaTrabalho,
      encaixe,
      selecionadoId,
      eu,
      permissoes,
      cenaAtivaId,
      personagens,
    ],
  );

  // Cena do grupo e cena vista. O jogador só tem a do grupo (a sala não manda as outras).
  const cenaDoGrupo = estado?.cenas.find((c) => c.id === estado.cenaAtivaId) ?? estado?.cenas[0];
  const cena =
    (euMestre && cenaVistaId ? estado?.cenas.find((c) => c.id === cenaVistaId) : undefined) ??
    cenaDoGrupo;
  const selecionado =
    estado?.tokens.find((t) => t.id === selecionadoId && t.cenaId === cena?.id) ?? null;
  const pronto = status === "conectado" && estado !== null;

  // Pede o que a mesa usa (mapa da cena, imagens dos tokens). O mestre também recolhe o que os
  // jogadores subiram, para guardar cópia em recebidos/<jogador>/.
  const hashDoMapa = cena?.mapa?.assetHash;
  const tokensDoEstado = estado?.tokens.filter((t) => t.cenaId === cena?.id);
  const assetsDoEstado = estado?.assets;
  // biome-ignore lint/correctness/useExhaustiveDependencies: roda quando mudam o mapa, os tokens ou as metas
  useEffect(() => {
    if (!gerente || !pronto || !euId) return;
    if (hashDoMapa) gerente.garantir(hashDoMapa);
    for (const t of tokensDoEstado ?? []) if (t.assetHash) gerente.garantir(t.assetHash);
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
    assetsDoEstado,
    versaoDosProntos,
  ]);

  function escolherCamada(c: Camada) {
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
        camada: camadaTrabalho,
        oculto: false,
        controladoPor: [],
      },
    });
    setSelecionadoId(id);
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

  function mudarEncaixe(v: boolean) {
    setEncaixe(v);
    gravarEncaixePadrao(v);
  }

  const abas =
    estado && eu
      ? [
          {
            id: "jogadores",
            titulo: "Jogadores",
            icone: <Users size={20} />,
            conteudo: (
              <AbaJogadores
                estado={estado}
                presenca={presenca}
                euMestre={euMestre}
                enviar={enviar}
              />
            ),
          },
          ...(gerente && cena
            ? [
                {
                  id: "biblioteca",
                  titulo: "Biblioteca",
                  icone: <Images size={20} />,
                  indicador: transferindo,
                  conteudo: (
                    <Biblioteca
                      gerente={gerente}
                      fontes={fontes}
                      processador={processador}
                      estado={estado}
                      eu={eu}
                      enviar={enviar}
                      tokenSelecionado={selecionado}
                      cena={cena}
                      centroDoMapa={() =>
                        mapa.current?.centroDaTelaEmMetros() ?? {
                          x: (cena?.larguraM ?? 0) / 2,
                          y: (cena?.alturaM ?? 0) / 2,
                        }
                      }
                    />
                  ),
                },
              ]
            : []),
          {
            id: "personagens",
            titulo: "Personagens",
            icone: <UserRound size={20} />,
            conteudo: (
              <AbaPersonagens
                estado={estado}
                eu={eu}
                cenaVista={{ id: cena?.id ?? estado.cenaAtivaId, nome: cena?.nome ?? "" }}
                enviar={enviar}
              />
            ),
          },
          ...(euMestre && cena
            ? [
                {
                  id: "cenas",
                  titulo: "Cenas",
                  icone: <Clapperboard size={20} />,
                  conteudo: (
                    <AbaCenas
                      estado={estado}
                      cenaVistaId={cena.id}
                      preparos={preparos}
                      enviar={enviar}
                      aoVer={setCenaVistaId}
                      aoPreparar={prepararCena}
                      centroDaVista={() =>
                        mapa.current?.centroDaTelaEmMetros() ?? {
                          x: cena.larguraM / 2,
                          y: cena.alturaM / 2,
                        }
                      }
                    />
                  ),
                },
              ]
            : []),
          {
            id: "notas",
            titulo: "Notas",
            icone: <StickyNote size={20} />,
            conteudo: (
              <AbaNotas estado={estado} eu={eu} pronto={pronto} enviar={enviar} ouvir={ouvir} />
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
          {
            id: "configuracoes",
            titulo: "Configurações",
            icone: <Settings size={20} />,
            conteudo: (
              <AbaConfiguracoes
                nome={eu.nome}
                papel={eu.papel}
                encaixe={encaixe}
                aoMudarEncaixe={mudarEncaixe}
                aoSair={aoSair}
              />
            ),
          },
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
            tokens={estado.tokens}
            opcoes={opcoes}
            retornos={retornos}
            imagens={imagens}
            versaoDasImagens={versaoDosProntos}
            aoCriar={(m) => {
              mapa.current = m;
            }}
          />
          <div className="etiqueta" data-testid="etiqueta-mesa">
            {euMestre && <span className="rotulo-vista">Vendo: </span>}
            <span data-testid="cena-nome">{cena.nome}</span>
            {euMestre && cenaDoGrupo && (
              <>
                <span className="separador">·</span>
                <span className="rotulo-vista">Grupo em: </span>
                <span data-testid="grupo-em">{cenaDoGrupo.nome}</span>
              </>
            )}
            <span className="separador">·</span>
            <strong data-testid="eu-nome">{eu.nome}</strong>{" "}
            <span data-testid="eu-papel" className="papel">
              {eu.papel}
            </span>
          </div>
          <BarraDeFerramentas
            ferramenta={ferramenta}
            aoEscolher={setFerramenta}
            euMestre={euMestre}
            camadaTrabalho={camadaTrabalho}
            aoEscolherCamada={escolherCamada}
            aoNovoToken={criarToken}
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
          {euMestre && selecionado && (
            <PainelDoToken
              token={selecionado}
              jogadores={estado.usuarios.filter((u) => u.papel === "jogador")}
              enviar={enviar}
              aoFechar={() => setSelecionadoId(null)}
            />
          )}
          <BarraLateral abas={abas} aoMudarAberta={setLateralAberta} />
        </>
      ) : (
        <p className="carregando">Carregando a mesa…</p>
      )}

      {status !== "conectado" && (
        <div className="selo-conexao" role="status">
          {status}
        </div>
      )}
      {aviso && (
        <p className="aviso" role="alert" data-testid="aviso" data-codigo={aviso.codigo ?? ""}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
