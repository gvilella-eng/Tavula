import {
  CORES_DO_SOM,
  type CorDoSom,
  type Estado,
  type GrupoDeSom,
  ICONES_DO_SOM,
  type IconeDoSom,
  LUGARES_POR_GRUPO,
  type LugarDeSom,
  lugarDe,
  lugaresDe,
  MAXIMO_DO_NOME_DO_LUGAR,
  usosDoSom,
} from "@tabletop/shared";
import { Play, Trash2, Volume2, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { noTopoAoCentro } from "../janelas/geometria";
import { Janela } from "../janelas/Janela";
import { Deslizante } from "./Deslizante";
import { EscolherSom, type SomEscolhido } from "./EscolherSom";
import { CORES, ICONES, IconeDoLugar } from "./iconesDoSom";
import { useEnvioAdiado } from "./modoDoSom";
import { mudarPrefsDeSom, usePrefsDeSom } from "./prefsDeSom";

type Props = {
  estado: Estado;
  /** O lugar que abre escolhido. */
  inicial: { grupo: GrupoDeSom; indice: number };
  fontes: Parameters<typeof EscolherSom>[0]["fontes"];
  registrar: (arquivo: File) => Promise<SomEscolhido>;
  enviar: (tipo: string, dados: object) => string | null;
  ouvir: (hash: string, volume: number) => void;
  aoFechar: () => void;
};

const VOLUME_PADRAO = 0.8;

const corDe = (c: CorDoSom): CSSProperties =>
  ({ "--cor-do-som": CORES[c].variavel }) as CSSProperties;

const tamanhoLegivel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Q4: a configuração da mesa de som. À esquerda, os 16 lugares (8 efeitos e 8 ambientes); à direita, o lugar escolhido:
 * o arquivo (da pasta `sons/` do computador ou escolhido à mão), o nome do botão (até 12 letras), o ícone, a cor da
 * etiqueta, o volume padrão e "Ouvir". "Tirar deste lugar" só esvazia o lugar; "Apagar este som da mesa" tira o arquivo da
 * mesa e de tudo o que o usa (a confirmação aparece na própria janela e diz onde o som estava).
 */
export function ConfigDaMesaDeSom(p: Props) {
  const [sel, setSel] = useState(p.inicial);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const adiar = useEnvioAdiado(300);
  const prefs = usePrefsDeSom();
  const lugares = lugaresDe(p.estado.mesaDeSom);
  const chaveDoLugar = `${sel.grupo}-${sel.indice}`;
  const doServidor = lugarDe(p.estado.mesaDeSom, sel.grupo, sel.indice);
  // O que a pessoa acabou de mudar em cada lugar vale até a sala devolver: sem isso, duas mudanças seguidas (o ícone e a cor,
  // por exemplo) se atropelariam, porque a sala só devolve a primeira depois. Um lugar esvaziado volta a valer o da sala.
  const locais = useRef(new Map<string, LugarDeSom>());
  const [, refazer] = useState(0);
  if (doServidor === null) locais.current.delete(chaveDoLugar);
  const atual = locais.current.get(chaveDoLugar) ?? doServidor;
  const estadoAtual = useRef(p.estado);
  estadoAtual.current = p.estado;
  const usados = lugares.efeitos.filter(Boolean).length + lugares.ambientes.filter(Boolean).length;
  const sons = (p.estado.assets ?? []).filter((a) => a.tipo === "som");

  // O nome digitado fica local até a sala devolver (e muda ao trocar de lugar).
  const [nome, setNome] = useState(atual?.nome ?? "");
  // biome-ignore lint/correctness/useExhaustiveDependencies: só refaz ao trocar de lugar ou quando o nome vem de fora
  useEffect(() => {
    setNome(atual?.nome ?? "");
    setConfirmandoApagar(false);
  }, [chaveDoLugar, atual?.nome]);

  function gravar(alvo: { grupo: GrupoDeSom; indice: number }, lugar: LugarDeSom | null) {
    p.enviar("som.lugar", { grupo: alvo.grupo, indice: alvo.indice, lugar });
  }
  /** Muda parte de um lugar (o escolhido, ou o que estava escolhido quando a mudança adiada foi pedida). */
  function mudarEm(alvo: { grupo: GrupoDeSom; indice: number }, parcial: Partial<LugarDeSom>) {
    const chave = `${alvo.grupo}-${alvo.indice}`;
    const base =
      locais.current.get(chave) ?? lugarDe(estadoAtual.current.mesaDeSom, alvo.grupo, alvo.indice);
    if (!base) return;
    const novo = { ...base, ...parcial };
    locais.current.set(chave, novo);
    refazer((n) => n + 1);
    gravar(alvo, novo);
  }
  const alvo = sel;
  const mudar = (parcial: Partial<LugarDeSom>) => mudarEm(sel, parcial);
  function escolheuArquivo(s: SomEscolhido) {
    const nomeDoArquivo = s.nome.replace(/\.[^.]+$/, "").trim() || "Som";
    const novo: LugarDeSom = {
      hash: s.hash,
      nome: (atual?.nome ?? nomeDoArquivo).slice(0, MAXIMO_DO_NOME_DO_LUGAR),
      icone: atual?.icone ?? (sel.grupo === "efeito" ? "espadas" : "musica"),
      cor: atual?.cor ?? "ambar",
      volume: atual?.volume ?? VOLUME_PADRAO,
    };
    locais.current.set(chaveDoLugar, novo);
    refazer((n) => n + 1);
    gravar(sel, novo);
  }

  const nomeDoArquivoAtual = atual
    ? (sons.find((s) => s.hash === atual.hash)?.nomeOriginal ?? "arquivo sem nome")
    : "";
  const usos = atual ? usosDoSom(p.estado, atual.hash) : null;
  const ondeEsta = usos
    ? [
        ...usos.lugares.map(
          (u) => `${u.grupo === "efeito" ? "o efeito" : "o ambiente"} ${u.indice + 1} (${u.nome})`,
        ),
        ...usos.zonas.map((z) => `a zona ${z}`),
        ...usos.automacoes.map((a) => `a automação ${a}`),
      ]
    : [];

  const lista = (grupo: GrupoDeSom, itens: (LugarDeSom | null)[]) => (
    <ul className="som-config-lista">
      {itens.map((l, i) => {
        const ativo = sel.grupo === grupo && sel.indice === i;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: os lugares são posições fixas (0 a 7)
          <li key={i}>
            <button
              type="button"
              className="som-config-lugar"
              style={l ? corDe(l.cor) : undefined}
              data-testid={`som-lugar-${grupo}-${i}`}
              data-ativo={ativo ? "sim" : "nao"}
              data-vazio={l ? "nao" : "sim"}
              aria-pressed={ativo}
              aria-label={
                l
                  ? `${grupo === "efeito" ? "Efeito" : "Ambiente"} ${i + 1}: ${l.nome}`
                  : `${grupo === "efeito" ? "Efeito" : "Ambiente"} ${i + 1}: vazio`
              }
              onClick={() => setSel({ grupo, indice: i })}
            >
              <span className="som-num">{i + 1}</span>
              {l ? (
                <>
                  <span className="som-icone">
                    <IconeDoLugar icone={l.icone} tamanho={15} />
                  </span>
                  <span className="som-nome-linha">{l.nome}</span>
                </>
              ) : (
                <span className="som-nome-linha som-vazio-texto">vazio</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Janela
      id="som-config"
      titulo="Mesa de som · configuração"
      icone={<Volume2 size={14} />}
      testid="som-config"
      corpoLivre
      // Q4b: por cima de tudo (da faixa no pé da tela e da janela do som), sempre inteira na tela.
      camadaAlta
      padrao={noTopoAoCentro(32)}
      largura={(area) => Math.min(760, area.largura - 24)}
      altura={(area) => Math.min(720, area.altura - 24)}
      minLargura={560}
      minAltura={420}
      acoes={
        <>
          <span className="som-config-conta" data-testid="som-config-conta">
            {usados} de {LUGARES_POR_GRUPO * 2} lugares usados
          </span>
          <button
            type="button"
            className="primario"
            data-testid="som-config-pronto"
            onClick={p.aoFechar}
          >
            Pronto
          </button>
        </>
      }
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar a configuração do som"
      testidDoFechar="som-config-fechar"
    >
      <div className="som-config">
        <div className="som-config-corpo">
          <nav className="som-config-esquerda" aria-label="Os 16 lugares da mesa de som">
            <h3 className="som-secao">
              <span>Efeitos</span>
              <span>
                {lugares.efeitos.filter(Boolean).length}/{LUGARES_POR_GRUPO}
              </span>
            </h3>
            {lista("efeito", lugares.efeitos)}
            <h3 className="som-secao">
              <span>Ambientes</span>
              <span>
                {lugares.ambientes.filter(Boolean).length}/{LUGARES_POR_GRUPO}
              </span>
            </h3>
            {lista("ambiente", lugares.ambientes)}
            <label className="som-opcao">
              <input
                type="checkbox"
                data-testid="som-ouvir-zonas"
                checked={prefs.ouvirZonas}
                onChange={(e) => mudarPrefsDeSom({ ouvirZonas: e.target.checked })}
              />
              Ouvir as zonas do token selecionado
            </label>
          </nav>

          <div className="som-config-direita" data-testid="som-config-editor">
            <div className="som-config-titulo">
              <div>
                <div className="som-secao-nome">
                  {sel.grupo === "efeito" ? "Efeito" : "Ambiente"} {sel.indice + 1}
                </div>
                <div className="som-config-nome-grande">{atual ? atual.nome : "Lugar vazio"}</div>
              </div>
              {atual && (
                <button
                  type="button"
                  data-testid="som-config-tirar"
                  onClick={() => gravar(sel, null)}
                >
                  <X size={14} aria-hidden="true" /> Tirar deste lugar
                </button>
              )}
            </div>
            {atual && (
              <p className="nota">Tirar só esvazia o lugar. O arquivo continua na pasta sons/.</p>
            )}

            <div className="som-secao-nome">Arquivo</div>
            {atual && (
              <p className="som-arquivo-atual" data-testid="som-config-arquivo">
                {nomeDoArquivoAtual}
              </p>
            )}
            {sons.length > 0 && (
              <p className="som-secao-nome som-ja-tem" data-testid="som-config-ja-tem">
                Sons que a mesa já tem
              </p>
            )}
            {sons.length > 0 && (
              <ul className="som-arquivos" data-testid="som-config-arquivos">
                {sons.map((s) => (
                  <li key={s.hash}>
                    <label className="som-arquivo-opcao">
                      <input
                        type="radio"
                        name="arquivo-do-lugar"
                        data-testid={`som-config-arquivo-${s.hash.slice(0, 8)}`}
                        checked={atual?.hash === s.hash}
                        onChange={() =>
                          escolheuArquivo({
                            hash: s.hash,
                            nome: s.nomeOriginal,
                          })
                        }
                      />
                      <span>{s.nomeOriginal}</span>
                      <span className="nota">{tamanhoLegivel(s.bytes)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <details
              key={`${chaveDoLugar}-${atual ? "cheio" : "vazio"}`}
              className="som-pasta"
              open={!atual}
            >
              <summary className="som-pasta-titulo">
                Escolher da pasta sons/ ou do computador
              </summary>
              <EscolherSom
                fontes={p.fontes}
                registrar={p.registrar}
                testid="som-config-escolher"
                aoEscolher={escolheuArquivo}
                vazio="Nenhum som na pasta local. Escolha a pasta em Preferências ou um arquivo."
              />
            </details>

            {atual && (
              <>
                <label className="som-secao-nome" htmlFor="som-config-nome">
                  Nome no botão
                </label>
                <div className="som-config-nome">
                  <input
                    id="som-config-nome"
                    type="text"
                    maxLength={MAXIMO_DO_NOME_DO_LUGAR}
                    data-testid="som-config-nome"
                    value={nome}
                    onChange={(e) => {
                      const digitado = e.target.value.slice(0, MAXIMO_DO_NOME_DO_LUGAR);
                      setNome(digitado);
                      const limpo = digitado.trim();
                      if (limpo.length > 0) {
                        adiar(`nome-${chaveDoLugar}`, () => mudarEm(alvo, { nome: limpo }));
                      }
                    }}
                    onBlur={() => {
                      const limpo = nome.trim();
                      if (limpo.length > 0 && limpo !== atual.nome) mudar({ nome: limpo });
                      else setNome(atual.nome);
                    }}
                  />
                  <span className="nota">
                    {nome.length} de {MAXIMO_DO_NOME_DO_LUGAR} letras
                  </span>
                </div>

                <div className="som-secao-nome">Ícone</div>
                <fieldset className="som-config-icones" aria-label="Ícone">
                  {ICONES_DO_SOM.map((id: IconeDoSom) => (
                    <button
                      key={id}
                      type="button"
                      className="som-config-icone"
                      style={corDe(atual.cor)}
                      data-testid={`som-config-icone-${id}`}
                      aria-pressed={atual.icone === id}
                      aria-label={ICONES[id].nome}
                      title={ICONES[id].nome}
                      onClick={() => mudar({ icone: id })}
                    >
                      <IconeDoLugar icone={id} tamanho={20} />
                    </button>
                  ))}
                </fieldset>

                <div className="som-secao-nome">Cor da etiqueta</div>
                <fieldset className="som-config-cores" aria-label="Cor da etiqueta">
                  {CORES_DO_SOM.map((id: CorDoSom) => (
                    <button
                      key={id}
                      type="button"
                      className="som-config-cor"
                      style={corDe(id)}
                      data-testid={`som-config-cor-${id}`}
                      aria-pressed={atual.cor === id}
                      aria-label={CORES[id].nome}
                      title={CORES[id].nome}
                      onClick={() => mudar({ cor: id })}
                    />
                  ))}
                </fieldset>

                <div className="som-secao-nome">Volume padrão</div>
                <div className="som-config-volume">
                  <Deslizante
                    classe="som-config-vol"
                    testid="som-config-volume"
                    rotulo="Volume padrão"
                    valor={atual.volume}
                    aoMudar={(v) =>
                      adiar(`volume-${chaveDoLugar}`, () => mudarEm(alvo, { volume: v }))
                    }
                  />
                  <BotaoComDica
                    className="som-btn-icone"
                    testid="som-config-ouvir"
                    nomeVisivel
                    onClick={() => p.ouvir(atual.hash, atual.volume)}
                  >
                    <Play size={12} fill="currentColor" aria-hidden="true" /> Ouvir
                  </BotaoComDica>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="som-config-apagar">
          <div className="som-config-apagar-botao">
            <button
              type="button"
              className="perigo"
              data-testid="som-config-apagar"
              disabled={!atual}
              onClick={() => setConfirmandoApagar(true)}
            >
              <Trash2 size={14} aria-hidden="true" /> Apagar este som da mesa
            </button>
            <p className="nota">Tira o arquivo da mesa e de todos os lugares que o usam.</p>
          </div>
          {atual && confirmandoApagar && (
            <div
              className="som-config-confirma"
              role="alertdialog"
              aria-label="Apagar o som da mesa"
              data-testid="som-config-confirma"
            >
              <p>
                <b>Apagar "{nomeDoArquivoAtual}"?</b> O som sai da mesa
                {ondeEsta.length > 0 ? ` e de ${ondeEsta.join(", ")}` : ""}. O arquivo continua na
                pasta sons/ do seu computador.
              </p>
              <div className="linha-botoes">
                <button
                  type="button"
                  data-testid="som-config-apagar-cancelar"
                  onClick={() => setConfirmandoApagar(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="perigo"
                  data-testid="som-config-apagar-confirmar"
                  onClick={() => {
                    p.enviar("som.apagar", { hash: atual.hash });
                    setConfirmandoApagar(false);
                  }}
                >
                  Apagar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Janela>
  );
}
