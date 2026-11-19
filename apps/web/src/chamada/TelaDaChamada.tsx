import { type Estado, membrosDaMesa, type Presenca, type Usuario } from "@tabletop/shared";
import {
  HeadphoneOff,
  Headphones,
  Lock,
  LogOut,
  Maximize2,
  Mic,
  MicOff,
  PictureInPicture2,
  Settings2,
  UserRound,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { BotaoComDica } from "../BotaoComDica";
import { abrirSomEmJanela, TEXTO_DO_POPUP_BLOQUEADO } from "../ficha/foraDaMesa";
import { useMusicaAgora } from "../som/useMusicaAgora";
import type { ControleDaChamada } from "./controlador";
import {
  ehEstreita,
  formatarTempo,
  inicialDe,
  listaDeNomes,
  VOLUME_MAXIMO,
  VOLUME_MINIMO,
} from "./puras";
import { type DadosDoQuadro, QuadroDaPessoa, QuadroDaTrilha, VideoDoFluxo } from "./Quadros";
import { rotuloDoPapel, trilhaDaMesa } from "./rotulos";

// CH1: a janela da chamada. "Antes de entrar" (a própria câmera, o fundo, os aparelhos), a janela larga (só a Grade,
// com a lista de pessoas ao lado) e a mesma janela estreita (linhas com miniatura). Abaixo de ~560 px de largura a
// disposição estreita entra sozinha.

type Props = {
  mesaId: string;
  mesaNome: string;
  controle: ControleDaChamada;
  estadoSala: Estado;
  eu: Usuario;
  presenca: Record<string, Presenca>;
  enviar: (tipo: string, dados: object) => string | null;
  avisar: (texto: string) => void;
};

type EstadoPip = { janela: Window };

type TipoDeDocumentPip = {
  requestWindow(opcoes: { width: number; height: number }): Promise<Window>;
};
const documentPip = (): TipoDeDocumentPip | null => {
  const v = (window as unknown as { documentPictureInPicture?: TipoDeDocumentPip })
    .documentPictureInPicture;
  return v ?? null;
};

function useLarguraDe(ref: React.RefObject<HTMLElement | null>): number {
  const [largura, setLargura] = useState(() => window.innerWidth);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ler = () => setLargura(Math.round(el.getBoundingClientRect().width));
    ler();
    const o = new ResizeObserver(ler);
    o.observe(el);
    return () => o.disconnect();
  }, [ref]);
  return largura;
}

/** O estado do controlador, lido como um repositório externo. */
function useControle(controle: ControleDaChamada) {
  return useSyncExternalStore(controle.assinar, controle.lerEstado);
}

// --- aparelhos ------------------------------------------------------------------------------------------------------

