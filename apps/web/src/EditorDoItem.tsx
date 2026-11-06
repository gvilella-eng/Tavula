import {
  type Editores,
  type Estado,
  type Pasta,
  type Personagem,
  pode,
  podeEditarPersonagem,
  type Usuario,
} from "@tabletop/shared";
import { Copy, FileUp, MapPinPlus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { Campo } from "./Campo";
import type { PedirImagem } from "./FaixaDeCenas";
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
  aoFechar: () => void;
};

/**
 * Editor do item (abre ao clicar numa ficha): à esquerda o retrato e o token padrão (clicar na caixa
 * escolhe a imagem); à direita nome, pasta (só leitura), quem edita e PV. O jogador que edita o item
 * também troca o retrato e o token.
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
}: Props) {
  const euMestre = eu.papel === "mestre";
  const editor = podeEditarPersonagem(p, eu);
  const podeTrocarImagem = editor && (euMestre || pode(eu, "asset.subir", estado.permissoes));
  const jogadores = estado.usuarios.filter((u) => u.papel === "jogador");
  const pasta = estado.pastas.find((x) => x.id === p.pastaId);
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      // Com o seletor de imagem por cima, o Esc é dele.
      if (e.key === "Escape" && !document.querySelector('[data-testid="seletor-imagem"]')) {
        aoFechar();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const editar = (mudancas: object) => enviar("personagem.editar", { id: p.id, mudancas });
  const alterarPv = (campo: "pvAtual" | "pvMax", texto: string) => {
    const n = Number(texto);
    if (texto !== "" && Number.isInteger(n) && n >= 0 && n <= 9999) {
      enviar("ficha.alterar", { personagemId: p.id, [campo]: n });
    }
  };

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
    <div className="fundo-modal">
      <section
        className="modal modal-editor"
        role="dialog"
        aria-label={`Ficha de ${p.nome}`}
        data-testid="editor-item"
        data-personagem-id={p.id}
      >
        <header className="cabecalho-modal">
          <strong>{p.nome}</strong>
          <button
            type="button"
            className="botao-icone pequeno"
            data-testid="editor-fechar"
            title="Fechar"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <X size={16} />
          </button>
        </header>

        <div className="editor-corpo">
          <div className="editor-imagens">
            <button
              type="button"
              className="caixa-retrato"
              data-testid="editor-retrato"
              disabled={!podeTrocarImagem}
              title={podeTrocarImagem ? "Escolher o retrato" : "Você não pode trocar o retrato"}
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
              title={podeTrocarImagem ? "Escolher o token padrão" : "Você não pode trocar o token"}
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
            {editor ? (
              <div className="linha-par">
                <Campo
                  testid={`pv-atual-${p.id}`}
                  rotulo="PV"
                  tipo="number"
                  min={0}
                  max={9999}
                  valor={String(p.ficha.pvAtual)}
                  aoConfirmar={(t) => alterarPv("pvAtual", t)}
                />
                <Campo
                  testid={`pv-max-${p.id}`}
                  rotulo="PV máximo"
                  tipo="number"
                  min={0}
                  max={9999}
                  valor={String(p.ficha.pvMax)}
                  aoConfirmar={(t) => alterarPv("pvMax", t)}
                />
              </div>
            ) : (
              <p data-testid={`pv-${p.id}`}>
                PV {p.ficha.pvAtual} / {p.ficha.pvMax}
              </p>
            )}
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
                title={`Põe o token na cena que você está vendo (${cenaVista.nome})`}
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
          <button
            type="button"
            data-testid="editor-importar"
            disabled
            title="Em breve: importar a ficha de D&D"
          >
            <FileUp size={16} /> Importar ficha (em breve)
          </button>
        </footer>
      </section>
    </div>
  );
}
