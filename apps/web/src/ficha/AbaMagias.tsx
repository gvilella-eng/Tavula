import {
  ATRIBUTOS,
  type Atributo,
  formatarBonus,
  ROTULO_DO_ATRIBUTO,
  SIGLA_DO_ATRIBUTO,
} from "@tabletop/shared";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { type PropsDaAba, um } from "./AbaPrincipal";
import { BotaoNovoCirculo, CirculoDeMagias, Espacos } from "./CirculoDeMagias";
import { ParteInata } from "./ConjuracaoInata";
import { CampoTexto } from "./campos";
import { EditorDeAtaque } from "./EditorDeAtaque";
import { Caixa, Secao } from "./livro";
import { useEntradaEmArrasto } from "./ordem";
import { secao } from "./secoes";

// Q9: o círculo de magias e a linha da magia moravam aqui; agora vêm de `CirculoDeMagias`, o mesmo componente que a
// seção Conjuração do NPC usa. Quem importava `Espacos` e `subDaMagia` daqui continua achando.
export { Espacos, subDaMagia } from "./CirculoDeMagias";

const TODOS_OS_NIVEIS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Atributo de conjuração, CD e ataque da classe: as três caixas do alto da aba. */
function ConjuracaoBruta({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  const c = d.conjuradoras[0];
  const seletor = (classe: string, valor: string) => (
    <select
      className="fl-fld fl-seletor"
      data-testid={`conjuracao-habilidade-${classe}`}
      aria-label={`Habilidade de conjuração de ${classe}`}
      value={valor}
      disabled={!editar}
      onChange={(e) => {
        const outras = (ficha.conjuracao ?? []).filter((x) => x.classe !== classe);
        alterar(um("conjuracao", [...outras, { classe, habilidade: e.target.value }]));
      }}
    >
      {ATRIBUTOS.map((a) => (
        <option key={a} value={a}>
          {ROTULO_DO_ATRIBUTO[a]}
        </option>
      ))}
    </select>
  );
  if (!c) {
    // V4a3: sem classe conjuradora, a pessoa escolhe o atributo e a CD e o ataque saem dele.
    const livre = d.conjuracaoSemClasse;
    return (
      <div
        className="fl-conj-caixas"
        data-testid={livre ? "fh-conjuracao-livre" : "fh-conjuracao-vazia"}
      >
        <Caixa className="fl-conj-caixa">
          <select
            className="fl-fld fl-seletor"
            data-testid="conjuracao-habilidade-livre"
            aria-label="Atributo de conjuração"
            value={ficha.habilidadeDeConjuracao ?? ""}
            disabled={!editar}
            onChange={(e) =>
              alterar(
                um(
                  "habilidadeDeConjuracao",
                  e.target.value === "" ? null : (e.target.value as Atributo),
                ),
              )
            }
          >
            <option value="">—</option>
            {ATRIBUTOS.map((a) => (
              <option key={a} value={a}>
                {ROTULO_DO_ATRIBUTO[a]}
              </option>
            ))}
          </select>
          <span className="fl-lbl">Atributo</span>
        </Caixa>
        <Caixa className="fl-conj-caixa">
          <strong className="fl-fa fl-conj-valor" data-testid="conjuracao-cd-livre">
            {livre ? livre.cd : "—"}
          </strong>
          <span className="fl-lbl">CD das magias</span>
        </Caixa>
        <Caixa className="fl-conj-caixa fl-conj-rola">
          {livre ? (
            <button
              type="button"
              className="fl-rl fl-conj-botao"
              data-testid="conjuracao-ataque-livre"
              disabled={!rolador.podeRolar}
              title={rolador.podeRolar ? undefined : "Só quem edita a ficha rola"}
              aria-label="Rolar o ataque de magia"
              onClick={() => rolador.teste("Ataque de magia", livre.ataque)}
            >
              <span className="fl-fa fl-rn fl-conj-valor">{formatarBonus(livre.ataque)}</span>
            </button>
          ) : (
            <span className="fl-fa fl-conj-valor">—</span>
          )}
          <span className="fl-lbl">Ataque de magia</span>
        </Caixa>
      </div>
    );
  }
  return (
    <div className="fl-conj-caixas">
      <Caixa className="fl-conj-caixa">
        {seletor(c.classe, c.habilidade)}
        <span className="fl-lbl">Atributo</span>
      </Caixa>
      <Caixa className="fl-conj-caixa">
        <strong className="fl-fa fl-conj-valor" data-testid={`conjuracao-cd-${c.classe}`}>
          {c.cd}
        </strong>
        <span className="fl-lbl">CD das magias</span>
      </Caixa>
      <Caixa className="fl-conj-caixa fl-conj-rola">
        <button
          type="button"
          className="fl-rl fl-conj-botao"
          data-testid={`conjuracao-ataque-${c.classe}`}
          disabled={!rolador.podeRolar}
          title={rolador.podeRolar ? undefined : "Só quem edita a ficha rola"}
          aria-label={`Rolar o ataque de magia de ${c.classe}`}
          onClick={() => rolador.teste(`Ataque de magia (${c.classe})`, c.ataque)}
        >
          <span className="fl-fa fl-rn fl-conj-valor">{formatarBonus(c.ataque)}</span>
        </button>
        <span className="fl-lbl">Ataque de magia</span>
      </Caixa>
    </div>
  );
}

/** As outras classes que conjuram: uma linha para cada, com os mesmos números. */
function OutrasConjuradorasBruta({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  const outras = d.conjuradoras.slice(1);
  if (outras.length === 0) return null;
  return (
    <ul className="fl-outras-conjuradoras" data-testid="fh-conjuracao">
      {outras.map((c) => (
        <li key={c.classe} data-testid={`conjuradora-${c.classe}`}>
          <strong>{c.classe}</strong>
          <select
            className="fl-fld fl-seletor"
            data-testid={`conjuracao-habilidade-${c.classe}`}
            aria-label={`Habilidade de conjuração de ${c.classe}`}
            value={c.habilidade}
            disabled={!editar}
            onChange={(e) => {
              const restante = (ficha.conjuracao ?? []).filter((x) => x.classe !== c.classe);
              alterar(
                um("conjuracao", [...restante, { classe: c.classe, habilidade: e.target.value }]),
              );
            }}
          >
            {ATRIBUTOS.map((a) => (
              <option key={a} value={a}>
                {SIGLA_DO_ATRIBUTO[a]}
              </option>
            ))}
          </select>
          <span>
            CD <strong data-testid={`conjuracao-cd-${c.classe}`}>{c.cd}</strong>
          </span>
          <button
            type="button"
            className="fl-rl fl-teste"
            data-testid={`conjuracao-ataque-${c.classe}`}
            disabled={!rolador.podeRolar}
            aria-label={`Rolar o ataque de magia de ${c.classe}`}
            onClick={() => rolador.teste(`Ataque de magia (${c.classe})`, c.ataque)}
          >
            {formatarBonus(c.ataque)}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** O campo "Classe de conjurador" e o "Recuperar espaços", logo abaixo das caixas do alto. */
function BarraDoConjuradorBruta({ ficha, d, alterar, editar }: PropsDaAba) {
  return (
    <div className="fl-mag-barra">
      <CampoTexto
        testid="ficha-classe-conjurador"
        rotulo="Classe de conjurador"
        placeholder="Classe de conjurador"
        valor={ficha.classeConjurador ?? d.conjuradoras[0]?.classe ?? ""}
        maxLength={48}
        desabilitado={!editar}
        className="fl-in fl-ln fl-classe-conj"
        aoMudar={(t) => alterar(um("classeConjurador", t === "" ? null : t))}
      />
      {editar && (
        <button
          type="button"
          className="fl-sec2"
          data-testid="recuperar-espacos"
          onClick={() => alterar(um("espacosGastos", null))}
        >
          <RotateCcw size={15} aria-hidden /> Recuperar espaços
        </button>
      )}
    </div>
  );
}

/** Os espaços de pacto do Bruxo. */
function EspacosDoPactoBruta({ d, alterar, editar }: PropsDaAba) {
  if (!d.pacto) return null;
  return (
    <Caixa testid="espacos-pacto" className="fl-nivel">
      <div className="fl-nivel-cab">
        <Secao className="fl-nivel-titulo">Pacto ({d.pacto.nivel}º nível)</Secao>
        <Espacos
          prefixo="pacto"
          total={d.pacto.quantidade}
          gastos={d.pacto.gastos}
          editar={editar}
          rotuloDoNivel="pacto"
          aoMudar={(g) => alterar(um("pactoGasto", g === 0 ? null : g))}
        />
        <span className="fl-fa fl-nivel-resumo" data-testid="espacos-resumo-pacto">
          {d.pacto.restantes}/{d.pacto.quantidade}
        </span>
      </div>
    </Caixa>
  );
}

// Q15: cada bloco da aba é uma seção em `memo` (ver `secoes.tsx`); os círculos e as linhas de magia, em `CirculoDeMagias`.
const Conjuracao = secao("Conjuracao", ConjuracaoBruta, {
  ficha: ["conjuracao", "habilidadeDeConjuracao"],
  d: ["conjuradoras", "conjuracaoSemClasse"],
});
const OutrasConjuradoras = secao("OutrasConjuradoras", OutrasConjuradorasBruta, {
  ficha: ["conjuracao"],
  d: ["conjuradoras"],
});
const BarraDoConjurador = secao("BarraDoConjurador", BarraDoConjuradorBruta, {
  ficha: ["classeConjurador"],
  d: ["conjuradoras"],
});
const EspacosDoPacto = secao("EspacosDoPacto", EspacosDoPactoBruta, { ficha: [], d: ["pacto"] });

/** Aba Magias: atributo, CD e ataque, os espaços por nível e as magias de cada nível. */
export function AbaMagias(props: PropsDaAba) {
  const { ficha, d, editar, editorAberto, fecharEditor, estreita } = props;
  const temMagiaNoNivel = (n: number) =>
    (ficha.magias ?? []).some((m) => m.nivel === n && !m.inata);
  // Arrastando uma magia do compêndio, o círculo dela aparece mesmo vazio, para ela ter onde cair.
  const emArrasto = useEntradaEmArrasto();
  const circuloEmArrasto = editar && emArrasto?.tipo === "magia" ? emArrasto.magia.nivel : null;
  // V4a3: o "+ Círculo" mostra um círculo vazio para preencher o total antes das magias.
  const [extras, setExtras] = useState<number[]>([]);
  const visiveis = TODOS_OS_NIVEIS.filter(
    (n) =>
      n <= 1 ||
      n === circuloEmArrasto ||
      temMagiaNoNivel(n) ||
      extras.includes(n) ||
      (d.espacos.find((e) => e.nivel === n)?.total ?? 0) > 0,
  );
  const proximoOculto = TODOS_OS_NIVEIS.find((n) => n > 1 && !visiveis.includes(n));
  const metade = Math.ceil(visiveis.length / 2);
  const esquerda = estreita ? visiveis : visiveis.slice(0, metade);
  const direita = estreita ? [] : visiveis.slice(metade);
  if (editorAberto && estreita) {
    return (
      <div className="fl-magias" data-testid="fh-aba-magias">
        <EditorDeAtaque alvo={editorAberto} origem="magias" props={props} aoVoltar={fecharEditor} />
      </div>
    );
  }
  return (
    <div className="fl-magias" data-testid="fh-aba-magias">
      <div className="fl-mag-col">
        <Conjuracao {...props} />
        <OutrasConjuradoras {...props} />
        {d.conjuradoras.length === 0 && !d.conjuracaoSemClasse && (
          <p className="fl-dica" data-testid="sem-conjuracao">
            Sem classe: escolha o atributo de conjuração.
          </p>
        )}
        <BarraDoConjurador {...props} />
        <EspacosDoPacto {...props} />
        {esquerda.map((n) => (
          <CirculoDeMagias
            key={n}
            n={n}
            props={props}
            variante="personagem"
            titulo={n === 0 ? "Truques" : `${n}º nível`}
          />
        ))}
        <ParteInata props={props} editorEmLinha={false} />
        {estreita && editar && proximoOculto !== undefined && (
          <BotaoNovoCirculo aoClicar={() => setExtras([...extras, proximoOculto])} />
        )}
      </div>
      {!estreita && (
        <div className="fl-mag-col">
          {editorAberto ? (
            <EditorDeAtaque
              alvo={editorAberto}
              origem="magias"
              props={props}
              aoVoltar={fecharEditor}
            />
          ) : (
            <>
              {direita.map((n) => (
                <CirculoDeMagias
                  key={n}
                  n={n}
                  props={props}
                  variante="personagem"
                  titulo={n === 0 ? "Truques" : `${n}º nível`}
                />
              ))}
              {editar && proximoOculto !== undefined && (
                <BotaoNovoCirculo aoClicar={() => setExtras([...extras, proximoOculto])} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
