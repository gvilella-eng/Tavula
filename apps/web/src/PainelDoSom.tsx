import {
  type Cena,
  type Estado,
  LUGARES_POR_GRUPO,
  type LugarDeSom,
  lugaresDe,
  tocandoAgora,
  volumeGeralDe,
} from "@tabletop/shared";
import {
  AppWindow,
  ChevronDown,
  ChevronUp,
  PanelBottom,
  Play,
  Plus,
  Settings,
  Square,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import type { CSSProperties, PointerEvent, KeyboardEvent as TecladoReact } from "react";
import { useEffect, useRef, useState } from "react";
import type { Fontes } from "./assets/fontes";
import { BotaoComDica } from "./BotaoComDica";
import { noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { AbasDoSom } from "./som/AbasDoSom";
import { useAbaDoSom } from "./som/abaDoSom";
import { ConfigDaMesaDeSom } from "./som/ConfigDaMesaDeSom";
import { Deslizante } from "./som/Deslizante";
import type { SomEscolhido } from "./som/EscolherSom";
import { CORES, IconeDoLugar } from "./som/iconesDoSom";
import { MusicaDoSom } from "./som/MusicaDoSom";
import {
  ALTURA_CHEIA_DA_FAIXA,
  ALTURA_MINIMA_DA_FAIXA,
  escalaDaFaixa,
  gravarAlturaDaFaixa,
  lerAlturaDaFaixa,
  useEnvioAdiado,
  useModoDoSom,
} from "./som/modoDoSom";
import type { EfeitoTocando } from "./som/motorDeSom";

type Props = {
  estado: Estado;
  /** A cena que o mestre está vendo: tem os ambientes dela. */
  cena: Cena;
  fontes: Fontes;
  registrar: (arquivo: File) => Promise<SomEscolhido>;
  enviar: (tipo: string, dados: object) => string | null;
  /** Os efeitos que estão tocando neste navegador (a barra de progresso e o "parar"). */
  efeitosEmAndamento: EfeitoTocando[];
  /** Ouve um som só aqui (a prévia da configuração): nada vai para a sala. */
  ouvir: (hash: string, volume: number) => void;
  /** FG2: um número que cresce a cada pedido de "Abrir a biblioteca" (o aviso depois de soltar um som). */
  abrirBiblioteca?: number | undefined;
  aoFechar: () => void;
  /** Q4b: leva a mesa de som para uma janela própria do navegador (some na própria janela). */
  aoAbrirEmJanela?: (() => void) | undefined;
  /** Q4b: a mesa de som na janela própria do navegador: página inteira, sem janela flutuante nem faixa. */
  propria?: { aoVoltar: () => void } | undefined;
};

/** A dica com o nome inteiro só aparece quando o nome do cartão está cortado (mais de duas linhas). */
function nomeCortado(botao: HTMLButtonElement): boolean {
  const nome = botao
    .closest("li, .som-efeito-celula")
    ?.querySelector<HTMLElement>(".som-nome, .som-nome-linha");
  return nome ? nome.scrollHeight > nome.clientHeight + 3 : false;
}

const corDe = (l: LugarDeSom): CSSProperties =>
  ({ "--cor-do-som": CORES[l.cor].variavel }) as CSSProperties;

/**
 * Q4: a mesa de som do mestre. 8 efeitos (um toque toca uma vez, para todos) e 8 ambientes (cada um com o próprio volume; os
 * interruptores escolhem quais entram), o volume geral e o transporte "Tocar"/"Parar" (Q4b), que toca ou cala os
 * ambientes marcados. É uma janela flutuante, uma faixa no pé da tela (com altura ajustável) ou, em Q4b, uma janela
 * própria do navegador (a escolha de janela ou faixa fica neste navegador). A configuração dos 16 lugares abre pela
 * engrenagem e pelo "adicionar" de um lugar vazio, por cima de tudo. Só o mestre controla; os jogadores só ouvem.
 */
export function PainelDoSom(p: Props) {
  const { modo, mudarModo, recolhida, mudarRecolhida } = useModoDoSom();
  const [configurando, setConfigurando] = useState<{
    grupo: "efeito" | "ambiente";
    indice: number;
    aba?: "lugares" | "musica";
  } | null>(null);
  const { aba, mudarAba } = useAbaDoSom();
  const pedidoDaBiblioteca = p.abrirBiblioteca ?? 0;
  useEffect(() => {
    if (pedidoDaBiblioteca > 0) setConfigurando({ grupo: "efeito", indice: 0, aba: "musica" });
  }, [pedidoDaBiblioteca]);
  const [alturaDaFaixa, setAlturaDaFaixa] = useState<number | null>(lerAlturaDaFaixa);
  const [dicaDoTransporte, setDicaDoTransporte] = useState(false);
  const faixaRef = useRef<HTMLElement>(null);
  // MU3: a faixa embaixo diz ao mapa quanto do pé ela ocupa (a variável `--faixa-do-som`), para o zoom e os avisos subirem.
  useEffect(() => {
    const faixa = faixaRef.current;
    const pai = faixa?.parentElement;
    if (modo !== "faixa" || !faixa || !pai) return;
    const atualizar = () =>
      pai.style.setProperty(
        "--faixa-do-som",
        `${Math.ceil(faixa.getBoundingClientRect().height) + 8}px`,
      );
    atualizar();
    const olho = new ResizeObserver(atualizar);
    olho.observe(faixa);
    return () => {
      olho.disconnect();
      pai.style.removeProperty("--faixa-do-som");
    };
  }, [modo]);
  const adiar = useEnvioAdiado();
  const lugares = lugaresDe(p.estado.mesaDeSom);
  const ligados = p.estado.somLigado?.ambientes ?? [];
  const tocando = tocandoAgora(p.estado);
  const geral = volumeGeralDe(p.estado);

  const usados = lugares.efeitos.filter(Boolean).length + lugares.ambientes.filter(Boolean).length;
  const mesaVazia = usados === 0;

  const nEfeitos = p.efeitosEmAndamento.length;
  const nMarcados = ligados.length;
  const nAmbientes = tocando ? nMarcados : 0;
  const resumo = `${nEfeitos} ${nEfeitos === 1 ? "efeito" : "efeitos"} e ${nAmbientes} ${
    nAmbientes === 1 ? "ambiente" : "ambientes"
  } tocando`;
  const rotuloDosAmbientes = tocando
    ? `${nMarcados} ${nMarcados === 1 ? "ligado" : "ligados"}`
    : `${nMarcados} ${nMarcados === 1 ? "marcado" : "marcados"}`;

  const abrirConfig = (grupo: "efeito" | "ambiente", indice: number) =>
    setConfigurando({ grupo, indice });

  const vazioGeral = (
    <div className="som-vazio-geral" data-testid="som-vazio-geral">
      <Volume2 size={22} aria-hidden="true" />
      <p>Nenhum som na mesa de som ainda</p>
      <button
        type="button"
        className="primario som-botao-com-icone"
        data-testid="som-vazio-configurar"
        onClick={() => abrirConfig("efeito", 0)}
      >
        <Settings size={14} aria-hidden="true" /> Configurar
      </button>
    </div>
  );

  const efeitos = (
    <div className="som-efeitos" data-testid="som-efeitos">
      {lugares.efeitos.map((l, i) => {
        const chave = `efeito-${i}`;
        const tocandoEfeito = p.efeitosEmAndamento.find((e) => e.lugar === i);
        if (!l) {
          return (
            <BotaoComDica
              key={chave}
              testid={`som-efeito-vazio-${i}`}
              nome="Adicionar efeito"
              className="som-vazio"
              aria-label={`Adicionar efeito no lugar ${i + 1}`}
              onClick={() => abrirConfig("efeito", i)}
            >
              <Plus size={18} aria-hidden="true" />
            </BotaoComDica>
          );
        }
        return (
          <div key={chave} className="som-efeito-celula">
            <BotaoComDica
              nome={l.nome}
              dicaSe={nomeCortado}
              className="som-efeito"
              style={corDe(l)}
              testid={`som-efeito-${i}`}
              data-tocando={tocandoEfeito ? "sim" : "nao"}
              aria-label={`${tocandoEfeito ? "Tocar de novo" : "Tocar"}: ${l.nome}`}
              onClick={() => p.enviar("som.efeito", { lugar: i })}
            >
              <span className="som-circulo">
                <IconeDoLugar icone={l.icone} />
              </span>
              <span className="som-nome">{l.nome}</span>
              {tocandoEfeito?.duracaoS ? (
                <span
                  key={tocandoEfeito.chave}
                  className="som-barra"
                  data-testid={`som-efeito-barra-${i}`}
                  style={{ animationDuration: `${tocandoEfeito.duracaoS}s` }}
                />
              ) : null}
            </BotaoComDica>
            {tocandoEfeito && (
              <button
                type="button"
                className="som-parar-efeito"
                data-testid={`som-efeito-parar-${i}`}
                aria-label={`Parar ${l.nome}`}
                onClick={() => p.enviar("som.efeitoParar", { lugar: i })}
              >
                <Square size={10} fill="currentColor" aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const ambientes = (
    <ul className="som-ambientes" data-testid="som-ambientes">
      {lugares.ambientes.map((l, i) => {
        const chave = `ambiente-${i}`;
        if (!l) {
          return (
            <li key={chave}>
              <BotaoComDica
                nome="Adicionar ambiente"
                dicaSe={(b) => b.scrollWidth > b.clientWidth + 1}
                className="som-vazio som-vazio-linha"
                testid={`som-ambiente-vazio-${i}`}
                aria-label={`Adicionar ambiente no lugar ${i + 1}`}
                onClick={() => abrirConfig("ambiente", i)}
              >
                <Plus size={14} aria-hidden="true" />
                <span className="som-vazio-texto-linha">Adicionar ambiente</span>
              </BotaoComDica>
            </li>
          );
        }
        const ligado = ligados.find((a) => a.indice === i);
        const volume = ligado?.volume ?? l.volume;
        return (
          <li key={chave}>
            <div
              className="som-ambiente"
              style={corDe(l)}
              data-testid={`som-ambiente-${i}`}
              data-ligado={ligado ? "sim" : "nao"}
              data-tocando={ligado && tocando ? "sim" : "nao"}
            >
              <BotaoComDica
                nome={l.nome}
                dicaSe={nomeCortado}
                role="switch"
                aria-checked={ligado !== undefined}
                aria-label={`${ligado ? "Desligar" : "Ligar"} ${l.nome}`}
                className="som-interruptor"
                testid={`som-ambiente-ligar-${i}`}
                onClick={() => {
                  setDicaDoTransporte(false);
                  p.enviar("som.ambiente", { indice: i, ligado: !ligado });
                }}
              >
                <span />
              </BotaoComDica>
              <span className="som-icone">
                <IconeDoLugar icone={l.icone} tamanho={16} />
              </span>
              <span className="som-nome-linha">{l.nome}</span>
              <Deslizante
                classe={ligado ? "som-ambiente-vol" : "som-ambiente-vol som-apagado"}
                testid={`som-ambiente-volume-${i}`}
                rotulo={`Volume de ${l.nome}`}
                valor={volume}
                aoMudar={(v) =>
                  adiar(chave, () =>
                    ligado
                      ? p.enviar("som.ambiente", { indice: i, ligado: true, volume: v })
                      : p.enviar("som.lugar", {
                          grupo: "ambiente",
                          indice: i,
                          lugar: { ...l, volume: v },
                        }),
                  )
                }
              />
            </div>
          </li>
        );
      })}
    </ul>
  );

  /** O transporte: "Tocar" quando nada toca e "Parar" enquanto toca. Sem ambiente marcado, "Tocar" só mostra a dica. */
  function alternarTransporte() {
    if (tocando) {
      p.enviar("som.transporte", { tocando: false });
      return;
    }
    if (nMarcados === 0) {
      setDicaDoTransporte(true);
      return;
    }
    p.enviar("som.transporte", { tocando: true });
  }
  const dicaVisivel = dicaDoTransporte && !tocando && nMarcados === 0;

  const pe = (
    <div className="som-pe">
      <Volume2 size={16} aria-hidden="true" />
      <span className="som-pe-rotulo">Volume geral</span>
      <Deslizante
        classe="som-pe-vol"
        testid="som-mesa-geral"
        rotulo="Volume geral da mesa de som"
        valor={geral}
        aoMudar={(v) => adiar("geral", () => p.enviar("som.volumeGeral", { volume: v }))}
      />
      <button
        type="button"
        className="som-transporte"
        data-testid="som-transporte"
        data-tocando={tocando ? "sim" : "nao"}
        disabled={mesaVazia}
        aria-label={tocando ? "Parar o som" : "Tocar os ambientes ligados"}
        onClick={alternarTransporte}
      >
        {tocando ? (
          <>
            <Square size={12} fill="currentColor" aria-hidden="true" /> Parar
          </>
        ) : (
          <>
            <Play size={12} fill="currentColor" aria-hidden="true" /> Tocar
          </>
        )}
      </button>
      {dicaVisivel && (
        <span className="som-transporte-dica" role="status" data-testid="som-transporte-dica">
          Ligue um ou mais ambientes
        </span>
      )}
    </div>
  );

  const config = configurando && (
    <ConfigDaMesaDeSom
      estado={p.estado}
      inicial={configurando}
      aba={configurando.aba}
      fontes={p.fontes}
      registrar={p.registrar}
      enviar={p.enviar}
      ouvir={p.ouvir}
      aoFechar={() => setConfigurando(null)}
    />
  );

  const botaoConfig = (
    <BotaoComDica
      testid="som-config-abrir"
      nome="Configurar a mesa de som"
      className="botao-icone pequeno"
      onClick={() => setConfigurando({ grupo: "efeito", indice: 0 })}
    >
      <Settings size={16} aria-hidden="true" />
    </BotaoComDica>
  );

  const botaoEmJanela = p.aoAbrirEmJanela && (
    <BotaoComDica
      testid="som-abrir-em-janela"
      nome="Abrir em outra janela"
      className="botao-icone pequeno"
      onClick={p.aoAbrirEmJanela}
    >
      <AppWindow size={16} aria-hidden="true" />
    </BotaoComDica>
  );

  const ambientesDaCena = p.cena.ambientes;
  const nomesDaCena = (ambientesDaCena ?? [])
    .map((i) => lugares.ambientes[i]?.nome)
    .filter((n): n is string => n !== undefined);

  // --- MU2: duas abas, "Efeitos e ambientes" e "Música": só a vista muda, nada para de tocar ----

  const musicaTocando = p.estado.musicaTocando;
  const resumoDaMusica = musicaTocando
    ? `${musicaTocando.botaoNome}${musicaTocando.tocando ? "" : " (pausada)"}`
    : "nada tocando";
  const partesDoEstado: string[] = [];
  if (nAmbientes > 0)
    partesDoEstado.push(
      `${nAmbientes} ${nAmbientes === 1 ? "ambiente ligado" : "ambientes ligados"}`,
    );
  if (nEfeitos > 0)
    partesDoEstado.push(`${nEfeitos} ${nEfeitos === 1 ? "efeito tocando" : "efeitos tocando"}`);

  const barraDeAbas = (
    <AbasDoSom
      aba={aba}
      aoMudar={mudarAba}
      efeitos={{
        estado: partesDoEstado.length > 0 ? partesDoEstado.join(" · ") : "nada tocando",
        toca: partesDoEstado.length > 0,
      }}
      musica={{
        nome: musicaTocando?.botaoNome ?? null,
        tocando: musicaTocando?.tocando === true,
        toca: musicaTocando?.tocando === true,
      }}
    />
  );

  const painelMusica = (
    <section
      className="som-painel-aba som-painel-musica"
      role="tabpanel"
      id="som-painel-musica"
      aria-labelledby="som-aba-musica"
      data-testid="som-painel-musica"
    >
      <MusicaDoSom
        estado={p.estado}
        enviar={p.enviar}
        aoConfigurar={() => setConfigurando({ grupo: "efeito", indice: 0, aba: "musica" })}
      />
    </section>
  );

  /** A aba "Efeitos e ambientes" na forma vertical: a da janela flutuante e a da janela própria do navegador. */
  const painelEfeitosVertical = (
    <div
      className="som-painel-aba som-painel-efeitos"
      role="tabpanel"
      id="som-painel-efeitos"
      aria-labelledby="som-aba-efeitos"
      data-testid="som-painel-efeitos"
    >
      {mesaVazia ? (
        vazioGeral
      ) : (
        <>
          <h3 className="som-secao">
            <span>Efeitos</span>
            <span>
              {lugares.efeitos.filter(Boolean).length}/{LUGARES_POR_GRUPO}
              {nEfeitos > 0 ? ` · ${nEfeitos} tocando` : ""}
            </span>
          </h3>
          {efeitos}
          <h3 className="som-secao">
            <span>Ambientes · em laço</span>
            <span>
              {lugares.ambientes.filter(Boolean).length}/{LUGARES_POR_GRUPO} · {rotuloDosAmbientes}
            </span>
          </h3>
          {ambientes}
          <div className="som-cena" data-testid="som-cena">
            <p className="nota" data-testid="som-cena-ambientes">
              Ambientes desta cena:{" "}
              {ambientesDaCena === undefined
                ? "não mexe nos que tocam"
                : nomesDaCena.length > 0
                  ? nomesDaCena.join(", ")
                  : "silêncio"}
            </p>
            <div className="linha-botoes">
              <button
                type="button"
                data-testid="som-cena-usar"
                onClick={() =>
                  p.enviar("cena.editar", {
                    cenaId: p.cena.id,
                    ambientes: ligados.map((a) => a.indice),
                  })
                }
              >
                Usar os marcados
              </button>
              <button
                type="button"
                data-testid="som-cena-tirar"
                disabled={ambientesDaCena === undefined}
                onClick={() => p.enviar("cena.editar", { cenaId: p.cena.id, ambientes: null })}
              >
                Tirar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
  const corpoVertical = (
    <>
      {barraDeAbas}
      {aba === "efeitos" ? painelEfeitosVertical : painelMusica}
      {pe}
      <p className="nota som-pe-nota" data-testid="som-resumo">
        {resumo} · {usados}/16 lugares · só o mestre controla; os jogadores só ouvem.
      </p>
    </>
  );

  if (p.propria) {
    return (
      <>
        <section className="som-propria" data-testid="som-propria" aria-label="Mesa de som">
          <header className="som-propria-topo">
            <Volume2 size={16} aria-hidden="true" className="som-faixa-icone" />
            <h2>Som</h2>
            <span className="som-faixa-espaco" />
            {botaoConfig}
            <BotaoComDica
              testid="som-voltar-para-mesa"
              nome="Voltar para a mesa"
              className="botao-icone pequeno"
              onClick={p.propria.aoVoltar}
            >
              <Undo2 size={16} aria-hidden="true" />
            </BotaoComDica>
          </header>
          <div className="som-propria-corpo painel-som">{corpoVertical}</div>
        </section>
        {config}
      </>
    );
  }

  if (modo === "faixa") {
    const escala = escalaDaFaixa(alturaDaFaixa);
    const comAltura = alturaDaFaixa !== null && alturaDaFaixa < ALTURA_CHEIA_DA_FAIXA;
    return (
      <>
        <section
          ref={faixaRef}
          className="som-faixa"
          data-testid="som-faixa"
          data-recolhida={recolhida ? "sim" : "nao"}
          data-escala={escala}
          aria-label="Mesa de som"
          style={comAltura && !recolhida ? { height: alturaDaFaixa } : undefined}
        >
          {!recolhida && (
            <AlcaDaFaixa
              altura={alturaDaFaixa}
              aoMudar={setAlturaDaFaixa}
              aoSoltar={(a) => gravarAlturaDaFaixa(a)}
            />
          )}
          <header className="som-faixa-topo">
            <Volume2 size={16} aria-hidden="true" className="som-faixa-icone" />
            <h2>Som</h2>
            <span className="som-resumo" data-testid="som-resumo">
              {resumo}
            </span>
            <span className="som-resumo" data-testid="som-resumo-musica">
              · música: {resumoDaMusica}
            </span>
            <span className="som-faixa-espaco" />
            {pe}
            {botaoConfig}
            {botaoEmJanela}
            <BotaoComDica
              testid="som-soltar"
              nome="Soltar em janela"
              className="botao-icone pequeno"
              onClick={() => mudarModo("janela")}
            >
              <PanelBottom size={16} aria-hidden="true" />
            </BotaoComDica>
            <BotaoComDica
              testid="som-faixa-recolher"
              nome={recolhida ? "Abrir a faixa" : "Recolher a faixa"}
              className="botao-icone pequeno"
              onClick={() => mudarRecolhida(!recolhida)}
            >
              {recolhida ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </BotaoComDica>
            <BotaoComDica
              testid="som-fechar"
              nome="Fechar a mesa de som"
              className="botao-icone pequeno"
              onClick={p.aoFechar}
            >
              <X size={16} aria-hidden="true" />
            </BotaoComDica>
          </header>
          {!recolhida && barraDeAbas}
          {!recolhida && (
            <div className="som-faixa-corpo" data-testid="som-faixa-corpo">
              <div
                className="som-faixa-escala"
                data-testid="som-faixa-escala"
                style={escala < 1 ? ({ zoom: escala } as CSSProperties) : undefined}
              >
                {aba === "musica" ? (
                  painelMusica
                ) : (
                  <div
                    className="som-painel-aba som-painel-efeitos"
                    role="tabpanel"
                    id="som-painel-efeitos"
                    aria-labelledby="som-aba-efeitos"
                    data-testid="som-painel-efeitos"
                  >
                    {mesaVazia ? (
                      vazioGeral
                    ) : (
                      <div className="som-faixa-colunas">
                        <div className="som-faixa-coluna som-faixa-efeitos">
                          <h3 className="som-secao">
                            <span>Efeitos</span>
                            <span>
                              {lugares.efeitos.filter(Boolean).length}/{LUGARES_POR_GRUPO}
                            </span>
                          </h3>
                          {efeitos}
                        </div>
                        <div className="som-faixa-coluna som-faixa-ambientes">
                          <h3 className="som-secao">
                            <span>Ambientes · em laço</span>
                            <span>
                              {lugares.ambientes.filter(Boolean).length}/{LUGARES_POR_GRUPO} ·{" "}
                              {rotuloDosAmbientes}
                            </span>
                          </h3>
                          {ambientes}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        {config}
      </>
    );
  }

  return (
    <>
      <Janela
        id="som"
        titulo="Som"
        icone={<Volume2 size={14} />}
        testid="painel-som"
        classeDoCorpo="painel-som"
        padrao={noCanto("topo-esquerda", 72, 64)}
        largura={420}
        altura={(area) => Math.min(680, area.altura - 24)}
        acoes={
          <>
            {botaoConfig}
            {botaoEmJanela}
            <BotaoComDica
              testid="som-encaixar"
              nome="Encaixar como faixa no pé da tela"
              className="botao-icone pequeno"
              onClick={() => mudarModo("faixa")}
            >
              <PanelBottom size={16} aria-hidden="true" />
            </BotaoComDica>
          </>
        }
        aoFechar={p.aoFechar}
        rotuloDoFechar="Fechar o painel de som"
        testidDoFechar="som-fechar"
      >
        {corpoVertical}
      </Janela>
      {config}
    </>
  );
}

const PASSO_DA_ALCA = 16;
const PASSO_GRANDE_DA_ALCA = 48;

/**
 * Q4b: a alça na borda de cima da faixa. Arrastar (ou as setas, com a alça focada) muda a altura: acima da altura cheia
 * a faixa volta ao tamanho natural; abaixo dela tudo encolhe junto até um mínimo legível e, daí para baixo, o corpo
 * rola. Home volta ao tamanho natural. A altura fica lembrada por pessoa.
 */
function AlcaDaFaixa(p: {
  altura: number | null;
  aoMudar: (altura: number | null) => void;
  aoSoltar: (altura: number | null) => void;
}) {
  const arrasto = useRef<{ y: number; altura: number } | null>(null);
  const atual =
    p.altura === null ? ALTURA_CHEIA_DA_FAIXA : Math.min(p.altura, ALTURA_CHEIA_DA_FAIXA);

  /** Cerca a altura; a cheia vira "natural" (`null`). */
  const cercar = (a: number): number | null => {
    const limitada = Math.max(ALTURA_MINIMA_DA_FAIXA, Math.round(a));
    return limitada >= ALTURA_CHEIA_DA_FAIXA ? null : limitada;
  };

  function aoApertar(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { y: e.clientY, altura: atual };
  }
  function aoMover(e: PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (!a) return;
    p.aoMudar(cercar(a.altura + (a.y - e.clientY)));
  }
  function aoSoltarOPonteiro(e: PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (!a) return;
    arrasto.current = null;
    const final = cercar(a.altura + (a.y - e.clientY));
    p.aoMudar(final);
    p.aoSoltar(final);
  }
  function aoTeclar(e: TecladoReact<HTMLDivElement>) {
    const passo = e.shiftKey ? PASSO_GRANDE_DA_ALCA : PASSO_DA_ALCA;
    let novo: number | null | undefined;
    if (e.key === "ArrowUp") novo = cercar(atual + passo);
    else if (e.key === "ArrowDown") novo = cercar(atual - passo);
    else if (e.key === "Home") novo = null;
    else if (e.key === "End") novo = ALTURA_MINIMA_DA_FAIXA;
    if (novo === undefined) return;
    e.preventDefault();
    p.aoMudar(novo);
    p.aoSoltar(novo);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: o separador com foco é o padrão de ARIA para uma divisória ajustável
    <div
      className="som-faixa-alca"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Ajustar a altura da mesa de som"
      aria-valuemin={ALTURA_MINIMA_DA_FAIXA}
      aria-valuemax={ALTURA_CHEIA_DA_FAIXA}
      aria-valuenow={atual}
      tabIndex={0}
      data-testid="som-faixa-alca"
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltarOPonteiro}
      onPointerCancel={aoSoltarOPonteiro}
      onKeyDown={aoTeclar}
    >
      <span aria-hidden="true" />
    </div>
  );
}
