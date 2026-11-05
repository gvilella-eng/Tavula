import type { Camada, Token, Usuario } from "@tabletop/shared";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  token: Token;
  jogadores: Usuario[];
  enviar: (tipo: string, dados: object) => string | null;
  aoFechar: () => void;
};

/** Painel flutuante do mestre para editar o token selecionado. Cada mudança vai na hora. */
export function PainelDoToken({ token, jogadores, enviar, aoFechar }: Props) {
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
        Tamanho (quadrados)
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
      <label>
        Camada
        <select
          data-testid="token-camada"
          value={token.camada}
          onChange={(e) => editar({ camada: e.target.value as Camada })}
        >
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
      <fieldset>
        <legend>Quem controla</legend>
        {jogadores.map((u) => (
          <label key={u.id} className="linha-opcao">
            <input
              type="checkbox"
              data-testid={`token-controla-${u.id}`}
              checked={token.controladoPor.includes(u.id)}
              onChange={(e) => alternarControle(u.id, e.target.checked)}
            />
            {u.nome}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className="perigo"
        data-testid="token-apagar"
        onClick={() => {
          enviar("token.apagar", { id: token.id });
          aoFechar();
        }}
      >
        <Trash2 size={16} /> Apagar token
      </button>
    </section>
  );
}
