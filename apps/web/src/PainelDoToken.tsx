import {
  type Borda,
  barraDeVidaLigada,
  type Camada,
  metrosParaUnidade,
  nomeDaUnidade,
  type Token,
  type Usuario,
  unidadeParaMetros,
} from "@tabletop/shared";
import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { PedirImagem } from "./FaixaDeCenas";
import {
  alturaDoTokenNaColuna,
  apertada,
  MARGEM,
  noCanto,
  RESERVA_DO_ZOOM,
} from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { SeletorDeBorda } from "./SeletorDeBorda";
import { useUnidade } from "./unidade";

type Props = {
  /** AS1: o lado de um quadrado da cena, em metros (o tamanho da imagem solta é mostrado em quadrados). */
  quadradoM: number;
  token: Token;
  /** Q11: os ids da seleção (o token deste painel e os somados): a borda e a barra de vida valem para todos. */
  idsDaSelecao?: string[] | undefined;
  jogadores: Usuario[];
  enviar: (tipo: string, dados: object) => string | null;
  pedirImagem: PedirImagem;
  aoFechar: () => void;
};

/**
 * Painel compacto do mestre para o token selecionado. Fica no canto inferior esquerdo, ao lado da
 * barra de ferramentas: não cobre o centro do mapa nem os tokens vizinhos. Cada mudança vai na hora.
 */
