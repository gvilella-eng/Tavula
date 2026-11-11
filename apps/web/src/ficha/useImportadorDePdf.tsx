import {
  type Estado,
  type Ficha,
  type ImportacaoDoPdf,
  importarFichaDoPdf,
  PASTA_PERSONAGENS_ID,
  type Personagem,
  podeEditarPersonagem,
  type Usuario,
} from "@tabletop/shared";
import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { extrairPedacosDoPdf } from "./extrairPdf";
import { RevisaoDoPdf } from "./RevisaoDoPdf";

type Enviar = (tipo: string, dados: object) => string | null;

type Fase =
  | { tipo: "lendo"; arquivo: string }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "revisao"; arquivo: string; resultado: ImportacaoDoPdf; alvo: Personagem | null };

type Opcoes = {
  estado: Estado;
  /** Quem importa: só os personagens que ele edita são destino de "Por cima de". */
  eu: Usuario;
  enviar: Enviar;
  /** O item novo foi enviado: quem chama abre a janela dele. */
  aoCriar?: (personagemId: string) => void;
};

/**
 * Importação da ficha em PDF (Lote 10): escolher o PDF, ler no navegador (o arquivo não sai do
 * PC), mostrar a tela de revisão e, só se o jogador confirmar, mandar a ficha (JSON) para a sala. Devolve
 * `escolher(alvo)` — o item que será substituído, ou `null` para criar um item novo — e os `elementos` que
 * quem usa precisa deixar na árvore (o seletor de arquivo escondido e a tela de revisão). A revisão
 * mostra o destino ("Ficha nova" ou "Por cima de: <personagem>"): `alvo` só o deixa já preenchido.
 */
export function useImportadorDePdf({ estado, eu, enviar, aoCriar }: Opcoes): {
  escolher: (alvo: Personagem | null) => void;
  elementos: ReactNode;
} {
  const entrada = useRef<HTMLInputElement>(null);
  const alvo = useRef<Personagem | null>(null);
  const [fase, setFase] = useState<Fase | null>(null);

  function escolher(novoAlvo: Personagem | null) {
    alvo.current = novoAlvo;
    entrada.current?.click();
  }

  async function ler(arquivo: File) {
    const itemAlvo = alvo.current;
    setFase({ tipo: "lendo", arquivo: arquivo.name });
    try {
      const pedacos = await extrairPedacosDoPdf(arquivo);
      const resultado = importarFichaDoPdf(pedacos);
      if (!resultado.reconhecido) {
        setFase({
          tipo: "erro",
          mensagem:
            "Este PDF não parece a ficha impressa (impressa pelo navegador, com texto). Nada foi importado.",
        });
        return;
      }
      setFase({ tipo: "revisao", arquivo: arquivo.name, resultado, alvo: itemAlvo });
    } catch (e) {
      setFase({
        tipo: "erro",
        mensagem: `Não consegui ler o PDF (${(e instanceof Error ? e.message : "erro desconhecido").replace(/\.+$/, "")}). Nada foi importado.`,
      });
    }
  }

  function confirmar(ficha: Ficha, nome: string, itemAlvo: Personagem | null): string | null {
    if (fase?.tipo !== "revisao") return null;
    if (itemAlvo) {
      // Importar por cima: troca só a ficha; retrato, token e pasta do item ficam como estão.
      const id = enviar("ficha.alterar", {
        personagemId: itemAlvo.id,
        operacoes: [{ caminho: "", valor: ficha }],
      });
      if (!id) return "Sem conexão com a sala: nada foi enviado.";
      setFase(null);
      return null;
    }
    const pastaId = estado.pastas.some((p) => p.id === PASTA_PERSONAGENS_ID)
      ? PASTA_PERSONAGENS_ID
      : estado.pastas[0]?.id;
    if (!pastaId) return "Não há nenhuma pasta para receber o personagem.";
    const novoId = `pers-${crypto.randomUUID().slice(0, 8)}`;
    const id = enviar("personagem.criar", {
      personagem: {
        id: novoId,
        pastaId,
        editores: { tipo: "jogadores", ids: [] },
        nome,
        tokenPadrao: { cor: "#3cb44b", tamanhoQuadrados: 1 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha,
      },
    });
    if (!id) return "Sem conexão com a sala: nada foi enviado.";
    setFase(null);
    aoCriar?.(novoId);
    return null;
  }

  const elementos = (
    <>
      <input
        ref={entrada}
        type="file"
        accept=".pdf,application/pdf"
        className="so-leitor"
        tabIndex={-1}
        data-testid="ficha-pdf-arquivo"
        aria-label="PDF da ficha para importar"
        onChange={(e) => {
          const arquivo = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (arquivo) void ler(arquivo);
        }}
      />
      {fase?.tipo === "lendo" &&
        createPortal(
          <div className="rev-fundo" data-testid="revisao-lendo">
            <p className="rev-lendo" role="status">
              Lendo {fase.arquivo}…
            </p>
          </div>,
          document.body,
        )}
      {fase?.tipo === "erro" &&
        createPortal(
          <div className="rev-fundo" data-testid="revisao-erro-leitura">
            <div className="rev-confirmar-caixa" role="alertdialog">
              <strong>Importação cancelada</strong>
              <p>{fase.mensagem}</p>
              <button type="button" onClick={() => setFase(null)}>
                Fechar
              </button>
            </div>
          </div>,
          document.body,
        )}
      {fase?.tipo === "revisao" &&
        createPortal(
          <RevisaoDoPdf
            nomeDoArquivo={fase.arquivo}
            resultado={fase.resultado}
            alvo={fase.alvo}
            candidatos={estado.personagens.filter((p) => podeEditarPersonagem(p, eu))}
            aoConfirmar={confirmar}
            aoCancelar={() => setFase(null)}
          />,
          document.body,
        )}
    </>
  );

  return { escolher, elementos };
}
