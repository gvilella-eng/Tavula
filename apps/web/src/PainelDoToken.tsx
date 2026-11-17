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
export function PainelDoToken({
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
      titulo="Token selecionado"
      cabecalho={<strong>Token</strong>}
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
          Borda{variosSelecionados ? ` (vale para os ${idsDaSelecao?.length} selecionados)` : ""}
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
    </Janela>
  );
}
