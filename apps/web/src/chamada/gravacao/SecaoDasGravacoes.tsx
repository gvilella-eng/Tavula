import {
  ARQUIVOS_DA_GRAVACAO,
  dividirEmNotas,
  type EstadoDaGravacao,
  estadoDaGravacao,
  type GravacaoJson,
  GravacaoJsonSchema,
  PASTA_DA_GRAVACAO_VALIDA,
  PASTA_DAS_GRAVACOES,
  PASTA_HANDOUTS_ID,
  TAMANHO_MAXIMO_NOTA,
  tituloDaTranscricao,
} from "@tabletop/shared";
import { FileText, FolderOpen, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { EstadoDaPasta, Fontes } from "../../assets/fontes";
import { useDialogo } from "../../useDialogo";
import { listaDeNomes } from "../puras";

// CH3: a seção "Gravações da sessão" da aba Mesa (só o mestre). Lista as gravações da pasta da mesa com o estado de cada uma
// (gravada, transcrita, trazida), "Trazer a transcrição" (vira uma nota só do mestre, rascunho) e "Apagar o áudio".

export type PropsDasGravacoes = {
  fontes: Fontes;
  enviar: (tipo: string, dados: object) => string | null;
  avisar: (texto: string) => void;
  /** Os títulos das notas que já existem (para não repetir o nome da nota da transcrição). */
  titulosDeNotas: () => string[];
  /** As pastas das Fichas que já existem (a "Handouts" é criada se faltar, como o Claude faz). */
  pastas: () => readonly { id: string; ordem: number }[];
};

type Linha = {
  pasta: string;
  estado: EstadoDaGravacao;
  /** "20/11 21:14" */
  quando: string;
  pessoas: string[];
  temAudio: boolean;
  dados: GravacaoJson | null;
};

export const RESUMO_DAS_GRAVACOES = "Gravar a chamada e transcrever";

const ROTULO: Record<EstadoDaGravacao, string> = {
  gravada: "gravada",
  transcrita: "transcrita",
  trazida: "trazida",
};

function quandoDe(pasta: string, dados: GravacaoJson | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})h(\d{2})/.exec(pasta);
  if (m) return `${m[3]}/${m[2]} ${m[4]}:${m[5]}`;
  return dados?.inicioLocal ?? pasta;
}

async function lerTexto(
  pasta: NonNullable<ReturnType<Fontes["pastaDosArquivos"]>>,
  caminho: string[],
): Promise<string | null> {
  return (await (await pasta.abrirPorCaminho(caminho))?.text()) ?? null;
}

/** Lê as gravações da pasta da mesa (a mais recente primeiro). */
export async function listarGravacoes(fontes: Fontes): Promise<Linha[] | null> {
  const pasta = fontes.pastaDosArquivos();
  if (!pasta) return null;
  const itens = await pasta.listarPasta([PASTA_DAS_GRAVACOES]).catch(() => []);
  const linhas: Linha[] = [];
  for (const it of itens) {
    if (it.tipo !== "pasta" || !PASTA_DA_GRAVACAO_VALIDA.test(it.nome)) continue;
    const dentro = await pasta.listarPasta([PASTA_DAS_GRAVACOES, it.nome]).catch(() => []);
    let dados: GravacaoJson | null = null;
    try {
      const bruto = await lerTexto(pasta, [
        PASTA_DAS_GRAVACOES,
        it.nome,
        ARQUIVOS_DA_GRAVACAO.dados,
      ]);
      const lido = bruto ? GravacaoJsonSchema.safeParse(JSON.parse(bruto)) : null;
      dados = lido?.success ? lido.data : null;
    } catch {
      dados = null;
    }
    const pastasDePessoa = new Set((dados?.pessoas ?? []).map((p) => p.pasta));
    linhas.push({
      pasta: it.nome,
      estado: estadoDaGravacao(dentro.filter((d) => d.tipo === "arquivo").map((d) => d.nome)),
      quando: quandoDe(it.nome, dados),
      pessoas: (dados?.pessoas ?? []).map((p) => p.nome),
      temAudio: dentro.some((d) => d.tipo === "pasta" && pastasDePessoa.has(d.nome)),
      dados,
    });
  }
  return linhas.sort((a, b) => b.pasta.localeCompare(a.pasta));
}

/** Apaga só o áudio: as pastas das pessoas. A transcrição, o gravacao.json, o nomes.txt e o eventos.jsonl ficam. */
export async function apagarOAudio(fontes: Fontes, l: Linha): Promise<boolean> {
  const pasta = fontes.pastaDosArquivos();
  if (!pasta || !l.dados) return false;
  let tudo = true;
  for (const p of l.dados.pessoas) {
    if (!p.pasta || p.pasta.includes("/") || p.pasta.includes("\\") || p.pasta.startsWith("."))
      continue;
    const dentro = await pasta.listarPasta([PASTA_DAS_GRAVACOES, l.pasta, p.pasta]).catch(() => []);
    if (dentro.length === 0) continue;
    if (!(await pasta.apagar([PASTA_DAS_GRAVACOES, l.pasta, p.pasta]))) tudo = false;
  }
  return tudo;
}

