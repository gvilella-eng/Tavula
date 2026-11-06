import type { Cena, FonteDeLuz, Token } from "@tabletop/shared";
import { Flame, Plus, Power, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Campo } from "./Campo";

type Props = {
  cena: Cena;
  /** As fontes da cena que o mestre está vendo. */
  fontes: FonteDeLuz[];
  tokens: Token[];
  selecionadaId: string | null;
  aoSelecionar: (id: string | null) => void;
  /** A ferramenta de luz está ativa (o próximo clique no mapa põe a luz). */
  colocando: boolean;
  aoColocar: () => void;
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

/**
 * Painel flutuante das fontes de luz (só do mestre), no estilo da ordem de turno: o slider geral no
 * topo, a lista da cena com intensidade e lixeira, "+ Luz fixa" e, com uma fonte escolhida, os raios, a
 * cor e o tremular. Clicar duas vezes no cabeçalho recolhe o painel (só o cabeçalho) e o deixa meio
 * transparente. As luzes com tempo (tochas) entram no espaço reservado do fim da lista, no Lote 7.
 */
export function PainelDeFontesDeLuz(p: Props) {
  const [recolhido, setRecolhido] = useState(false);
  const suave = useEnvioSuave();
  const selecionada = p.fontes.find((f) => f.id === p.selecionadaId) ?? null;
  const fator = p.cena.fatorDeLuz ?? 1;

  const editar = (id: string, mudancas: object) => p.enviar("fonte.editar", { id, mudancas });
  const onde = (f: FonteDeLuz) => {
    if (f.portador.tipo === "cena") return "na cena";
    const id = f.portador.tokenId;
    return `em ${p.tokens.find((t) => t.id === id)?.nome ?? "token"}`;
  };

  return (
    <aside
      className="painel-fontes"
      data-testid="painel-fontes"
      data-recolhido={recolhido}
      aria-label="Fontes de luz"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: o duplo clique é um atalho; o painel também fecha pelo X */}
      <header
        data-testid="painel-fontes-cabecalho"
        title="Clique duas vezes para recolher ou abrir"
        onDoubleClick={() => setRecolhido(!recolhido)}
      >
        <Flame size={16} /> <strong>Fontes de luz</strong>
        <span className="nota">{p.fontes.length}</span>
        <button
          type="button"
          className="botao-icone pequeno"
          title="Fechar"
          aria-label="Fechar"
          data-testid="painel-fontes-fechar"
          onClick={p.aoFechar}
        >
          <X size={16} />
        </button>
      </header>
      {!recolhido && (
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
          <div className="linha-botoes">
            <button
              type="button"
              data-testid="luz-nova"
              aria-pressed={p.colocando}
              onClick={p.aoColocar}
            >
              <Plus size={16} /> Luz fixa
            </button>
            {p.colocando && <span className="nota">Clique no mapa para colocar.</span>}
          </div>
          <ul className="lista-simples lista-fontes" data-testid="luz-lista">
            {p.fontes.length === 0 && <li className="nota">Nenhuma fonte de luz nesta cena.</li>}
            {p.fontes.map((f) => (
              <li
                key={f.id}
                data-testid={`luz-${f.id}`}
                data-selecionada={f.id === p.selecionadaId}
                data-acesa={f.acesa}
              >
                <div className="linha-fonte">
                  <button
                    type="button"
                    className="botao-icone pequeno"
                    title={f.acesa ? "Apagar" : "Acender"}
                    aria-label={f.acesa ? "Apagar" : "Acender"}
                    aria-pressed={f.acesa}
                    data-testid={`luz-acesa-${f.id}`}
                    onClick={() => editar(f.id, { acesa: !f.acesa })}
                  >
                    <Power size={14} />
                  </button>
                  <button
                    type="button"
                    className="luz-nome"
                    title={`Editar (${onde(f)})`}
                    data-testid={`luz-escolher-${f.id}`}
                    onClick={() => p.aoSelecionar(f.id === p.selecionadaId ? null : f.id)}
                  >
                    {f.nome}
                  </button>
                  <button
                    type="button"
                    className="botao-icone pequeno perigo"
                    title="Apagar a fonte"
                    aria-label={`Apagar ${f.nome}`}
                    data-testid={`luz-apagar-${f.id}`}
                    onClick={() => {
                      p.enviar("fonte.apagar", { id: f.id });
                      if (p.selecionadaId === f.id) p.aoSelecionar(null);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
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
          {selecionada && (
            <fieldset className="quem-controla" data-testid="luz-editor" key={selecionada.id}>
              <legend>Editar “{selecionada.nome}”</legend>
              <Campo
                testid="luz-nome"
                rotulo="Nome"
                valor={selecionada.nome}
                aoConfirmar={(t) => t !== "" && editar(selecionada.id, { nome: t })}
              />
              <div className="linha-par">
                <Campo
                  testid="luz-clara"
                  rotulo="Luz plena (m)"
                  tipo="number"
                  min={0}
                  max={500}
                  valor={String(selecionada.luz.claraM)}
                  aoConfirmar={(t) =>
                    t !== "" && editar(selecionada.id, { luz: { claraM: Number(t) } })
                  }
                />
                <Campo
                  testid="luz-penumbra"
                  rotulo="Penumbra (m)"
                  tipo="number"
                  min={0}
                  max={500}
                  valor={String(selecionada.luz.penumbraM)}
                  aoConfirmar={(t) =>
                    t !== "" && editar(selecionada.id, { luz: { penumbraM: Number(t) } })
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
                    onChange={(e) => editar(selecionada.id, { luz: { tremula: e.target.checked } })}
                  />
                  Tremular
                </label>
              </div>
              <p className="nota">
                Arraste a luz no mapa para mudar de lugar. Intensidade = alcance (os dois raios).
              </p>
            </fieldset>
          )}
          {/* Espaço do Lote 7: as luzes com tempo (tocha, fogueira), com − e + de 1 minuto e a lixeira. */}
          <section className="luz-variaveis" data-testid="luz-variaveis">
            <strong>Com tempo</strong>
            <p className="nota">As tochas e fogueiras com tempo chegam no Lote 7.</p>
          </section>
        </div>
      )}
    </aside>
  );
}