function Aparelhos({ controle }: { controle: ControleDaChamada }) {
  const e = useControle(controle);
  const { aparelhos, prefs } = e;
  const seletor = (
    rotulo: string,
    testid: string,
    lista: { id: string; nome: string }[],
    valor: string,
    aoMudar: (id: string) => void,
  ) => (
    <label className="chamada-rotulo-campo">
      {rotulo}
      <select
        className="chamada-select"
        data-testid={testid}
        value={lista.some((a) => a.id === valor) ? valor : (lista[0]?.id ?? "")}
        disabled={lista.length === 0}
        onChange={(ev) => aoMudar(ev.target.value)}
      >
        {lista.length === 0 && <option value="">Nenhum encontrado</option>}
        {lista.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="chamada-aparelhos-campos">
      {seletor(
        "Câmera",
        "chamada-aparelho-camera",
        aparelhos.cameras,
        prefs.cameraId,
        (id) => void controle.trocarAparelho("camera", id),
      )}
      {seletor(
        "Microfone",
        "chamada-aparelho-microfone",
        aparelhos.microfones,
        prefs.microfoneId,
        (id) => void controle.trocarAparelho("microfone", id),
      )}
      {e.suportaSaida ? (
        seletor(
          "Saída de som",
          "chamada-aparelho-saida",
          aparelhos.saidas,
          prefs.saidaId,
          (id) => void controle.trocarAparelho("saida", id),
        )
      ) : (
        <p className="chamada-dica" data-testid="chamada-sem-saida">
          Este navegador não deixa escolher a saída de som: a chamada sai pela saída padrão do
          sistema.
        </p>
      )}
      <label className="chamada-marca">
        <input
          type="checkbox"
          data-testid="chamada-reduzir-ruido"
          checked={prefs.reduzirRuido}
          onChange={(ev) => void controle.definirReduzirRuido(ev.target.checked)}
        />
        Reduzir ruído e eco
      </label>
      <label className="chamada-marca">
        <input
          type="checkbox"
          data-testid="chamada-sons"
          checked={prefs.sons}
          onChange={(ev) => controle.definirSons(ev.target.checked)}
        />
        Tocar um som quando alguém entra ou sai
      </label>
    </div>
  );
}

// --- antes de entrar ------------------------------------------------------------------------------------------------

const BARRAS_DO_NIVEL = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"] as const;

const FUNDOS = [
  { id: "nenhum", nome: "Sem efeito" },
  { id: "desfocar", nome: "Desfocar" },
  { id: "forte", nome: "Desfocar forte" },
] as const;

function AntesDeEntrar({
  controle,
  mesaNome,
  estadoSala,
  eu,
  estreita,
}: {
  controle: ControleDaChamada;
  mesaNome: string;
  estadoSala: Estado;
  eu: Usuario;
  estreita: boolean;
}) {
  const e = useControle(controle);
  const quem = e.participantes
    .map((p) => estadoSala.usuarios.find((u) => u.id === p.usuarioId))
    .filter((u): u is Usuario => u !== undefined);
  const aceso = Math.round(e.nivelMicrofone * 12);
  const motivoDoFundo = !e.camera
    ? "Ligue a câmera para escolher o fundo."
    : (e.fundoIndisponivel ?? null);
  return (
    <div className="chamada-antes" data-testid="chamada-antes" data-estreita={estreita}>
      <header className="chamada-topo">
        <h1 className="chamada-titulo">Entrar na chamada</h1>
        <span className="chamada-sub">{mesaNome}</span>
      </header>
      <div className="chamada-antes-corpo">
        <section className="chamada-antes-previa" aria-label="Sua câmera">
          <div className="chamada-previa" data-testid="chamada-previa">
            {e.camera && e.fluxoLocal ? (
              <VideoDoFluxo fluxo={e.fluxoLocal} espelhar testid="chamada-previa-video" />
            ) : (
              <div className="chamada-sem-video">
                <span
                  className="chamada-inicial chamada-inicial-grande"
                  style={{ "--cor-da-pessoa": eu.cor } as CSSProperties}
                >
                  {inicialDe(eu.nome)}
                </span>
                <span className="chamada-dica">Câmera desligada: os outros veem sua inicial</span>
              </div>
            )}
            <div className="chamada-previa-botoes">
              <BotaoComDica
                testid="chamada-previa-microfone"
                className="chamada-botao-redondo pequeno"
                nome="Microfone"
                aria-pressed={e.microfone}
                data-desligado={e.microfone ? undefined : "sim"}
                onClick={() => void controle.alternarMicrofone()}
              >
                {e.microfone ? (
                  <Mic size={18} aria-hidden="true" />
                ) : (
                  <MicOff size={18} aria-hidden="true" />
                )}
              </BotaoComDica>
              <BotaoComDica
                testid="chamada-previa-camera"
                className="chamada-botao-redondo pequeno"
                nome="Câmera"
                aria-pressed={e.camera}
                data-desligado={e.camera ? undefined : "sim"}
                onClick={() => void controle.alternarCamera()}
              >
                {e.camera ? (
                  <Video size={18} aria-hidden="true" />
                ) : (
                  <VideoOff size={18} aria-hidden="true" />
                )}
              </BotaoComDica>
            </div>
            <div className="chamada-nivel-caixa">
              <Mic size={14} aria-hidden="true" />
              <div
                className="chamada-nivel"
                data-testid="chamada-nivel"
                role="img"
                aria-label="Nível do microfone"
              >
                {BARRAS_DO_NIVEL.map((id, i) => (
                  <span
                    key={id}
                    className={i < aceso ? "chamada-nivel-barra aceso" : "chamada-nivel-barra"}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="chamada-grupo-campo">
            <span className="chamada-rotulo-campo" id="chamada-fundo-rotulo">
              Fundo da câmera
            </span>
            {/* biome-ignore lint/a11y/useSemanticElements: grupo de botões com nome; o fieldset é de formulário */}
            <div className="chamada-segmentos" role="group" aria-labelledby="chamada-fundo-rotulo">
              {FUNDOS.map((f) => (
                <BotaoComDica
                  key={f.id}
                  testid={`chamada-fundo-${f.id}`}
                  className="chamada-segmento"
                  nomeVisivel
                  aria-pressed={e.fundo === f.id}
                  motivo={f.id === "nenhum" ? null : motivoDoFundo}
                  onClick={() => void controle.definirFundo(f.id)}
                >
                  {f.nome}
                </BotaoComDica>
              ))}
            </div>
            <span className="chamada-dica" data-testid="chamada-fundo-nota">
              {e.fundoCarregando
                ? "Carregando o desfoque…"
                : (e.fundoIndisponivel ??
                  "O desfoque roda no seu computador; os outros recebem a imagem já desfocada.")}
            </span>
          </div>
        </section>
        <section className="chamada-antes-lado" aria-label="Aparelhos">
          <Aparelhos controle={controle} />
          <label className="chamada-marca">
            <input
              type="checkbox"
              data-testid="chamada-entrar-mudo"
              checked={e.prefs.entrarMudo}
              onChange={(ev) => controle.definirEntrarMudo(ev.target.checked)}
            />
            Entrar com o microfone desligado
          </label>
          {e.erroDeMidia && (
            <p className="chamada-erro" role="alert" data-testid="chamada-erro-midia">
              {e.erroDeMidia}
            </p>
          )}
          <div className="chamada-antes-fim">
            {quem.length > 0 ? (
              <div className="chamada-quem" data-testid="chamada-quem-ja-esta">
                <span className="chamada-pilha">
                  {quem.slice(0, 5).map((u) => (
                    <span
                      key={u.id}
                      className="chamada-mini-avatar"
                      style={{ "--cor-da-pessoa": u.cor } as CSSProperties}
                    >
                      {inicialDe(u.nome)}
                    </span>
                  ))}
                </span>
                <span>
                  {listaDeNomes(quem.map((u) => u.nome))}{" "}
                  {quem.length === 1 ? "já está" : "já estão"} na chamada
                </span>
              </div>
            ) : (
              <span className="chamada-dica">Ninguém está na chamada ainda.</span>
            )}
            {e.aviso && (
              <p className="chamada-erro" role="alert" data-testid="chamada-aviso">
                {e.aviso}
              </p>
            )}
            <button
              type="button"
              className="chamada-principal"
              data-testid="chamada-entrar"
              onClick={() => void controle.entrar(false)}
            >
              Entrar na chamada
            </button>
            <button
              type="button"
              className="chamada-secundario"
              data-testid="chamada-so-ouvindo"
              onClick={() => void controle.entrar(true)}
            >
              Entrar só ouvindo
            </button>
          </div>
        </section>
      </div>
      <footer className="chamada-privacidade">
        <Lock size={14} aria-hidden="true" />
        Só quem é da mesa entra. O vídeo e a voz vão direto entre os computadores, criptografados;
        nada é gravado.
      </footer>
    </div>
  );
}

function SubstituidaPorOutraJanela({
  controle,
  aviso,
}: {
  controle: ControleDaChamada;
  aviso: string | null;
}) {
  return (
    <main className="chamada-vazia" data-testid="chamada-substituida">
      <p>{aviso ?? "Você entrou na chamada por outra janela."}</p>
      <button
        type="button"
        className="chamada-principal"
        data-testid="chamada-entrar-de-novo"
        onClick={() => void controle.recomecar()}
      >
        Entrar de novo
      </button>
    </main>
  );
}

// --- dentro da chamada -----------------------------------------------------------------------------------------------

function useAgora(ligado: boolean): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ligado) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ligado]);
  return agora;
}

