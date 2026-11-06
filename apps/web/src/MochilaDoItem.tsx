import {
  type Estado,
  formatarRestante,
  type ObjetoDeLuz,
  type Personagem,
  podeEditarPersonagem,
  type Usuario,
} from "@tabletop/shared";
import { Backpack, Flame, Minus, Plus } from "lucide-react";
import { type TempoDaTela, useTic } from "./tempo";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  personagem: Personagem;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  tempo: TempoDaTela;
};

/** O objeto é deste personagem (na mão ou guardado)? */
function doPersonagem(l: ObjetoDeLuz, personagemId: string): boolean {
  return (
    (l.portador.tipo === "mao" || l.portador.tipo === "mochila") &&
    l.portador.personagemId === personagemId
  );
}

/**
 * Mochila mínima do item (Lote 7; a ficha do Lote 9 absorve): para cada modelo de objeto que ocupa a
 * mão, "Tocha: 4 novas, 1 usada", com Acender (nova ou usada) e, para o mestre, + e − na quantidade.
 * Acender põe o objeto numa mão livre do token do personagem.
 */
export function MochilaDoItem({ personagem: p, estado, eu, enviar, tempo }: Props) {
  const euMestre = eu.papel === "mestre";
  const podeMexer = euMestre || podeEditarPersonagem(p, eu);
  const usadasDoPersonagem = estado.luzes.filter((l) => doPersonagem(l, p.id));
  const modelos = estado.modelos.filter(
    (m) =>
      m.ocupaMao &&
      (euMestre ||
        (p.mochila?.[m.id] ?? 0) > 0 ||
        usadasDoPersonagem.some((l) => l.modeloId === m.id)),
  );
  useTic(usadasDoPersonagem.some((l) => l.contando === true));

  if (modelos.length === 0 && !euMestre) return null;
  return (
    <fieldset className="mochila" data-testid="mochila" disabled={!podeMexer && !euMestre}>
      <legend>
        <Backpack size={14} /> Mochila
      </legend>
      {modelos.length === 0 && <p className="nota">Nenhum modelo de objeto de luz na campanha.</p>}
      {modelos.map((m) => {
        const novas = p.mochila?.[m.id] ?? 0;
        const usadas = usadasDoPersonagem.filter((l) => l.modeloId === m.id);
        return (
          <div key={m.id} className="mochila-modelo" data-testid={`mochila-${m.id}`}>
            <div className="mochila-linha">
              <strong>{m.nome}</strong>
              <span data-testid={`mochila-resumo-${m.id}`}>
                {novas} {novas === 1 ? "nova" : "novas"}, {usadas.length}{" "}
                {usadas.length === 1 ? "usada" : "usadas"}
              </span>
              <span className="mochila-quantidade">
                <button
                  type="button"
                  data-testid={`mochila-acender-${m.id}`}
                  disabled={!podeMexer || novas <= 0}
                  title={
                    novas <= 0 ? "Sem unidade nova (use uma usada abaixo)" : "Acender uma nova"
                  }
                  onClick={() =>
                    enviar("tocha.acender", {
                      personagemId: p.id,
                      modeloId: m.id,
                      novoId: `obj-${crypto.randomUUID().slice(0, 8)}`,
                    })
                  }
                >
                  <Flame size={14} /> Acender
                </button>
                {euMestre && (
                  <>
                    <button
                      type="button"
                      className="botao-icone pequeno"
                      aria-label={`Tirar uma ${m.nome} da mochila`}
                      data-testid={`mochila-menos-${m.id}`}
                      disabled={novas <= 0}
                      onClick={() =>
                        enviar("mochila.ajustar", { personagemId: p.id, modeloId: m.id, delta: -1 })
                      }
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      type="button"
                      className="botao-icone pequeno"
                      aria-label={`Pôr mais uma ${m.nome} na mochila`}
                      data-testid={`mochila-mais-${m.id}`}
                      onClick={() =>
                        enviar("mochila.ajustar", { personagemId: p.id, modeloId: m.id, delta: 1 })
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </>
                )}
              </span>
            </div>
            {usadas.map((l) => {
              const naMao = l.portador.tipo === "mao";
              const restante = tempo.restanteDe(l.id);
              return (
                <div key={l.id} className="mochila-usada" data-testid={`mochila-usada-${l.id}`}>
                  <span>
                    Usada ·{" "}
                    {restante !== undefined
                      ? formatarRestante(restante)
                      : (l.estagio ?? "sem tempo visível")}{" "}
                    ·{" "}
                    {naMao
                      ? l.estado === "acesa"
                        ? "na mão, acesa"
                        : "na mão, apagada"
                      : "guardada"}
                  </span>
                  {naMao ? (
                    <>
                      <button
                        type="button"
                        data-testid={`mochila-alternar-${l.id}`}
                        disabled={!podeMexer}
                        onClick={() => enviar("tocha.alternar", { id: l.id })}
                      >
                        {l.estado === "acesa" ? "Apagar" : "Reacender"}
                      </button>
                      <button
                        type="button"
                        data-testid={`mochila-guardar-${l.id}`}
                        disabled={!podeMexer}
                        onClick={() => enviar("tocha.guardar", { id: l.id })}
                      >
                        Guardar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      data-testid={`mochila-acender-usada-${l.id}`}
                      disabled={!podeMexer}
                      onClick={() =>
                        enviar("tocha.acender", {
                          personagemId: p.id,
                          modeloId: m.id,
                          objetoId: l.id,
                        })
                      }
                    >
                      <Flame size={14} /> Acender
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </fieldset>
  );
}
