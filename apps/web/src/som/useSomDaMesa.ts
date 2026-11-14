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
 * N5: liga o som da mesa. A trilha vem do estado da sala; os efeitos e os sons de zona, das mensagens dela. O mestre
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

  // A trilha da sala (inclusive a que já tocava ao entrar).
  const trilha = p.estado?.trilha ?? null;
  const trilhaChave = trilha ? `${trilha.hash}|${trilha.inicioMs}|${trilha.volume}` : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: refaz quando a trilha muda de verdade (a cópia traz um `servidorMs` novo a cada snapshot)
  useEffect(() => {
    motor.definirTrilha(trilha);
  }, [motor, trilhaChave]);

  // Baixar antes: a trilha padrão das cenas que a pessoa recebe chega ao cache sem esperar o grupo mudar de cena.
  const trilhasDasCenas = (p.estado?.cenas ?? [])
    .flatMap((c) => (c.trilha ? [c.trilha.hash] : []))
    .join(",");
  useEffect(() => {
    if (!p.gerente) return;
    for (const hash of trilhasDasCenas.split(",")) if (hash) p.gerente.garantir(hash);
  }, [p.gerente, trilhasDasCenas]);

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
          motor.tocarEfeito(o.evento.dados.hash, o.evento.dados.volume);
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
