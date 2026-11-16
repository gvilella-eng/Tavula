import {
  type EnvioPendente,
  type ImportacaoDeMapa,
  lerCompendio,
  type UsoDeEnvio,
} from "@tabletop/shared";
import { Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Fontes } from "./assets/fontes";
import type { GerenteDeAssets } from "./assets/gerente";

// M1: o navegador do mestre processa os arquivos que o Claude mandou. A sala guarda o arquivo numa caixa de entrada e avisa
// (`caixa.pendentes`); aqui o arquivo é baixado, passa pelo MESMO caminho do botão de subir (tiles, redução a 512 px, cifra se a
// pasta tem chave), é registrado como asset e a sala aplica o uso como o Claude (`caixa.concluir`). Sem esta aba aberta o
// arquivo espera na caixa: a mesa o processa sozinha ao abrir.

/** A subpasta da pasta local onde a cópia do arquivo vai (só com a pasta liberada para escrita). */
const SUBPASTA_DO_USO: Record<UsoDeEnvio, string | null> = {
  mapa: "mapas",
  "mapa-uvtt": "mapas",
  token: "tokens",
  retrato: "retratos",
  handout: "handouts",
  som: "sons",
  // Fora da pasta: o compêndio da pasta vale por cima do que a mesa guarda, e não se sobrescreve o arquivo do mestre.
  compendio: null,
};

export type AndamentoDaCaixa = {
  /** Quantos arquivos do Claude entraram nesta leva. */
  total: number;
  /** Quantos já acabaram (certos ou não). */
  feitos: number;
  /** O que está sendo processado agora. */
  atual: string | null;
  /** O último a acabar: `ok` ou o motivo do erro. */
  ultimo: { nome: string; erro: string | null } | null;
};

type Entradas = {
  mesaId: string;
  euMestre: boolean;
  gerente: GerenteDeAssets | null;
  fontes: Fontes;
  pendentes: readonly EnvioPendente[];
  enviar: (tipo: string, dados: object) => string | null;
};

/** O processamento de um arquivo: devolve o hash (e, no compêndio, quantas magias). Lança com o motivo se não deu. */
async function processar(
  envio: EnvioPendente,
  arquivo: File,
  gerente: GerenteDeAssets,
): Promise<{ hash: string; magias?: number; importacao?: ImportacaoDeMapa; copia?: File }> {
  switch (envio.uso) {
    case "mapa-uvtt": {
      // Q3: o worker lê o arquivo do Dungeondraft; a imagem entra como mapa e a cena convertida vai na conclusão.
      const lido = await gerente.lerMapaUniversalVtt(arquivo);
      return { hash: lido.hash, importacao: lido.importacao, copia: lido.imagem };
    }
    case "mapa":
      return { hash: await gerente.usarArquivo(arquivo, "mapa") };
    case "token":
      return { hash: await gerente.usarArquivo(arquivo, "token") };
    // O retrato da ficha e a imagem do handout usam o mesmo processamento (512 px) do botão de cada um.
    case "retrato":
    case "handout":
      return { hash: await gerente.usarArquivo(arquivo, "retrato") };
    case "som":
      return { hash: (await gerente.registrarSom(arquivo)).hash };
    case "compendio": {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const lido = lerCompendio(new TextDecoder().decode(bytes));
      if (!lido.ok) throw new Error(lido.motivo);
      const hash = await gerente.registrarCompendio(bytes, arquivo.name);
      return { hash, magias: lido.compendio.magias.length };
    }
  }
}

/** Guarda uma cópia na subpasta certa da pasta local, se ela está liberada para escrita (nunca derruba o envio). */
export async function copiarParaAPasta(
  fontes: Fontes,
  uso: UsoDeEnvio,
  arquivo: File,
): Promise<void> {
  const sub = SUBPASTA_DO_USO[uso];
  const pasta = fontes.pastaDoCompendio();
  if (!sub || !pasta) return;
  try {
    await pasta.gravar([sub], arquivo.name, arquivo);
  } catch (e) {
    console.warn("Não consegui guardar a cópia na pasta local", e);
  }
}

/**
 * Processa, um por vez, os arquivos que o Claude mandou (só o mestre). Cada um é baixado de `GET caixa/<id>` (cookie do mestre),
 * processado e concluído (`caixa.concluir`) ou recusado com o motivo (`caixa.falhar`). Devolve o andamento para o aviso.
 */