type OpcoesDosBotoes = {
  controle: ControleDaChamada;
  estreita: boolean;
  aoAparelhos: () => void;
  aparelhosAbertos: boolean;
  aoSair: () => void;
};

function BarraDeBaixo({
  controle,
  estreita,
  aoAparelhos,
  aparelhosAbertos,
  aoSair,
}: OpcoesDosBotoes) {
  const e = useControle(controle);
  const mudoMeu = !e.microfone || e.surdo;
  const travado = e.soOuvindo ? "Você entrou só ouvindo. Saia e entre de novo para falar." : null;
  const motivoDoFundo =
    travado ??
    (!e.camera ? "Ligue a câmera para desfocar o fundo." : (e.fundoIndisponivel ?? null));
  const botao = (
    testid: string,
    nome: string,
    icone: ReactNode,
    extra: {
      pressionado?: boolean;
      desligado?: boolean;
      motivo?: string | null;
      aoClicar: () => void;
      acento?: boolean;
    },
  ) => (
    <BotaoComDica
      testid={testid}
      className="chamada-botao-redondo"
      nome={nome}
      aria-pressed={extra.pressionado}
      data-desligado={extra.desligado ? "sim" : undefined}
      data-acento={extra.acento ? "sim" : undefined}
      motivo={extra.motivo ?? null}
      onClick={extra.aoClicar}
    >
      {icone}
    </BotaoComDica>
  );
  return (
    <footer className="chamada-baixo" data-estreita={estreita}>
      {!estreita && (
        <div className="chamada-atalhos" aria-hidden="true">
          <kbd>M</kbd> microfone <kbd>V</kbd> câmera <kbd>B</kbd> fundo
        </div>
      )}
      <div className="chamada-botoes">
        {botao(
          "chamada-microfone",
          "Microfone",
          mudoMeu ? <MicOff size={21} aria-hidden="true" /> : <Mic size={21} aria-hidden="true" />,
          {
            pressionado: e.microfone,
            desligado: mudoMeu,
            motivo: travado,
            aoClicar: () => void controle.alternarMicrofone(),
          },
        )}
        {botao(
          "chamada-camera",
          "Câmera",
          e.camera ? (
            <Video size={21} aria-hidden="true" />
          ) : (
            <VideoOff size={21} aria-hidden="true" />
          ),
          {
            pressionado: e.camera,
            desligado: !e.camera,
            motivo: travado,
            aoClicar: () => void controle.alternarCamera(),
          },
        )}
        {botao("chamada-fundo", "Desfocar o fundo", <UserRound size={21} aria-hidden="true" />, {
          pressionado: e.fundo !== "nenhum",
          acento: e.fundo !== "nenhum",
          motivo: motivoDoFundo,
          aoClicar: () => controle.alternarFundo(),
        })}
        {botao(
          "chamada-surdo",
          "Parar de ouvir a chamada",
          e.surdo ? (
            <HeadphoneOff size={21} aria-hidden="true" />
          ) : (
            <Headphones size={21} aria-hidden="true" />
          ),
          { pressionado: e.surdo, desligado: e.surdo, aoClicar: controle.alternarSurdo },
        )}
        <span className="chamada-separador" aria-hidden="true" />
        {botao(
          "chamada-aparelhos-botao",
          "Câmera, microfone e som",
          <Settings2 size={21} aria-hidden="true" />,
          {
            pressionado: aparelhosAbertos,
            aoClicar: aoAparelhos,
          },
        )}
      </div>
      <div className="chamada-baixo-fim">
        <button type="button" className="chamada-sair" data-testid="chamada-sair" onClick={aoSair}>
          <LogOut size={18} aria-hidden="true" />
          {!estreita && "Sair"}
          {estreita && <span className="so-leitor">Sair</span>}
        </button>
      </div>
    </footer>
  );
}