/** AS1: o painel de uma imagem solta na cena: nome, tamanho em quadrados, giro, camada, ocultar e apagar. */
function CorpoDaImagem({
  token,
  quadradoM,
  enviar,
  aoFechar,
}: {
  token: Token;
  quadradoM: number;
  enviar: Props["enviar"];
  aoFechar: () => void;
}) {
  const imagem = token.imagem as NonNullable<Token["imagem"]>;
  const emQuadrados = (m: number) => String(Math.round((m / quadradoM) * 100) / 100);
  const [nome, setNome] = useState(token.nome);
  const [travar, setTravar] = useState(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando o objeto ou o nome da sala mudam
  useEffect(() => setNome(token.nome), [token.id, token.nome]);
  const ajustar = (mudancas: object) => enviar("imagem.ajustar", { id: token.id, mudancas });
  const confirmarNome = () => {
    const limpo = nome.trim();
    if (limpo && limpo !== token.nome) ajustar({ nome: limpo });
    else setNome(token.nome);
  };
  function mudarMedida(eixo: "larguraM" | "alturaM", texto: string) {
    const n = Number(texto.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    const metros = Math.min(1000, Math.max(0.1, n * quadradoM));
    if (!travar) {
      ajustar({ [eixo]: metros });
      return;
    }
    const k = metros / imagem[eixo];
    ajustar({
      larguraM: Math.min(1000, Math.max(0.1, imagem.larguraM * k)),
      alturaM: Math.min(1000, Math.max(0.1, imagem.alturaM * k)),
    });
  }
  return (
    <>
      <label>
        Nome
        <input
          data-testid="imagem-nome"
          value={nome}
          maxLength={64}
          onChange={(e) => setNome(e.target.value)}
          onBlur={confirmarNome}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </label>
      <div className="linha-par">
        <label>
          Largura (quadrados)
          <input
            data-testid="imagem-largura"
            inputMode="decimal"
            key={`l-${token.id}-${imagem.larguraM}`}
            defaultValue={emQuadrados(imagem.larguraM)}
            onBlur={(e) => {
              if (e.target.value.trim() !== emQuadrados(imagem.larguraM)) {
                mudarMedida("larguraM", e.target.value);
              }
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </label>
        <label>
          Altura (quadrados)
          <input
            data-testid="imagem-altura"
            inputMode="decimal"
            key={`a-${token.id}-${imagem.alturaM}`}
            defaultValue={emQuadrados(imagem.alturaM)}
            onBlur={(e) => {
              if (e.target.value.trim() !== emQuadrados(imagem.alturaM)) {
                mudarMedida("alturaM", e.target.value);
              }
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </label>
      </div>
      <label className="linha-opcao">
        <input
          type="checkbox"
          data-testid="imagem-proporcao"
          checked={travar}
          onChange={(e) => setTravar(e.target.checked)}
        />
        Manter a proporção
      </label>
      <label>
        Giro (graus)
        <input
          data-testid="imagem-giro"
          inputMode="decimal"
          key={`g-${token.id}-${imagem.rotacao}`}
          defaultValue={String(imagem.rotacao)}
          onBlur={(e) => {
            const n = Number(e.target.value.trim().replace(",", "."));
            if (!Number.isFinite(n) || n < -360 || n > 360) {
              e.target.value = String(imagem.rotacao);
            } else if (n !== imagem.rotacao) ajustar({ rotacao: n });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </label>
      <label>
        Camada
        <select
          data-testid="token-camada"
          value={token.camada}
          onChange={(e) => ajustar({ camada: e.target.value as Camada })}
        >
          <option value="mapa">mapa (cenário)</option>
          <option value="tokens">tokens</option>
          <option value="mestre">mestre</option>
        </select>
      </label>
      <label className="linha-opcao">
        <input
          type="checkbox"
          data-testid="token-oculto"
          checked={token.oculto}
          onChange={(e) => ajustar({ oculto: e.target.checked })}
        />
        Oculto para os jogadores
      </label>
      <p className="nota">Arraste a imagem para mover; as alças esticam e giram.</p>
      <div className="linha-botoes">
        <button
          type="button"
          className="perigo"
          data-testid="token-apagar"
          onClick={() => {
            enviar("token.apagar", { id: token.id });
            aoFechar();
          }}
        >
          <Trash2 size={16} /> Apagar
        </button>
      </div>
    </>
  );
}

export function PainelDoToken({
  quadradoM,
  token,
  idsDaSelecao,
  jogadores,
  enviar,
  pedirImagem,
  aoFechar,
}: Props) {
  const [nome, setNome] = useState(token.nome);
  // Outro token selecionado, ou o nome mudou por fora: acompanha a sala.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando o token ou o nome da sala mudam
  useEffect(() => setNome(token.nome), [token.id, token.nome]);

  const editar = (mudancas: object) => enviar("token.editar", { id: token.id, mudancas });
  // Q11: a borda e a barra de vida valem para a seleção inteira (um pedido só); o resto é só do token do painel.
  const variosSelecionados = idsDaSelecao !== undefined && idsDaSelecao.length > 1;
  const editarSelecao = (mudancas: object) =>
    variosSelecionados
      ? enviar("tokens.editar", { ids: idsDaSelecao, mudancas })
      : editar(mudancas);
  // V14: os campos de alcance mostram e aceitam a unidade das Preferências; a sala recebe metros.
  const unidade = useUnidade();
  const nomeDaUn = nomeDaUnidade(unidade);
  const emUnidade = (m: number | undefined) =>
    m === undefined ? "" : String(Math.round(metrosParaUnidade(m, unidade) * 100) / 100);
  const confirmarNome = () => {
    const limpo = nome.trim();
    if (limpo && limpo !== token.nome) editar({ nome: limpo });
    else setNome(token.nome);
  };
  function alternarControle(id: string, controla: boolean) {
    const sem = token.controladoPor.filter((x) => x !== id);
    editar({ controladoPor: controla ? [...sem, id] : sem });
  }

  return (
    <Janela
      id="token"
      titulo={token.imagem ? "Imagem selecionada" : "Token selecionado"}
      cabecalho={<strong>{token.imagem ? "Imagem" : "Token"}</strong>}
      testid="painel-token"
      dados={{ "data-token-id": token.id }}
      classeDoCorpo="painel-token"
      // Embaixo à esquerda; numa área apertada (1280×720) vai para a coluna da direita, embaixo da ordem de turno.
      padrao={(area, janela) =>
        apertada(area)
          ? noCanto("baixo-direita", MARGEM, RESERVA_DO_ZOOM)(area, janela)
          : noCanto("baixo-esquerda")(area, janela)
      }
      alturaMaxima={(area) => (apertada(area) ? `${alturaDoTokenNaColuna(area)}px` : undefined)}
      largura={236}
      aoFechar={aoFechar}
      rotuloDoFechar="Fechar"
    >
      {token.imagem ? (
        <CorpoDaImagem token={token} quadradoM={quadradoM} enviar={enviar} aoFechar={aoFechar} />
      ) : (
        <>
          <label>
            Nome
            <input
              data-testid="token-nome"
              value={nome}
              maxLength={64}
              onChange={(e) => setNome(e.target.value)}
              onBlur={confirmarNome}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </label>
          <div className="linha-par">
            <label>
              Cor
              <input
                type="color"
                data-testid="token-cor"
                value={/^#[0-9a-f]{6}$/i.test(token.cor) ? token.cor : "#888888"}
                onChange={(e) => editar({ cor: e.target.value })}
              />
            </label>
            <label>
              Tamanho
              <select
                data-testid="token-tamanho"
                value={token.tamanhoQuadrados}
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
          <label>
            Camada
            <select
              data-testid="token-camada"
              value={token.camada}
              onChange={(e) => editar({ camada: e.target.value as Camada })}
            >
              <option value="mapa">mapa (cenário)</option>
              <option value="tokens">tokens</option>
              <option value="mestre">mestre</option>
            </select>
          </label>
          <div className="campo-borda">
            <span className="nota">
              Borda
              {variosSelecionados ? ` (vale para os ${idsDaSelecao?.length} selecionados)` : ""}
            </span>
            <SeletorDeBorda
              valor={token.borda}
              aoEscolher={(b: Borda | null) => editarSelecao({ borda: b })}
              prefixo="token-borda"
              papel="radio"
            />
          </div>
          <label className="linha-opcao">
            <input
              type="checkbox"
              data-testid="token-barra-de-vida"
              checked={barraDeVidaLigada(token)}
              onChange={(e) => editarSelecao({ barraDeVida: e.target.checked })}
            />
            Barra de vida (só quem controla o token a vê)
          </label>
          {token.personagemId === undefined ? (
            <label>
              Alcance da visão ({nomeDaUn}; vazio = sem limite)
              <input
                data-testid="token-alcance-visao"
                inputMode="decimal"
                key={`alcance-${token.id}-${token.alcanceVisaoM ?? ""}-${unidade}`}
                defaultValue={emUnidade(token.alcanceVisaoM)}
                onBlur={(e) => {
                  const texto = e.target.value.trim().replace(",", ".");
                  const n = unidadeParaMetros(Number(texto), unidade);
                  if (texto === emUnidade(token.alcanceVisaoM)) return; // sem mexer: a sala não muda
                  if (texto === "") editar({ alcanceVisaoM: null });
                  else if (Number.isFinite(n) && n > 0 && n <= 1000) editar({ alcanceVisaoM: n });
                  else e.target.value = emUnidade(token.alcanceVisaoM);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
          ) : (
            <p className="nota">A visão vem do personagem (editor da ficha).</p>
          )}
          {token.personagemId === undefined && (
            <label>
              Visão no escuro ({nomeDaUn}; vazio = nenhuma)
              <input
                data-testid="token-visao-escuro"
                inputMode="decimal"
                key={`escuro-${token.id}-${token.visaoNoEscuroM ?? ""}-${unidade}`}
                defaultValue={emUnidade(token.visaoNoEscuroM)}
                onBlur={(e) => {
                  const texto = e.target.value.trim().replace(",", ".");
                  const n = unidadeParaMetros(Number(texto), unidade);
                  if (texto === emUnidade(token.visaoNoEscuroM)) return; // sem mexer: a sala não muda
                  if (texto === "") editar({ visaoNoEscuroM: null });
                  else if (Number.isFinite(n) && n >= 0 && n <= 1000) editar({ visaoNoEscuroM: n });
                  else e.target.value = emUnidade(token.visaoNoEscuroM);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
          )}
          <label className="linha-opcao">
            <input
              type="checkbox"
              data-testid="token-oculto"
              checked={token.oculto}
              onChange={(e) => editar({ oculto: e.target.checked })}
            />
            Oculto para os jogadores
          </label>
          <div className="linha-botoes">
            <button
              type="button"
              data-testid="token-imagem"
              onClick={() =>
                pedirImagem("Imagem do token", "token", (assetHash) => editar({ assetHash }))
              }
            >
              <ImagePlus size={16} /> Imagem…
            </button>
            {token.assetHash && (
              <button
                type="button"
                data-testid="token-sem-imagem"
                onClick={() => editar({ assetHash: null })}
              >
                Tirar
              </button>
            )}
            <button
              type="button"
              className="perigo"
              data-testid="token-apagar"
              onClick={() => {
                enviar("token.apagar", { id: token.id });
                aoFechar();
              }}
            >
              <Trash2 size={16} /> Apagar
            </button>
          </div>
          <fieldset className="quem-controla">
            <legend>Quem controla</legend>
            <div className="chips">
              {jogadores.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="chip"
                  data-testid={`token-controla-${u.id}`}
                  aria-pressed={token.controladoPor.includes(u.id)}
                  onClick={() => alternarControle(u.id, !token.controladoPor.includes(u.id))}
                >
                  {u.nome}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </Janela>
  );
}
