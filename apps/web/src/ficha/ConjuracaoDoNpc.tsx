import { ATRIBUTOS, type Atributo, formatarBonus, ROTULO_DO_ATRIBUTO } from "@tabletop/shared";
import { Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { type PropsDaAba, um } from "./AbaPrincipal";
import { BotaoNovoCirculo, CirculoDeMagias } from "./CirculoDeMagias";
import { ParteInata } from "./ConjuracaoInata";
import { TituloDoBloco as Titulo } from "./livro";
import { useEntradaEmArrasto } from "./ordem";

// ---------------------------------------------------------------------------------------------
// A seção Conjuração do bloco de monstro (V4b2). Os dados são os da ficha de personagem (`magias`, os espaços por
// círculo e `habilidadeDeConjuracao`), então trocar a apresentação Personagem ↔ NPC mantém tudo. No Q9 os círculos são
// os mesmos da aba Magias do personagem (`CirculoDeMagias`): espaços totais e restantes, uma linha por magia com
// Conjurar, chat e engrenagem, "+ Círculo", reordenar e soltar do compêndio. Fica só do NPC: o atributo, a CD e o
// ataque pelo ND, a conjuração inata e a ausência do "Prep.".
// ---------------------------------------------------------------------------------------------

const NIVEIS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const nomeDoNivel = (n: number) => (n === 0 ? "Truques (à vontade)" : `${n}º nível`);

/** O cabeçalho da seção: o atributo de conjuração, a CD e o ataque de magia (com o bônus de proficiência do ND). */
function CabecalhoDaConjuracao({ props }: { props: PropsDaAba }) {
  const { ficha, d, alterar, editar, rolador } = props;
  const c = d.conjuradoras[0];
  const livre = d.conjuracaoSemClasse;
  const habilidade = c?.habilidade ?? ficha.habilidadeDeConjuracao ?? "";
  const cd = c?.cd ?? livre?.cd;
  const ataque = c?.ataque ?? livre?.ataque;
  return (
    <div className="npc-conj-cab" data-testid="npc-conj-cab">
      <label className="npc-conj-attr">
        <span className="npc-rot">Atributo</span>
        <select
          className="npc-sel"
          data-testid="npc-conj-habilidade"
          aria-label="Atributo de conjuração"
          value={habilidade}
          disabled={!editar}
          onChange={(e) => {
            if (c) {
              const outras = (ficha.conjuracao ?? []).filter((x) => x.classe !== c.classe);
              alterar(
                um("conjuracao", [...outras, { classe: c.classe, habilidade: e.target.value }]),
              );
            } else {
              alterar(
                um(
                  "habilidadeDeConjuracao",
                  e.target.value === "" ? null : (e.target.value as Atributo),
                ),
              );
            }
          }}
        >
          <option value="">—</option>
          {ATRIBUTOS.map((a) => (
            <option key={a} value={a}>
              {ROTULO_DO_ATRIBUTO[a]}
            </option>
          ))}
        </select>
      </label>
      <span className="npc-conj-num">
        <span className="npc-rot">CD</span>
        <strong className="fl-fa" data-testid="npc-conj-cd">
          {cd ?? "—"}
        </strong>
      </span>
      <span className="npc-conj-num">
        <span className="npc-rot">Ataque de magia</span>
        {ataque === undefined ? (
          <strong className="fl-fa">—</strong>
        ) : (
          <button
            type="button"
            className="npc-acerto npc-conj-ataque"
            data-testid="npc-conj-ataque"
            disabled={!rolador.podeRolar}
            aria-label={`Rolar o ataque de magia, ${formatarBonus(ataque)}`}
            onClick={() => rolador.teste("Ataque de magia", ataque)}
          >
            {formatarBonus(ataque)}
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * A seção Conjuração entre Traços e Ações. Existe enquanto a ficha tem magias (ou atributo ou espaços escolhidos);
 * quem edita vê um "+ Conjuração" discreto para criá-la. Cada círculo recebe a magia arrastada do compêndio.
 */
export function SecaoDeConjuracao({ props }: { props: PropsDaAba }) {
  const { ficha, d, alterar, editar } = props;
  const magias = ficha.magias ?? [];
  const [extras, setExtras] = useState<number[]>([]);
  const emArrasto = useEntradaEmArrasto();
  const circuloEmArrasto = editar && emArrasto?.tipo === "magia" ? emArrasto.magia.nivel : null;
  const existe =
    magias.length > 0 ||
    ficha.habilidadeDeConjuracao !== undefined ||
    ficha.espacosTotal !== undefined ||
    d.conjuradoras.length > 0;
  if (!existe && circuloEmArrasto === null) {
    if (!editar) return null;
    return (
      <div className="npc-novas" data-testid="npc-nova-conjuracao-bloco">
        <button
          type="button"
          className="npc-novo"
          data-testid="npc-nova-conjuracao"
          onClick={() => {
            // O atributo mental mais alto: a seção passa a existir e a CD sai dele.
            const mod = (a: Atributo) => ficha.atributos?.[a] ?? 10;
            const melhor = (["int", "sab", "car"] as const).reduce((m, a) =>
              mod(a) > mod(m) ? a : m,
            );
            alterar(um("habilidadeDeConjuracao", melhor));
          }}
        >
          <Plus size={13} aria-hidden /> Conjuração
        </button>
      </div>
    );
  }
  const visivel = (n: number) =>
    (n === 0 && editar) ||
    magias.some((m) => m.nivel === n && !m.inata) ||
    (d.espacos.find((e) => e.nivel === n)?.total ?? 0) > 0 ||
    extras.includes(n) ||
    circuloEmArrasto === n;
  const niveis = NIVEIS.filter(visivel);
  const proximoOculto = NIVEIS.find((n) => n > 0 && !niveis.includes(n));
  return (
    <div className="npc-secao" data-testid="npc-secao-conjuracao">
      <Titulo testid="npc-titulo-conjuracao">Conjuração</Titulo>
      <CabecalhoDaConjuracao props={props} />
      {editar && (
        <div className="fl-mag-barra">
          <button
            type="button"
            className="fl-sec2"
            data-testid="npc-recuperar-espacos"
            onClick={() => alterar(um("espacosGastos", null))}
          >
            <RotateCcw size={15} aria-hidden /> Recuperar espaços
          </button>
        </div>
      )}
      <div className="npc-conj-circulos">
        {niveis.map((n) => (
          <CirculoDeMagias key={n} n={n} props={props} variante="npc" titulo={nomeDoNivel(n)} />
        ))}
      </div>
      <ParteInata props={props} />
      {editar && proximoOculto !== undefined && (
        <BotaoNovoCirculo
          testid="npc-conj-mais-circulo"
          aoClicar={() => setExtras([...extras, proximoOculto])}
        />
      )}
    </div>
  );
}
