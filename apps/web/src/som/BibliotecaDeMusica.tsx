import {
  type BotaoDeMusica,
  CORES_DO_SOM,
  type CorDoSom,
  duracaoLegivel,
  ENERGIA_MAXIMA,
  ENERGIA_MINIMA,
  ENERGIA_PADRAO,
  type Estado,
  ehArquivoDeSom,
  energiaDe,
  etiquetasDaBiblioteca,
  etiquetasDoCaminho,
  faixasDoFiltro,
  ICONES_DO_SOM,
  type IconeDoSom,
  LIMITES_DE_ASSET,
  MAXIMO_DE_ETIQUETAS,
  MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA,
  nomeDoFiltro,
  normalizarBusca,
  ORDENS_DA_MUSICA,
  type OrdemDaMusica,
  ROTULO_DA_ORDEM,
} from "@tabletop/shared";
import { Pencil, Play, Trash2 } from "lucide-react";
import { type CSSProperties, type FormEvent, useRef, useState } from "react";
import { lerDuracaoMs } from "./duracao";
import type { SomEscolhido } from "./EscolherSom";
import { CORES, ICONES } from "./iconesDoSom";

type Props = {
  estado: Estado;
  registrar: (arquivo: File) => Promise<SomEscolhido>;
  enviar: (tipo: string, dados: object) => string | null;
  /** Ouve uma música só aqui (o play da linha): nada vai para a sala. */
  ouvir: (hash: string, volume: number) => void;
};

type PainelDoLote = "mais" | "menos" | "energia" | "tirar" | "editar" | null;
type Entrada = { arquivo: File; etiquetas: string[] };

const VOLUME_DA_CONFERENCIA = 0.8;
const POR_ENVIO = 25;
const energias = Array.from(
  { length: ENERGIA_MAXIMA - ENERGIA_MINIMA + 1 },
  (_, i) => ENERGIA_MINIMA + i,
);

const semExtensao = (nome: string) => nome.replace(/\.[^.]+$/, "").trim() || "Música";

/**
 * MU1: a aba Música da configuração da mesa de som. Organiza a biblioteca (etiquetas, energia de 1 a 5, descrição), filtra por
 * etiquetas e energia, marca várias músicas para mexer em lote, adiciona mp3 ou uma pasta (as subpastas viram etiquetas) e
 * salva o filtro atual como botão da mesa de som, com a ordem ao tocar. O play de cada linha toca só para o mestre.
 */