type Pergunta = { tipo: "depois-de-trazer" | "so-apagar"; linha: Linha };

function PerguntaDoAudio({
  pergunta,
  aoEscolher,
}: {
  pergunta: Pergunta;
  aoEscolher: (apagar: boolean) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const nivel = useDialogo(caixa, () => aoEscolher(false));
  const depois = pergunta.tipo === "depois-de-trazer";
  return (
    <div className="fundo-modal" style={{ zIndex: 80 + nivel }}>
      <div
        ref={caixa}
        className="modal modal-pequeno"
        role="alertdialog"
        aria-label="Apagar o áudio da gravação"
        data-testid="gravacao-apagar-audio"
      >
        <strong>Apagar o áudio da gravação?</strong>
        <p className="nota">
          {depois
            ? "A transcrição já está na nota. O áudio ocupa espaço e guarda a voz de cada pessoa: o padrão é apagar. A transcrição sempre fica."
            : "Só o áudio (os trechos de voz) é apagado. A transcrição e o resto ficam."}
        </p>
        <div className="linha-botoes fim">
          <button
            type="button"
            data-testid="gravacao-manter-audio"
            onClick={() => aoEscolher(false)}
          >
            {depois ? "Manter o áudio" : "Cancelar"}
          </button>
          <button
            type="button"
            className="perigo"
            data-testid="gravacao-apagar-audio-sim"
            onClick={() => aoEscolher(true)}
          >
            <Trash2 size={16} aria-hidden="true" /> Apagar o áudio
          </button>
        </div>
      </div>
    </div>
  );
}

export function SecaoDasGravacoes({
  fontes,
  enviar,
  avisar,
  titulosDeNotas,
  pastas,
}: PropsDasGravacoes) {
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  const estadoDaPasta: EstadoDaPasta = fontes.estado;
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const atualizar = useCallback(async () => {
    setLinhas(await listarGravacoes(fontes));
  }, [fontes]);

  useEffect(() => {
    void atualizar();
    const relogio = setInterval(() => void atualizar(), 5000);
    const aoFoco = () => void atualizar();
    window.addEventListener("focus", aoFoco);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("focus", aoFoco);
    };
  }, [atualizar]);
  // A pasta mudou (escolhida, autorizada): a lista é lida de novo.
  useEffect(() => fontes.assinar(() => void atualizar()), [fontes, atualizar]);

  async function trazer(l: Linha) {
    const pasta = fontes.pastaDosArquivos();
    if (!pasta) return;
    setOcupada(l.pasta);
    try {
      const md = await lerTexto(pasta, [
        PASTA_DAS_GRAVACOES,
        l.pasta,
        ARQUIVOS_DA_GRAVACAO.transcricaoMd,
      ]);
      if (!md || md.trim() === "") {
        avisar("Não achei o transcricao.md dessa gravação. Rode o pnpm transcrever antes.");
        return;
      }
      const linhasDoMd = md.replace(/\r\n/g, "\n").split("\n");
      const cab = /^#\s+(.+)$/.exec(linhasDoMd[0] ?? "");
      const tituloBase = (
        cab?.[1] ??
        (l.dados
          ? tituloDaTranscricao(l.dados.inicioEpochMs, l.dados.fusoMin)
          : "Sessão — transcrição")
      ).slice(0, 70);
      const corpo = (cab ? linhasDoMd.slice(1) : linhasDoMd).join("\n").trim();
      const partes = dividirEmNotas(corpo, TAMANHO_MAXIMO_NOTA - 200);
      const usados = new Set(titulosDeNotas().map((t) => t.toLowerCase()));
      let titulo = tituloBase;
      for (let n = 2; usados.has(titulo.toLowerCase()); n++) titulo = `${tituloBase} (${n})`;
      const titulos: string[] = [];
      const existentes = pastas();
      if (!existentes.some((x) => x.id === PASTA_HANDOUTS_ID)) {
        const ordem = existentes.reduce((m, x) => Math.max(m, x.ordem), -1) + 1;
        enviar("pasta.criar", {
          pasta: {
            id: PASTA_HANDOUTS_ID,
            nome: "Handouts",
            ordem: Math.min(ordem, 10_000),
            visivel: { tipo: "mestre" },
          },
        });
      }
      for (const [i, texto] of partes.entries()) {
        const t = partes.length > 1 ? `${titulo} — parte ${i + 1}` : titulo;
        const enviado = enviar("handout.criar", {
          handout: {
            id: `handout-${crypto.randomUUID().slice(0, 8)}`,
            pastaId: PASTA_HANDOUTS_ID,
            titulo: t.slice(0, 80),
            texto,
            fonte: "simples",
            visivel: { tipo: "mestre" },
          },
        });
        if (enviado === null) {
          avisar("Não consegui criar a nota da transcrição.");
          return;
        }
        titulos.push(t);
      }
      await pasta.gravar(
        [PASTA_DAS_GRAVACOES, l.pasta],
        ARQUIVOS_DA_GRAVACAO.trazida,
        new Blob([
          JSON.stringify({
            versao: 1,
            trazidaEmMs: Date.now(),
            notas: titulos,
            audioApagado: false,
          }),
        ]),
        true,
      );
      avisar(
        titulos.length === 1
          ? `A transcrição virou a nota “${titulos[0]}”, só sua (rascunho).`
          : `A transcrição virou ${titulos.length} notas, só suas (rascunho).`,
      );
      await atualizar();
      if (l.temAudio) setPergunta({ tipo: "depois-de-trazer", linha: l });
    } finally {
      setOcupada(null);
    }
  }

  async function responder(apagar: boolean) {
    const p = pergunta;
    setPergunta(null);
    if (!p || !apagar) return;
    setOcupada(p.linha.pasta);
    try {
      const ok = await apagarOAudio(fontes, p.linha);
      const pasta = fontes.pastaDosArquivos();
      if (ok && pasta) {
        const antes = await lerTexto(pasta, [
          PASTA_DAS_GRAVACOES,
          p.linha.pasta,
          ARQUIVOS_DA_GRAVACAO.trazida,
        ]);
        let marca: Record<string, unknown> = { versao: 1 };
        try {
          marca = { ...marca, ...(antes ? (JSON.parse(antes) as object) : {}) };
        } catch {
          // marca antiga quebrada: recomeça
        }
        if (antes !== null) {
          await pasta.gravar(
            [PASTA_DAS_GRAVACOES, p.linha.pasta],
            ARQUIVOS_DA_GRAVACAO.trazida,
            new Blob([JSON.stringify({ ...marca, audioApagado: true })]),
            true,
          );
        }
      }
      avisar(
        ok
          ? "O áudio da gravação foi apagado. A transcrição ficou."
          : "Não consegui apagar todo o áudio.",
      );
      await atualizar();
    } finally {
      setOcupada(null);
    }
  }

  const semPasta = estadoDaPasta !== "autorizada";
  return (
    <div className="gravacoes" data-testid="gravacoes-secao">
      <p className="nota">
        O mestre grava a chamada pelo botão da chamada; cada fala vira um trecho de áudio na pasta
        da mesa. Depois rode <code>pnpm transcrever "gravacoes/&lt;pasta&gt;"</code> e traga o texto
        para cá.
      </p>
      {semPasta && (
        <div className="gravacoes-sem-pasta" data-testid="gravacoes-sem-pasta">
          <p className="nota">Escolha a pasta da mesa para ver as gravações.</p>
          <button
            type="button"
            className="botao-do-bloco"
            data-testid="gravacoes-escolher-pasta"
            onClick={() =>
              void (estadoDaPasta === "reautorizar" ? fontes.reautorizar() : fontes.escolherPasta())
            }
          >
            <FolderOpen size={16} aria-hidden="true" />{" "}
            {estadoDaPasta === "reautorizar" ? "Autorizar a pasta" : "Escolher a pasta da mesa"}
          </button>
        </div>
      )}
      {!semPasta && linhas !== null && linhas.length === 0 && (
        <p className="nota" data-testid="gravacoes-vazio">
          Nenhuma gravação ainda.
        </p>
      )}
      {!semPasta && linhas !== null && linhas.length > 0 && (
        <ul className="lista-simples gravacoes-lista" data-testid="gravacoes-lista">
          {linhas.map((l) => (
            <li key={l.pasta} className="gravacao-linha" data-testid={`gravacao-${l.pasta}`}>
              <div className="gravacao-titulo">
                <strong>{l.quando}</strong>
                <span
                  className="gravacao-estado"
                  data-estado={l.estado}
                  data-testid={`gravacao-estado-${l.pasta}`}
                >
                  {ROTULO[l.estado]}
                </span>
              </div>
              <span className="nota">
                {l.pessoas.length > 0 ? listaDeNomes(l.pessoas) : "sem pessoas"}
                {l.temAudio ? "" : " · sem áudio"}
              </span>
              {l.estado === "gravada" && (
                <span className="nota" data-testid={`gravacao-comando-${l.pasta}`}>
                  Rode{" "}
                  <code>
                    pnpm transcrever "{PASTA_DAS_GRAVACOES}/{l.pasta}"
                  </code>{" "}
                  (a pasta da mesa vem antes).
                </span>
              )}
              <div className="linha-botoes">
                {l.estado !== "gravada" && (
                  <button
                    type="button"
                    data-testid={`gravacao-trazer-${l.pasta}`}
                    disabled={ocupada === l.pasta}
                    onClick={() => void trazer(l)}
                  >
                    <FileText size={16} aria-hidden="true" />{" "}
                    {l.estado === "trazida" ? "Trazer de novo" : "Trazer a transcrição"}
                  </button>
                )}
                {l.temAudio && (
                  <button
                    type="button"
                    data-testid={`gravacao-apagar-${l.pasta}`}
                    disabled={ocupada === l.pasta}
                    onClick={() => setPergunta({ tipo: "so-apagar", linha: l })}
                  >
                    <Trash2 size={16} aria-hidden="true" /> Apagar o áudio
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {pergunta && <PerguntaDoAudio pergunta={pergunta} aoEscolher={(a) => void responder(a)} />}
    </div>
  );
}
