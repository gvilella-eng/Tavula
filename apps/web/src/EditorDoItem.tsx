import {
  type Editores,
  type Estado,
  jogadoresDaMesa,
  type Pasta,
  type Personagem,
  pode,
  podeEditarPersonagem,
  type Usuario,
} from "@tabletop/shared";
import { Copy, Download, FileUp, MapPinPlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Campo } from "./Campo";
import type { PedirImagem } from "./FaixaDeCenas";
import { BotaoImportarPdf } from "./ficha/BotaoImportarPdf";
import type { ImagensDoMapa } from "./mapa/mapaPixi";

type Enviar = (tipo: string, dados: object) => string | null;

/** De quem a pasta é visível, em palavras (o mestre sempre vê). */
export function rotuloDaVisibilidade(pasta: Pasta, usuarios: Usuario[]): string {
  const v = pasta.visivel;
  if (v.tipo === "todos") return "todos os jogadores";
  if (v.tipo === "mestre") return "só o mestre";
  const nomes = v.ids.map((id) => usuarios.find((u) => u.id === id)?.nome ?? id);
  return nomes.length > 0 ? nomes.join(", ") : "só o mestre";
}

type Props = {
  personagem: Personagem;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  pedirImagem: PedirImagem;
  /** Nome da cena que o mestre está vendo (onde "Colocar na cena" põe o token). */
  cenaVista: { id: string; nome: string };
  /** Fecha a janela da ficha (depois de colocar na cena, duplicar ou apagar). */
  aoFechar: () => void;
  /** Exporta a ficha em JSON (pasta `fichas/` ou download). Devolve o aviso para mostrar. */
  exportar: () => Promise<string>;
  /** Importa a ficha de um arquivo JSON (já confirmado); devolve o erro, se houver. */
  importar: (arquivo: File) => Promise<string | null>;
};

/**
 * Aba Configurar da janela da ficha (o editor do item do Lote 4b): à esquerda o retrato e o token padrão
 * (clicar na caixa escolhe a imagem); à direita nome, pasta (só leitura) e quem edita. O jogador que
 * edita o item também troca o retrato e o token. Os PV e os objetos de luz, que moravam aqui até o
 * Lote 8, estão nas abas Principal e Equipamento.
 */