export function BibliotecaDeMusica({ estado, registrar, enviar, ouvir }: Props) {
  const faixas = estado.musica?.faixas ?? [];
  const botoes = estado.musica?.botoes ?? [];
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [energiaMin, setEnergiaMin] = useState(ENERGIA_MINIMA);
  const [energiaMax, setEnergiaMax] = useState(ENERGIA_MAXIMA);
  const [ordem, setOrdem] = useState<OrdemDaMusica>("aleatoria");
  const [busca, setBusca] = useState("");
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set());
  const [painel, setPainel] = useState<PainelDoLote>(null);
  const [novaEtiqueta, setNovaEtiqueta] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [formBotao, setFormBotao] = useState<{
    id: string | null;
    nome: string;
    icone: IconeDoSom;
    cor: CorDoSom;
  } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const pastaRef = useRef<HTMLInputElement>(null);

  const energiaCheia = energiaMin === ENERGIA_MINIMA && energiaMax === ENERGIA_MAXIMA;
  const doFiltro = faixasDoFiltro(faixas, { etiquetas, energiaMin, energiaMax });
  const termo = normalizarBusca(busca);
  const visiveis = termo
    ? doFiltro.filter((f) => normalizarBusca(`${f.nome} ${f.descricao ?? ""}`).includes(termo))
    : doFiltro;
  const existentes = etiquetasDaBiblioteca(faixas);
  const escolhidas = faixas.filter((f) => marcadas.has(f.hash));
  const hashesEscolhidos = escolhidas.map((f) => f.hash);
  const tituloDoResultado = nomeDoFiltro({ etiquetas });
  const quantasNoFiltro = faixasDoFiltro(faixas, { etiquetas, energiaMin, energiaMax }).length;

  function alternarEtiqueta(nome: string) {
    setEtiquetas((a) =>
      a.some((x) => x.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))
        ? a.filter((x) => x.toLocaleLowerCase("pt-BR") !== nome.toLocaleLowerCase("pt-BR"))
        : [...a, nome].slice(0, MAXIMO_DE_ETIQUETAS),
    );
  }
  /** Um clique numa energia estica ou encolhe a faixa; o clique dentro dela escolhe só aquela. */
  function alternarEnergia(n: number) {
    if (energiaCheia) {
      setEnergiaMin(n);
      setEnergiaMax(n);
    } else if (n < energiaMin) setEnergiaMin(n);
    else if (n > energiaMax) setEnergiaMax(n);
    else if (n === energiaMin && n === energiaMax) {
      setEnergiaMin(ENERGIA_MINIMA);
      setEnergiaMax(ENERGIA_MAXIMA);
    } else if (n === energiaMin) setEnergiaMin(n + 1);
    else if (n === energiaMax) setEnergiaMax(n - 1);
    else {
      setEnergiaMin(n);
      setEnergiaMax(n);
    }
  }
  function marcar(hash: string) {
    setMarcadas((a) => {
      const n = new Set(a);
      if (n.has(hash)) n.delete(hash);
      else n.add(hash);
      return n;
    });
  }
  function marcarTodas() {
    setMarcadas(
      marcadas.size === visiveis.length && visiveis.length > 0
        ? new Set()
        : new Set(visiveis.map((f) => f.hash)),
    );
  }

  // --- adicionar -----------------------------------------------------------------------------

  async function adicionar(entradas: Entrada[]) {
    if (ocupado || entradas.length === 0) return;
    setOcupado(true);
    let falhas = 0;
    let lote: { hash: string; nome: string; duracaoMs: number; etiquetas: string[] }[] = [];
    let entraram = 0;
    const despachar = () => {
      if (lote.length === 0) return;
      enviar("musica.adicionar", { faixas: lote });
      entraram += lote.length;
      lote = [];
    };
    try {
      let i = 0;
      for (const e of entradas) {
        i++;
        setAviso(`Adicionando ${i} de ${entradas.length}…`);
        try {
          if (e.arquivo.size > LIMITES_DE_ASSET.bytesDoSom) throw new Error("grande demais");
          const duracaoMs = Math.max(1000, await lerDuracaoMs(e.arquivo));
          const reg = await registrar(e.arquivo);
          lote.push({
            hash: reg.hash,
            nome: semExtensao(e.arquivo.name).slice(0, 120),
            duracaoMs,
            etiquetas: e.etiquetas,
          });
          if (lote.length >= POR_ENVIO) despachar();
        } catch {
          falhas++;
        }
      }
      despachar();
    } finally {
      setOcupado(false);
    }
    setAviso(
      falhas > 0
        ? `${entraram} ${entraram === 1 ? "música entrou" : "músicas entraram"}; ${falhas} não ${falhas === 1 ? "entrou" : "entraram"} (formato, tamanho de até 20 MB ou arquivo que o navegador não abre).`
        : `${entraram} ${entraram === 1 ? "música adicionada" : "músicas adicionadas"}.`,
    );
  }
  function aoEscolherArquivos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []).filter((f) => ehArquivoDeSom(f.name));
    void adicionar(arquivos.map((arquivo) => ({ arquivo, etiquetas: [] })));
  }
  function aoEscolherPasta(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []).filter((f) => ehArquivoDeSom(f.name));
    void adicionar(
      arquivos.map((arquivo) => ({
        arquivo,
        etiquetas: etiquetasDoCaminho(
          (arquivo as File & { webkitRelativePath?: string }).webkitRelativePath || arquivo.name,
          true,
        ),
      })),
    );
  }

  // --- em lote -------------------------------------------------------------------------------

  function aplicarMais(e?: FormEvent) {
    e?.preventDefault();
    const nome = novaEtiqueta.trim();
    if (nome === "" || hashesEscolhidos.length === 0) return;
    enviar("musica.editarFaixas", { hashes: hashesEscolhidos, maisEtiquetas: [nome] });
    setNovaEtiqueta("");
    setPainel(null);
  }
  function aplicarEnergia(n: number | null) {
    enviar("musica.editarFaixas", { hashes: hashesEscolhidos, energia: n });
    setPainel(null);
  }
  function aplicarMenos(nome: string) {
    enviar("musica.editarFaixas", { hashes: hashesEscolhidos, menosEtiquetas: [nome] });
    setPainel(null);
  }
  function aplicarTirar() {
    enviar("musica.tirarFaixas", { hashes: hashesEscolhidos });
    setMarcadas(new Set());
    setPainel(null);
  }
  function abrirEditar() {
    const f = escolhidas[0];
    if (!f) return;
    setNovoNome(f.nome);
    setNovaDescricao(f.descricao ?? "");
    setPainel("editar");
  }
  function aplicarEditar(e: FormEvent) {
    e.preventDefault();
    const f = escolhidas[0];
    const nome = novoNome.trim();
    if (!f || nome === "") return;
    enviar("musica.editarFaixas", {
      hashes: [f.hash],
      nome,
      descricao: novaDescricao.trim() === "" ? null : novaDescricao.trim(),
    });
    setPainel(null);
  }
  const etiquetasDasEscolhidas = [
    ...new Map(
      escolhidas.flatMap((f) => f.etiquetas).map((e) => [e.toLocaleLowerCase("pt-BR"), e]),
    ).values(),
  ];

  // --- botões --------------------------------------------------------------------------------

  function abrirFormNovo() {
    setFormBotao({
      id: null,
      nome: etiquetas.join(" ").slice(0, MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA),
      icone: "musica",
      cor: "ambar",
    });
  }
  function editarBotao(b: BotaoDeMusica) {
    setEtiquetas(b.etiquetas);
    setEnergiaMin(b.energiaMin);
    setEnergiaMax(b.energiaMax);
    setOrdem(b.ordem);
    setFormBotao({ id: b.id, nome: b.nome, icone: b.icone, cor: b.cor });
  }
  function salvarBotao(e: FormEvent) {
    e.preventDefault();
    if (!formBotao) return;
    const nome = formBotao.nome.trim();
    if (nome === "") return;
    enviar("musica.botao", {
      botao: {
        id: formBotao.id ?? `musica-${crypto.randomUUID().slice(0, 8)}`,
        nome,
        icone: formBotao.icone,
        cor: formBotao.cor,
        etiquetas,
        energiaMin,
        energiaMax,
        ordem,
      },
    });
    setFormBotao(null);
  }

  const resumoDoBotao = (b: BotaoDeMusica) =>
    [
      b.etiquetas.join(" + ") || "Todas",
      b.energiaMin === ENERGIA_MINIMA && b.energiaMax === ENERGIA_MAXIMA
        ? null
        : b.energiaMin === b.energiaMax
          ? `energia ${b.energiaMin}`
          : `energia ${b.energiaMin}–${b.energiaMax}`,
      b.ordem === "crescente" ? "crescente" : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="musica-biblioteca" data-testid="musica-biblioteca">
      <aside className="musica-lateral" aria-label="Filtro e botões">
        <div className="musica-bloco">
          <h3 className="som-secao">
            <span>Etiquetas</span>
          </h3>
          {existentes.length === 0 ? (
            <p className="nota">Ainda não há etiquetas. Marque músicas e use + Etiqueta.</p>
          ) : (
            <div className="musica-chips">
              {existentes.map((x) => {
                const ligado = etiquetas.some(
                  (e) => e.toLocaleLowerCase("pt-BR") === x.nome.toLocaleLowerCase("pt-BR"),
                );
                return (
                  <button
                    key={x.nome}
                    type="button"
                    className="musica-chip"
                    data-testid={`musica-etiqueta-${x.nome}`}
                    aria-pressed={ligado}
                    onClick={() => alternarEtiqueta(x.nome)}
                  >
                    {x.nome} <span className="musica-chip-qtd">{x.qtd}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="nota">Várias etiquetas: só as músicas que têm todas.</p>
        </div>

        <div className="musica-bloco">
          <h3 className="som-secao">
            <span>Energia</span>
            <span>{energiaCheia ? "todas" : `${energiaMin} a ${energiaMax}`}</span>
          </h3>
          <div className="musica-chips">
            {energias.map((n) => (
              <button
                key={n}
                type="button"
                className="musica-chip musica-chip-energia"
                data-testid={`musica-energia-${n}`}
                aria-pressed={!energiaCheia && n >= energiaMin && n <= energiaMax}
                aria-label={`Energia ${n}`}
                onClick={() => alternarEnergia(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="musica-ordem">
          <legend>Ordem ao tocar</legend>
          {ORDENS_DA_MUSICA.map((o) => (
            <label key={o}>
              <input
                type="radio"
                name="musica-ordem"
                data-testid={`musica-ordem-${o}`}
                checked={ordem === o}
                onChange={() => setOrdem(o)}
              />
              <span>
                {o === "aleatoria"
                  ? ROTULO_DA_ORDEM.aleatoria
                  : "Crescente: começa na energia mais baixa e sobe; no topo, fica nas mais fortes"}
              </span>
            </label>
          ))}
        </fieldset>

        {formBotao ? (
          <form
            className="musica-form-botao"
            data-testid="musica-form-botao"
            onSubmit={salvarBotao}
          >
            <label>
              Nome do botão
              <input
                type="text"
                maxLength={MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA}
                data-testid="musica-botao-nome"
                value={formBotao.nome}
                onChange={(e) => setFormBotao({ ...formBotao, nome: e.target.value })}
              />
            </label>
            <fieldset className="musica-chips" aria-label="Ícone do botão">
              {ICONES_DO_SOM.map((id) => {
                const { Icone, nome } = ICONES[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className="musica-chip musica-chip-icone"
                    aria-pressed={formBotao.icone === id}
                    aria-label={nome}
                    title={nome}
                    onClick={() => setFormBotao({ ...formBotao, icone: id })}
                  >
                    <Icone size={14} aria-hidden="true" />
                  </button>
                );
              })}
            </fieldset>
            <fieldset className="musica-chips" aria-label="Cor do botão">
              {CORES_DO_SOM.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="musica-cor"
                  style={{ "--cor-do-som": CORES[id].variavel } as CSSProperties}
                  aria-pressed={formBotao.cor === id}
                  aria-label={CORES[id].nome}
                  title={CORES[id].nome}
                  onClick={() => setFormBotao({ ...formBotao, cor: id })}
                />
              ))}
            </fieldset>
            <div className="linha-botoes">
              <button type="button" onClick={() => setFormBotao(null)}>
                Cancelar
              </button>
              <button type="submit" className="primario" data-testid="musica-botao-confirmar">
                {formBotao.id ? "Salvar alterações" : "Salvar botão"}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="musica-salvar-filtro"
            data-testid="musica-salvar-botao"
            onClick={abrirFormNovo}
          >
            Salvar este filtro como botão
          </button>
        )}

        <div className="musica-bloco">
          <h3 className="som-secao">
            <span>Botões da mesa de som</span>
            <span>{botoes.length}</span>
          </h3>
          {botoes.length === 0 && <p className="nota">Nenhum botão ainda.</p>}
          <ul className="musica-botoes-salvos" data-testid="musica-botoes-salvos">
            {botoes.map((b) => (
              <li
                key={b.id}
                className="musica-botao-salvo"
                data-testid="musica-botao-salvo"
                data-nome={b.nome}
                style={{ "--cor-do-som": CORES[b.cor].variavel } as CSSProperties}
              >
                <span className="musica-ponto" aria-hidden="true" />
                <span className="musica-botao-salvo-nome">{b.nome}</span>
                <span className="musica-botao-salvo-resumo">{resumoDoBotao(b)}</span>
                <button
                  type="button"
                  className="musica-icone-botao"
                  data-testid="musica-botao-editar"
                  aria-label={`Editar o botão ${b.nome}`}
                  title="Editar"
                  onClick={() => editarBotao(b)}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="musica-icone-botao"
                  data-testid="musica-botao-apagar"
                  aria-label={`Apagar o botão ${b.nome}`}
                  title="Apagar"
                  onClick={() => enviar("musica.botaoApagar", { id: b.id })}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="musica-principal">
        <div className="musica-barra">
          <label className="musica-busca">
            <span className="so-leitor">Buscar música</span>
            <input
              type="search"
              placeholder="Buscar pelo nome ou pela descrição"
              data-testid="musica-busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <button
            type="button"
            data-testid="musica-adicionar-mp3"
            disabled={ocupado}
            onClick={() => arquivoRef.current?.click()}
          >
            Adicionar mp3
          </button>
          <button
            type="button"
            data-testid="musica-adicionar-pasta-botao"
            disabled={ocupado}
            onClick={() => pastaRef.current?.click()}
          >
            Adicionar pasta
          </button>
          <input
            ref={arquivoRef}
            type="file"
            multiple
            hidden
            accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav"
            data-testid="musica-adicionar-arquivo"
            onChange={(e) => {
              aoEscolherArquivos(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={pastaRef}
            type="file"
            multiple
            hidden
            // @ts-expect-error: atributo não padrão que o Chrome e o Edge entendem
            webkitdirectory=""
            data-testid="musica-adicionar-pasta"
            onChange={(e) => {
              aoEscolherPasta(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <p className="nota">
          Ao adicionar uma pasta, o nome das subpastas vira etiqueta: tudo em <b>Combate\</b> já
          entra com "Combate".
        </p>
        {aviso && (
          <p className="nota musica-aviso" role="status" data-testid="musica-aviso">
            {aviso}
          </p>
        )}

        <div className="musica-titulo">
          <span className="musica-titulo-nome" data-testid="musica-titulo">
            {tituloDoResultado}
          </span>
          <span className="nota" data-testid="musica-contagem">
            {visiveis.length} de {faixas.length} {faixas.length === 1 ? "música" : "músicas"}
          </span>
          <label className="musica-marcar-todas">
            <input
              type="checkbox"
              data-testid="musica-marcar-todas"
              checked={visiveis.length > 0 && marcadas.size === visiveis.length}
              onChange={marcarTodas}
            />
            Marcar todas
          </label>
          <span className="som-faixa-espaco" />
          <button
            type="button"
            className="primario"
            data-testid="musica-tocar-todos"
            disabled={quantasNoFiltro === 0}
            onClick={() =>
              enviar("musica.tocar", { filtro: { etiquetas, energiaMin, energiaMax, ordem } })
            }
          >
            <Play size={13} fill="currentColor" aria-hidden="true" /> Tocar para todos (
            {ordem === "crescente" ? "crescente" : "aleatório"})
          </button>
        </div>

        {escolhidas.length > 0 && (
          <div className="musica-lote" data-testid="musica-lote">
            <span className="musica-lote-conta" data-testid="musica-lote-conta">
              {escolhidas.length === 1 ? "1 selecionada" : `${escolhidas.length} selecionadas`}
            </span>
            <button
              type="button"
              data-testid="musica-lote-mais"
              aria-pressed={painel === "mais"}
              onClick={() => setPainel(painel === "mais" ? null : "mais")}
            >
              + Etiqueta
            </button>
            <button
              type="button"
              data-testid="musica-lote-menos"
              aria-pressed={painel === "menos"}
              disabled={etiquetasDasEscolhidas.length === 0}
              onClick={() => setPainel(painel === "menos" ? null : "menos")}
            >
              − Etiqueta
            </button>
            <button
              type="button"
              data-testid="musica-lote-energia"
              aria-pressed={painel === "energia"}
              onClick={() => setPainel(painel === "energia" ? null : "energia")}
            >
              Energia
            </button>
            {escolhidas.length === 1 && (
              <button type="button" data-testid="musica-lote-editar" onClick={abrirEditar}>
                Nome e descrição
              </button>
            )}
            <span className="som-faixa-espaco" />
            <button
              type="button"
              className="perigo"
              data-testid="musica-lote-tirar"
              onClick={() => setPainel(painel === "tirar" ? null : "tirar")}
            >
              Tirar da lista
            </button>
          </div>
        )}
        {escolhidas.length > 0 && painel === "mais" && (
          <form className="musica-painel-lote" onSubmit={aplicarMais}>
            <input
              type="text"
              list="musica-etiquetas-existentes"
              placeholder="Nome da etiqueta"
              aria-label="Nome da etiqueta"
              data-testid="musica-lote-mais-entrada"
              maxLength={30}
              value={novaEtiqueta}
              onChange={(e) => setNovaEtiqueta(e.target.value)}
            />
            <datalist id="musica-etiquetas-existentes">
              {existentes.map((x) => (
                <option key={x.nome} value={x.nome} />
              ))}
            </datalist>
            <button type="submit" className="primario" data-testid="musica-lote-mais-aplicar">
              Pôr nas {escolhidas.length}
            </button>
          </form>
        )}
        {escolhidas.length > 0 && painel === "menos" && (
          <div className="musica-painel-lote">
            <span className="nota">Tirar de todas as marcadas:</span>
            {etiquetasDasEscolhidas.map((e) => (
              <button
                key={e}
                type="button"
                className="musica-chip"
                data-testid={`musica-lote-menos-${e}`}
                onClick={() => aplicarMenos(e)}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {escolhidas.length > 0 && painel === "energia" && (
          <div className="musica-painel-lote">
            <span className="nota">Energia das marcadas:</span>
            {energias.map((n) => (
              <button
                key={n}
                type="button"
                className="musica-chip musica-chip-energia"
                data-testid={`musica-lote-energia-${n}`}
                onClick={() => aplicarEnergia(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="musica-chip"
              data-testid="musica-lote-energia-nenhuma"
              onClick={() => aplicarEnergia(null)}
            >
              Sem nota (vale {ENERGIA_PADRAO})
            </button>
          </div>
        )}
        {escolhidas.length === 1 && painel === "editar" && (
          <form className="musica-painel-lote" onSubmit={aplicarEditar}>
            <input
              type="text"
              aria-label="Nome da música"
              data-testid="musica-editar-nome"
              maxLength={120}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
            />
            <input
              type="text"
              aria-label="Descrição de uma linha"
              placeholder="Descrição de uma linha (opcional)"
              data-testid="musica-editar-descricao"
              maxLength={200}
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
            />
            <button type="submit" className="primario" data-testid="musica-editar-aplicar">
              Salvar
            </button>
          </form>
        )}
        {escolhidas.length > 0 && painel === "tirar" && (
          <div className="musica-painel-lote" role="alertdialog" aria-label="Tirar da lista">
            <span>
              Tirar {escolhidas.length === 1 ? "esta música" : `estas ${escolhidas.length} músicas`}{" "}
              da lista? Os arquivos continuam no computador.
            </span>
            <button type="button" onClick={() => setPainel(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="perigo"
              data-testid="musica-lote-tirar-confirmar"
              onClick={aplicarTirar}
            >
              Tirar
            </button>
          </div>
        )}

        <ul className="musica-lista" data-testid="musica-lista">
          {visiveis.length === 0 && (
            <li className="nota musica-lista-vazia" data-testid="musica-lista-vazia">
              {faixas.length === 0
                ? "Nenhuma música ainda. Adicione mp3 ou uma pasta."
                : "Nenhuma música com este filtro."}
            </li>
          )}
          {visiveis.map((f) => {
            const marcada = marcadas.has(f.hash);
            return (
              <li
                key={f.hash}
                className="musica-linha"
                data-testid="musica-linha"
                data-nome={f.nome}
                data-marcada={marcada ? "sim" : "nao"}
              >
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${f.nome}`}
                  data-testid="musica-marcar"
                  checked={marcada}
                  onChange={() => marcar(f.hash)}
                />
                <button
                  type="button"
                  className="musica-ouvir"
                  data-testid="musica-ouvir"
                  aria-label={`Ouvir ${f.nome} só para mim`}
                  title="Ouvir só para mim"
                  onClick={() => ouvir(f.hash, VOLUME_DA_CONFERENCIA)}
                >
                  <Play size={12} fill="currentColor" aria-hidden="true" />
                </button>
                <div className="musica-linha-nome">
                  <span className="musica-linha-titulo">{f.nome}</span>
                  <span className="nota" data-testid="musica-linha-detalhe">
                    {duracaoLegivel(f.duracaoMs)} · energia {energiaDe(f)}
                  </span>
                </div>
                <span className="musica-linha-descricao">{f.descricao ?? ""}</span>
                <div className="musica-linha-etiquetas">
                  {f.etiquetas.map((e) => (
                    <span key={e} className="musica-etq" data-testid="musica-etq">
                      {e}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="nota">
          O play de cada linha toca só para você, para conferir. Os arquivos ficam na pasta da mesa
          no seu computador.
        </p>
      </section>
    </div>
  );
}