export function useCaixaDoClaude({
  mesaId,
  euMestre,
  gerente,
  fontes,
  pendentes,
  enviar,
}: Entradas): AndamentoDaCaixa | null {
  const [andamento, setAndamento] = useState<AndamentoDaCaixa | null>(null);
  // O que esta aba já pegou (a lista da sala pode repetir um arquivo antes de ele ser marcado como "processando").
  const vistos = useRef(new Set<string>());
  const fila = useRef<EnvioPendente[]>([]);
  const rodando = useRef(false);
  const enviarAtual = useRef(enviar);
  enviarAtual.current = enviar;
  const sumir = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!euMestre || !gerente) return;
    const novos = pendentes.filter((p) => !vistos.current.has(p.id));
    if (novos.length === 0) return;
    for (const p of novos) {
      vistos.current.add(p.id);
      fila.current.push(p);
    }
    clearTimeout(sumir.current);
    setAndamento((a) => ({
      total: (rodando.current && a ? a.total : 0) + novos.length,
      feitos: rodando.current && a ? a.feitos : 0,
      atual: a?.atual ?? null,
      ultimo: null,
    }));
    if (rodando.current) return;
    rodando.current = true;
    void (async () => {
      try {
        for (let envio = fila.current.shift(); envio; envio = fila.current.shift()) {
          setAndamento((a) => (a ? { ...a, atual: envio.nome } : a));
          let erro: string | null = null;
          try {
            const r = await fetch(`/api/m/${mesaId}/caixa/${envio.id}`, { cache: "no-store" });
            if (r.status === 409 || r.status === 404) {
              // Outra aba já está com ele (ou ele acabou): não é com esta.
              setAndamento((a) => (a ? { ...a, total: Math.max(0, a.total - 1), atual: null } : a));
              continue;
            }
            if (!r.ok) throw new Error("A mesa não entregou o arquivo.");
            const arquivo = new File([await r.blob()], envio.nome, { type: envio.mime });
            const feito = await processar(envio, arquivo, gerente);
            await copiarParaAPasta(fontes, envio.uso, feito.copia ?? arquivo);
            const mandou = enviarAtual.current("caixa.concluir", {
              envioId: envio.id,
              hash: feito.hash,
              ...(feito.magias !== undefined ? { magias: feito.magias } : {}),
              ...(feito.importacao ? { importacao: feito.importacao } : {}),
            });
            if (mandou === null) throw new Error("Sem conexão com a sala.");
          } catch (e) {
            erro = e instanceof Error ? e.message : "Não consegui processar o arquivo.";
            enviarAtual.current("caixa.falhar", {
              envioId: envio.id,
              motivo: erro.slice(0, 300),
            });
          }
          setAndamento((a) =>
            a ? { ...a, feitos: a.feitos + 1, atual: null, ultimo: { nome: envio.nome, erro } } : a,
          );
        }
      } finally {
        rodando.current = false;
        sumir.current = setTimeout(() => setAndamento(null), 5000);
      }
    })();
  }, [pendentes, euMestre, gerente, mesaId, fontes]);

  useEffect(() => () => clearTimeout(sumir.current), []);

  return andamento;
}

/** O aviso "O Claude enviou 1 arquivo": aparece enquanto a mesa processa e some uns segundos depois de acabar. */
export function AvisoDaCaixaDoClaude({ andamento }: { andamento: AndamentoDaCaixa | null }) {
  if (!andamento || andamento.total === 0) return null;
  const { total, feitos, atual, ultimo } = andamento;
  const acabou = feitos >= total;
  const titulo = `O Claude enviou ${total} ${total === 1 ? "arquivo" : "arquivos"}`;
  const detalhe = acabou
    ? ultimo?.erro
      ? `Não deu: ${ultimo.erro}`
      : "Pronto."
    : atual
      ? `Processando ${atual}…`
      : "Processando…";
  return (
    <div
      className={`aviso-caixa${acabou && ultimo?.erro ? " com-erro" : ""}`}
      role="status"
      data-testid="aviso-caixa-claude"
      data-estado={acabou ? (ultimo?.erro ? "erro" : "pronto") : "processando"}
    >
      <Bot size={16} aria-hidden="true" />
      <span>
        <strong>{titulo}</strong> — {detalhe}
      </span>
    </div>
  );
}