export function EditorDoItem({
  personagem: p,
  estado,
  eu,
  enviar,
  imagens,
  versaoDasImagens,
  pedirImagem,
  cenaVista,
  aoFechar,
  exportar,
  importar,
}: Props) {
  const euMestre = eu.papel === "mestre";
  const editor = podeEditarPersonagem(p, eu);
  const podeTrocarImagem = editor && (euMestre || pode(eu, "asset.subir", estado.permissoes));
  const jogadores = jogadoresDaMesa(estado);
  const pasta = estado.pastas.find((x) => x.id === p.pastaId);
  const [apagando, setApagando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [arquivoParaImportar, setArquivoParaImportar] = useState<File | null>(null);
  const entradaDeArquivo = useRef<HTMLInputElement>(null);

  const editar = (mudancas: object) => enviar("personagem.editar", { id: p.id, mudancas });

  function trocarRetrato() {
    pedirImagem("Retrato", "retrato", (retratoHash) => editar({ retratoHash }));
  }
  function trocarToken() {
    pedirImagem("Token padrão", "token", (assetHash) => {
      editar({ assetHash });
      // O jogador também põe a imagem nos tokens que controla deste personagem (o mestre muda só o padrão).
      if (euMestre) return;
      for (const t of estado.tokens.filter((x) => x.personagemId === p.id)) {
        enviar("token.definirImagem", { id: t.id, assetHash });
      }
    });
  }

  const editoresIds = p.editores.tipo === "jogadores" ? p.editores.ids : [];
  function mudarEditores(novo: Editores) {
    editar({ editores: novo });
  }
  function alternarEditor(id: string) {
    const ids = editoresIds.includes(id)
      ? editoresIds.filter((x) => x !== id)
      : [...editoresIds, id];
    mudarEditores({ tipo: "jogadores", ids });
  }

  function duplicar() {
    enviar("personagem.criar", {
      personagem: {
        ...p,
        id: `pers-${crypto.randomUUID().slice(0, 8)}`,
        nome: `${p.nome} (cópia)`.slice(0, 64),
      },
    });
    aoFechar();
  }

  return (
    <div className="fh-configurar" data-testid="editor-item" data-personagem-id={p.id}>
      <div className="editor-corpo">
        <div className="editor-imagens">
          <button
            type="button"
            className="caixa-retrato"
            data-testid="editor-retrato"
            disabled={!podeTrocarImagem}
            title={podeTrocarImagem ? undefined : "Retrato — você não pode trocar o retrato"}
            onClick={trocarRetrato}
          >
            <Avatar
              imagens={imagens}
              versao={versaoDasImagens}
              hash={p.retratoHash}
              nome={p.nome}
              cor="var(--painel-2)"
              className="grande"
            />
            <span className="legenda-caixa">Retrato</span>
          </button>
          <button
            type="button"
            className="caixa-token"
            data-testid="editor-token"
            disabled={!podeTrocarImagem}
            title={podeTrocarImagem ? undefined : "Token — você não pode trocar o token"}
            onClick={trocarToken}
          >
            <Avatar
              imagens={imagens}
              versao={versaoDasImagens}
              hash={p.tokenPadrao.assetHash}
              nome={p.nome}
              cor={p.tokenPadrao.cor}
              redondo
              className="medio"
            />
            <span className="legenda-caixa">Token</span>
          </button>
        </div>

        <div className="editor-campos">
          <Campo
            testid={`personagem-nome-${p.id}`}
            rotulo="Nome"
            valor={p.nome}
            desabilitado={!euMestre}
            aoConfirmar={(t) => t && editar({ nome: t })}
          />
          <p className="campo-coluna" data-testid="editor-pasta">
            Pasta
            <span className="valor-leitura">
              {pasta ? pasta.nome : "—"}
              {pasta && (
                <span className="nota" data-testid="editor-pasta-visivel">
                  {" "}
                  · visível para {rotuloDaVisibilidade(pasta, estado.usuarios)}
                </span>
              )}
            </span>
          </p>
          <fieldset className="quem-edita" disabled={!euMestre}>
            <legend>Pode ser controlado e editado por</legend>
            <div className="chips">
              <button
                type="button"
                className="chip"
                data-testid="editor-editores-todos"
                aria-pressed={p.editores.tipo === "todos"}
                onClick={() =>
                  mudarEditores(
                    p.editores.tipo === "todos"
                      ? { tipo: "jogadores", ids: [] }
                      : { tipo: "todos" },
                  )
                }
              >
                Todos os jogadores
              </button>
              {jogadores.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="chip"
                  data-testid={`editor-editor-${u.id}`}
                  aria-pressed={p.editores.tipo === "jogadores" && editoresIds.includes(u.id)}
                  onClick={() =>
                    p.editores.tipo === "todos"
                      ? mudarEditores({ tipo: "jogadores", ids: [u.id] })
                      : alternarEditor(u.id)
                  }
                >
                  {u.nome}
                </button>
              ))}
            </div>
            {p.editores.tipo === "jogadores" && editoresIds.length === 0 && (
              <p className="nota">Ninguém: só o mestre controla (como um NPC).</p>
            )}
          </fieldset>
          {euMestre && (
            <details className="avancado">
              <summary>Token padrão e visão</summary>
              <div className="linha-par">
                <label className="campo-coluna">
                  Cor
                  <input
                    type="color"
                    data-testid={`personagem-cor-${p.id}`}
                    value={
                      /^#[0-9a-f]{6}$/i.test(p.tokenPadrao.cor) ? p.tokenPadrao.cor : "#888888"
                    }
                    onChange={(e) => editar({ cor: e.target.value })}
                  />
                </label>
                <label className="campo-coluna">
                  Tamanho (quadrados)
                  <select
                    data-testid={`personagem-tamanho-${p.id}`}
                    value={p.tokenPadrao.tamanhoQuadrados}
                    onChange={(e) => editar({ tamanhoQuadrados: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Campo
                testid={`personagem-alcance-${p.id}`}
                rotulo="Alcance da visão (m; vazio = sem limite)"
                tipo="number"
                min={1}
                max={1000}
                valor={p.visao.alcanceM === null ? "" : String(p.visao.alcanceM)}
                aoConfirmar={(t) => editar({ alcanceM: t === "" ? null : Number(t) })}
              />
              <Campo
                testid={`personagem-escuro-${p.id}`}
                rotulo="Visão no escuro (m)"
                tipo="number"
                min={0}
                max={1000}
                valor={String(p.visao.visaoNoEscuroM)}
                aoConfirmar={(t) => t !== "" && editar({ visaoNoEscuroM: Number(t) })}
              />
              <Campo
                testid={`personagem-int-${p.id}`}
                rotulo="Modificador de Inteligência de reserva (vale só sem a Inteligência da ficha)"
                tipo="number"
                min={-5}
                max={10}
                valor={String(p.modInteligencia ?? 0)}
                aoConfirmar={(t) => {
                  const n = Number(t);
                  if (t !== "" && Number.isInteger(n) && n >= -5 && n <= 10) {
                    editar({ modInteligencia: n });
                  }
                }}
              />
            </details>
          )}
        </div>
      </div>

      <footer className="rodape-modal">
        {euMestre && (
          <>
            <button type="button" data-testid="editor-duplicar" onClick={duplicar}>
              <Copy size={16} /> Duplicar
            </button>
            <button
              type="button"
              data-testid={`personagem-colocar-${p.id}`}
              onClick={() => {
                enviar("personagem.colocar", {
                  personagemId: p.id,
                  cenaId: cenaVista.id,
                  tokenId: `tok-${crypto.randomUUID().slice(0, 8)}`,
                });
                aoFechar();
              }}
            >
              <MapPinPlus size={16} /> Colocar na cena
            </button>
            {apagando ? (
              <button
                type="button"
                className="perigo"
                data-testid="editor-apagar-confirmar"
                onClick={() => {
                  enviar("personagem.apagar", { id: p.id });
                  aoFechar();
                }}
              >
                <Trash2 size={16} /> Confirmar: apagar item e tokens
              </button>
            ) : (
              <button
                type="button"
                className="perigo"
                data-testid="editor-apagar"
                onClick={() => setApagando(true)}
              >
                <Trash2 size={16} /> Apagar
              </button>
            )}
          </>
        )}
        {p.ficha !== undefined && (
          <button
            type="button"
            data-testid="ficha-exportar"
            onClick={async () => setAviso(await exportar())}
          >
            <Download size={16} /> Exportar ficha
          </button>
        )}
        {editor && (
          <>
            <input
              ref={entradaDeArquivo}
              type="file"
              accept=".json,application/json"
              className="so-leitor"
              tabIndex={-1}
              data-testid="ficha-importar-arquivo"
              aria-label="Arquivo da ficha para importar"
              onChange={(e) => {
                const arquivo = e.target.files?.[0] ?? null;
                e.target.value = "";
                setAviso(null);
                setArquivoParaImportar(arquivo);
              }}
            />
            <button
              type="button"
              data-testid="editor-importar"
              onClick={() => entradaDeArquivo.current?.click()}
            >
              <FileUp size={16} /> Importar ficha
            </button>
            <BotaoImportarPdf estado={estado} eu={eu} enviar={enviar} personagem={p} />
          </>
        )}
      </footer>
      {arquivoParaImportar && (
        <div className="fh-confirmar" role="alertdialog" data-testid="ficha-importar-confirmar">
          <p>
            Importar <strong>{arquivoParaImportar.name}</strong> substitui TODA a ficha de {p.nome}.
            Continuar?
          </p>
          <button
            type="button"
            className="perigo"
            data-testid="ficha-importar-confirmar-sim"
            onClick={async () => {
              const arquivo = arquivoParaImportar;
              setArquivoParaImportar(null);
              setAviso((await importar(arquivo)) ?? "Ficha importada.");
            }}
          >
            Substituir a ficha
          </button>
          <button
            type="button"
            data-testid="ficha-importar-confirmar-nao"
            onClick={() => setArquivoParaImportar(null)}
          >
            Cancelar
          </button>
        </div>
      )}
      {aviso && (
        <p className="nota" role="status" data-testid="ficha-arquivo-aviso">
          {aviso}
        </p>
      )}
    </div>
  );
}
