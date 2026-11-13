import {
  type Cena,
  cenaDoObjeto,
  type Estado,
  type FonteDeLuz,
  formatarRestante,
  type PontoDeLuz,
} from "@tabletop/shared";
import { Flame, Minus, Plus, Power, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BotaoComDica } from "./BotaoComDica";
import { Campo, CampoDeDistancia } from "./Campo";
import { noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { type TempoDaTela, useTic } from "./tempo";

type Props = {
  cena: Cena;
  /** O estado da mesa (o painel lista as luzes, os pontos, os personagens e o relógio da sala). */
  estado: Estado;
  tempo: TempoDaTela;
  selecionadaId: string | null;
  aoSelecionar: (id: string | null) => void;
  /** A ferramenta de luz está ativa (o próximo clique no mapa põe a luz). */
  colocando: boolean;
  aoColocar: () => void;
  pontoSelecionadoId: string | null;
  aoSelecionarPonto: (id: string | null) => void;
  /** A ferramenta de ponto está ativa, com este tipo (o próximo clique no mapa põe o ponto). */
  colocandoPonto: "suporte" | "inflamavel" | null;
  aoColocarPonto: (tipo: "suporte" | "inflamavel") => void;
  enviar: (tipo: string, dados: object) => string | null;
  aoFechar: () => void;
};

/**
 * Envia no máximo um valor a cada `ms` por chave (o último vale): um slider arrastado não vira uma
 * mensagem por pixel.
 */
function useEnvioSuave(ms = 90) {
  const pendentes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const ultimos = useRef(new Map<string, () => void>());
  useEffect(() => {
    const temporizadores = pendentes.current;
    return () => {
      for (const t of temporizadores.values()) clearTimeout(t);
    };
  }, []);
  return (chave: string, enviar: () => void) => {
    ultimos.current.set(chave, enviar);
    if (pendentes.current.has(chave)) return;
    pendentes.current.set(
      chave,
      setTimeout(() => {
        pendentes.current.delete(chave);
        ultimos.current.get(chave)?.();
      }, ms),
    );
  };
}

/** Slider de 0 a 100% que acompanha o valor da sala (0 a 1) e envia o que o mestre arrasta. */
function Deslizante(props: {
  testid: string;
  rotulo: string;
  valor: number;
  aoMudar: (v: number) => void;
}) {
  const [local, setLocal] = useState(Math.round(props.valor * 100));
  const arrastando = useRef(false);
  useEffect(() => {
    if (!arrastando.current) setLocal(Math.round(props.valor * 100));
  }, [props.valor]);
  return (
    <div className="deslizante">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label={props.rotulo}
        data-testid={props.testid}
        value={local}
        onPointerDown={() => {
          arrastando.current = true;
        }}
        onPointerUp={() => {
          arrastando.current = false;
        }}
        onChange={(e) => {
          const v = Number(e.target.value);
          setLocal(v);
          props.aoMudar(v / 100);
        }}
      />
      <output data-testid={`${props.testid}-valor`}>{local}%</output>
    </div>
  );
}

const UM_MINUTO_MS = 60_000;

/** O tempo restante da luz, no relógio do painel ("12:34"); em cinza quando não está contando. */
function TempoDaLuz({ luz, restante }: { luz: FonteDeLuz; restante: number | undefined }) {
  if (restante === undefined) return null;
  return (
    <span className="luz-tempo" data-testid={`luz-tempo-${luz.id}`} data-contando={luz.contando}>
      {formatarRestante(restante)}
    </span>
  );
}

/** "12:34" do relógio da sala (para o histórico e os prazos). */
function noRelogio(ms: number): string {
  return formatarRestante(ms);
}

/**
 * Painel flutuante das fontes de luz (só do mestre), no estilo da ordem de turno: o slider geral no
 * topo, as fontes fixas, as variáveis (tochas nas mãos e objetos dos pontos, com o tempo restante,
 * −1 min / +1 min, lixeira e intensidade), os pontos (suporte e inflamável) e, com algo escolhido, o
 * detalhe: saldo, histórico e modificadores de raio. É uma `Janela`: dois cliques no cabeçalho
 * minimizam (só o cabeçalho) e restauram.
 */
export function PainelDeFontesDeLuz(p: Props) {
  const suave = useEnvioSuave();
  const { estado } = p;
  const contexto = { tokens: estado.tokens, pontos: estado.pontos };
  useTic(estado.luzes.some((l) => l.contando === true));

  const daCena = estado.luzes.filter((l) => cenaDoObjeto(l, contexto) === p.cena.id);
  const fixas = daCena.filter((l) => l.portador.tipo === "cena" || l.portador.tipo === "token");
  const variaveis = daCena.filter((l) => l.portador.tipo === "mao" || l.portador.tipo === "ponto");
  const pontos = estado.pontos.filter((x) => x.cenaId === p.cena.id);
  const selecionada = daCena.find((f) => f.id === p.selecionadaId) ?? null;
  const pontoSelecionado = pontos.find((x) => x.id === p.pontoSelecionadoId) ?? null;
  const fator = p.cena.fatorDeLuz ?? 1;

  const editar = (id: string, mudancas: object) => p.enviar("fonte.editar", { id, mudancas });
  const ajustar = (id: string, ajuste: object) => p.enviar("objeto.ajustar", { id, ajuste });
  const nomeDoToken = (id: string) => estado.tokens.find((t) => t.id === id)?.nome ?? "token";
  const onde = (f: FonteDeLuz) => {
    const por = f.portador;
    switch (por.tipo) {
      case "cena":
        return "na cena";
      case "token":
        return `em ${nomeDoToken(por.tokenId)}`;
      case "mao": {
        const id = por.personagemId;
        const dono = estado.personagens.find((x) => x.id === id)?.nome ?? "personagem";
        return `na mão de ${dono}`;
      }
      case "ponto": {
        const id = por.pontoId;
        return `em ${estado.pontos.find((x) => x.id === id)?.nome ?? "ponto"}`;
      }
      case "mochila":
        return "na mochila";
    }
  };

  return (
    <Janela
      id="fontes"
      titulo="Fontes de luz"
      icone={<Flame size={16} />}
      testid="painel-fontes"
      testidDoCabecalho="painel-fontes-cabecalho"
      testidDoFechar="painel-fontes-fechar"
      classeDoCorpo="painel-fontes"
      padrao={noCanto("topo-esquerda")}
      largura={292}
      redimensionar="altura"
      rotuloDoFechar="Fechar"
      aoFechar={p.aoFechar}
      acoes={<span className="nota">{daCena.length}</span>}
    >
      <div className="painel-fontes-corpo" data-testid="painel-fontes-corpo">
        <div className="campo-coluna">
          <span id="luz-geral-rotulo">Geral (todas as fontes)</span>
          <Deslizante
            testid="luz-fator-geral"
            rotulo="Intensidade geral"
            valor={fator}
            aoMudar={(v) =>
              suave("geral", () =>
                p.enviar("cena.configurarIluminacao", { cenaId: p.cena.id, fatorDeLuz: v }),
              )
            }
          />
        </div>

        <section className="luz-fixas" data-testid="luz-fixas">
          <div className="linha-botoes">
            <strong>Fixas</strong>
            <button
              type="button"
              data-testid="luz-nova"
              aria-pressed={p.colocando}
              onClick={p.aoColocar}
            >
              <Plus size={16} /> Luz fixa
            </button>
          </div>
          {p.colocando && <span className="nota">Clique no mapa para colocar.</span>}
          <ul className="lista-simples lista-fontes" data-testid="luz-lista">
            {fixas.length === 0 && <li className="nota">Nenhuma fonte fixa nesta cena.</li>}
            {fixas.map((f) => (
              <li
                key={f.id}
                data-testid={`luz-${f.id}`}
                data-selecionada={f.id === p.selecionadaId}
                data-acesa={f.estado === "acesa"}
              >
                <div className="linha-fonte">
                  <BotaoComDica
                    className="botao-icone pequeno"
                    dica={f.estado === "acesa" ? "Apagar" : "Acender"}
                    aria-label={f.estado === "acesa" ? "Apagar" : "Acender"}
                    aria-pressed={f.estado === "acesa"}
                    testid={`luz-acesa-${f.id}`}
                    onClick={() =>
                      editar(f.id, { estado: f.estado === "acesa" ? "apagada" : "acesa" })
                    }
                  >
                    <Power size={14} />
                  </BotaoComDica>
                  <BotaoComDica
                    className="luz-nome"
                    nomeVisivel
                    testid={`luz-escolher-${f.id}`}
                    onClick={() => p.aoSelecionar(f.id === p.selecionadaId ? null : f.id)}
                  >
                    {f.nome}
                  </BotaoComDica>
                  <BotaoComDica
                    className="botao-icone pequeno perigo"
                    dica="Apagar a fonte"
                    aria-label={`Apagar ${f.nome}`}
                    testid={`luz-apagar-${f.id}`}
                    onClick={() => {
                      p.enviar("fonte.apagar", { id: f.id });
                      if (p.selecionadaId === f.id) p.aoSelecionar(null);
                    }}
                  >
                    <Trash2 size={14} />
                  </BotaoComDica>
                </div>
                <Deslizante
                  testid={`luz-intensidade-${f.id}`}
                  rotulo={`Intensidade de ${f.nome}`}
                  valor={f.intensidade}
                  aoMudar={(v) => suave(`i-${f.id}`, () => editar(f.id, { intensidade: v }))}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="luz-variaveis" data-testid="luz-variaveis">
          <strong>Variáveis</strong>
          <ul className="lista-simples lista-fontes" data-testid="luz-variaveis-lista">
            {variaveis.length === 0 && (
              <li className="nota">Nenhuma tocha acesa ou posta nesta cena.</li>
            )}
            {variaveis.map((f) => {
              const comTempo = f.restanteMs !== undefined;
              return (
                <li
                  key={f.id}
                  data-testid={`luz-${f.id}`}
                  data-selecionada={f.id === p.selecionadaId}
                  data-acesa={f.estado === "acesa"}
                  data-variavel="true"
                >
                  <div className="linha-fonte">
                    <BotaoComDica
                      className="botao-icone pequeno"
                      dica={f.estado === "acesa" ? "Apagar" : "Reacender"}
                      aria-label={f.estado === "acesa" ? "Apagar" : "Reacender"}
                      aria-pressed={f.estado === "acesa"}
                      testid={`luz-acesa-${f.id}`}
                      onClick={() => p.enviar("tocha.alternar", { id: f.id })}
                    >
                      <Power size={14} />
                    </BotaoComDica>
                    <BotaoComDica
                      className="luz-nome"
                      nomeVisivel
                      testid={`luz-escolher-${f.id}`}
                      onClick={() => p.aoSelecionar(f.id === p.selecionadaId ? null : f.id)}
                    >
                      {f.nome} <span className="nota">{onde(f)}</span>
                    </BotaoComDica>
                    <BotaoComDica
                      className="botao-icone pequeno perigo"
                      dica="Extinguir de vez (consumida)"
                      aria-label={`Extinguir ${f.nome}`}
                      testid={`luz-consumir-${f.id}`}
                      onClick={() => {
                        ajustar(f.id, { acao: "consumir" });
                        if (p.selecionadaId === f.id) p.aoSelecionar(null);
                      }}
                    >
                      <Trash2 size={14} />
                    </BotaoComDica>
                  </div>
                  {comTempo ? (
                    <div className="linha-tempo">
                      <BotaoComDica
                        className="botao-icone pequeno"
                        dica="Tirar 1 minuto"
                        aria-label={`Tirar 1 minuto de ${f.nome}`}
                        testid={`luz-menos-${f.id}`}
                        onClick={() => ajustar(f.id, { acao: "tempo", deltaMs: -UM_MINUTO_MS })}
                      >
                        <Minus size={14} />
                      </BotaoComDica>
                      <TempoDaLuz luz={f} restante={p.tempo.restanteDe(f.id)} />
                      <BotaoComDica
                        className="botao-icone pequeno"
                        dica="Somar 1 minuto"
                        aria-label={`Somar 1 minuto a ${f.nome}`}
                        testid={`luz-mais-${f.id}`}
                        onClick={() => ajustar(f.id, { acao: "tempo", deltaMs: UM_MINUTO_MS })}
                      >
                        <Plus size={14} />
                      </BotaoComDica>
                      {f.estagio && (
                        <span className="estagio" data-estagio={f.estagio}>
                          {f.estagio}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="nota">Não se consome.</span>
                  )}
                  <Deslizante
                    testid={`luz-intensidade-${f.id}`}
                    rotulo={`Intensidade de ${f.nome}`}
                    valor={f.intensidade}
                    aoMudar={(v) => suave(`i-${f.id}`, () => editar(f.id, { intensidade: v }))}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {selecionada && (
          <fieldset className="quem-controla" data-testid="luz-editor" key={selecionada.id}>
            <legend>“{selecionada.nome}”</legend>
            {(selecionada.portador.tipo === "cena" || selecionada.portador.tipo === "token") && (
              <>
                <Campo
                  testid="luz-nome"
                  rotulo="Nome"
                  valor={selecionada.nome}
                  aoConfirmar={(t) => t !== "" && editar(selecionada.id, { nome: t })}
                />
                <div className="linha-par">
                  <CampoDeDistancia
                    testid="luz-clara"
                    rotulo="Luz plena"
                    minM={0}
                    maxM={500}
                    valorM={selecionada.luz.claraM}
                    aoConfirmar={(n) =>
                      n !== null && editar(selecionada.id, { luz: { claraM: n } })
                    }
                  />
                  <CampoDeDistancia
                    testid="luz-penumbra"
                    rotulo="Penumbra"
                    minM={0}
                    maxM={500}
                    valorM={selecionada.luz.penumbraM}
                    aoConfirmar={(n) =>
                      n !== null && editar(selecionada.id, { luz: { penumbraM: n } })
                    }
                  />
                </div>
                <div className="linha-par">
                  <label className="campo-coluna">
                    Cor
                    <input
                      type="color"
                      data-testid="luz-cor"
                      value={selecionada.luz.cor}
                      onChange={(e) => editar(selecionada.id, { luz: { cor: e.target.value } })}
                    />
                  </label>
                  <label className="linha-opcao">
                    <input
                      type="checkbox"
                      data-testid="luz-tremula"
                      checked={selecionada.luz.tremula}
                      onChange={(e) =>
                        editar(selecionada.id, { luz: { tremula: e.target.checked } })
                      }
                    />
                    Tremular
                  </label>
                </div>
                <p className="nota">
                  Arraste a luz no mapa para mudar de lugar. Intensidade = alcance (os dois raios).
                </p>
              </>
            )}
            <DetalheDoObjeto
              objeto={selecionada}
              tempo={p.tempo}
              salaMs={p.tempo.salaMs()}
              ajustar={ajustar}
            />
          </fieldset>
        )}

        <section className="luz-pontos" data-testid="luz-pontos">
          <strong>Pontos</strong>
          <div className="linha-botoes">
            <button
              type="button"
              data-testid="ponto-novo-suporte"
              aria-pressed={p.colocandoPonto === "suporte"}
              onClick={() => p.aoColocarPonto("suporte")}
            >
              <Plus size={16} /> Suporte
            </button>
            <button
              type="button"
              data-testid="ponto-novo-inflamavel"
              aria-pressed={p.colocandoPonto === "inflamavel"}
              onClick={() => p.aoColocarPonto("inflamavel")}
            >
              <Plus size={16} /> Inflamável
            </button>
          </div>
          {p.colocandoPonto && <span className="nota">Clique no mapa para colocar.</span>}
          <ul className="lista-simples lista-fontes" data-testid="ponto-lista">
            {pontos.length === 0 && <li className="nota">Nenhum ponto nesta cena.</li>}
            {pontos.map((x) => (
              <li
                key={x.id}
                data-testid={`ponto-${x.id}`}
                data-selecionada={x.id === p.pontoSelecionadoId}
              >
                <div className="linha-fonte">
                  <BotaoComDica
                    className="luz-nome"
                    testid={`ponto-escolher-${x.id}`}
                    nomeVisivel
                    onClick={() => p.aoSelecionarPonto(x.id === p.pontoSelecionadoId ? null : x.id)}
                  >
                    {x.nome}{" "}
                    <span className="nota">
                      {x.tipo === "suporte" ? "suporte" : "inflamável"}
                      {x.visivelParaJogadores ? "" : " · oculto"}
                    </span>
                  </BotaoComDica>
                  <BotaoComDica
                    className="botao-icone pequeno perigo"
                    dica="Apagar o ponto (e o que está nele)"
                    aria-label={`Apagar ${x.nome}`}
                    testid={`ponto-apagar-${x.id}`}
                    onClick={() => {
                      p.enviar("ponto.apagar", { id: x.id });
                      if (p.pontoSelecionadoId === x.id) p.aoSelecionarPonto(null);
                    }}
                  >
                    <Trash2 size={14} />
                  </BotaoComDica>
                </div>
              </li>
            ))}
          </ul>
        </section>
        {pontoSelecionado && (
          <EditorDoPonto
            key={pontoSelecionado.id}
            ponto={pontoSelecionado}
            estado={estado}
            enviar={p.enviar}
          />
        )}
      </div>
    </Janela>
  );
}

/** Saldo, histórico e modificadores de raio de um objeto de luz (só o mestre vê). */
function DetalheDoObjeto(props: {
  objeto: FonteDeLuz;
  tempo: TempoDaTela;
  salaMs: number | undefined;
  ajustar: (id: string, ajuste: object) => string | null;
}) {
  const { objeto: o } = props;
  const [raio, setRaio] = useState("0,5");
  const [prazo, setPrazo] = useState("");
  const restante = props.tempo.restanteDe(o.id);
  const sala = props.salaMs;
  return (
    <div className="detalhe-do-objeto" data-testid="luz-detalhe">
      <p data-testid="luz-saldo">
        Saldo:{" "}
        <strong>{restante === undefined ? "não se consome" : formatarRestante(restante)}</strong>
        {o.duracaoMs ? <span className="nota"> de {formatarRestante(o.duracaoMs)}</span> : null}
      </p>
      <div>
        <strong>Modificadores de raio</strong>
        <ul className="lista-simples" data-testid="luz-modificadores">
          {o.modificadores.length === 0 && <li className="nota">Nenhum.</li>}
          {o.modificadores.map((m) => (
            <li key={m.id} className="linha-fonte" data-testid={`luz-mod-${m.id}`}>
              <span>
                × {String(m.raioX).replace(".", ",")}
                {m.ateSala !== undefined && sala !== undefined
                  ? ` · mais ${formatarRestante(Math.max(0, m.ateSala - sala))}`
                  : " · sem prazo"}
                {m.nota ? ` · ${m.nota}` : ""}
              </span>
              <BotaoComDica
                className="botao-icone pequeno"
                dica="Tirar o modificador"
                aria-label="Tirar o modificador"
                testid={`luz-mod-tirar-${m.id}`}
                onClick={() => props.ajustar(o.id, { acao: "tirarModificador", id: m.id })}
              >
                <X size={14} />
              </BotaoComDica>
            </li>
          ))}
        </ul>
        <div className="linha-par">
          <label className="campo-coluna">
            Raio ×
            <input
              data-testid="luz-mod-raio"
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={raio.replace(",", ".")}
              onChange={(e) => setRaio(e.target.value)}
            />
          </label>
          <label className="campo-coluna">
            Prazo (min)
            <input
              data-testid="luz-mod-prazo"
              type="number"
              min={0}
              step={1}
              placeholder="sem prazo"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          data-testid="luz-mod-aplicar"
          onClick={() => {
            const raioX = Number(raio.replace(",", "."));
            const minutos = prazo === "" ? null : Number(prazo);
            if (!Number.isFinite(raioX) || raioX < 0.1 || raioX > 5) return;
            props.ajustar(o.id, {
              acao: "modificar",
              modificador: {
                id: `mod-${crypto.randomUUID().slice(0, 8)}`,
                raioX,
                ...(minutos !== null && Number.isFinite(minutos) && minutos > 0
                  ? { duracaoMs: Math.round(minutos * 60_000) }
                  : {}),
              },
            });
          }}
        >
          <Plus size={14} /> Aplicar
        </button>
      </div>
      <div>
        <strong>Histórico</strong>
        <ul className="lista-simples historico-do-objeto" data-testid="luz-historico">
          {o.historico.length === 0 && <li className="nota">Sem registros.</li>}
          {[...o.historico].reverse().map((h) => (
            <li key={`${h.emSala}|${h.deltaMs ?? ""}|${h.texto}`} data-testid="luz-historico-item">
              <span className="nota">{noRelogio(h.emSala)}</span> {h.texto}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Edita um ponto: nome, capacidade (suporte), modelo e tempo de segurar (inflamável), visibilidade. */
function EditorDoPonto(props: {
  ponto: PontoDeLuz;
  estado: Estado;
  enviar: (tipo: string, dados: object) => string | null;
}) {
  const { ponto: x, estado } = props;
  const editar = (mudancas: object) => props.enviar("ponto.editar", { id: x.id, mudancas });
  return (
    <fieldset className="quem-controla" data-testid="ponto-editor">
      <legend>Ponto “{x.nome}”</legend>
      <Campo
        testid="ponto-nome"
        rotulo="Nome"
        valor={x.nome}
        aoConfirmar={(t) => t !== "" && editar({ nome: t })}
      />
      {x.tipo === "suporte" ? (
        <Campo
          testid="ponto-capacidade"
          rotulo="Capacidade (objetos)"
          tipo="number"
          min={1}
          max={20}
          valor={String(x.capacidade ?? 1)}
          aoConfirmar={(t) => {
            const n = Number(t);
            if (t !== "" && Number.isInteger(n) && n >= 1 && n <= 20) editar({ capacidade: n });
          }}
        />
      ) : (
        <>
          <label className="campo-coluna">
            Vira (ao queimar)
            <select
              data-testid="ponto-modelo"
              value={x.modeloId ?? ""}
              onChange={(e) => editar({ modeloId: e.target.value === "" ? null : e.target.value })}
            >
              <option value="">(nada)</option>
              {estado.modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <Campo
            testid="ponto-segurar"
            rotulo="Segurar a tocha por (s)"
            tipo="number"
            min={0}
            max={60}
            valor={String(x.segurarS ?? 3)}
            aoConfirmar={(t) => {
              const n = Number(t.replace(",", "."));
              if (t !== "" && Number.isFinite(n) && n >= 0 && n <= 60) editar({ segurarS: n });
            }}
          />
        </>
      )}
      <label className="linha-opcao">
        <input
          type="checkbox"
          data-testid="ponto-visivel"
          checked={x.visivelParaJogadores}
          onChange={(e) => editar({ visivelParaJogadores: e.target.checked })}
        />
        Visível para os jogadores
      </label>
      <p className="nota">Arraste o ponto no mapa para mudar de lugar.</p>
    </fieldset>
  );
}
