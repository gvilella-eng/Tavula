import {
  type Cena,
  type Estado,
  LUGARES_POR_GRUPO,
  type LugarDeSom,
  lugaresDe,
  volumeGeralDe,
} from "@tabletop/shared";
import {
  ChevronDown,
  ChevronUp,
  PanelBottom,
  Plus,
  Settings,
  Square,
  Volume2,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { Fontes } from "./assets/fontes";
import { BotaoComDica } from "./BotaoComDica";
import { noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { ConfigDaMesaDeSom } from "./som/ConfigDaMesaDeSom";
import { Deslizante } from "./som/Deslizante";
import type { SomEscolhido } from "./som/EscolherSom";
import { CORES, IconeDoLugar } from "./som/iconesDoSom";
import { useEnvioAdiado, useModoDoSom } from "./som/modoDoSom";
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
  aoFechar: () => void;
};

const corDe = (l: LugarDeSom): CSSProperties =>
  ({ "--cor-do-som": CORES[l.cor].variavel }) as CSSProperties;

/**
 * Q4: a mesa de som do mestre. 8 efeitos (um toque toca uma vez, para todos) e 8 ambientes (ligam e desligam sozinhos, vários
 * ao mesmo tempo, em laço, cada um com o próprio volume), o volume geral e "Parar tudo". É uma janela flutuante ou, se a
 * pessoa preferir, uma faixa no pé da tela (a escolha fica neste navegador). A configuração dos 16 lugares abre pela
 * engrenagem e pelo "adicionar" de um lugar vazio. Só o mestre controla; os jogadores só ouvem.
 */
export function PainelDoSom(p: Props) {
  const { modo, mudarModo, recolhida, mudarRecolhida } = useModoDoSom();
  const [configurando, setConfigurando] = useState<{
    grupo: "efeito" | "ambiente";
    indice: number;
  } | null>(null);
  const adiar = useEnvioAdiado();
  const lugares = lugaresDe(p.estado.mesaDeSom);
  const ligados = p.estado.somLigado?.ambientes ?? [];
  const geral = volumeGeralDe(p.estado);

  const nEfeitos = p.efeitosEmAndamento.length;
  const nAmbientes = ligados.length;
  const resumo = `${nEfeitos} ${nEfeitos === 1 ? "efeito" : "efeitos"} e ${nAmbientes} ${
    nAmbientes === 1 ? "ambiente" : "ambientes"
  } tocando`;

  const abrirConfig = (grupo: "efeito" | "ambiente", indice: number) =>
    setConfigurando({ grupo, indice });

  const efeitos = (
    <div className="som-efeitos" data-testid="som-efeitos">
      {lugares.efeitos.map((l, i) => {
        const chave = `efeito-${i}`;
        const tocando = p.efeitosEmAndamento.find((e) => e.lugar === i);
        if (!l) {
          return (
            <button
              key={chave}
              type="button"
              className="som-vazio"
              data-testid={`som-efeito-vazio-${i}`}
              aria-label={`Adicionar efeito no lugar ${i + 1}`}
              onClick={() => abrirConfig("efeito", i)}
            >
              <Plus size={18} aria-hidden="true" />
              <span>adicionar</span>
            </button>
          );
        }
        return (
          <div key={chave} className="som-efeito-celula">
            <button
              type="button"
              className="som-efeito"
              style={corDe(l)}
              data-testid={`som-efeito-${i}`}
              data-tocando={tocando ? "sim" : "nao"}
              aria-label={`${tocando ? "Tocar de novo" : "Tocar"}: ${l.nome}`}
              onClick={() => p.enviar("som.efeito", { lugar: i })}
            >
              <span className="som-circulo">
                <IconeDoLugar icone={l.icone} />
              </span>
              <span className="som-nome">{l.nome}</span>
              {tocando?.duracaoS ? (
                <span
                  key={tocando.chave}
                  className="som-barra"
                  data-testid={`som-efeito-barra-${i}`}
                  style={{ animationDuration: `${tocando.duracaoS}s` }}
                />
              ) : null}
            </button>
            {tocando && (
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
              <button
                type="button"
                className="som-vazio som-vazio-linha"
                data-testid={`som-ambiente-vazio-${i}`}
                aria-label={`Adicionar ambiente no lugar ${i + 1}`}
                onClick={() => abrirConfig("ambiente", i)}
              >
                <Plus size={14} aria-hidden="true" />
                adicionar ambiente
              </button>
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
            >
              <button
                type="button"
                role="switch"
                aria-checked={ligado !== undefined}
                aria-label={`${ligado ? "Desligar" : "Ligar"} ${l.nome}`}
                className="som-interruptor"
                data-testid={`som-ambiente-ligar-${i}`}
                onClick={() => p.enviar("som.ambiente", { indice: i, ligado: !ligado })}
              >
                <span />
              </button>
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
        className="som-parar-tudo"
        data-testid="som-parar-tudo"
        onClick={() => p.enviar("som.pararTudo", {})}
      >
        <Square size={12} fill="currentColor" aria-hidden="true" /> Parar tudo
      </button>
    </div>
  );

  const config = configurando && (
    <ConfigDaMesaDeSom
      estado={p.estado}
      inicial={configurando}
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

  const usados = lugares.efeitos.filter(Boolean).length + lugares.ambientes.filter(Boolean).length;

  if (modo === "faixa") {
    return (
      <>
        <section
          className="som-faixa"
          data-testid="som-faixa"
          data-recolhida={recolhida ? "sim" : "nao"}
          aria-label="Mesa de som"
        >
          <header className="som-faixa-topo">
            <Volume2 size={16} aria-hidden="true" className="som-faixa-icone" />
            <h2>Som</h2>
            <span className="som-resumo" data-testid="som-resumo">
              {resumo}
            </span>
            <span className="som-faixa-espaco" />
            {pe}
            {botaoConfig}
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
          {!recolhida && (
            <div className="som-faixa-corpo">
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
                    {lugares.ambientes.filter(Boolean).length}/{LUGARES_POR_GRUPO} · {nAmbientes}{" "}
                    {nAmbientes === 1 ? "ligado" : "ligados"}
                  </span>
                </h3>
                {ambientes}
              </div>
            </div>
          )}
        </section>
        {config}
      </>
    );
  }

  const ambientesDaCena = p.cena.ambientes;
  const nomesDaCena = (ambientesDaCena ?? [])
    .map((i) => lugares.ambientes[i]?.nome)
    .filter((n): n is string => n !== undefined);

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
        acoes={
          <>
            {botaoConfig}
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
            {lugares.ambientes.filter(Boolean).length}/{LUGARES_POR_GRUPO} · {nAmbientes}{" "}
            {nAmbientes === 1 ? "ligado" : "ligados"}
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
              Usar os que tocam
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
        {pe}
        <p className="nota som-pe-nota" data-testid="som-resumo">
          {resumo} · {usados}/16 lugares · só o mestre controla; os jogadores só ouvem.
        </p>
      </Janela>
      {config}
    </>
  );
}
