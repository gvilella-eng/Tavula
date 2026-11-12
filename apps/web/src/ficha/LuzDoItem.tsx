import {
  type Estado,
  formatarRestante,
  maoLivre,
  modeloDoItem,
  novasDoModelo,
  type ObjetoDeLuz,
  type Personagem,
  podeEditarPersonagem,
  type Usuario,
} from "@tabletop/shared";
import { Flame } from "lucide-react";
import { BotaoComDica } from "../BotaoComDica";
import { type TempoDaTela, useTic } from "../tempo";

type Enviar = (tipo: string, dados: object) => string | null;

/** O que a linha do equipamento precisa saber da mesa para acender e apagar (V4a2). */
export type LuzDaFicha = {
  estado: Estado;
  eu: Usuario;
  personagem: Personagem;
  tempo: TempoDaTela;
};

/** O objeto de luz é deste personagem (na mão ou guardado)? */
const doPersonagem = (l: ObjetoDeLuz, personagemId: string) =>
  (l.portador.tipo === "mao" || l.portador.tipo === "mochila") &&
  l.portador.personagemId === personagemId;

/** O modelo (de objeto de luz da mesa) de um item da ficha, ou `undefined` se for item comum. */
export function modeloDaLinha(
  luz: LuzDaFicha | undefined,
  item: { nome: string; modeloId?: string | undefined },
): string | undefined {
  return luz ? modeloDoItem(item, luz.estado.modelos) : undefined;
}

/** Os objetos usados do personagem de um modelo (para o tic do relógio e as sublinhas). */
export function usadasDoModelo(luz: LuzDaFicha, modeloId: string): ObjetoDeLuz[] {
  return luz.estado.luzes.filter(
    (l) => l.modeloId === modeloId && doPersonagem(l, luz.personagem.id),
  );
}

/** Faz o relógio da tela andar enquanto houver objeto contando. */
export function useTicDasLuzes(luz: LuzDaFicha | undefined) {
  const contando =
    luz?.estado.luzes.some((l) => doPersonagem(l, luz.personagem.id) && l.contando === true) ??
    false;
  useTic(contando);
}

/** O botão Acender da linha do item (gasta uma unidade nova e põe numa mão livre do token). */
export function BotaoAcender({
  luz,
  modeloId,
  enviar,
  indice,
}: {
  luz: LuzDaFicha;
  modeloId: string;
  enviar: Enviar;
  indice: number;
}) {
  const { estado, eu, personagem: p } = luz;
  const podeMexer = eu.papel === "mestre" || podeEditarPersonagem(p, eu);
  const novas = novasDoModelo(p.ficha, modeloId, estado.modelos);
  const temToken = estado.tokens.some(
    (t) => t.personagemId === p.id && t.cenaId === estado.cenaAtivaId,
  );
  const semMao = maoLivre(estado.luzes, p.id, estado.config.maosPorPersonagem) === undefined;
  const segura = estado.modelos.find((m) => m.id === modeloId)?.ocupaMao === true;
  const motivo = !podeMexer
    ? "Só quem edita a ficha acende"
    : !segura
      ? "Este objeto não se segura na mão"
      : novas <= 0
        ? "Sem unidade nova"
        : !temToken
          ? "Sem token deste personagem na cena"
          : semMao
            ? "As mãos estão ocupadas"
            : null;
  return (
    <BotaoComDica
      type="button"
      className="fl-pill fl-acender"
      testid={`item-acender-${indice}`}
      nomeVisivel
      motivo={motivo}
      onClick={() =>
        enviar("tocha.acender", {
          personagemId: p.id,
          modeloId,
          novoId: `obj-${crypto.randomUUID().slice(0, 8)}`,
        })
      }
    >
      <Flame size={14} aria-hidden /> Acender
    </BotaoComDica>
  );
}

/** As sublinhas "em uso", "apagada" e "guardada" de um modelo, logo abaixo da linha do item. */
export function SublinhasDeLuz({
  luz,
  modeloId,
  enviar,
}: {
  luz: LuzDaFicha;
  modeloId: string;
  enviar: Enviar;
}) {
  const { estado, eu, personagem: p, tempo } = luz;
  const podeMexer = eu.papel === "mestre" || podeEditarPersonagem(p, eu);
  const semMao = maoLivre(estado.luzes, p.id, estado.config.maosPorPersonagem) === undefined;
  const usadas = usadasDoModelo(luz, modeloId);
  const nomeDoModelo = estado.modelos.find((m) => m.id === modeloId)?.nome ?? "Objeto";
  return (
    <>
      {usadas.map((l) => {
        const naMao = l.portador.tipo === "mao";
        const acesa = naMao && l.estado === "acesa";
        const restante = tempo.restanteDe(l.id);
        const relogio =
          restante !== undefined ? formatarRestante(restante) : (l.estagio ?? undefined);
        const rotulo = acesa ? "em uso" : naMao ? "apagada" : "guardada";
        return (
          <div
            key={l.id}
            className="fl-item fl-item-luz"
            data-testid={`item-usada-${l.id}`}
            data-estado={rotulo}
          >
            <div className="fl-item-linha">
              <span className="fl-item-recuo" aria-hidden />
              {acesa ? (
                <Flame size={14} className="fl-chama" aria-hidden />
              ) : (
                <span className="fl-chama-vazia" />
              )}
              <span className="fl-item-luz-texto" data-testid={`item-usada-texto-${l.id}`}>
                {nomeDoModelo} · {rotulo}
                {relogio ? ` · ${relogio}` : ""}
              </span>
              {naMao ? (
                <>
                  <button
                    type="button"
                    className="fl-pill"
                    data-testid={`item-alternar-${l.id}`}
                    disabled={!podeMexer}
                    onClick={() => enviar("tocha.alternar", { id: l.id })}
                  >
                    {acesa ? "Apagar" : "Reacender"}
                  </button>
                  <button
                    type="button"
                    className="fl-pill"
                    data-testid={`item-guardar-${l.id}`}
                    disabled={!podeMexer}
                    onClick={() => enviar("tocha.guardar", { id: l.id })}
                  >
                    Guardar
                  </button>
                </>
              ) : (
                <BotaoComDica
                  type="button"
                  className="fl-pill"
                  testid={`item-acender-usada-${l.id}`}
                  nomeVisivel
                  motivo={
                    !podeMexer
                      ? "Só quem edita a ficha acende"
                      : semMao
                        ? "As mãos estão ocupadas"
                        : null
                  }
                  onClick={() =>
                    enviar("tocha.acender", { personagemId: p.id, modeloId, objetoId: l.id })
                  }
                >
                  <Flame size={14} aria-hidden /> Acender
                </BotaoComDica>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
