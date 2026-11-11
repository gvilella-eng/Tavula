import {
  CAMINHO_DO_COMPENDIO,
  type Compendio,
  type CompendioDaMesa,
  lerCompendio,
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
      const arquivo = await f.abrirCompendio();
      if (!arquivo) {
        setSemArquivo(true);
        setErroDoArquivo(null);
        return;
      }
      setSemArquivo(false);
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const texto = new TextDecoder().decode(bytes);
      const r = lerCompendio(texto);
      if (!r.ok) {
        setErroDoArquivo(r.motivo);
        return;
      }
      setErroDoArquivo(null);
      const hash = await sha256Hex(bytes);
      const atual = ultima.current.referencia;
      const magias = r.compendio.magias.length;
      const mesaJaTem = atual?.hash === hash && atual.magias === magias && g.estaPronto(hash);
      if (!mesaJaTem) {
        await g.registrarCompendio(bytes, arquivo.name);
        const enviado = ultima.current.enviar("compendio.definir", {
          compendio: { hash, nomeOriginal: arquivo.name.slice(0, 200), magias },
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
  };
}