type Dentro = {
  controle: ControleDaChamada;
  estadoSala: Estado;
  eu: Usuario;
  presenca: Record<string, Presenca>;
  mesaNome: string;
  estreita: boolean;
  enviar: (tipo: string, dados: object) => string | null;
  avisar: (texto: string) => void;
  mesaId?: string;
  /** Só na estreita: botões "Flutuar por cima" e "Abrir em tamanho grande". */
  aoFlutuar: (() => void) | null;
  aoAbrirGrande: (() => void) | null;
};

function useDadosDosQuadros(controle: ControleDaChamada, estadoSala: Estado, eu: Usuario) {
  const e = useControle(controle);
  const quadros: DadosDoQuadro[] = [];
  const doEu = e.participantes.find((p) => p.usuarioId === eu.id);
  // Eu sempre apareço, mesmo antes de a sala me listar; o que mostro de mim vem do que escolhi aqui.
  const meu = {
    usuarioId: eu.id,
    microfone: e.microfone && !e.soOuvindo,
    camera: e.camera && e.fluxoLocal !== null,
    fundo: e.fundo,
    surdo: e.surdo,
    soOuvindo: e.soOuvindo,
  };
  const ordem = e.participantes.filter((p) => p.usuarioId !== eu.id);
  const todos = [doEu ? { ...doEu, ...meu } : meu, ...ordem];
  for (const p of todos) {
    const u = estadoSala.usuarios.find((x) => x.id === p.usuarioId);
    if (!u) continue;
    const euSou = p.usuarioId === eu.id;
    quadros.push({
      usuario: u,
      participante: p,
      euSou,
      papel: rotuloDoPapel(estadoSala, u),
      fluxo: euSou ? e.fluxoLocal : (e.fluxos[u.id] ?? null),
      falando: e.falando.has(u.id),
      conectando: !euSou && e.conexoes[u.id] !== "connected",
    });
  }
  return { e, quadros };
}

