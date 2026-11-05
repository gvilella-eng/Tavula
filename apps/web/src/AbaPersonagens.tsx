import {
  type Estado,
  type Personagem,
  personagemVisivelPara,
  type Usuario,
} from "@tabletop/shared";
import { useEffect, useState } from "react";

type Enviar = (tipo: string, dados: object) => string | null;

/** Campo de texto ou número com rascunho: confirma ao sair (ou Enter) e acompanha a sala. */
function Campo({
  testid,
  rotulo,
  valor,
  tipo = "text",
  min,
  max,
  placeholder,
  aoConfirmar,
}: {
  testid: string;
  rotulo: string;
  /** O valor da sala, em texto (vazio = sem valor). */
  valor: string;
  tipo?: "text" | "number";
  min?: number;
  max?: number;
  placeholder?: string;
  aoConfirmar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  const confirmar = () => {
    if (texto.trim() === valor) return;
    aoConfirmar(texto.trim());
    // Se a sala recusar, o valor dela volta no próximo estado; até lá, mostra o que ela tem.
    setTexto(valor);
  };
  return (
    <label>
      {rotulo}
      <input
        data-testid={testid}
        type={tipo}
        min={min}
        max={max}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
  );
}

function Ficha({ p, editavel, enviar }: { p: Personagem; editavel: boolean; enviar: Enviar }) {
  const alterar = (campo: "pvAtual" | "pvMax", texto: string) => {
    const n = Number(texto);
    if (texto !== "" && Number.isInteger(n) && n >= 0 && n <= 9999) {
      enviar("ficha.alterar", { personagemId: p.id, [campo]: n });
    }
  };
  if (!editavel) {
    return (
      <p data-testid={`pv-${p.id}`}>
        PV {p.ficha.pvAtual} / {p.ficha.pvMax}
      </p>
    );
  }
  return (
    <div className="linha-opcao">
      <Campo
        testid={`pv-atual-${p.id}`}
        rotulo="PV"
        tipo="number"
        min={0}
        max={9999}
        valor={String(p.ficha.pvAtual)}
        aoConfirmar={(t) => alterar("pvAtual", t)}
      />
      <Campo
        testid={`pv-max-${p.id}`}
        rotulo="de"
        tipo="number"
        min={0}
        max={9999}
        valor={String(p.ficha.pvMax)}
        aoConfirmar={(t) => alterar("pvMax", t)}
      />
    </div>
  );
}

type PropsDoMestre = {
  p: Personagem;
  jogadores: Usuario[];
  nomeDaCena: string;
  enviar: Enviar;
  aoColocar: () => void;
};

/** Edição completa de um personagem (só o mestre). Cada mudança vai na hora. */
function CartaoDoMestre({ p, jogadores, nomeDaCena, enviar, aoColocar }: PropsDoMestre) {
  const [apagando, setApagando] = useState(false);
  const editar = (mudancas: object) => enviar("personagem.editar", { id: p.id, mudancas });
  return (
    <li className="cartao-personagem" data-testid={`personagem-${p.id}`} data-personagem-id={p.id}>
      <Campo
        testid={`personagem-nome-${p.id}`}
        rotulo="Nome"
        valor={p.nome}
        aoConfirmar={(t) => t && editar({ nome: t })}
      />
      <label>
        Dono
        <select
          data-testid={`personagem-dono-${p.id}`}
          value={p.donoId ?? ""}
          onChange={(e) => editar({ donoId: e.target.value === "" ? null : e.target.value })}
        >
          <option value="">NPC do mestre</option>
          {jogadores.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cor
        <input
          type="color"
          data-testid={`personagem-cor-${p.id}`}
          value={/^#[0-9a-f]{6}$/i.test(p.tokenPadrao.cor) ? p.tokenPadrao.cor : "#888888"}
          onChange={(e) => editar({ cor: e.target.value })}
        />
      </label>
      <label>
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
      <p className="nota" data-testid={`personagem-imagem-${p.id}`}>
        Imagem do token padrão:{" "}
        {p.tokenPadrao.assetHash ? (
          <>
            {p.tokenPadrao.assetHash.slice(0, 8)}{" "}
            <button type="button" onClick={() => editar({ assetHash: null })}>
              Tirar
            </button>
          </>
        ) : (
          "nenhuma (escolha na Biblioteca)"
        )}
      </p>
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
      <Ficha p={p} editavel enviar={enviar} />
      <div className="linha-botoes">
        <button type="button" data-testid={`personagem-colocar-${p.id}`} onClick={aoColocar}>
          Colocar na cena que estou vendo ({nomeDaCena})
        </button>
        {apagando ? (
          <button
            type="button"
            className="perigo"
            data-testid={`personagem-apagar-confirmar-${p.id}`}
            onClick={() => enviar("personagem.apagar", { id: p.id })}
          >
            Confirmar: apagar personagem e tokens
          </button>
        ) : (
          <button
            type="button"
            className="perigo"
            data-testid={`personagem-apagar-${p.id}`}
            onClick={() => setApagando(true)}
          >
            Apagar
          </button>
        )}
      </div>
    </li>
  );
}

type Props = {
  estado: Estado;
  eu: Usuario;
  /** Nome e id da cena que o mestre está vendo (onde "Colocar" põe o token). */
  cenaVista: { id: string; nome: string };
  enviar: Enviar;
};

/**
 * Aba Personagens. Mestre: cria e edita todos e põe o token na cena que está vendo. Jogador: os
 * dele, com PV editável, e os dos outros jogadores só se a mesa permite (`ficha.verOutras`; o
 * snapshot já vem filtrado).
 */
export function AbaPersonagens({ estado, eu, cenaVista, enviar }: Props) {
  const [novo, setNovo] = useState("");
  const jogadores = estado.usuarios.filter((u) => u.papel === "jogador");

  if (eu.papel !== "mestre") {
    const visiveis = estado.personagens.filter((p) =>
      personagemVisivelPara(p, eu, estado.permissoes),
    );
    const meus = visiveis.filter((p) => p.donoId === eu.id);
    const outros = visiveis.filter((p) => p.donoId !== eu.id);
    return (
      <div data-testid="aba-personagens-conteudo">
        {meus.length === 0 && <p className="nota">Você ainda não tem personagem.</p>}
        <ul className="lista-simples">
          {meus.map((p) => (
            <li key={p.id} className="cartao-personagem" data-testid={`personagem-${p.id}`}>
              <strong>{p.nome}</strong>
              <Ficha p={p} editavel enviar={enviar} />
            </li>
          ))}
        </ul>
        {outros.length > 0 && (
          <>
            <h3>Outros personagens</h3>
            <ul className="lista-simples">
              {outros.map((p) => (
                <li key={p.id} className="cartao-personagem" data-testid={`personagem-${p.id}`}>
                  <strong>{p.nome}</strong>
                  <Ficha p={p} editavel={false} enviar={enviar} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  function criar() {
    const nome = novo.trim();
    if (!nome) return;
    enviar("personagem.criar", {
      personagem: {
        id: `pers-${crypto.randomUUID().slice(0, 8)}`,
        donoId: null,
        nome,
        tokenPadrao: { cor: "#3cb44b", tamanhoQuadrados: 1 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha: { pvAtual: 10, pvMax: 10 },
      },
    });
    setNovo("");
  }

  return (
    <div data-testid="aba-personagens-conteudo">
      <ul className="lista-simples">
        {estado.personagens.map((p) => (
          <CartaoDoMestre
            key={p.id}
            p={p}
            jogadores={jogadores}
            nomeDaCena={cenaVista.nome}
            enviar={enviar}
            aoColocar={() =>
              enviar("personagem.colocar", {
                personagemId: p.id,
                cenaId: cenaVista.id,
                tokenId: `tok-${crypto.randomUUID().slice(0, 8)}`,
              })
            }
          />
        ))}
      </ul>
      <div className="linha-botoes">
        <input
          aria-label="Nome do novo personagem"
          data-testid="personagem-novo-nome"
          placeholder="Nome do novo personagem"
          value={novo}
          maxLength={64}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criar()}
        />
        <button type="button" data-testid="personagem-novo" onClick={criar}>
          Criar personagem
        </button>
      </div>
    </div>
  );
}
