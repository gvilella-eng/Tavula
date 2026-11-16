import { type Estado, sonsDasZonasParaTokens } from "@tabletop/shared";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { GerenteDeAssets } from "../assets/gerente";
import type { Ocorrencia } from "../useSala";
import { MotorDeSom } from "./motorDeSom";
import { assinarPrefsDeSom, usePrefsDeSom } from "./prefsDeSom";

type Props = {
  estado: Estado | null;
  gerente: GerenteDeAssets | null;
  /** Quantos arquivos estão prontos (muda quando um som termina de chegar). */
  versaoDosProntos: number;
  ouvir: (fn: (o: Ocorrencia) => void) => () => void;
  euMestre: boolean;
  /** O token selecionado (o mestre ouve as zonas dele, se quiser). */
  selecionadoId: string | null;
};

/**
 * N5/Q4: liga o som da mesa. Os ambientes vêm do estado da sala; os efeitos e os sons de zona, das mensagens dela. O mestre
 * ouve também as zonas do token que selecionou, se ligou "ouvir as zonas". No modo de teste expõe
 * `window.__tabletopSom.estado()` com o que está tocando, sem depender do áudio real.
 */
export function useSomDaMesa(p: Props) {
  const gerenteAtual = useRef(p.gerente);
  gerenteAtual.current = p.gerente;
  const motor = useMemo(
    () =>
      new MotorDeSom(
        {
          urlDe: async (hash) => {
            const g = gerenteAtual.current;
            const arquivo = g ? await g.blobDe(hash) : null;
            if (!arquivo) return null;
            const mime = g?.meta(hash)?.mime;
            return URL.createObjectURL(mime ? new Blob([arquivo], { type: mime }) : arquivo);
          },
          garantir: (hash) => gerenteAtual.current?.garantir(hash),
        },
        assinarPrefsDeSom,
      ),
    [],
  );
  useEffect(() => {
    motor.iniciar();
    return () => motor.encerrar();
  }, [motor]);

  // Os ambientes da sala (inclusive os que já tocavam ao entrar) e o volume geral da mesa de som.
  const daSala = p.estado?.somLigado ?? null;
  // Q4b: os ambientes MARCADOS só tocam com o transporte tocando (sem o campo, como antes: toca se há ambiente marcado).
  const transporteTocando = daSala ? (daSala.tocando ?? daSala.ambientes.length > 0) : false;
  const somLigado = daSala && !transporteTocando ? { ...daSala, ambientes: [] } : daSala;
  const ligadoChave = somLigado
    ? `${somLigado.volumeGeral}|${somLigado.ambientes.map((a) => `${a.indice}:${a.hash}:${a.inicioMs}:${a.volume}`).join(",")}`
    : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: refaz quando o que toca muda de verdade (a cópia traz um `servidorMs` novo a cada snapshot)
  useEffect(() => {
    motor.definirAmbientes(somLigado);
  }, [motor, ligadoChave]);

  // Baixar antes (só o mestre sabe quais são): os ambientes dos lugares chegam ao cache sem esperar ligar.
  const dosLugares = (p.estado?.mesaDeSom?.ambientes ?? [])
    .flatMap((l) => (l ? [l.hash] : []))
    .join(",");
  useEffect(() => {
    if (!p.gerente) return;
    for (const hash of dosLugares.split(",")) if (hash) p.gerente.garantir(hash);
  }, [p.gerente, dosLugares]);

  // Um som que acabou de chegar ao cache pode destravar o que esperava por ele.
  // biome-ignore lint/correctness/useExhaustiveDependencies: roda quando a contagem dos prontos muda
  useEffect(() => {
    motor.arquivoChegou();
  }, [motor, p.versaoDosProntos]);

  // Efeitos e sons de zona: mensagens da sala.
  const [zonasDaSala, setZonasDaSala] = useState<{ hash: string; volume: number; laco: boolean }[]>(
    [],
  );
  useEffect(
    () =>
      p.ouvir((o) => {
        if (o.tipo === "evento" && o.evento.tipo === "som.efeitoTocado") {
          motor.tocarEfeito(o.evento.dados.hash, o.evento.dados.volume, o.evento.dados.lugar);
        } else if (o.tipo === "evento" && o.evento.tipo === "som.efeitoParado") {
          motor.pararEfeito(o.evento.dados.lugar);
        } else if (o.tipo === "somDaZona") {
          setZonasDaSala(o.sons);
        } else if (o.tipo === "conectado") {
          // Conexão nova: o que a sala souber, ela manda de novo.
          setZonasDaSala([]);
        }
      }),
    [motor, p.ouvir],
  );

  // O mestre ouve as zonas do token selecionado, se ligou a opção.
  const prefs = usePrefsDeSom();
  const zonasDoMestre = useMemo(() => {
    if (!p.euMestre || !prefs.ouvirZonas || !p.estado || p.selecionadoId === null) return [];
    const t = p.estado.tokens.find((x) => x.id === p.selecionadoId);
    return t ? sonsDasZonasParaTokens(p.estado, [t]) : [];
  }, [p.euMestre, prefs.ouvirZonas, p.estado, p.selecionadoId]);
  const zonas = p.euMestre ? zonasDoMestre : zonasDaSala;
  const zonasChave = JSON.stringify(zonas);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refaz quando a lista de sons muda de verdade
  useEffect(() => {
    motor.definirZonas(zonas);
  }, [motor, zonasChave]);

  // Gancho de teste: o que está tocando (volume já com as preferências), sem áudio real.
  useEffect(() => {
    if (import.meta.env.MODE !== "e2e") return;
    const w = window as unknown as { __tabletopSom?: unknown };
    w.__tabletopSom = {
      estado: () => motor.estado(),
      ativar: () => motor.ativar(),
      simularBloqueio: () => motor.simularBloqueio(),
    };
    return () => {
      w.__tabletopSom = undefined;
    };
  }, [motor]);

  const bloqueado = useSyncExternalStore(motor.assinar, () => motor.estaBloqueado());
  const versao = useSyncExternalStore(motor.assinar, motor.versaoAtual);
  return { motor, bloqueado, versao };
}
