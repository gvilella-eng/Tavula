import {
  type Camada,
  type Exportacao,
  encaixarNoGrid,
  podeMoverToken,
  type Token,
} from "@tabletop/shared";
import { Crown, Settings, StickyNote, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AbaConfiguracoes, AbaJogadores, AbaNotas } from "./abas";
import { BarraDeFerramentas } from "./BarraDeFerramentas";
import { BarraLateral } from "./BarraLateral";
import { Mapa } from "./mapa/Mapa";
import type { Ferramenta, MapaPixi, MedicaoNaTela, RetornosDoMapa } from "./mapa/mapaPixi";
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

type Props = { aoSair: () => void; aoPerderSessao: () => void };

/** A mesa: o mapa ocupa a tela e as ferramentas flutuam em volta (PROJETO.md 4.13). */
export function Mesa({ aoSair, aoPerderSessao }: Props) {
  const { status, estado, eu, presenca, uso, aviso, enviar, ouvir } = useSala({
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
  const mapa = useRef<MapaPixi | null>(null);

  const euMestre = eu?.papel === "mestre";
  const permissoes = estado?.permissoes;

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
      podeMover: (t: Token) => (eu && permissoes ? podeMoverToken(t, eu, permissoes) : false),
    }),
    [ferramenta, euMestre, camadaTrabalho, encaixe, selecionadoId, eu, permissoes],
  );

  const cena = estado?.cenas.find((c) => c.id === estado.cenaAtivaId) ?? estado?.cenas[0];
  const selecionado = estado?.tokens.find((t) => t.id === selecionadoId) ?? null;
  const pronto = status === "conectado" && estado !== null;

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
            aoCriar={(m) => {
              mapa.current = m;
            }}
          />
          <div className="etiqueta" data-testid="etiqueta-mesa">
            <span data-testid="cena-nome">{cena.nome}</span>
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
