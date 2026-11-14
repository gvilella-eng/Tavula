import {
  CAMINHO_DO_COMPENDIO,
  type Compendio,
  type CompendioDaMesa,
  juntarCompendios,
  lerCompendio,
  lerVariosCompendios,
  nomeCanonicoDoArquivo,
  PASTA_DO_COMPENDIO,
  type ParteDoCompendio,
  sha256Hex,
} from "@tabletop/shared";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Fontes } from "./assets/fontes";
import type { GerenteDeAssets, StatusDeAsset } from "./assets/gerente";
import { NOME_DO_EXEMPLO_SRD, TEXTO_DO_EXEMPLO_SRD } from "./exemploSrd";

const semAssinatura = () => () => {};
const versaoZero = () => 0;

type Parametros = {
  /** O compêndio da mesa (`Estado.compendio`): só a referência. */
  referencia: CompendioDaMesa | undefined;
  euMestre: boolean;
  conectado: boolean;
  gerente: GerenteDeAssets | null;
  fontes: Fontes;
  enviar: (tipo: string, dados: object) => string | null;
};

/**
 * O que "Usar o exemplo" fez: `gravado` (escreveu `compendio/magias.json` na pasta local), `solto` (sem pasta: vale
 * até recarregar a página), `existe` (a pasta já tem o arquivo: precisa confirmar para substituir) ou `falhou`.
 */
export type ResultadoDoExemplo = "gravado" | "solto" | "existe" | "falhou";

/**
 * O que "Carregar arquivos do compêndio…" fez: `ok` com os arquivos gravados em `compendio/` (`naPasta`) ou só soltos até
 * recarregar (sem pasta), e os avisos de nomes repetidos; ou o motivo de nada ter sido gravado.
 */
export type ResultadoDosArquivos =
  | { ok: true; gravados: string[]; avisos: string[]; naPasta: boolean }
  | { ok: false; motivo: string };

export type SituacaoDoCompendio =
  /** A mesa não tem compêndio (o mestre ainda não pôs o arquivo). */
  | "sem"
  /** Há compêndio e o arquivo está vindo (ou esperando o mestre ficar online). */
  | "baixando"
  | "indisponivel"
  | "pronto"
  /** O arquivo que chegou (ou o da pasta) não passou na validação. */
  | "erro";

/**
 * O compêndio de magias deste navegador. Todos baixam o asset do compêndio da mesa (como uma imagem:
 * pedaços, cache local) e leem as magias do cache. O mestre, além disso, lê `compendio/magias.json` da
 * pasta local dele: se o arquivo é válido, registra como asset e define o compêndio da mesa; se não é,
 * mostra o erro e nada é distribuído. `recarregar` relê o arquivo.
 */
