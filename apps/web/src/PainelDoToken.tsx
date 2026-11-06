import type { Camada, Token, Usuario } from "@tabletop/shared";
import { ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PedirImagem } from "./FaixaDeCenas";

type Props = {
  token: Token;
  jogadores: Usuario[];
  enviar: (tipo: string, dados: object) => string | null;
  pedirImagem: PedirImagem;
  aoFechar: () => void;
};

/**
 * Painel compacto do mestre para o token selecionado. Fica no canto inferior esquerdo, ao lado da
 * barra de ferramentas: não cobre o centro do mapa nem os tokens vizinhos. Cada mudança vai na hora.
 */
export function PainelDoToken({ token, jogadores, enviar, pedirImagem, aoFechar }: Props) {
  const [nome, setNome] = useState(token.nome);
  // Outro token selecionado, ou o nome mudou por fora: acompanha a sala.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando o token ou o nome da sala mudam
  useEffect(() => setNome(token.nome), [token.id, token.nome]);

  const editar = (mudancas: object) => enviar("token.editar", { id: token.id, mudancas });
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
    <section className="painel-token" data-testid="painel-token" aria-label="Token selecionado">
      <header>
        <strong>Token</strong>
        <button
          type="button"
          className="botao-icone pequeno"
          title="Fechar"
          aria-label="Fechar"
          onClick={aoFechar}
        >
          <X size={16} />
        </button>
      </header>
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
    </section>
  );
}
