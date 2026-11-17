import {
  ATRIBUTOS,
  type Ataque,
  bonusDeAcerto,
  bonusDeProficiencia,
  CATEGORIAS_DE_ACAO,
  type CategoriaDeAcao,
  cdDaRolagem,
  expressaoDeDano,
  formatarBonus,
  moverNoGrupo,
  NIVEIS_DE_DESAFIO,
  PERICIAS,
  posicoesDoGrupo,
  previaDoAtaque,
  ROTULO_DO_ATRIBUTO,
  SIGLA_DO_ATRIBUTO,
  TIPOS_DE_ACAO,
  type TipoDeAcao,
  xpDoND,
} from "@tabletop/shared";
import { ChevronRight, Dices, GripVertical, MessageSquare, Plus, Settings, X } from "lucide-react";
import { type HTMLAttributes, type KeyboardEvent, type ReactNode, useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { BarraDePv, CampoDeCa, ControlesDePv, type PropsDaAba, um } from "./AbaPrincipal";
import { SecaoDeConjuracao } from "./ConjuracaoDoNpc";
import { CampoDecimal, CampoNumero, CampoTexto } from "./campos";
import { EditorDeAtaque } from "./EditorDeAtaque";
import { ListaDeCaracteristicas } from "./ListaDeTitulos";
import { TituloDoBloco as Titulo } from "./livro";
import { NomeComCapitular } from "./NomeComCapitular";
import { indicadorDoVao, useOrdemDaLista, useSoltarDoCompendio } from "./ordem";
import { soltarNaFicha } from "./soltar";

// ---------------------------------------------------------------------------------------------
// O bloco de monstro (V4b), no desenho N (docs/desenho/NpcN.dc.html): estandarte com o nome, CA, PV e deslocamento,
// os seis atributos, as linhas de sentidos e afins, Traços, Ações, Reações e Ações lendárias. Tudo sai da mesma ficha
// do personagem: os traços são `caracteristicas`, as ações são `ataques` com `categoria`, e os números (acerto, dano,
// salvaguardas) saem das mesmas contas, com o bônus de proficiência do ND.
// ---------------------------------------------------------------------------------------------

const TAMANHOS = ["Miúdo", "Pequeno", "Médio", "Grande", "Enorme", "Imenso"] as const;

const ROTULO_DO_TIPO_DE_ACAO: Record<TipoDeAcao, string> = {
  cac: "Corpo a corpo",
  dist: "À distância",
  cacdist: "Corpo a corpo ou à distância",
  magia: "Magia",
  esp: "Especial",
};

const ROTULO_DA_CATEGORIA: Record<CategoriaDeAcao, string> = {
  acao: "Ação",
  reacao: "Reação",
  lendaria: "Ação lendária",
};

const TITULO_DA_SECAO: Record<CategoriaDeAcao, string> = {
  acao: "Ações",
  reacao: "Reações",
  lendaria: "Ações lendárias",
};

const categoriaDe = (a: Ataque): CategoriaDeAcao => a.categoria ?? "acao";

/** O texto da ação quando ninguém escreveu um: monta dos campos (acerto, alcance, dano e CD). */
function textoDaAcao(props: PropsDaAba, a: Ataque): string {
  const previa = previaDoAtaque(props.ficha, a);
  const tipo = a.tipoDeAcao ? ROTULO_DO_TIPO_DE_ACAO[a.tipoDeAcao] : "";
  const cabeca = [tipo, previa.acerto, a.alcance ? `alcance ${a.alcance}` : "", previa.salvaguarda]
    .filter(Boolean)
    .join(", ");
  const dano = previa.dano ? `Dano: ${previa.dano}.` : "";
  return [cabeca ? `${cabeca}.` : "", dano].filter(Boolean).join(" ") || "Sem texto.";
}

/** Uma linha de rótulo e conteúdo (Sentidos, Idiomas, Desafio...). */
function Linha({
  rotulo,
  children,
  testid,
}: {
  rotulo: string;
  children: ReactNode;
  testid?: string;
}) {
  return (
    <div className="npc-linha" data-testid={testid}>
      <span className="npc-rot">{rotulo}</span>
      <div className="npc-linha-corpo">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Cabeçalho: nome, CA, PV e deslocamento
// ---------------------------------------------------------------------------------------------

function Cabecalho(props: PropsDoNpc) {
  const { ficha, alterar, editar, personagemId, nomeDoPersonagem, aoMudarNome } = props;
  const npc = ficha.npc ?? {};
  const texto = (campo: keyof NonNullable<typeof ficha.npc>) => (t: string) =>
    alterar(um(`npc.${campo}`, t === "" ? null : t));
  return (
    <>
      <div className="npc-estandarte">
        <NomeComCapitular
          variante="monstro"
          rotulo="Nome do monstro"
          nome={nomeDoPersonagem}
          podeEditar={editar}
          aoMudar={aoMudarNome}
          capitular
          filhos={
            <div className="npc-identidade">
              <select
                className="npc-sel"
                data-testid="npc-tamanho"
                aria-label="Tamanho"
                value={npc.tamanho ?? ""}
                disabled={!editar}
                onChange={(e) => texto("tamanho")(e.target.value)}
              >
                <option value="">Tamanho</option>
                {TAMANHOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <CampoTexto
                testid="npc-tipo"
                rotulo="Tipo"
                placeholder="Tipo"
                valor={npc.tipo ?? ""}
                maxLength={60}
                desabilitado={!editar}
                className="npc-inp"
                aoMudar={(t) => {
                  texto("tipo")(t);
                  return true;
                }}
              />
              <CampoTexto
                testid="npc-tendencia"
                rotulo="Tendência"
                placeholder="Tendência"
                valor={ficha.alinhamento ?? ""}
                maxLength={64}
                desabilitado={!editar}
                className="npc-inp"
                aoMudar={(t) => {
                  alterar(um("alinhamento", t === "" ? null : t));
                  return true;
                }}
              />
            </div>
          }
        />
      </div>

      <div className="npc-vitais">
        <div className="npc-ca" data-testid="npc-ca">
          <span className="npc-rot">Armadura</span>
          <CampoDeCa {...props} className="npc-ca-campo" />
          <CampoTexto
            testid="npc-armadura"
            rotulo="Tipo de armadura"
            placeholder="armadura"
            valor={ficha.ca?.nota ?? ""}
            maxLength={100}
            desabilitado={!editar}
            className="npc-armadura"
            aoMudar={(t) => {
              alterar(um("ca.nota", t === "" ? null : t));
              return true;
            }}
          />
        </div>
        <div className="npc-pv">
          <div className="npc-pv-cab">
            <span className="npc-h2 npc-acento">
              {props.pvDoModelo ? "Pontos de Vida do modelo" : "Pontos de Vida"}
            </span>
            <CampoTexto
              testid="npc-pv-formula"
              rotulo="Fórmula dos PV"
              placeholder="7d10 + 21"
              valor={npc.pvFormula ?? ""}
              maxLength={40}
              desabilitado={!editar}
              className="npc-pv-formula"
              aoMudar={(t) => {
                alterar(um("npc.pvFormula", t === "" ? null : t));
                return true;
              }}
            />
          </div>
          <div className="npc-pv-linha">
            <ControlesDePv {...props} />
            <span className="npc-pv-barra" aria-hidden>
              /
            </span>
            <CampoNumero
              testid={`pv-max-${personagemId}`}
              rotulo={props.pvDoModelo ? "PV máximos do modelo" : "PV máximos"}
              valor={ficha.pvMax}
              desabilitado={!editar}
              className="fl-in fl-fn npc-pv-max"
              aoMudar={(n) => alterar(um("pvMax", n))}
            />
          </div>
          <BarraDePv ficha={ficha} />
        </div>
        <div className="npc-desl">
          <CampoDecimal
            testid="npc-deslocamento"
            rotulo="Deslocamento em metros"
            valor={props.d.deslocamentoM}
            max={150}
            desabilitado={!editar}
            className="fl-in fl-fn npc-desl-campo"
            aoMudar={(n) => alterar(um("deslocamentoFt", n === null ? null : Math.round(n / 0.3)))}
          />
          <span className="npc-rot">m · Desloc.</span>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Atributos
// ---------------------------------------------------------------------------------------------

function Atributos({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  return (
    <section className="npc-atributos" aria-label="Atributos" data-testid="npc-atributos">
      {ATRIBUTOS.map((a) => (
        <div key={a} className="npc-at" data-testid={`atributo-${a}`}>
          <div className="npc-escudo">
            <svg viewBox="0 0 70 92" aria-hidden="true" className="npc-escudo-svg">
              <path
                d="M0 0H70V50.6L65.8 64.4 57.4 76.4 46.2 86.5 35 92 23.8 86.5 12.6 76.4 4.2 64.4 0 50.6Z"
                className="npc-escudo-fora"
              />
              <path
                d="M2.5 2.5H67.5V50L63.5 63 55.5 74.5 45 84 35 89 25 84 14.5 74.5 6.5 63 2.5 50Z"
                className="npc-escudo-dentro"
              />
            </svg>
            <button
              type="button"
              className="npc-escudo-botao"
              data-testid={`atributo-mod-${a}`}
              disabled={!rolador.podeRolar}
              aria-label={`Rolar teste de ${ROTULO_DO_ATRIBUTO[a]}, modificador ${formatarBonus(d.atributos[a].mod)}`}
              onClick={() => rolador.teste(`Teste de ${ROTULO_DO_ATRIBUTO[a]}`, d.atributos[a].mod)}
            >
              <span className="npc-rot">{SIGLA_DO_ATRIBUTO[a]}</span>
              <span className="npc-mod">{formatarBonus(d.atributos[a].mod)}</span>
            </button>
            <CampoNumero
              testid={`atributo-valor-${a}`}
              rotulo={`Valor de ${ROTULO_DO_ATRIBUTO[a]}`}
              valor={ficha.atributos?.[a] ?? 10}
              min={1}
              max={30}
              desabilitado={!editar}
              className="npc-valor"
              aoMudar={(n) => alterar(um(`atributos.${a}`, n))}
            />
          </div>
          <button
            type="button"
            className="npc-salv"
            data-testid={`salvaguarda-botao-${a}`}
            data-proficiente={d.salvaguardas[a].nivel !== "nenhuma"}
            disabled={!rolador.podeRolar}
            aria-label={`Rolar salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}, ${formatarBonus(d.salvaguardas[a].total)}`}
            onClick={() =>
              rolador.teste(`Salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}`, d.salvaguardas[a].total)
            }
          >
            Salv. {formatarBonus(d.salvaguardas[a].total)}
          </button>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Sentidos e afins
// ---------------------------------------------------------------------------------------------

/** Os testes em que o monstro é proficiente (salvaguardas ou perícias): botões que rolam, e o "+" de quem edita. */
function Proficiencias({ props, tipo }: { props: PropsDaAba; tipo: "salvaguardas" | "pericias" }) {
  const { ficha, d, alterar, editar, rolador } = props;
  const salvas = tipo === "salvaguardas";
  const itens = salvas
    ? ATRIBUTOS.filter((a) => d.salvaguardas[a].nivel !== "nenhuma").map((a) => ({
        id: a as string,
        nome: ROTULO_DO_ATRIBUTO[a],
        total: d.salvaguardas[a].total,
      }))
    : d.pericias
        .filter((p) => p.nivel !== "nenhuma")
        .map((p) => ({ id: p.id as string, nome: p.nome, total: p.total }));
  const faltam = salvas
    ? ATRIBUTOS.filter((a) => d.salvaguardas[a].nivel === "nenhuma").map((a) => ({
        id: a as string,
        nome: ROTULO_DO_ATRIBUTO[a],
      }))
    : PERICIAS.filter(
        (p) => !ficha.pericias?.[p.id] || ficha.pericias[p.id]?.nivel === "nenhuma",
      ).map((p) => ({ id: p.id as string, nome: p.nome }));
  const rotulo = salvas ? "Testes de resistência" : "Perícias";
  const prefixo = salvas ? "salvaguardas" : "pericias";
  if (itens.length === 0 && !editar) return null;
  return (
    <Linha rotulo={rotulo} testid={`npc-${prefixo}`}>
      <span className="npc-chips">
        {itens.map((it) => (
          <span key={it.id} className="npc-prof">
            <button
              type="button"
              className="npc-chip-rolar"
              data-testid={`npc-${prefixo}-${it.id}`}
              disabled={!rolador.podeRolar}
              aria-label={`Rolar ${salvas ? "salvaguarda de" : "teste de"} ${it.nome}, ${formatarBonus(it.total)}`}
              onClick={() =>
                rolador.teste(salvas ? `Salvaguarda de ${it.nome}` : it.nome, it.total)
              }
            >
              {it.nome} {formatarBonus(it.total)}
            </button>
            {editar && (
              <BotaoComDica
                className="fl-ib npc-prof-tirar"
                testid={`npc-${prefixo}-tirar-${it.id}`}
                nome={`Tirar ${it.nome}`}
                aria-label={`Tirar ${it.nome}`}
                onClick={() => alterar(um(`${prefixo}.${it.id}`, null))}
              >
                <X size={12} aria-hidden />
              </BotaoComDica>
            )}
          </span>
        ))}
        {editar && faltam.length > 0 && (
          <select
            className="npc-sel npc-sel-mais"
            data-testid={`npc-${prefixo}-mais`}
            aria-label={salvas ? "Somar um teste de resistência" : "Somar uma perícia"}
            value=""
            onChange={(e) => {
              if (e.target.value !== "")
                alterar(um(`${prefixo}.${e.target.value}`, { nivel: "proficiente" }));
            }}
          >
            <option value="">+ {salvas ? "Resistência" : "Perícia"}</option>
            {faltam.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        )}
      </span>
    </Linha>
  );
}

function LinhasDoBloco(props: PropsDaAba) {
  const { ficha, d, alterar, editar, rolador } = props;
  const npc = ficha.npc ?? {};
  const textoDe = (campo: string, rotulo: string, testid: string) => {
    const valor = (npc as Record<string, string | undefined>)[campo] ?? "";
    if (valor === "" && !editar) return null;
    return (
      <Linha rotulo={rotulo} testid={testid}>
        <CampoTexto
          testid={`${testid}-campo`}
          rotulo={rotulo}
          valor={valor}
          maxLength={200}
          crescente
          umaLinha
          desabilitado={!editar}
          className="npc-inp"
          aoMudar={(t) => {
            alterar(um(`npc.${campo}`, t === "" ? null : t));
            return true;
          }}
        />
      </Linha>
    );
  };
  const xp = xpDoND(npc.nd);
  const percepcao = d.pericias.find((p) => p.id === "percepcao");
  return (
    <div className="npc-linhas" data-testid="npc-linhas">
      <Proficiencias props={props} tipo="salvaguardas" />
      <Proficiencias props={props} tipo="pericias" />
      {textoDe("vulnerabilidades", "Vulnerab.", "npc-vulnerabilidades")}
      {textoDe("resistencias", "Resistências", "npc-resistencias")}
      {textoDe("imunidades", "Imunidades", "npc-imunidades")}
      {textoDe("imunidadesCondicoes", "Imun. cond.", "npc-imunidades-condicoes")}
      <Linha rotulo="Sentidos" testid="npc-sentidos">
        <CampoTexto
          testid="npc-sentidos-campo"
          rotulo="Sentidos"
          placeholder="visão no escuro 18 m"
          valor={npc.sentidos ?? ""}
          maxLength={200}
          crescente
          umaLinha
          desabilitado={!editar}
          className="npc-inp npc-sentidos-campo"
          aoMudar={(t) => {
            alterar(um("npc.sentidos", t === "" ? null : t));
            return true;
          }}
        />
        <button
          type="button"
          className="npc-botao-linha"
          data-testid="percepcao-passiva"
          disabled={!rolador.podeRolar}
          aria-label={`Rolar Percepção, ${formatarBonus(percepcao?.total ?? 0)}. Percepção passiva ${d.percepcaoPassiva}`}
          onClick={() => rolador.teste("Percepção", percepcao?.total ?? 0)}
        >
          <span className="npc-losango" aria-hidden />
          Percepção passiva {d.percepcaoPassiva}
        </button>
      </Linha>
      <Linha rotulo="Idiomas" testid="npc-idiomas">
        <CampoTexto
          testid="npc-idiomas-campo"
          rotulo="Idiomas"
          placeholder="Comum, Gigante"
          valor={(ficha.idiomas ?? []).join(", ")}
          maxLength={400}
          crescente
          umaLinha
          desabilitado={!editar}
          className="npc-inp"
          aoMudar={(t) => {
            const lista = t
              .split(",")
              .map((x) => x.trim().slice(0, 40))
              .filter(Boolean);
            alterar(um("idiomas", lista.length === 0 ? null : lista.slice(0, 30)));
            return true;
          }}
        />
      </Linha>
      <Linha rotulo="Desafio" testid="npc-desafio">
        <select
          className="npc-sel"
          data-testid="npc-nd"
          aria-label="Nível de desafio"
          value={npc.nd ?? ""}
          disabled={!editar}
          onChange={(e) => alterar(um("npc.nd", e.target.value === "" ? null : e.target.value))}
        >
          <option value="">—</option>
          {NIVEIS_DE_DESAFIO.map((nd) => (
            <option key={nd} value={nd}>
              {nd}
            </option>
          ))}
        </select>
        {xp !== undefined && (
          <span data-testid="npc-xp">
            ({xp.toLocaleString("pt-BR")} XP) · Proficiência{" "}
            {formatarBonus(bonusDeProficiencia(ficha))}
          </span>
        )}
      </Linha>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Ações, reações e lendárias
// ---------------------------------------------------------------------------------------------

/** O que só o monstro tem numa ação: categoria, tipo, recarga e usos por dia. Fica acima do editor comum. */
function ExtrasDaAcao({ a, gi, props }: { a: Ataque; gi: number; props: PropsDaAba }) {
  const { alterar, editar } = props;
  const grava = (campo: string, valor: unknown) => alterar(um(`ataques.${gi}.${campo}`, valor));
  return (
    <div className="npc-extras fl-ed4" data-testid={`npc-extras-${gi}`}>
      <div className="fl-edf">
        <span className="fl-lbl">Onde mora</span>
        <select
          className="fl-fld"
          data-testid="npc-extra-categoria"
          aria-label="Categoria"
          disabled={!editar}
          value={categoriaDe(a)}
          onChange={(e) => grava("categoria", e.target.value === "acao" ? null : e.target.value)}
        >
          {CATEGORIAS_DE_ACAO.map((c) => (
            <option key={c} value={c}>
              {ROTULO_DA_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="fl-edf">
        <span className="fl-lbl">Tipo</span>
        <select
          className="fl-fld"
          data-testid="npc-extra-tipo"
          aria-label="Tipo da ação"
          disabled={!editar}
          value={a.tipoDeAcao ?? ""}
          onChange={(e) => grava("tipoDeAcao", e.target.value === "" ? null : e.target.value)}
        >
          <option value="">—</option>
          {TIPOS_DE_ACAO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_DO_TIPO_DE_ACAO[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="fl-edf">
        <span className="fl-lbl">Recarga</span>
        <select
          className="fl-fld"
          data-testid="npc-extra-recarga"
          aria-label="Recarga"
          disabled={!editar}
          value={a.recarga ?? ""}
          onChange={(e) => {
            if (e.target.value === "") alterar([...um(`ataques.${gi}.recarga`, null)]);
            else grava("recarga", Number(e.target.value));
          }}
        >
          <option value="">Sem recarga</option>
          {[6, 5, 4, 3, 2].map((n) => (
            <option key={n} value={n}>
              {n === 6 ? "Recarga 6" : `Recarga ${n}–6`}
            </option>
          ))}
        </select>
      </div>
      <div className="fl-edf">
        <span className="fl-lbl">Usos por dia</span>
        <CampoNumero
          testid="npc-extra-usos"
          rotulo="Usos por dia"
          valor={a.usos?.max ?? 0}
          max={20}
          desabilitado={!editar}
          className="fl-fld"
          aoMudar={(n) =>
            grava("usos", n === 0 ? null : { max: n, gastos: Math.min(a.usos?.gastos ?? 0, n) })
          }
        />
      </div>
    </div>
  );
}

function LinhaDeAcao({
  a,
  gi,
  props,
  ordem,
}: {
  a: Ataque;
  gi: number;
  props: PropsDaAba;
  ordem: HTMLAttributes<HTMLDivElement>;
}) {
  const {
    ficha,
    rolador,
    editar,
    enviar,
    personagemId,
    alterar,
    abrirEditor,
    fecharEditor,
    editorAberto,
  } = props;
  const [aberta, setAberta] = useState(false);
  const editando = editorAberto?.tipo === "ataque" && editorAberto.i === gi;
  const acerto = bonusDeAcerto(ficha, a);
  const dano = expressaoDeDano(ficha, a);
  const cd = cdDaRolagem(ficha, a);
  const rola = acerto !== undefined || dano !== undefined || cd !== undefined;
  const podeRolar = rolador.podeRolar;
  const cat = categoriaDe(a);
  const texto = a.descricao && a.descricao.trim() !== "" ? a.descricao : textoDaAcao(props, a);
  const chips = [
    a.tipoDeAcao ? ROTULO_DO_TIPO_DE_ACAO[a.tipoDeAcao] : "",
    a.alcance
      ? a.tipoDeAcao === "magia" || a.tipoDeAcao === "esp"
        ? a.alcance
        : `alcance ${a.alcance}`
      : "",
  ].filter(Boolean);
  const usos = a.usos;
  const disponivel = a.recarregado !== false;
  const rotuloDaRecarga =
    a.recarga === undefined ? "" : a.recarga === 6 ? "Recarga 6" : `Recarga ${a.recarga}–6`;

  function mandarAoChat() {
    if (!editar) return;
    enviar("chat.caracteristica", {
      caracteristica: {
        nome: a.nome.trim().slice(0, 80),
        descricao: texto.slice(0, 12_000),
        origem: ROTULO_DA_CATEGORIA[cat],
      },
      como: personagemId,
    });
  }
  function rolarAcerto() {
    if (!podeRolar) return;
    if (acerto !== undefined || dano !== undefined) return rolador.ataque(a, ficha);
    mandarAoChat();
  }

  return (
    <div
      className="npc-acao"
      data-testid={`npc-acao-${gi}`}
      data-aberta={aberta}
      data-editando={editando}
      {...ordem}
    >
      <div className="npc-acao-linha">
        {editar && <GripVertical size={12} className="npc-alca" aria-hidden />}
        <div className="npc-acao-meio">
          <button
            type="button"
            className="npc-acao-titulo"
            data-foco-ordem
            data-testid={`npc-acao-titulo-${gi}`}
            aria-expanded={aberta}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            aria-label={`${a.nome}: ${aberta ? "recolher" : "expandir"} a descrição. Alt mais seta para cima ou para baixo muda a posição.`}
            onClick={() => setAberta(!aberta)}
          >
            <ChevronRight size={12} className="npc-giro" aria-hidden />
            <span className="npc-acao-nome">{a.nome}</span>
          </button>
          <div className="npc-chips-da-acao">
            {chips.map((c) => (
              <span key={c} className="npc-chip">
                {c}
              </span>
            ))}
            {usos && (
              <span className="npc-usos" data-sem data-testid={`npc-usos-${gi}`}>
                <span className="npc-chip-texto">{usos.max} por dia</span>
                {Array.from({ length: usos.max }, (_, k) => k).map((k) => {
                  const cheio = k >= usos.gastos;
                  return (
                    <label key={k} className="npc-pip" data-sem>
                      <input
                        type="checkbox"
                        className="npc-pip-bolinha"
                        data-sem
                        data-testid={`npc-uso-${gi}-${k}`}
                        checked={cheio}
                        disabled={!editar}
                        aria-label={`Uso ${k + 1} de ${a.nome}: ${cheio ? "disponível" : "gasto"}`}
                        onChange={() =>
                          alterar(
                            um(`ataques.${gi}.usos`, {
                              max: usos.max,
                              gastos: cheio
                                ? Math.min(usos.max, usos.gastos + 1)
                                : Math.max(0, usos.gastos - 1),
                            }),
                          )
                        }
                      />
                    </label>
                  );
                })}
              </span>
            )}
            {a.recarga !== undefined && (
              <span className="npc-usos" data-sem>
                <label className="npc-recarga" data-sem>
                  <input
                    type="checkbox"
                    className="npc-pip-bolinha"
                    data-sem
                    data-testid={`npc-recarga-${gi}`}
                    checked={disponivel}
                    disabled={!editar}
                    aria-label={`${rotuloDaRecarga} de ${a.nome}: ${disponivel ? "disponível" : "gasta"}`}
                    onChange={() =>
                      alterar(um(`ataques.${gi}.recarregado`, disponivel ? false : null))
                    }
                  />
                  {rotuloDaRecarga}
                </label>
                <BotaoComDica
                  className="fl-ib npc-recarga-rolar"
                  testid={`npc-recarga-rolar-${gi}`}
                  nome={`Rolar a recarga de ${a.nome} (d6)`}
                  aria-label={`Rolar a recarga de ${a.nome}`}
                  motivo={podeRolar ? null : "Só quem edita a ficha rola"}
                  onClick={() =>
                    rolador.expressao("1d6", `Recarga de ${a.nome} (${rotuloDaRecarga})`)
                  }
                >
                  <Dices size={14} aria-hidden />
                </BotaoComDica>
              </span>
            )}
          </div>
        </div>
        {rola ? (
          <>
            <button
              type="button"
              className="npc-acerto"
              data-sem
              data-testid={`npc-acao-acerto-${gi}`}
              disabled={!podeRolar}
              aria-label={
                acerto !== undefined
                  ? `Rolar acerto e dano de ${a.nome}, ${formatarBonus(acerto)}`
                  : cd !== undefined
                    ? `Rolar o dano de ${a.nome} com salvaguarda CD ${cd}`
                    : `Rolar o dano de ${a.nome}`
              }
              onClick={rolarAcerto}
            >
              {acerto !== undefined ? formatarBonus(acerto) : cd !== undefined ? `CD ${cd}` : "–"}
            </button>
            <button
              type="button"
              className="npc-dano"
              data-longo={dano !== undefined && dano.length > 8 ? "true" : undefined}
              title={dano}
              data-sem
              data-testid={`npc-acao-dano-${gi}`}
              disabled={!podeRolar || dano === undefined}
              aria-label={dano ? `Rolar só o dano de ${a.nome}, ${dano}` : "Sem dano"}
              onClick={() => rolador.dano(a, ficha)}
            >
              {dano ?? "–"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="npc-sem-rolar"
            data-sem
            data-testid={`npc-acao-chat-${gi}`}
            disabled={!editar}
            aria-label={`Mandar ${a.nome} ao chat`}
            onClick={mandarAoChat}
          >
            Mandar ao chat
          </button>
        )}
        <BotaoComDica
          className="fl-ib npc-engrenagem"
          testid={`npc-acao-editar-${gi}`}
          nome={`Configurar ${a.nome}`}
          aria-label={`Configurar ${a.nome}`}
          aria-expanded={editando}
          motivo={editar ? null : "Só quem edita a ficha configura"}
          onClick={() => (editando ? fecharEditor() : abrirEditor({ tipo: "ataque", i: gi }))}
        >
          <Settings size={17} aria-hidden />
        </BotaoComDica>
      </div>

      {aberta && (
        <div className="npc-acao-texto" data-sem>
          <p data-testid={`npc-acao-texto-${gi}`}>{texto}</p>
          {rola && (
            <button
              type="button"
              className="npc-mandar"
              data-testid={`npc-acao-mandar-${gi}`}
              disabled={!editar}
              aria-label={`Mandar ${a.nome} ao chat`}
              onClick={mandarAoChat}
            >
              <MessageSquare size={16} aria-hidden /> Mandar ao chat
            </button>
          )}
        </div>
      )}

      {editando && (
        <div className="npc-editor" data-sem>
          <ExtrasDaAcao a={a} gi={gi} props={props} />
          <EditorDeAtaque
            alvo={{ tipo: "ataque", i: gi }}
            origem="principal"
            props={props}
            aoVoltar={fecharEditor}
          />
        </div>
      )}
    </div>
  );
}

function SecaoDeAcoes({
  cat,
  props,
  versao,
  aoReordenar,
}: {
  cat: CategoriaDeAcao;
  props: PropsDaAba;
  versao: number;
  aoReordenar: () => void;
}) {
  const { ficha, alterar, editar, abrirEditor, fecharEditor } = props;
  const todos = ficha.ataques ?? [];
  const daSecao = todos.map((a, gi) => ({ a, gi })).filter((x) => categoriaDe(x.a) === cat);
  const ordem = useOrdemDaLista({
    lista: cat,
    habilitado: editar,
    aoMover: (de, para) => {
      fecharEditor();
      aoReordenar();
      alterar(
        um(
          "ataques",
          moverNoGrupo(
            todos,
            posicoesDoGrupo(todos, (a) => categoriaDe(a) === cat),
            de,
            para,
          ),
        ),
      );
    },
  });
  const soltar = useSoltarDoCompendio({
    aceita: ["arma"],
    habilitado: editar && cat === "acao",
    listaDoTipo: { arma: "acao" },
    aoSoltar: (entrada, posicao) => soltarNaFicha(props, "npc", entrada, { posicao }),
  });
  if (cat !== "acao" && daSecao.length === 0) return null;
  function nova() {
    const posicao = todos.length;
    const ok = alterar(
      um("ataques", [
        ...todos,
        {
          nome: `Nova ${ROTULO_DA_CATEGORIA[cat].toLowerCase()}`,
          tipoDeAcao: "esp",
          ...(cat === "acao" ? {} : { categoria: cat }),
        },
      ]),
    );
    if (ok) abrirEditor({ tipo: "ataque", i: posicao });
  }
  return (
    <div
      className="npc-secao npc-soltar"
      data-testid={`npc-secao-${cat}`}
      {...(cat === "acao" ? soltar.props : {})}
    >
      <Titulo testid={`npc-titulo-${cat}`}>{TITULO_DA_SECAO[cat]}</Titulo>
      <div className="npc-acoes-cab" aria-hidden>
        <span className="npc-acoes-cab-vazio" />
        <span className="npc-rot npc-col-acerto">Acerto</span>
        <span className="npc-rot npc-col-dano">Dano</span>
        <span className="npc-col-eng" />
      </div>
      {daSecao.map(({ a, gi }, k) => (
        <LinhaDeAcao
          key={`a-${gi}-${versao}`}
          a={a}
          gi={gi}
          props={props}
          ordem={{
            ...ordem.linha(k, daSecao.length),
            ...(cat === "acao" && soltar.previsao?.lista === "acao"
              ? { "data-indicador": indicadorDoVao(soltar.previsao.vao, k, daSecao.length) }
              : {}),
          }}
        />
      ))}
      {editar && (
        <button type="button" className="npc-novo" data-testid={`npc-nova-${cat}`} onClick={nova}>
          <Plus size={13} aria-hidden />{" "}
          {cat === "acao" ? "Ação" : cat === "reacao" ? "Reação" : "Lendária"}
        </button>
      )}
      {soltar.acesa && (
        <p className="npc-soltar-aviso" data-testid="soltar-aqui-acoes">
          Solte aqui para pôr a arma como ação
        </p>
      )}
    </div>
  );
}

/** "+ Reação" e "+ Lendária": discretos, só para quem edita e só enquanto a seção não existe. */
function BotoesDeNovaCategoria({ props }: { props: PropsDaAba }) {
  const { ficha, alterar, editar, abrirEditor } = props;
  const todos = ficha.ataques ?? [];
  if (!editar) return null;
  const falta = (["reacao", "lendaria"] as const).filter(
    (c) => !todos.some((a) => categoriaDe(a) === c),
  );
  if (falta.length === 0) return null;
  return (
    <div className="npc-novas" data-testid="npc-novas-categorias">
      {falta.map((c) => (
        <button
          key={c}
          type="button"
          className="npc-novo"
          data-testid={`npc-nova-${c}`}
          onClick={() => {
            const ok = alterar(
              um("ataques", [
                ...todos,
                {
                  nome: `Nova ${ROTULO_DA_CATEGORIA[c].toLowerCase()}`,
                  tipoDeAcao: "esp",
                  categoria: c,
                },
              ]),
            );
            if (ok) abrirEditor({ tipo: "ataque", i: todos.length });
          }}
        >
          <Plus size={13} aria-hidden /> {c === "reacao" ? "Reação" : "Lendária"}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// O bloco inteiro
// ---------------------------------------------------------------------------------------------

export type PaginaDoNpc = "bestiario" | "conjuracao";

export type PropsDoNpc = PropsDaAba & {
  /** Grava o nome (a janela cuida de `personagem.editar`). */
  aoMudarNome: (nome: string) => void;
  /** A faixa Vantagem / Normal / Desvantagem da janela. */
  modos: ReactNode;
  /** A fita aberta (V8): o Bestiário ou a Conjuração. A janela guarda por ficha, como as abas do PJ. */
  pagina: PaginaDoNpc;
  aoMudarPagina: (pagina: PaginaDoNpc) => void;
};

/** A fita Conjuração: sempre para quem edita (para poder criar); para os outros, só se o NPC tem magias (V8, assumido). */
export const npcMostraConjuracao = (editar: boolean, ficha: PropsDaAba["ficha"]) =>
  editar || (ficha.magias?.length ?? 0) > 0;

const FITAS_DO_NPC: readonly { id: PaginaDoNpc; titulo: string }[] = [
  { id: "bestiario", titulo: "Bestiário" },
  { id: "conjuracao", titulo: "Conjuração" },
];

export function BlocoDoNpc(props: PropsDoNpc) {
  const { modos, pagina, aoMudarPagina } = props;
  // Mexer na ordem recria as linhas (a seta de "expandida" volta ao fechado: elas se identificam pela posição).
  const [versao, setVersao] = useState(0);
  const tracos = useSoltarDoCompendio({
    aceita: ["item", "itemMagico"],
    habilitado: props.editar,
    listaDoTipo: { item: "caracteristicas", itemMagico: "caracteristicas" },
    aoSoltar: (entrada, posicao) => soltarNaFicha(props, "npc", entrada, { posicao }),
  });
  // Com o Bestiário aberto a magia do compêndio cai na Conjuração: a fita acende como alvo (e a página também recebe).
  const magiaNaFita = useSoltarDoCompendio({
    aceita: ["magia"],
    habilitado: props.editar && pagina === "bestiario",
    aoSoltar: (entrada, posicao) => {
      soltarNaFicha(props, "npc", entrada, { posicao });
      aoMudarPagina("conjuracao");
    },
  });
  const fitas = FITAS_DO_NPC.filter(
    (f) => f.id === "bestiario" || npcMostraConjuracao(props.editar, props.ficha),
  );

  function teclarNasFitas(e: KeyboardEvent<HTMLDivElement>) {
    const i = fitas.findIndex((f) => f.id === pagina);
    const destino =
      e.key === "ArrowRight"
        ? (i + 1) % fitas.length
        : e.key === "ArrowLeft"
          ? (i - 1 + fitas.length) % fitas.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? fitas.length - 1
              : -1;
    if (destino < 0) return;
    e.preventDefault();
    const alvo = fitas[destino];
    if (!alvo) return;
    aoMudarPagina(alvo.id);
    e.currentTarget.querySelector<HTMLElement>(`[data-testid="npc-fita-${alvo.id}"]`)?.focus();
  }

  const { onDragOver, onDragLeave, onDrop } = magiaNaFita.props;
  const soltarDaMagia = { onDragOver, onDragLeave, onDrop };
  return (
    <div
      className="npc-pagina"
      data-testid="npc-bloco"
      data-pagina={pagina}
      {...(pagina === "bestiario" ? soltarDaMagia : {})}
    >
      <div className="npc-barra">
        <fieldset className="npc-modos" aria-label="Rolagens com vantagem ou desvantagem">
          <span className="npc-rot">Rolagens</span>
          {modos}
        </fieldset>
        <div
          className="npc-fitas"
          role="tablist"
          aria-label="Páginas da ficha do monstro"
          onKeyDown={teclarNasFitas}
        >
          {fitas.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              id={`npc-fita-${f.id}`}
              className="npc-fita fl-fh"
              data-testid={`npc-fita-${f.id}`}
              aria-selected={pagina === f.id}
              aria-controls="npc-pagina-painel"
              tabIndex={pagina === f.id ? 0 : -1}
              data-aceita-soltar={
                f.id === "conjuracao" ? magiaNaFita.props["data-aceita-soltar"] : undefined
              }
              {...(f.id === "conjuracao" && pagina === "bestiario" ? soltarDaMagia : {})}
              onClick={() => aoMudarPagina(f.id)}
            >
              {f.titulo}
            </button>
          ))}
        </div>
      </div>
      <div
        className="npc-miolo"
        role="tabpanel"
        id="npc-pagina-painel"
        aria-labelledby={`npc-fita-${pagina}`}
        data-testid={`npc-painel-${pagina}`}
      >
        {pagina === "conjuracao" ? (
          <SecaoDeConjuracao props={props} />
        ) : (
          <>
            <div className="npc-col npc-col-esq">
              <Cabecalho {...props} />
              <Atributos {...props} />
              <LinhasDoBloco {...props} />
            </div>
            <div className="npc-col npc-col-dir">
              <div
                className="npc-secao npc-soltar"
                data-testid="npc-secao-tracos"
                {...tracos.props}
              >
                <Titulo testid="npc-titulo-tracos">Traços</Titulo>
                <div className="npc-tracos">
                  <ListaDeCaracteristicas
                    campo="caracteristicas"
                    testidBase="traco"
                    ficha={props.ficha}
                    alterar={props.alterar}
                    editar={props.editar}
                    enviar={props.enviar}
                    personagemId={props.personagemId}
                  />
                </div>
                {tracos.acesa && (
                  <p className="npc-soltar-aviso" data-testid="soltar-aqui-tracos">
                    Solte aqui para pôr o item como traço
                  </p>
                )}
              </div>

              {CATEGORIAS_DE_ACAO.map((c) => (
                <SecaoDeAcoes
                  key={c}
                  cat={c}
                  props={props}
                  versao={versao}
                  aoReordenar={() => setVersao((v) => v + 1)}
                />
              ))}
              <BotoesDeNovaCategoria props={props} />
              <p className="npc-dica" role="note">
                Segure uma ação por meio segundo para arrastá-la, ou use Alt + seta no título.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