export function useCompendio({
  referencia,
  euMestre,
  conectado,
  gerente,
  fontes,
  enviar,
}: Parametros) {
  const [lido, setLido] = useState<{ hash: string; compendio: Compendio } | null>(null);
  const [erroDoArquivo, setErroDoArquivo] = useState<string | null>(null);
  const [erroDaMesa, setErroDaMesa] = useState<string | null>(null);
  const [semArquivo, setSemArquivo] = useState(false);
  /** N3a: os avisos da junção dos arquivos da pasta (nome repetido: a última vence). */
  const [avisos, setAvisos] = useState<string[]>([]);
  const [lendo, setLendo] = useState(false);
  const ocupado = useRef(false);
  const ultima = useRef({ referencia, enviar, gerente, fontes });
  ultima.current = { referencia, enviar, gerente, fontes };

  const versaoDoGerente = useSyncExternalStore(
    gerente?.assinar ?? semAssinatura,
    gerente?.versaoAtual ?? versaoZero,
  );
  const versaoDasFontes = useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  const hashDaMesa = referencia?.hash;

  // Todos: pede o arquivo do compêndio da mesa (idempotente) e lê as magias quando ele está no cache.
  useEffect(() => {
    if (!gerente || hashDaMesa === undefined) return;
    gerente.garantir(hashDaMesa);
  }, [gerente, hashDaMesa]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `versaoDoGerente` avisa que algo chegou ao cache
  useEffect(() => {
    if (!gerente || hashDaMesa === undefined) {
      setLido(null);
      setErroDaMesa(null);
      return;
    }
    if (lido?.hash === hashDaMesa || !gerente.estaPronto(hashDaMesa)) return;
    let vivo = true;
    void gerente.textoDe(hashDaMesa).then((texto) => {
      if (!vivo || texto === null) return;
      const r = lerCompendio(texto);
      if (r.ok) {
        setErroDaMesa(null);
        setLido({ hash: hashDaMesa, compendio: r.compendio });
      } else {
        setErroDaMesa(`O compêndio recebido não passou na validação (${r.motivo})`);
      }
    });
    return () => {
      vivo = false;
    };
  }, [gerente, hashDaMesa, versaoDoGerente, lido?.hash]);

  /** Mestre: lê o arquivo da pasta, valida e, se mudou, registra e define o compêndio da mesa. */
  const carregarDaPasta = useCallback(async (): Promise<void> => {
    const { gerente: g, fontes: f } = ultima.current;
    if (!g || ocupado.current) return;
    ocupado.current = true;
    setLendo(true);
    try {
      const arquivos = await f.abrirArquivosDoCompendio();
      if (arquivos.length === 0) {
        setSemArquivo(true);
        setErroDoArquivo(null);
        setAvisos([]);
        return;
      }
      setSemArquivo(false);
      // N3a: a pasta pode ter vários arquivos; a mesa junta tudo num compêndio só (um arquivo só vai como está).
      const lidos = await Promise.all(
        arquivos.map(async (a) => ({
          nome: a.name,
          bytes: new Uint8Array(await a.arrayBuffer()),
        })),
      );
      const decodificador = new TextDecoder();
      const r = lerVariosCompendios(
        lidos.map((l) => ({ nome: l.nome, texto: decodificador.decode(l.bytes) })),
      );
      if (!r.ok) {
        setErroDoArquivo(r.motivo);
        return;
      }
      setErroDoArquivo(null);
      setAvisos(r.avisos);
      const unico = lidos.length === 1 ? lidos[0] : undefined;
      const bytes = unico ? unico.bytes : new TextEncoder().encode(JSON.stringify(r.compendio));
      const hash = await sha256Hex(bytes);
      const atual = ultima.current.referencia;
      const magias = r.compendio.magias.length;
      const mesaJaTem = atual?.hash === hash && atual.magias === magias && g.estaPronto(hash);
      if (!mesaJaTem) {
        await g.registrarCompendio(bytes, unico ? unico.nome : "compendio.json");
        const enviado = ultima.current.enviar("compendio.definir", {
          compendio: {
            hash,
            nomeOriginal: (unico ? unico.nome : "compendio.json").slice(0, 200),
            magias,
          },
        });
        if (enviado === null) throw new Error("Sem conexão com a sala.");
      }
      setLido({ hash, compendio: r.compendio });
    } catch (e) {
      setErroDoArquivo(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
    } finally {
      ocupado.current = false;
      setLendo(false);
    }
  }, []);

  /**
   * N3a, mestre: "Carregar arquivos do compêndio…". Valida cada `.json` escolhido (um com erro derruba todos e diz
   * qual) e grava em `compendio/` com o nome pelo conteúdo (`magias.json`, `monstros.json`, `itens.json`; misturado,
   * `compendio.json`), somando ao que a pasta já tem (nome repetido: vale o novo, com aviso). Sem pasta, os arquivos
   * valem até recarregar a página. Depois a mesa relê a pasta sozinha.
   */
  const carregarArquivos = useCallback(
    async (arquivos: readonly File[]): Promise<ResultadoDosArquivos> => {
      const f = ultima.current.fontes;
      try {
        const lidos: { nome: string; texto: string; compendio: Compendio }[] = [];
        for (const a of arquivos) {
          const texto = await a.text();
          const r = lerCompendio(texto);
          if (!r.ok) return { ok: false, motivo: `${a.name}: ${r.motivo}` };
          lidos.push({ nome: a.name, texto, compendio: r.compendio });
        }
        if (lidos.length === 0) return { ok: false, motivo: "Nenhum arquivo escolhido." };
        const pasta = f.pastaDoCompendio();
        if (!pasta) {
          f.adicionarCompendiosSoltos(arquivos);
          return { ok: true, gravados: lidos.map((l) => l.nome), avisos: [], naPasta: false };
        }
        const grupos = new Map<string, typeof lidos>();
        for (const l of lidos) {
          const nome = nomeCanonicoDoArquivo(l.compendio);
          grupos.set(nome, [...(grupos.get(nome) ?? []), l]);
        }
        const avisos: string[] = [];
        const gravados: string[] = [];
        for (const [nome, novos] of grupos) {
          const partes: ParteDoCompendio[] = [];
          const existente = await pasta.abrirPorCaminho([PASTA_DO_COMPENDIO, nome]);
          if (existente) {
            const antes = lerCompendio(await existente.text());
            if (!antes.ok) {
              return {
                ok: false,
                motivo: `${PASTA_DO_COMPENDIO}/${nome} (já na pasta): ${antes.motivo}. Corrija ou apague esse arquivo antes.`,
              };
            }
            partes.push({ nome: `${PASTA_DO_COMPENDIO}/${nome}`, compendio: antes.compendio });
          }
          const [primeiro] = novos;
          if (partes.length === 0 && novos.length === 1 && primeiro) {
            partes.push({ nome: primeiro.nome, compendio: primeiro.compendio });
          } else {
            partes.push(...novos.map((n) => ({ nome: n.nome, compendio: n.compendio })));
          }
          const junto = juntarCompendios(partes);
          if (!junto.ok) return { ok: false, motivo: `${nome}: ${junto.motivo}` };
          avisos.push(...junto.avisos);
          // Um arquivo só e nada na pasta: grava o texto como veio.
          const texto =
            partes.length === 1 && primeiro ? primeiro.texto : JSON.stringify(junto.compendio);
          const gravou = await pasta.gravar(
            [PASTA_DO_COMPENDIO],
            nome,
            new Blob([texto], { type: "application/json" }),
            true,
          );
          if (!gravou) return { ok: false, motivo: `Não consegui gravar ${nome} na pasta.` };
          gravados.push(nome);
        }
        f.notificar();
        return { ok: true, gravados, avisos, naPasta: true };
      } catch {
        return { ok: false, motivo: "Não consegui ler ou gravar os arquivos." };
      }
    },
    [],
  );

  /** Mestre: põe o exemplo do SRD como compêndio (na pasta, se houver; senão só até recarregar). */
  const usarExemplo = useCallback(async (substituir = false): Promise<ResultadoDoExemplo> => {
    const f = ultima.current.fontes;
    const pasta = f.pastaDoCompendio();
    if (pasta) {
      try {
        if (!substituir && (await pasta.abrirPorCaminho(CAMINHO_DO_COMPENDIO))) return "existe";
        const caminho = [...CAMINHO_DO_COMPENDIO];
        const nome = caminho.pop() ?? "magias.json";
        const gravou = await pasta.gravar(
          caminho,
          nome,
          new Blob([TEXTO_DO_EXEMPLO_SRD], { type: "application/json" }),
          true,
        );
        if (!gravou) return "falhou";
        f.notificar();
        return "gravado";
      } catch {
        return "falhou";
      }
    }
    f.escolherCompendioSolto(
      new File([TEXTO_DO_EXEMPLO_SRD], NOME_DO_EXEMPLO_SRD, { type: "application/json" }),
    );
    return "solto";
  }, []);

  // Mestre: ao abrir, quando a pasta fica autorizada ou ganha um arquivo, e ao reconectar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `versaoDasFontes` avisa que a pasta ou os arquivos mudaram
  useEffect(() => {
    if (!euMestre || !conectado || !gerente) return;
    void carregarDaPasta();
  }, [euMestre, conectado, gerente, carregarDaPasta, versaoDasFontes]);

  const status: StatusDeAsset | undefined =
    gerente && hashDaMesa !== undefined ? gerente.statusDe(hashDaMesa) : undefined;
  const compendio = lido && lido.hash === hashDaMesa ? lido.compendio : null;

  let situacao: SituacaoDoCompendio;
  if (compendio) situacao = "pronto";
  else if (hashDaMesa === undefined) situacao = euMestre && erroDoArquivo ? "erro" : "sem";
  else if (erroDaMesa || status?.estado === "erro") situacao = "erro";
  else if (status?.estado === "indisponivel") situacao = "indisponivel";
  else situacao = "baixando";

  return {
    situacao,
    compendio,
    /** Mestre: o erro do `magias.json` da pasta (nada foi distribuído). */
    erroDoArquivo: euMestre ? erroDoArquivo : null,
    /** O motivo do erro de um compêndio da mesa que não foi lido (jogador ou mestre). */
    erroDaMesa: erroDaMesa ?? (status?.estado === "erro" ? (status.mensagem ?? "Erro") : null),
    /** Mestre: a pasta não tem `compendio/magias.json`. */
    semArquivo: euMestre && semArquivo,
    lendo,
    recebidos: status?.recebidos ?? 0,
    total: status?.total ?? 0,
    recarregar: carregarDaPasta,
    usarExemplo,
    carregarArquivos,
    /** N3a: os avisos de nome repetido entre os arquivos da pasta. */
    avisos: euMestre ? avisos : [],
  };
}