function ListaDePessoas({
  controle,
  quadros,
  foraDaChamada,
  chamados,
  aoChamar,
}: {
  controle: ControleDaChamada;
  quadros: DadosDoQuadro[];
  foraDaChamada: Usuario[];
  chamados: ReadonlySet<string>;
  aoChamar: (id: string) => void;
}) {
  const e = useControle(controle);
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <aside className="chamada-lista" aria-label="Pessoas" data-testid="chamada-lista">
      <h2 className="chamada-lista-titulo">Na chamada — {quadros.length}</h2>
      {quadros.map((q) => {
        const u = q.usuario;
        const pref = controle.preferenciaDe(u.id);
        const estaAberta = aberta === u.id && !q.euSou;
        return (
          <div key={u.id} data-testid={`chamada-pessoa-${u.id}`}>
            <button
              type="button"
              className="chamada-linha"
              aria-expanded={q.euSou ? undefined : estaAberta}
              data-falando={q.falando ? "sim" : "nao"}
              style={{ "--cor-da-pessoa": u.cor } as CSSProperties}
              onClick={() => !q.euSou && setAberta(estaAberta ? null : u.id)}
            >
              <span className="chamada-bolinha">{inicialDe(u.nome)}</span>
              <span className="chamada-linha-textos">
                <span className="chamada-linha-nome">
                  {u.nome}
                  {q.euSou ? " (você)" : ""}
                </span>
                <span className="chamada-linha-papel">{q.papel}</span>
              </span>
              {(!q.participante.microfone || q.participante.surdo) && (
                <MicOff
                  size={16}
                  className="chamada-ic-perigo"
                  role="img"
                  aria-label="Microfone desligado"
                />
              )}
              {!q.participante.camera && (
                <VideoOff
                  size={16}
                  className="chamada-ic-suave"
                  role="img"
                  aria-label="Câmera desligada"
                />
              )}
            </button>
            {estaAberta && (
              <div className="chamada-volume" data-testid={`chamada-volume-${u.id}`}>
                <label className="chamada-volume-linha">
                  Volume para você
                  <input
                    type="range"
                    min={VOLUME_MINIMO}
                    max={VOLUME_MAXIMO}
                    value={pref.volume}
                    data-testid={`chamada-volume-faixa-${u.id}`}
                    onChange={(ev) => controle.definirVolume(u.id, Number(ev.target.value))}
                  />
                  <span className="chamada-volume-valor">{pref.volume}%</span>
                </label>
                <label className="chamada-marca">
                  <input
                    type="checkbox"
                    checked={pref.silenciado}
                    data-testid={`chamada-silenciar-${u.id}`}
                    onChange={(ev) => controle.silenciar(u.id, ev.target.checked)}
                  />
                  Silenciar só para mim
                </label>
              </div>
            )}
          </div>
        );
      })}
      {e.participantes.length >= 0 && foraDaChamada.length > 0 && (
        <>
          <div className="chamada-divisoria" />
          <h2 className="chamada-lista-titulo">
            Na mesa, fora da chamada — {foraDaChamada.length}
          </h2>
          {foraDaChamada.map((u) => (
            <div
              key={u.id}
              className="chamada-linha chamada-linha-fixa"
              style={{ "--cor-da-pessoa": u.cor } as CSSProperties}
              data-testid={`chamada-fora-${u.id}`}
            >
              <span className="chamada-bolinha">{inicialDe(u.nome)}</span>
              <span className="chamada-linha-textos">
                <span className="chamada-linha-nome">{u.nome}</span>
              </span>
              <button
                type="button"
                className="chamada-botao-texto"
                data-testid={`chamada-chamar-${u.id}`}
                disabled={chamados.has(u.id)}
                onClick={() => aoChamar(u.id)}
              >
                {chamados.has(u.id) ? "Chamado" : "Chamar"}
              </button>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}

function DentroDaChamada(p: Dentro) {
  const { controle, estadoSala, eu, estreita } = p;
  const { e, quadros } = useDadosDosQuadros(controle, estadoSala, eu);
  const agora = useAgora(true);
  const [aparelhosAbertos, setAparelhosAbertos] = useState(false);
  const [chamados, setChamados] = useState<ReadonlySet<string>>(new Set());
  const musicaAgora = useMusicaAgora(estadoSala.musicaTocando);
  const trilha = trilhaDaMesa(estadoSala, musicaAgora?.peca.nome);
  const euMestre = eu.papel === "mestre";
  const emCima = new Set(e.participantes.map((x) => x.usuarioId));
  emCima.add(eu.id);
  const foraDaChamada = membrosDaMesa(estadoSala).filter(
    (u) => !emCima.has(u.id) && p.presenca[u.id] === "online",
  );
  const lista = e.prefs.lista;

  const chamar = (id: string) => {
    p.enviar("chamada.chamar", { para: id });
    setChamados((a) => new Set([...a, id]));
    setTimeout(
      () =>
        setChamados((a) => {
          const n = new Set(a);
          n.delete(id);
          return n;
        }),
      10_000,
    );
  };
  const abrirSom = () => {
    if (!abrirSomEmJanela(p.mesaId ?? "", { largura: 460, altura: 720 })) {
      p.avisar(TEXTO_DO_POPUP_BLOQUEADO);
    }
  };
  const sair = () => void controle.sair();

  // Atalhos M, V e B: só dentro da janela da chamada, e nunca enquanto se digita ou escolhe num campo.
  const sairRef = useRef(sair);
  sairRef.current = sair;
  useEffect(() => {
    const aoTecla = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const alvo = ev.target as HTMLElement | null;
      if (alvo?.closest("input, select, textarea, [contenteditable='true']")) return;
      const k = ev.key.toLowerCase();
      if (k === "m") void controle.alternarMicrofone();
      else if (k === "v") void controle.alternarCamera();
      else if (k === "b") controle.alternarFundo();
      else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", aoTecla);
    return () => window.removeEventListener("keydown", aoTecla);
  }, [controle]);

  const pessoas = quadros.length;
  const tempo = e.entrouEmMs ? formatarTempo(agora - e.entrouEmMs) : "0:00";
  const resumo = `${p.mesaNome} · ${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} · ${tempo}`;

  const quadroTrilha = (pequeno: boolean) => (
    <QuadroDaTrilha
      tocando={trilha.tocando}
      titulo={trilha.titulo}
      subtitulo={trilha.subtitulo}
      musica={trilha.musica}
      pequeno={pequeno}
      euMestre={euMestre}
      aoAbrirSom={abrirSom}
      aoMusica={(acao) => p.enviar("musica.controle", { acao })}
    />
  );

  return (
    <div
      className="chamada-dentro"
      data-testid="chamada-janela"
      data-estreita={estreita}
      data-disposicao={estreita ? "estreita" : "grade"}
    >
      <header className="chamada-topo">
        <span className="chamada-ponto" aria-hidden="true" />
        <h1 className="chamada-titulo">Chamada da mesa</h1>
        <span className="chamada-sub" data-testid="chamada-resumo">
          {resumo}
        </span>
        <span className="chamada-espaco" />
        {estreita ? (
          <>
            {p.aoFlutuar && (
              <BotaoComDica
                testid="chamada-flutuar"
                className="chamada-botao-pequeno"
                nome="Flutuar por cima"
                onClick={p.aoFlutuar}
              >
                <PictureInPicture2 size={17} aria-hidden="true" />
              </BotaoComDica>
            )}
            {p.aoAbrirGrande && (
              <BotaoComDica
                testid="chamada-abrir-grande"
                className="chamada-botao-pequeno"
                nome="Abrir em tamanho grande"
                onClick={p.aoAbrirGrande}
              >
                <Maximize2 size={17} aria-hidden="true" />
              </BotaoComDica>
            )}
          </>
        ) : (
          <BotaoComDica
            testid="chamada-alternar-lista"
            className="chamada-botao-pequeno"
            nome="Mostrar ou esconder a lista de pessoas"
            aria-pressed={lista}
            onClick={() => controle.guardarPreferencias({ lista: !lista })}
          >
            <Users size={18} aria-hidden="true" />
          </BotaoComDica>
        )}
      </header>

      <div className="chamada-corpo">
        {estreita ? (
          <ul className="chamada-linhas" data-testid="chamada-linhas">
            {quadros.map((q) => (
              <li
                key={q.usuario.id}
                className="chamada-linha-estreita"
                data-falando={q.falando ? "sim" : "nao"}
              >
                <div className="chamada-miniatura">
                  <QuadroDaPessoa d={q} pequeno semRotulo />
                </div>
                <div className="chamada-linha-textos">
                  <span className="chamada-linha-nome">
                    {q.usuario.nome}
                    {q.euSou ? " (você)" : ""}
                  </span>
                  <span className="chamada-linha-papel">{q.falando ? "falando" : q.papel}</span>
                </div>
                {(!q.participante.microfone || q.participante.surdo) && (
                  <MicOff
                    size={16}
                    className="chamada-ic-perigo"
                    role="img"
                    aria-label="Microfone desligado"
                  />
                )}
              </li>
            ))}
            <li className="chamada-linha-estreita chamada-linha-trilha">
              <TrilhaEmLinha trilha={trilha} />
            </li>
          </ul>
        ) : (
          <main
            className="chamada-quadros"
            data-testid="chamada-quadros"
            style={{ "--n": Math.max(1, quadros.length) } as CSSProperties}
          >
            {quadros.map((q) => (
              <div className="chamada-celula" key={q.usuario.id}>
                <QuadroDaPessoa d={q} />
              </div>
            ))}
            <div className="chamada-celula">{quadroTrilha(false)}</div>
          </main>
        )}
        {!estreita && lista && (
          <ListaDePessoas
            controle={controle}
            quadros={quadros}
            foraDaChamada={foraDaChamada}
            chamados={chamados}
            aoChamar={chamar}
          />
        )}
      </div>

      {aparelhosAbertos && (
        <section
          className="chamada-aparelhos-janela"
          aria-label="Câmera, microfone e som"
          data-testid="chamada-aparelhos"
        >
          <Aparelhos controle={controle} />
        </section>
      )}
      <BarraDeBaixo
        controle={controle}
        estreita={estreita}
        aparelhosAbertos={aparelhosAbertos}
        aoAparelhos={() => setAparelhosAbertos((a) => !a)}
        aoSair={sair}
      />
    </div>
  );
}

/** A trilha numa linha, na disposição estreita. */
function TrilhaEmLinha({ trilha }: { trilha: { tocando: boolean; titulo: string } }) {
  return (
    <div
      className="chamada-trilha-linha"
      data-testid="chamada-trilha"
      data-tocando={trilha.tocando ? "sim" : "nao"}
    >
      <span className="chamada-trilha-cab">Trilha</span>
      <span className="chamada-trilha-titulo">{trilha.titulo}</span>
      {trilha.tocando && (
        <span className="chamada-eq" aria-hidden="true">
          <span className="chamada-eq-barra" />
          <span className="chamada-eq-barra" />
          <span className="chamada-eq-barra" />
          <span className="chamada-eq-barra" />
        </span>
      )}
    </div>
  );
}

// --- a janela inteira -----------------------------------------------------------------------------------------------

/** Copia os estilos e o tema da janela para a janela flutuante (Document Picture-in-Picture). */
function copiarEstilos(de: Document, para: Document): void {
  for (const a of Array.from(de.documentElement.attributes)) {
    para.documentElement.setAttribute(a.name, a.value);
  }
  for (const no of Array.from(de.head.querySelectorAll("style, link[rel='stylesheet']"))) {
    para.head.appendChild(no.cloneNode(true));
  }
}

export function TelaDaChamada(props: Props) {
  const { controle, estadoSala, eu, mesaNome } = props;
  const raiz = useRef<HTMLDivElement>(null);
  const largura = useLarguraDe(raiz);
  const e = useControle(controle);
  const estreita = ehEstreita(largura);
  const [pip, setPip] = useState<EstadoPip | null>(null);
  const suportaPip = documentPip() !== null;

  const flutuar = async () => {
    const api = documentPip();
    if (!api) return;
    try {
      const janela = await api.requestWindow({ width: 380, height: 520 });
      copiarEstilos(document, janela.document);
      janela.document.body.className = document.body.className;
      janela.addEventListener("pagehide", () => setPip(null));
      setPip({ janela });
    } catch {
      props.avisar("O navegador não deixou a chamada flutuar.");
    }
  };
  const trazerDeVolta = () => {
    pip?.janela.close();
    setPip(null);
  };
  const abrirGrande = () => {
    try {
      window.resizeTo(1100, 720);
    } catch {
      // o navegador não deixa redimensionar: a pessoa abre a janela maior à mão
    }
  };

  const conteudo = (comoEstreita: boolean, ehPip: boolean) =>
    e.fase === "dentro" ? (
      <DentroDaChamada
        controle={controle}
        estadoSala={estadoSala}
        eu={eu}
        presenca={props.presenca}
        mesaNome={mesaNome}
        estreita={comoEstreita}
        enviar={props.enviar}
        avisar={props.avisar}
        mesaId={props.mesaId}
        aoFlutuar={comoEstreita && !ehPip && suportaPip ? flutuar : null}
        aoAbrirGrande={comoEstreita && !ehPip ? abrirGrande : null}
      />
    ) : e.fase === "substituida" ? (
      <SubstituidaPorOutraJanela controle={controle} aviso={e.aviso} />
    ) : (
      <AntesDeEntrar
        controle={controle}
        mesaNome={mesaNome}
        estadoSala={estadoSala}
        eu={eu}
        estreita={comoEstreita}
      />
    );

  return (
    <div className="chamada-raiz" ref={raiz} data-testid="chamada-raiz" data-estreita={estreita}>
      {pip ? (
        <main className="chamada-vazia" data-testid="chamada-flutuando">
          <p>A chamada está flutuando por cima das outras janelas.</p>
          <button type="button" className="chamada-principal" onClick={trazerDeVolta}>
            Trazer de volta
          </button>
          {createPortal(
            <div className="chamada-raiz" data-estreita="true">
              {conteudo(true, true)}
            </div>,
            pip.janela.document.body,
          )}
        </main>
      ) : (
        conteudo(estreita, false)
      )}
    </div>
  );
}
