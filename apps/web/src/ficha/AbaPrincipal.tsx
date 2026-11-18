import {
  ATRIBUTOS,
  type Ataque,
  bonusDeAcerto,
  CLASSES,
  type Compendio,
  cargaDaFicha,
  cdDaRolagem,
  compartilharEstrutura,
  expressaoDeDano,
  type Ficha,
  type FichaDerivada,
  formatarBonus,
  type Magia,
  MOEDAS,
  moedasEmOuro,
  moverNoGrupo,
  NIVEIS_DE_PROFICIENCIA,
  type NivelDeProficiencia,
  type OperacaoDeFicha,
  PERICIAS,
  posicoesDoGrupo,
  previaDoAtaque,
  ROTULO_DO_ATRIBUTO,
  receberDano,
  SIGLA_DO_ATRIBUTO,
  type Token,
} from "@tabletop/shared";
import { Dices, GripVertical, Minus, Plus, Settings, Trash2 } from "lucide-react";
import type { HTMLAttributes } from "react";
import { BotaoComDica } from "../BotaoComDica";
import type { PedirImagem } from "../FaixaDeCenas";
import type { ImagensDoMapa } from "../mapa/mapaPixi";
import { CampoDecimal, CampoDeNovo, CampoNumero, CampoTexto } from "./campos";
import { type AlvoDoEditor, EditorDeAtaque } from "./EditorDeAtaque";
import { ListaDeCaracteristicas } from "./ListaDeTitulos";
import {
  BotaoAcender,
  type LuzDaFicha,
  modeloDaLinha,
  SublinhasDeLuz,
  useTicDasLuzes,
} from "./LuzDoItem";
import { Acordeao, Bolinha, Caixa, Secao } from "./livro";
import { BotaoPingarMagia, useConjurar } from "./menuDeEspaco";
import { PopoverDoModificador, useModificadorExtra } from "./modificadorExtra";
import { indicadorDoVao, useOrdemDaLista, useSoltarDoCompendio } from "./ordem";
import type { Rolador } from "./rolador";
import { secao } from "./secoes";
import { soltarNaFicha } from "./soltar";

type Enviar = (tipo: string, dados: object) => string | null;

export type PropsDaAba = {
  personagemId: string;
  /** O nome do personagem (a janela mostra e edita no cabeçalho). */
  nomeDoPersonagem: string;
  ficha: Ficha;
  d: FichaDerivada;
  alterar: (operacoes: OperacaoDeFicha[]) => boolean;
  editar: boolean;
  rolador: Rolador;
  enviar: Enviar;
  /** O token do personagem na cena ativa (as condições e a concentração moram nele); sem token, `undefined`. */
  token?: Token | undefined;
  /**
   * A ordem de turno (V2). Aberta, clicar em Iniciativa rola 1d20 + o valor da ficha na sala e põe o token
   * selecionado na lista; fechada, só rola no chat como antes.
   */
  ordem?: { aberta: boolean; entrar: () => void } | undefined;
  /** O compêndio de magias da mesa, quando já chegou (as linhas de magia ganham o cartão dele). */
  compendio?: Compendio | null | undefined;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  pedirImagem: PedirImagem;
  /** Quem pode trocar as imagens da ficha (o retrato segue a mesma regra). */
  podeTrocarImagem: boolean;
  /** A janela está estreita: as seções viram acordeão e o cabeçalho gruda. */
  estreita: boolean;
  /** O editor da engrenagem aberto nesta aba (ou `null`). */
  editorAberto: AlvoDoEditor | null;
  abrirEditor: (alvo: AlvoDoEditor) => void;
  fecharEditor: () => void;
  /** Um aviso curto no alto da ficha. */
  avisar: (texto: string) => void;
  /** Q10: a ficha foi aberta por um token de NPC com vida própria: estes PV são os do modelo, não os do token. */
  pvDoModelo?: boolean | undefined;
  /** A mesa, para acender e apagar objetos de luz na linha do equipamento (V4a2). */
  luz?: LuzDaFicha | undefined;
};

/** As chaves da ficha que são só texto livre: ataques e equipamento não as leem (Q14). */
const TEXTOS_LIVRES: (keyof Ficha)[] = [
  "caracteristicas",
  "outrasCaracteristicas",
  "personalidade",
  "ideais",
  "ligacoes",
  "defeitos",
  "notas",
  "historia",
  "tesouro",
  "aliados",
  "aparencia",
  "aparenciaHash",
  "simboloNome",
  "simboloHash",
  "idade",
  "altura",
  "peso",
  "olhos",
  "pele",
  "cabelos",
  "outrasProficiencias",
  "idiomas",
  "raca",
  "antecedente",
  "alinhamento",
  "xp",
  "inspiracao",
  "moedas",
  "mortes",
  "pvAtual",
  "pvMax",
  "pvTemp",
  "dadosDeVidaUsados",
  "recursos",
  "deslocamentoFt",
];

/** A `luz` da ficha carrega a mesa inteira: só importa o que o equipamento lê dela. */
function mesmaLuz(a: unknown, b: unknown): boolean {
  const x = a as LuzDaFicha | undefined;
  const y = b as LuzDaFicha | undefined;
  if (x === y) return true;
  if (!x || !y) return false;
  return (
    x.estado.modelos === y.estado.modelos &&
    x.estado.luzes === y.estado.luzes &&
    x.estado.tokens === y.estado.tokens &&
    x.estado.cenaAtivaId === y.estado.cenaAtivaId &&
    x.estado.config === y.estado.config &&
    x.eu === y.eu &&
    x.personagem.id === y.personagem.id &&
    // a ficha da sala volta do eco como objeto novo: vale o conteúdo dos itens, não a referência
    compartilharEstrutura(x.personagem.ficha?.itens, y.personagem.ficha?.itens) ===
      x.personagem.ficha?.itens &&
    x.tempo === y.tempo
  );
}

/** Uma operação só: `caminho` recebe `valor` (`null` remove). */
export const um = (caminho: string, valor: unknown): OperacaoDeFicha[] => [{ caminho, valor }];

const ROTULO_DA_PROFICIENCIA: Record<NivelDeProficiencia, string> = {
  nenhuma: "sem proficiência",
  proficiente: "proficiente",
  especialista: "especialista",
};

/** Os nomes que a ficha do PDF usa (os ids internos das perícias não mudam). */
const NOME_NO_PDF: Record<string, string> = {
  enganacao: "Blefar",
  adestrarAnimais: "Lidar com Animais",
};
const nomeNoPdf = (id: string, nome: string) => NOME_NO_PDF[id] ?? nome;

/** As perícias na ordem do PDF (alfabética pelos nomes dele). */
const PERICIAS_NA_ORDEM_DO_PDF = [...PERICIAS].sort((a, b) =>
  nomeNoPdf(a.id, a.nome).localeCompare(nomeNoPdf(b.id, b.nome), "pt-BR"),
);

const ROTULO_DA_MOEDA: Record<(typeof MOEDAS)[number], string> = {
  pc: "PC",
  pp: "PP",
  pe: "PE",
  po: "PO",
  pl: "PL",
};
const NOME_DA_MOEDA: Record<(typeof MOEDAS)[number], string> = {
  pc: "Peças de cobre",
  pp: "Peças de prata",
  pe: "Peças de electro",
  po: "Peças de ouro",
  pl: "Peças de platina",
};

const comVirgula = (n: number) => String(n).replace(".", ",");

/** Bolinha que alterna nenhuma → proficiente → especialista. */
function BotaoDeProficiencia({
  testid,
  nome,
  nivel,
  editar,
  aoMudar,
}: {
  testid: string;
  nome: string;
  nivel: NivelDeProficiencia;
  editar: boolean;
  aoMudar: (nivel: NivelDeProficiencia) => void;
}) {
  const proximo = (): NivelDeProficiencia => {
    const i = NIVEIS_DE_PROFICIENCIA.indexOf(nivel);
    return NIVEIS_DE_PROFICIENCIA[(i + 1) % NIVEIS_DE_PROFICIENCIA.length] ?? "nenhuma";
  };
  return (
    <BotaoComDica
      className="fl-pmb"
      testid={testid}
      nome={`${nome}: ${ROTULO_DA_PROFICIENCIA[nivel]}`}
      motivo={editar ? null : "Só quem edita a ficha muda"}
      data-nivel={nivel}
      aria-label={`Proficiência em ${nome}: ${ROTULO_DA_PROFICIENCIA[nivel]}`}
      onClick={() => aoMudar(proximo())}
    >
      <span className="fl-pm" data-nivel={nivel} />
    </BotaoComDica>
  );
}

/** Número que se rola: clicar manda o teste para o chat, como o personagem. */
function NumeroRolavel({
  testid,
  valor,
  nome,
  rolador,
  className,
  cd,
}: {
  testid: string;
  valor: number;
  nome: string;
  rolador: Rolador;
  className?: string;
  cd?: number;
}) {
  return (
    <button
      type="button"
      className={`fl-rolavel ${className ?? ""}`}
      data-testid={testid}
      disabled={!rolador.podeRolar}
      title={rolador.podeRolar ? undefined : "Só quem edita a ficha rola"}
      aria-label={`Rolar ${nome} ${formatarBonus(valor)}`}
      onClick={() => rolador.teste(nome, valor, cd)}
    >
      {formatarBonus(valor)}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Identidade (cabeçalho da janela larga; seção "Identidade" da estreita)
// ---------------------------------------------------------------------------------------------

function ClasseENivelBruta({ ficha, alterar, editar }: PropsDaAba) {
  const classes = ficha.classes ?? [];
  return (
    <div className="fl-classes" data-testid="fh-classes">
      {classes.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
        <div key={i} className="fl-classe" data-testid={`classe-${i}`}>
          <CampoTexto
            testid={`classe-nome-${i}`}
            lista="fh-classes-srd"
            rotulo="Classe"
            valor={c.classe}
            maxLength={48}
            desabilitado={!editar}
            className="fl-in fl-ln fl-classe-nome"
            aoMudar={(t) => alterar(um(`classes.${i}.classe`, t))}
          />
          <CampoNumero
            testid={`classe-nivel-${i}`}
            rotulo={`Nível de ${c.classe}`}
            valor={c.nivel}
            min={1}
            max={20}
            desabilitado={!editar}
            className="fl-in fl-ln fl-classe-nivel"
            aoMudar={(n) => alterar(um(`classes.${i}.nivel`, n))}
          />
          <CampoTexto
            testid={`classe-subclasse-${i}`}
            rotulo="Subclasse"
            placeholder="subclasse"
            valor={c.subclasse ?? ""}
            maxLength={48}
            desabilitado={!editar}
            className="fl-in fl-ln fl-classe-sub"
            aoMudar={(t) => alterar(um(`classes.${i}.subclasse`, t === "" ? null : t))}
          />
          {editar && (
            <BotaoComDica
              className="fl-ib fl-mini"
              testid={`classe-remover-${i}`}
              nome={`Tirar a classe ${c.classe}`}
              aria-label={`Tirar a classe ${c.classe}`}
              onClick={() => alterar(um(`classes.${i}`, null))}
            >
              <Trash2 size={13} aria-hidden />
            </BotaoComDica>
          )}
        </div>
      ))}
      {editar && (
        <datalist id="fh-classes-srd">
          {CLASSES.map((c) => (
            <option key={c.id} value={c.nome} />
          ))}
        </datalist>
      )}
      {editar && (
        <BotaoComDica
          className="fl-ib fl-mini fl-adicionar"
          testid="classe-adicionar"
          nome="Adicionar classe"
          aria-label="Adicionar classe"
          onClick={() => alterar(um("classes", [...classes, { classe: "Guerreiro", nivel: 1 }]))}
        >
          <Plus size={13} aria-hidden />
        </BotaoComDica>
      )}
    </div>
  );
}

/** Os campos de texto do cabeçalho (antecedente, raça, alinhamento) e o XP. */
function CamposDeIdentidadeBruta(props: PropsDaAba) {
  const { ficha, alterar, editar } = props;
  const texto = (campo: "antecedente" | "raca" | "alinhamento", rotulo: string) => (
    <div className="fl-campo-id">
      <CampoTexto
        testid={`ficha-${campo}`}
        rotulo={rotulo}
        valor={ficha[campo] ?? ""}
        maxLength={64}
        desabilitado={!editar}
        className="fl-in fl-ln"
        aoMudar={(t) => alterar(um(campo, t === "" ? null : t))}
      />
      <span className="fl-lbl">{rotulo}</span>
    </div>
  );
  return (
    <>
      {texto("antecedente", "Antecedente")}
      {texto("raca", "Raça")}
      {texto("alinhamento", "Tendência")}
      <div className="fl-campo-id fl-campo-xp">
        <CampoNumero
          testid="ficha-xp"
          rotulo="Pontos de experiência"
          valor={ficha.xp ?? 0}
          max={99_999_999}
          desabilitado={!editar}
          className="fl-in fl-ln"
          aoMudar={(n) => alterar(um("xp", n === 0 ? null : n))}
        />
        <span className="fl-lbl">XP</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Coluna da esquerda: atributos, inspiração, proficiência, salvaguardas e perícias
// ---------------------------------------------------------------------------------------------

function AtributosBruta({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  return (
    <section className="fl-atributos" data-testid="fh-atributos" aria-label="Atributos">
      {ATRIBUTOS.map((a) => (
        <div key={a} className="fl-at" data-testid={`atributo-${a}`}>
          <span className="fl-lbl fl-fa fl-at-sigla">{SIGLA_DO_ATRIBUTO[a]}</span>
          <NumeroRolavel
            testid={`atributo-mod-${a}`}
            valor={d.atributos[a].mod}
            nome={`Teste de ${ROTULO_DO_ATRIBUTO[a]}`}
            rolador={rolador}
            className="fl-modificador"
          />
          <CampoNumero
            testid={`atributo-valor-${a}`}
            rotulo={`Valor de ${ROTULO_DO_ATRIBUTO[a]}`}
            valor={ficha.atributos?.[a] ?? 10}
            min={1}
            max={30}
            desabilitado={!editar}
            className="fl-oval"
            aoMudar={(n) => alterar(um(`atributos.${a}`, n))}
          />
        </div>
      ))}
    </section>
  );
}

function PassivaBruta({ d }: PropsDaAba) {
  return (
    <div className="fl-cx fl-passiva" data-testid="fh-passiva">
      <strong className="fl-fa fl-passiva-valor" data-testid="percepcao-passiva">
        {d.percepcaoPassiva}
      </strong>
      <span className="fl-lbl">Percepção passiva</span>
    </div>
  );
}

function InspiracaoEProficienciaBruta({ ficha, d, alterar, editar }: PropsDaAba) {
  const tem = ficha.inspiracao === true;
  return (
    <>
      <label className="fl-cx fl-faixa" data-testid="fh-inspiracao">
        <input
          type="checkbox"
          className="fl-dot"
          data-testid="ficha-inspiracao"
          aria-label={tem ? "Inspiração: tem" : "Inspiração: não tem"}
          checked={tem}
          disabled={!editar}
          onChange={() => alterar(um("inspiracao", tem ? null : true))}
        />
        <span className="fl-lbl fl-faixa-nome">Inspiração</span>
      </label>
      <div className="fl-cx fl-faixa" data-testid="fh-proficiencia">
        <strong className="fl-fa fl-faixa-valor" data-testid="proficiencia">
          {formatarBonus(d.proficiencia)}
        </strong>
        <span className="fl-lbl fl-faixa-nome">Bônus de proficiência</span>
      </div>
    </>
  );
}

/** O sinal discreto de que a linha tem bônus extra (o valor está na dica; o total já o inclui). */
function MarcaDeBonus({ valor }: { valor: number }) {
  if (valor === 0) return null;
  return (
    <span
      className="fl-bonus-marca"
      role="img"
      aria-label={`Bônus extra ${formatarBonus(valor)}`}
      title={`Bônus extra ${formatarBonus(valor)}`}
    />
  );
}

function SalvaguardasBruta({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  const mod = useModificadorExtra(editar);
  const aberta = ATRIBUTOS.find((a) => mod.aberto?.id === `salva-${a}`);
  return (
    <Caixa testid="fh-salvaguardas" className="fl-lista-de-testes" rotulo="Salvaguardas">
      <Secao>Salvaguardas</Secao>
      {ATRIBUTOS.map((a) => (
        <div
          key={a}
          className="fl-linha"
          data-testid={`salvaguarda-${a}`}
          {...mod.propsDaLinha(`salva-${a}`)}
        >
          <BotaoDeProficiencia
            testid={`prof-salva-${a}`}
            nome={`salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}`}
            nivel={d.salvaguardas[a].nivel}
            editar={editar}
            aoMudar={(nivel) => alterar(um(`salvaguardas.${a}.nivel`, nivel))}
          />
          <button
            type="button"
            className="fl-rl fl-teste"
            data-testid={`salvaguarda-botao-${a}`}
            disabled={!rolador.podeRolar}
            title={rolador.podeRolar ? undefined : "Só quem edita a ficha rola"}
            aria-label={`Rolar salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}, ${formatarBonus(d.salvaguardas[a].total)}`}
            onClick={() =>
              rolador.teste(`Salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}`, d.salvaguardas[a].total)
            }
          >
            <span className="fl-fa fl-rn fl-teste-bonus" data-testid={`salvaguarda-total-${a}`}>
              {formatarBonus(d.salvaguardas[a].total)}
            </span>
            <span className="fl-teste-nome">{ROTULO_DO_ATRIBUTO[a]}</span>
            <MarcaDeBonus valor={ficha.salvaguardas?.[a]?.bonus ?? 0} />
          </button>
        </div>
      ))}
      {mod.aberto && aberta && (
        <PopoverDoModificador
          testid={`salvaguarda-bonus-${aberta}`}
          rotulo={`Modificador extra na salvaguarda de ${ROTULO_DO_ATRIBUTO[aberta]}`}
          valor={ficha.salvaguardas?.[aberta]?.bonus ?? 0}
          x={mod.aberto.x}
          y={mod.aberto.y}
          testidDoFoco={`salvaguarda-botao-${aberta}`}
          aoFechar={() => mod.setAberto(null)}
          aoMudar={(n) =>
            alterar(
              ficha.salvaguardas?.[aberta]
                ? um(`salvaguardas.${aberta}.bonus`, n === 0 ? null : n)
                : um(`salvaguardas.${aberta}`, {
                    nivel: "nenhuma",
                    ...(n === 0 ? {} : { bonus: n }),
                  }),
            )
          }
        />
      )}
    </Caixa>
  );
}

function PericiasBruta({ ficha, d, alterar, editar, rolador }: PropsDaAba) {
  const mod = useModificadorExtra(editar);
  const aberta = PERICIAS_NA_ORDEM_DO_PDF.find((def) => mod.aberto?.id === `pericia-${def.id}`);
  return (
    <Caixa testid="fh-pericias" className="fl-lista-de-testes" rotulo="Perícias">
      <Secao>Perícias</Secao>
      {PERICIAS_NA_ORDEM_DO_PDF.map((def) => {
        const p = d.pericias.find((x) => x.id === def.id);
        if (!p) return null;
        const nome = nomeNoPdf(p.id, p.nome);
        return (
          <div
            key={p.id}
            className="fl-linha"
            data-testid={`pericia-${p.id}`}
            {...mod.propsDaLinha(`pericia-${p.id}`)}
          >
            <BotaoDeProficiencia
              testid={`prof-pericia-${p.id}`}
              nome={nome}
              nivel={p.nivel}
              editar={editar}
              aoMudar={(nivel) => alterar(um(`pericias.${p.id}.nivel`, nivel))}
            />
            <button
              type="button"
              className="fl-rl fl-teste"
              data-testid={`pericia-botao-${p.id}`}
              disabled={!rolador.podeRolar}
              title={rolador.podeRolar ? undefined : "Só quem edita a ficha rola"}
              aria-label={`Rolar ${nome} ${formatarBonus(p.total)}`}
              onClick={() => rolador.teste(nome, p.total)}
            >
              <span className="fl-fa fl-rn fl-teste-bonus" data-testid={`pericia-total-${p.id}`}>
                {formatarBonus(p.total)}
              </span>
              <span className="fl-teste-nome" title={`${nome} (${SIGLA_DO_ATRIBUTO[p.atributo]})`}>
                {nome}
              </span>
              <MarcaDeBonus valor={ficha.pericias?.[p.id]?.bonus ?? 0} />
            </button>
          </div>
        );
      })}
      {mod.aberto && aberta && (
        <PopoverDoModificador
          testid={`pericia-bonus-${aberta.id}`}
          rotulo={`Modificador extra em ${nomeNoPdf(aberta.id, aberta.nome)}`}
          valor={ficha.pericias?.[aberta.id]?.bonus ?? 0}
          x={mod.aberto.x}
          y={mod.aberto.y}
          testidDoFoco={`pericia-botao-${aberta.id}`}
          aoFechar={() => mod.setAberto(null)}
          aoMudar={(n) =>
            alterar(
              ficha.pericias?.[aberta.id]
                ? um(`pericias.${aberta.id}.bonus`, n === 0 ? null : n)
                : um(`pericias.${aberta.id}`, {
                    nivel: "nenhuma",
                    ...(n === 0 ? {} : { bonus: n }),
                  }),
            )
          }
        />
      )}
    </Caixa>
  );
}

// ---------------------------------------------------------------------------------------------
// Coluna do meio: CA, iniciativa, deslocamento, vida, dados de vida, morte, moedas, ataques, equipamento
// ---------------------------------------------------------------------------------------------

function BotaoDeIniciativaBruta({
  d,
  rolador,
  ordem,
}: Pick<PropsDaAba, "d" | "rolador" | "ordem">) {
  return ordem?.aberta ? (
    <BotaoComDica
      type="button"
      className="fl-rl fl-grande-rolavel"
      testid="iniciativa"
      dica="Rolar a iniciativa e entrar na ordem de turno"
      nomeVisivel
      motivo={rolador.podeRolar ? null : "Só quem edita a ficha rola"}
      aria-label={`Rolar Iniciativa ${formatarBonus(d.iniciativa)} e entrar na ordem de turno`}
      onClick={ordem.entrar}
    >
      <span className="fl-fa fl-rn">{formatarBonus(d.iniciativa)}</span>
    </BotaoComDica>
  ) : (
    <button
      type="button"
      className="fl-rl fl-grande-rolavel"
      data-testid="iniciativa"
      disabled={!rolador.podeRolar}
      title={rolador.podeRolar ? undefined : "Só quem edita a ficha rola"}
      aria-label={`Rolar Iniciativa ${formatarBonus(d.iniciativa)}`}
      onClick={() => rolador.teste("Iniciativa", d.iniciativa)}
    >
      <span className="fl-fa fl-rn">{formatarBonus(d.iniciativa)}</span>
    </button>
  );
}

function CampoDeCaBruta({
  personagemId,
  d,
  alterar,
  editar,
  className,
}: PropsDaAba & { className?: string }) {
  return (
    <CampoNumero
      testid={`ca-${personagemId}`}
      rotulo="Classe de armadura"
      valor={d.ca}
      max={50}
      desabilitado={!editar}
      className={`fl-in fl-fn ${className ?? ""}`}
      aoMudar={(n) => alterar(um("ca.valor", n))}
    />
  );
}

function CampoDeDeslocamentoBruta({
  d,
  alterar,
  editar,
  className,
}: PropsDaAba & { className?: string }) {
  return (
    <CampoNumero
      testid="deslocamento-ft"
      rotulo="Deslocamento em pés (ft)"
      valor={d.deslocamentoFt}
      max={500}
      desabilitado={!editar}
      className={`fl-in fl-fn ${className ?? ""}`}
      aoMudar={(n) => alterar(um("deslocamentoFt", n))}
    />
  );
}

function CaIniciativaDeslocamentoBruta(props: PropsDaAba) {
  const { d, rolador, ordem } = props;
  return (
    <div className="fl-resumo">
      <div className="fl-escudo" data-testid="fh-ca">
        <svg className="fl-escudo-svg" viewBox="0 0 80 92" fill="none" aria-hidden="true">
          <path
            d="M40 4 L72 15 V46 C72 66 58 80 40 88 C22 80 8 66 8 46 V15 Z"
            className="fl-escudo-fora"
          />
          <path
            d="M40 9 L67 18 V46 C67 63 55 75 40 82 C25 75 13 63 13 46 V18 Z"
            className="fl-escudo-dentro"
          />
        </svg>
        <span className="fl-lbl fl-escudo-rotulo">CA</span>
        <CampoDeCa {...props} className="fl-ca" />
      </div>
      <div className="fl-cx fl-quadrada" data-testid="fh-iniciativa">
        <span className="fl-lbl">Iniciativa</span>
        <BotaoDeIniciativa d={d} rolador={rolador} ordem={ordem} />
      </div>
      <div className="fl-cx fl-quadrada" data-testid="fh-deslocamento">
        <span className="fl-lbl">Desloc.</span>
        <CampoDeDeslocamento {...props} className="fl-desloc" />
        <span className="fl-sr" data-testid="deslocamento-texto">
          ft = {String(d.deslocamentoM).replace(".", ",")} m
        </span>
      </div>
    </div>
  );
}

/** PV atuais com − e +: o dano consome os temporários primeiro. */
function ControlesDePvBruta({ personagemId, ficha, alterar, editar, pvDoModelo }: PropsDaAba) {
  const tirar = () => {
    const novo = receberDano(ficha, 1);
    alterar([
      { caminho: "pvAtual", valor: novo.pvAtual },
      { caminho: "pvTemp", valor: novo.pvTemp === 0 ? null : novo.pvTemp },
    ]);
  };
  const somar = () => alterar(um("pvAtual", Math.min(ficha.pvMax, ficha.pvAtual + 1)));
  return (
    <div className="fl-pv-linha">
      <BotaoComDica
        className="fl-ib fl-ib-borda"
        testid="pv-menos"
        nome="Tirar 1 PV"
        aria-label="Tirar 1 PV"
        motivo={editar ? null : "Só quem edita a ficha muda"}
        onClick={tirar}
      >
        <Minus size={16} aria-hidden />
      </BotaoComDica>
      <CampoNumero
        testid={`pv-atual-${personagemId}`}
        rotulo={pvDoModelo ? "PV atuais do modelo" : "PV atuais"}
        valor={ficha.pvAtual}
        max={9999}
        desabilitado={!editar}
        className="fl-in fl-fn fl-pv-atual"
        aoMudar={(n) => alterar(um("pvAtual", n))}
      />
      <BotaoComDica
        className="fl-ib fl-ib-borda"
        testid="pv-mais"
        nome="Somar 1 PV"
        aria-label="Somar 1 PV"
        motivo={editar ? null : "Só quem edita a ficha muda"}
        onClick={somar}
      >
        <Plus size={16} aria-hidden />
      </BotaoComDica>
    </div>
  );
}

function BarraDePvBruta({ ficha }: Pick<PropsDaAba, "ficha">) {
  const pct = Math.max(
    0,
    Math.min(100, Math.round((ficha.pvAtual / Math.max(1, ficha.pvMax)) * 100)),
  );
  const nivel = pct > 50 ? "alto" : pct > 25 ? "medio" : "baixo";
  return (
    <div
      className="fl-barra"
      role="img"
      aria-label={`PV ${ficha.pvAtual} de ${ficha.pvMax}`}
      data-testid="pv-barra"
    >
      <div className="fl-barra-cheia" data-nivel={nivel} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ControlesDePvTemporarioBruta({ personagemId, ficha, alterar, editar }: PropsDaAba) {
  const temp = ficha.pvTemp ?? 0;
  const ajustar = (n: number) => alterar(um("pvTemp", n <= 0 ? null : n));
  return (
    <div className="fl-pvt">
      <BotaoComDica
        className="fl-ib fl-mq"
        testid="pv-temp-menos"
        nome="Tirar 1 PV temporário"
        aria-label="Tirar 1 PV temporário"
        motivo={editar ? null : "Só quem edita a ficha muda"}
        onClick={() => ajustar(temp - 1)}
      >
        <Minus size={13} aria-hidden />
      </BotaoComDica>
      <CampoNumero
        testid={`pv-temp-${personagemId}`}
        rotulo="PV temporários"
        valor={temp}
        desabilitado={!editar}
        className="fl-in fl-fn fl-pv-temp"
        aoMudar={(n) => alterar(um("pvTemp", n === 0 ? null : n))}
      />
      <BotaoComDica
        className="fl-ib fl-mq"
        testid="pv-temp-mais"
        nome="Somar 1 PV temporário"
        aria-label="Somar 1 PV temporário"
        motivo={editar ? null : "Só quem edita a ficha muda"}
        onClick={() => ajustar(temp + 1)}
      >
        <Plus size={13} aria-hidden />
      </BotaoComDica>
    </div>
  );
}

function PontosDeVidaBruta(props: PropsDaAba) {
  const { personagemId, ficha, alterar, editar } = props;
  return (
    <Caixa moldura testid="fh-pv" className="fl-bloco" rotulo="Pontos de Vida">
      <Secao>{props.pvDoModelo ? "Pontos de Vida do modelo" : "Pontos de Vida"}</Secao>
      <ControlesDePv {...props} />
      <BarraDePv ficha={ficha} />
      <div className="fl-pv-baixo">
        <div className="fl-pv-max">
          <CampoNumero
            testid={`pv-max-${personagemId}`}
            rotulo={props.pvDoModelo ? "PV máximos do modelo" : "PV máximos"}
            valor={ficha.pvMax}
            desabilitado={!editar}
            className="fl-in fl-fn fl-pv-max-campo"
            aoMudar={(n) => alterar(um("pvMax", n))}
          />
          <span className="fl-lbl">Máximo</span>
        </div>
        <div className="fl-pv-temp-bloco" data-testid="fh-pv-temp">
          <ControlesDePvTemporario {...props} />
          <span className="fl-lbl">Temporários</span>
        </div>
      </div>
    </Caixa>
  );
}

/** Acima disto, os dados de vida de um tipo viram o contador compacto (V4a3). */
const LIMITE_DE_BOLINHAS_DE_DV = 12;

function DadosDeVidaBruta({ d, alterar, editar, rolador, enviar, personagemId }: PropsDaAba) {
  return (
    <Caixa testid="fh-dados-de-vida" className="fl-bloco" rotulo="Dados de Vida">
      <Secao>Dados de Vida</Secao>
      {d.dadosDeVida.length === 0 && <p className="fl-dica">Sem classe do SRD</p>}
      {d.dadosDeVida.map((dv) => (
        <div key={dv.dado} className="fl-dv" data-testid={`dv-${dv.dado}`}>
          <button
            type="button"
            className="fl-pill fl-fa fl-dv-rolar"
            data-testid={`dv-rolar-${dv.dado}`}
            disabled={!rolador.podeRolar || dv.restantes <= 0}
            aria-label={`Gastar um dado de vida ${dv.dado} e rolar`}
            // V4a2: a sala rola 1dN + Con, marca o dado, soma a cura ao PV (teto no máximo) e publica no chat
            onClick={() => enviar("ficha.dadoDeVida", { personagemId, dado: dv.dado })}
          >
            <Dices size={15} aria-hidden /> <span>{dv.dado}</span>
          </button>
          {dv.total > LIMITE_DE_BOLINHAS_DE_DV ? (
            // V4a3: acima de ~12 por tipo as bolinhas viram o contador compacto, com − e +
            <>
              <BotaoComDica
                className="fl-ib fl-mq"
                testid={`dv-menos-${dv.dado}`}
                nome={`Gastar um dado de vida ${dv.dado} (sem rolar)`}
                aria-label={`Marcar um dado de vida ${dv.dado} como gasto`}
                motivo={
                  editar
                    ? dv.restantes <= 0
                      ? "Não há dados restantes"
                      : null
                    : "Só quem edita a ficha muda"
                }
                onClick={() => alterar(um(`dadosDeVidaUsados.${dv.dado}`, dv.usados + 1))}
              >
                <Minus size={13} aria-hidden />
              </BotaoComDica>
              <span className="fl-lbl fl-dv-contagem" data-testid={`dv-restantes-${dv.dado}`}>
                {dv.restantes}/{dv.total}
              </span>
              <BotaoComDica
                className="fl-ib fl-mq"
                testid={`dv-mais-${dv.dado}`}
                nome={`Recuperar um dado de vida ${dv.dado}`}
                aria-label={`Recuperar um dado de vida ${dv.dado}`}
                motivo={
                  editar
                    ? dv.usados <= 0
                      ? "Todos os dados estão disponíveis"
                      : null
                    : "Só quem edita a ficha muda"
                }
                onClick={() =>
                  alterar(
                    um(`dadosDeVidaUsados.${dv.dado}`, dv.usados - 1 <= 0 ? null : dv.usados - 1),
                  )
                }
              >
                <Plus size={13} aria-hidden />
              </BotaoComDica>
            </>
          ) : (
            <>
              <span className="fl-bolinhas fl-bolinhas-dv">
                {Array.from({ length: dv.total }, (_, n) => n + 1).map((n) => (
                  <Bolinha
                    key={n}
                    testid={`dv-bolinha-${dv.dado}-${n}`}
                    rotulo={`Dado de vida ${dv.dado} número ${n}`}
                    marcada={n <= dv.restantes}
                    desabilitado={!editar}
                    aoMudar={() => {
                      const restantes = n <= dv.restantes ? n - 1 : n;
                      const usados = dv.total - restantes;
                      alterar(um(`dadosDeVidaUsados.${dv.dado}`, usados === 0 ? null : usados));
                    }}
                  />
                ))}
              </span>
              <span className="fl-lbl fl-dv-contagem" data-testid={`dv-restantes-${dv.dado}`}>
                {dv.restantes}/{dv.total}
              </span>
            </>
          )}
        </div>
      ))}
    </Caixa>
  );
}

function ContraAMorteBruta({ ficha, alterar, editar, rolador }: PropsDaAba) {
  const mortes = ficha.mortes ?? { sucessos: 0, falhas: 0 };
  const marcas = (campo: "sucessos" | "falhas") =>
    [1, 2, 3].map((n) => (
      <Bolinha
        key={n}
        testid={`morte-${campo}-${n}`}
        rotulo={`${campo === "sucessos" ? "Sucesso" : "Falha"} ${n} no teste contra a morte`}
        marcada={mortes[campo] >= n}
        falha={campo === "falhas"}
        desabilitado={!editar}
        aoMudar={() =>
          alterar(um("mortes", { ...mortes, [campo]: mortes[campo] >= n ? n - 1 : n }))
        }
      />
    ));
  return (
    <Caixa testid="fh-mortes" className="fl-bloco" rotulo="Contra a Morte">
      <Secao>Contra a Morte</Secao>
      <div className="fl-morte">
        <div className="fl-morte-marcas">
          <div className="fl-morte-linha">
            <span className="fl-lbl fl-morte-rotulo">Sucessos</span>
            {marcas("sucessos")}
          </div>
          <div className="fl-morte-linha">
            <span className="fl-lbl fl-morte-rotulo">Falhas</span>
            {marcas("falhas")}
          </div>
        </div>
        <button
          type="button"
          className="fl-sec2 fl-morte-rolar"
          data-testid="morte-rolar"
          disabled={!rolador.podeRolar}
          aria-label="Rolar teste contra a morte"
          onClick={() => rolador.teste("Teste contra a morte", 0, 10)}
        >
          <Dices size={17} aria-hidden />
          <span>Rolar</span>
        </button>
      </div>
    </Caixa>
  );
}

function MoedasBruta({ ficha, alterar, editar }: PropsDaAba) {
  return (
    <Caixa testid="fh-moedas" className="fl-bloco" rotulo="Moedas">
      <Secao>Moedas</Secao>
      <div className="fl-moedas">
        {MOEDAS.map((m) => (
          <div key={m} className="fl-moeda">
            <CampoNumero
              testid={`moeda-${m}`}
              rotulo={NOME_DA_MOEDA[m]}
              valor={ficha.moedas?.[m] ?? 0}
              max={9_999_999}
              desabilitado={!editar}
              className="fl-in fl-fn fl-moeda-campo"
              aoMudar={(n) => {
                const atuais = { ...(ficha.moedas ?? {}) };
                if (n === 0) delete atuais[m];
                else atuais[m] = n;
                alterar(um("moedas", Object.keys(atuais).length === 0 ? null : atuais));
              }}
            />
            <span className="fl-lbl">{ROTULO_DA_MOEDA[m]}</span>
          </div>
        ))}
      </div>
      <div className="fl-moedas-total">
        <span className="fl-lbl">Total em peças de ouro</span>
        <span className="fl-fn fl-moedas-valor" data-testid="moedas-total">
          {comVirgula(moedasEmOuro(ficha))} po
        </span>
      </div>
    </Caixa>
  );
}

// ---- Ataques e magias ----

type LinhaDeAtaque =
  | { tipo: "ataque"; i: number; r: Ataque }
  | { tipo: "magia"; i: number; r: Magia };

/** A lista de Ataques e magias: os ataques da ficha e as magias marcadas com "Mostrar em Ataques e magias". */
export function linhasDeAtaque(ficha: Ficha): LinhaDeAtaque[] {
  return [
    ...(ficha.ataques ?? []).map((r, i): LinhaDeAtaque => ({ tipo: "ataque", i, r })),
    ...(ficha.magias ?? []).flatMap((r, i): LinhaDeAtaque[] =>
      r.emAtaques ? [{ tipo: "magia", i, r }] : [],
    ),
  ];
}

function LinhaDoAtaque({
  l,
  props,
  ordem,
}: {
  l: LinhaDeAtaque;
  props: PropsDaAba;
  ordem: HTMLAttributes<HTMLDivElement>;
}) {
  const { ficha, d, rolador, editar, abrirEditor, enviar, personagemId } = props;
  const { r } = l;
  const prefixo = l.tipo === "magia" ? `ataque-magia-${l.i}` : `ataque-${l.i}`;
  const acerto = bonusDeAcerto(ficha, r);
  const dano = expressaoDeDano(ficha, r);
  const cd = cdDaRolagem(ficha, r);
  const previa = previaDoAtaque(ficha, r);
  const magia = l.tipo === "magia" ? l.r : undefined;
  const espaco =
    magia && magia.nivel > 0 ? d.espacos.find((e) => e.nivel === magia.nivel) : undefined;
  const nivelTxt = magia ? (magia.nivel === 0 ? "truque" : `${magia.nivel}º nível`) : "";
  const sub = [dano ? (r.tipo ?? "").toLowerCase() : "", r.alcance ?? ""]
    .filter(Boolean)
    .join(" · ");
  const podeRolar = rolador.podeRolar;
  const conj = useConjurar(props, magia);

  function rolarAcerto() {
    if (acerto !== undefined) return rolador.acerto(r, ficha);
    if (cd === undefined || !podeRolar) return;
    if (dano !== undefined) return rolador.ataque(r, ficha);
    enviar("chat.caracteristica", {
      caracteristica: {
        nome: r.nome.slice(0, 80),
        descricao: previa.salvaguarda ?? `CD ${cd}`,
        origem: magia ? `Magia · ${nivelTxt}` : "Ataque",
      },
      como: personagemId,
    });
  }

  return (
    <div className="fl-ar" data-testid={prefixo} {...ordem}>
      <button
        type="button"
        className="fl-nm"
        data-foco-ordem
        data-testid={`${prefixo.replace("ataque-", "ataque-nome-")}`}
        disabled={!podeRolar}
        aria-label={
          magia
            ? `Conjurar ${r.nome}${magia.nivel > 0 ? ", escolhendo o espaço de magia" : ""}: ataque e dano`
            : `Rolar ${r.nome}: ataque e dano juntos`
        }
        onClick={(e) => (magia ? conj.pedir(e.currentTarget) : rolador.ataque(r, ficha))}
      >
        <span className="fl-nmt">{r.nome}</span>
        <span className="fl-sub">
          {magia && <span className="fl-tgm">magia · {nivelTxt}</span>}
          {espaco && (
            <span
              className="fl-sds"
              role="img"
              aria-label={`${espaco.restantes} de ${espaco.total} espaços de ${magia?.nivel}º nível`}
            >
              {Array.from({ length: espaco.total }, (_, q) => q).map((q) => (
                <span key={q} className="fl-sd" data-on={q < espaco.restantes} />
              ))}
            </span>
          )}
          {sub && <span>{sub}</span>}
        </span>
      </button>
      <button
        type="button"
        className="fl-rb"
        data-testid={`${prefixo.replace("ataque-", "ataque-rolar-")}`}
        disabled={!podeRolar || (acerto === undefined && cd === undefined)}
        aria-label={
          acerto !== undefined
            ? `Rolar o ataque de ${r.nome}, ${formatarBonus(acerto)} para acertar`
            : cd !== undefined
              ? `Mostrar a CD de ${r.nome} no chat, ${cd}`
              : "Sem jogada de ataque"
        }
        onClick={rolarAcerto}
      >
        {acerto !== undefined ? formatarBonus(acerto) : cd !== undefined ? `CD ${cd}` : "–"}
      </button>
      <button
        type="button"
        className="fl-rb fl-dm"
        data-testid={`${prefixo.replace("ataque-", "ataque-dano-")}`}
        disabled={!podeRolar || dano === undefined}
        aria-label={dano ? `Rolar o dano de ${r.nome}, ${dano}` : "Sem dano"}
        onClick={() => rolador.dano(r, ficha)}
      >
        {dano ?? "–"}
      </button>
      <span className="fl-ar-fim">
        {magia && (
          <BotaoPingarMagia
            props={props}
            m={magia}
            testid={`${prefixo.replace("ataque-", "ataque-pingar-")}`}
          />
        )}
        <BotaoComDica
          className="fl-ib fl-eng"
          testid={`${prefixo.replace("ataque-", "ataque-editar-")}`}
          nome={`Configurar ${r.nome}`}
          aria-label={`Configurar ${r.nome}`}
          motivo={editar ? null : "Só quem edita a ficha configura"}
          onClick={() => abrirEditor({ tipo: l.tipo, i: l.i })}
        >
          <Settings size={18} aria-hidden />
        </BotaoComDica>
      </span>
      {conj.menu}
    </div>
  );
}

function AtaquesBruta(props: PropsDaAba) {
  const { ficha, alterar, editar, abrirEditor, fecharEditor } = props;
  const linhas = linhasDeAtaque(ficha);
  const doTipo = (tipo: "ataque" | "magia") => linhas.filter((x) => x.tipo === tipo);
  // Reordenar: os ataques entre si e as magias de "Mostrar em Ataques e magias" entre si (cada uma mora na sua lista).
  const ordemDosAtaques = useOrdemDaLista({
    lista: "ataque",
    habilitado: editar,
    aoMover: (de, para) => {
      const todos = ficha.ataques ?? [];
      fecharEditor();
      alterar(
        um(
          "ataques",
          moverNoGrupo(
            todos,
            posicoesDoGrupo(todos, () => true),
            de,
            para,
          ),
        ),
      );
    },
  });
  const ordemDasMagias = useOrdemDaLista({
    lista: "magia-ataque",
    habilitado: editar,
    aoMover: (de, para) => {
      const todas = ficha.magias ?? [];
      fecharEditor();
      alterar(
        um(
          "magias",
          moverNoGrupo(
            todas,
            posicoesDoGrupo(todas, (m) => m.emAtaques === true),
            de,
            para,
          ),
        ),
      );
    },
  });
  const soltar = useSoltarDoCompendio({
    aceita: ["arma", "magia"],
    habilitado: editar,
    listaDoTipo: { arma: "ataque" },
    aoSoltar: (entrada, posicao) =>
      soltarNaFicha(props, "personagem", entrada, { posicao, emAtaques: true }),
  });
  const ataquesDaLista = doTipo("ataque");
  const magiasDaLista = doTipo("magia");
  const novo = () => {
    const ataques = ficha.ataques ?? [];
    const ok = alterar(
      um("ataques", [
        ...ataques,
        {
          nome: "Novo ataque",
          acerto: { tipo: "formula", atributo: "for", proficiente: true },
          dano: "1d6",
          atributoDano: "for",
          tipo: "Cortante",
        },
      ]),
    );
    if (ok) abrirEditor({ tipo: "ataque", i: ataques.length });
  };
  return (
    <Caixa
      testid="fh-ataques"
      className="fl-bloco fl-soltar"
      rotulo="Ataques e Magias"
      {...soltar.props}
    >
      <Secao>Ataques e Magias</Secao>
      <div className="fl-ataques">
        <div className="fl-ar fl-ar-cab" aria-hidden>
          <span className="fl-lbl fl-ar-nome">Nome</span>
          <span className="fl-lbl fl-ar-c">Acerto</span>
          <span className="fl-lbl fl-ar-c">Dano</span>
          <span />
        </div>
        {ataquesDaLista.map((l, k) => (
          <LinhaDoAtaque
            key={`ataque-${l.i}`}
            l={l}
            props={props}
            ordem={{
              ...ordemDosAtaques.linha(k, ataquesDaLista.length),
              ...(soltar.previsao?.lista === "ataque"
                ? {
                    "data-indicador": indicadorDoVao(soltar.previsao.vao, k, ataquesDaLista.length),
                  }
                : {}),
            }}
          />
        ))}
        {magiasDaLista.map((l, k) => (
          <LinhaDoAtaque
            key={`magia-${l.i}`}
            l={l}
            props={props}
            ordem={ordemDasMagias.linha(k, magiasDaLista.length)}
          />
        ))}
      </div>
      {soltar.acesa && (
        <p className="fl-soltar-aviso" data-testid="soltar-aqui-ataques">
          Solte aqui para pôr no ataque ou na magia
        </p>
      )}
      {editar && (
        <button
          type="button"
          className="fl-pill fl-novo"
          data-testid="ataque-adicionar"
          onClick={novo}
        >
          <Plus size={15} aria-hidden /> Novo ataque
        </button>
      )}
      {linhas.length === 0 && !editar && <p className="fl-dica">Nenhum ataque.</p>}
      <CampoTexto
        testid="ficha-ataques-texto"
        rotulo="Texto de ataques e magias"
        placeholder="Anotações sobre ataques e magias"
        valor={ficha.ataquesTexto ?? ""}
        maxLength={8000}
        multilinha
        crescente
        desabilitado={!editar}
        className="fl-in fl-notas-ataques"
        aoMudar={(t) => alterar(um("ataquesTexto", t === "" ? null : t))}
      />
    </Caixa>
  );
}

function EquipamentoBruta(props: PropsDaAba) {
  const { ficha, alterar, editar, luz, enviar } = props;
  const itens = ficha.itens ?? [];
  const ordem = useOrdemDaLista({
    lista: "itens",
    habilitado: editar,
    aoMover: (de, para) =>
      alterar(
        um(
          "itens",
          moverNoGrupo(
            itens,
            posicoesDoGrupo(itens, () => true),
            de,
            para,
          ),
        ),
      ),
  });
  const soltar = useSoltarDoCompendio({
    aceita: ["item", "itemMagico"],
    habilitado: editar,
    listaDoTipo: { item: "itens", itemMagico: "itens" },
    aoSoltar: (entrada, posicao) => soltarNaFicha(props, "personagem", entrada, { posicao }),
  });
  const euMestre = luz?.eu.papel === "mestre";
  useTicDasLuzes(luz);
  const modeloDe = itens.map((it) => modeloDaLinha(luz, it));
  return (
    <Caixa testid="fh-itens" className="fl-bloco fl-soltar" rotulo="Equipamento" {...soltar.props}>
      <Secao>Equipamento</Secao>
      <div className="fl-itens">
        {itens.map((it, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
            key={`i-${i}`}
            className="fl-item-grupo"
            {...ordem.linha(i, itens.length)}
            {...(soltar.previsao?.lista === "itens"
              ? { "data-indicador": indicadorDoVao(soltar.previsao.vao, i, itens.length) }
              : {})}
          >
            <div className="fl-item" data-testid={`item-${i}`}>
              <div className="fl-item-linha">
                {editar && <GripVertical size={14} className="fl-alca" aria-hidden />}
                <BotaoComDica
                  className="fl-ib fl-mq"
                  testid={`item-menos-${i}`}
                  nome={`Tirar uma unidade de ${it.nome}`}
                  aria-label={`Tirar uma unidade de ${it.nome}`}
                  motivo={editar ? null : "Só quem edita a ficha muda"}
                  onClick={() =>
                    alterar(um(`itens.${i}.quantidade`, Math.max(0, it.quantidade - 1)))
                  }
                >
                  <Minus size={12} aria-hidden />
                </BotaoComDica>
                <CampoNumero
                  testid={`item-quantidade-${i}`}
                  rotulo={`Quantidade de ${it.nome}`}
                  valor={it.quantidade}
                  max={modeloDe[i] && !euMestre ? it.quantidade : 9999}
                  desabilitado={!editar}
                  className="fl-in fl-fa fl-item-qtd"
                  aoMudar={(n) => alterar(um(`itens.${i}.quantidade`, n))}
                />
                <BotaoComDica
                  className="fl-ib fl-mq"
                  testid={`item-mais-${i}`}
                  nome={`Somar uma unidade de ${it.nome}`}
                  aria-label={`Somar uma unidade de ${it.nome}`}
                  motivo={
                    !editar
                      ? "Só quem edita a ficha muda"
                      : modeloDe[i] && !euMestre
                        ? "Só o mestre repõe objetos de luz"
                        : null
                  }
                  onClick={() =>
                    alterar(um(`itens.${i}.quantidade`, Math.min(9999, it.quantidade + 1)))
                  }
                >
                  <Plus size={12} aria-hidden />
                </BotaoComDica>
                <CampoTexto
                  testid={`item-nome-${i}`}
                  rotulo="Nome do item"
                  valor={it.nome}
                  maxLength={80}
                  desabilitado={!editar}
                  className="fl-in fl-item-nome"
                  aoMudar={(t) => alterar(um(`itens.${i}.nome`, t))}
                />
                {editar && (
                  <BotaoComDica
                    className="fl-ib"
                    testid={`item-remover-${i}`}
                    nome={`Tirar ${it.nome}`}
                    aria-label={`Tirar ${it.nome}`}
                    onClick={() => alterar(um(`itens.${i}`, null))}
                  >
                    <Trash2 size={15} aria-hidden />
                  </BotaoComDica>
                )}
              </div>
              <div className="fl-item-baixo">
                <CampoDecimal
                  testid={`item-peso-${i}`}
                  rotulo={`Peso de ${it.nome} em quilos`}
                  placeholder="peso"
                  valor={it.peso}
                  desabilitado={!editar}
                  className="fl-in fl-item-peso"
                  aoMudar={(n) => alterar(um(`itens.${i}.peso`, n === null || n === 0 ? null : n))}
                />
                <span className="fl-item-kg">kg</span>
                {(it.nota !== undefined || editar) && (
                  <CampoTexto
                    testid={`item-nota-${i}`}
                    rotulo="Nota do item"
                    placeholder="nota"
                    valor={it.nota ?? ""}
                    maxLength={4000}
                    desabilitado={!editar}
                    className="fl-in fl-item-nota"
                    aoMudar={(t) => alterar(um(`itens.${i}.nota`, t === "" ? null : t))}
                  />
                )}
                {luz && modeloDe[i] && (
                  <BotaoAcender
                    luz={luz}
                    modeloId={modeloDe[i] as string}
                    enviar={enviar}
                    indice={i}
                  />
                )}
              </div>
            </div>
            {luz && modeloDe[i] && modeloDe.indexOf(modeloDe[i]) === i && (
              <SublinhasDeLuz luz={luz} modeloId={modeloDe[i] as string} enviar={enviar} />
            )}
          </div>
        ))}
      </div>
      {editar && (
        <CampoDeNovo
          testid="item-novo-nome"
          rotulo="Nome do novo item"
          placeholder="Novo item"
          className="fl-in fl-item-novo"
          aoCriar={(t) => alterar(um("itens", [...itens, { nome: t, quantidade: 1 }]))}
        />
      )}
      {soltar.acesa && (
        <p className="fl-soltar-aviso" data-testid="soltar-aqui-equipamento">
          Solte aqui para pôr no equipamento
        </p>
      )}
      <div className="fl-carga">
        <span data-testid="carga-total">Carga: {comVirgula(cargaDaFicha(ficha))} kg</span>
      </div>
    </Caixa>
  );
}

// ---------------------------------------------------------------------------------------------
// Coluna da direita: personalidade e características
// ---------------------------------------------------------------------------------------------

function PersonalidadeBruta({ ficha, alterar, editar }: PropsDaAba) {
  const campos = [
    ["personalidade", "Traços de personalidade", "fl-t-150"],
    ["ideais", "Ideais", "fl-t-80"],
    ["ligacoes", "Vínculos", "fl-t-80"],
    ["defeitos", "Defeitos", "fl-t-70"],
  ] as const;
  return (
    <div className="fl-personalidade" data-testid="fh-personalidade">
      {campos.map(([campo, rotulo, tamanho]) => (
        <div key={campo} className="fl-cx fl-texto-caixa">
          <CampoTexto
            testid={`ficha-${campo}`}
            rotulo={rotulo}
            valor={ficha[campo] ?? ""}
            maxLength={2000}
            multilinha
            crescente
            desabilitado={!editar}
            className={`fl-in fl-area ${tamanho}`}
            aoMudar={(t) => alterar(um(campo, t === "" ? null : t))}
          />
          <span className="fl-lbl">{rotulo}</span>
        </div>
      ))}
    </div>
  );
}

function CaracteristicasBruta(props: PropsDaAba) {
  return (
    <div className="fl-caracteristicas" data-testid="fh-caracteristicas">
      <Secao>Características e Talentos</Secao>
      <div className="fl-cx fl-cx-lista">
        <ListaDeCaracteristicas
          campo="caracteristicas"
          testidBase="caracteristica"
          ficha={props.ficha}
          alterar={props.alterar}
          editar={props.editar}
          enviar={props.enviar}
          personagemId={props.personagemId}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// As duas páginas
// ---------------------------------------------------------------------------------------------

function PrincipalLarga(props: PropsDaAba) {
  const { editorAberto, fecharEditor } = props;
  return (
    <div className="fl-pers" data-testid="fh-aba-principal">
      <div className="fl-col-esq">
        <div className="fl-esq-topo">
          <div className="fl-col-atr">
            <Atributos {...props} />
            <Passiva {...props} />
          </div>
          <div className="fl-col-testes">
            <InspiracaoEProficiencia {...props} />
            <Salvaguardas {...props} />
            <Pericias {...props} />
          </div>
        </div>
      </div>
      {editorAberto ? (
        <div className="fl-col-editor">
          <EditorDeAtaque
            alvo={editorAberto}
            origem="principal"
            props={props}
            aoVoltar={fecharEditor}
          />
        </div>
      ) : (
        <>
          <div className="fl-col-meio">
            <CaIniciativaDeslocamento {...props} />
            <PontosDeVida {...props} />
            <DadosDeVida {...props} />
            <ContraAMorte {...props} />
            <Moedas {...props} />
            <Ataques {...props} />
            <Equipamento {...props} />
          </div>
          <div className="fl-col-dir">
            <Personalidade {...props} />
            <Caracteristicas {...props} />
          </div>
        </>
      )}
    </div>
  );
}

/** A janela estreita: o cabeçalho (nome, CA, iniciativa, PV) gruda no alto; o resto vira acordeão. */
function PrincipalEstreita(props: PropsDaAba) {
  const { editorAberto, fecharEditor, ficha, d } = props;
  if (editorAberto) {
    return (
      <div className="fl-pers fl-estreita" data-testid="fh-aba-principal">
        <EditorDeAtaque
          alvo={editorAberto}
          origem="principal"
          props={props}
          aoVoltar={fecharEditor}
        />
      </div>
    );
  }
  const classes = (ficha.classes ?? []).map((c) => `${c.classe} ${c.nivel}`).join(" / ");
  const profs = ATRIBUTOS.filter((a) => d.salvaguardas[a].nivel !== "nenhuma").length;
  const nAtq = linhasDeAtaque(ficha).length;
  const itens = ficha.itens ?? [];
  return (
    <div className="fl-pers fl-estreita" data-testid="fh-aba-principal">
      <Acordeao id="identidade" titulo="Identidade" resumo={classes || "Sem classe"}>
        <div className="fl-identidade-corpo">
          <ClasseENivel {...props} />
          <div className="fl-identidade-campos">
            <CamposDeIdentidade {...props} />
          </div>
        </div>
      </Acordeao>
      <Acordeao
        id="atributos"
        titulo="Atributos"
        resumo={`Prof. ${formatarBonus(d.proficiencia)}`}
        inicialmenteAberto
      >
        <div className="fl-estreita-atributos">
          <Atributos {...props} />
          <div className="fl-estreita-faixas">
            <InspiracaoEProficiencia {...props} />
            <Passiva {...props} />
          </div>
        </div>
      </Acordeao>
      <Acordeao
        id="salvaguardas-pericias"
        titulo="Salvaguardas e perícias"
        resumo={`${profs} salvaguardas`}
      >
        <div className="fl-estreita-testes">
          <Salvaguardas {...props} />
          <Pericias {...props} />
        </div>
      </Acordeao>
      <Acordeao
        id="vida"
        titulo="Vida e morte"
        resumo={`PV ${ficha.pvAtual}/${ficha.pvMax}`}
        inicialmenteAberto
      >
        <div className="fl-estreita-vida">
          <DadosDeVida {...props} />
          <ContraAMorte {...props} />
        </div>
      </Acordeao>
      <Acordeao id="moedas" titulo="Moedas" resumo={`${comVirgula(moedasEmOuro(ficha))} po`}>
        <Moedas {...props} />
      </Acordeao>
      <Acordeao id="ataques" titulo="Ataques" resumo={`${nAtq}`} inicialmenteAberto>
        <Ataques {...props} />
      </Acordeao>
      <Acordeao
        id="equipamento"
        titulo="Equipamento"
        resumo={`${itens.length} · ${comVirgula(cargaDaFicha(ficha))} kg`}
        inicialmenteAberto
      >
        <Equipamento {...props} />
      </Acordeao>
      <Acordeao id="personalidade" titulo="Personalidade">
        <Personalidade {...props} />
      </Acordeao>
      <Acordeao
        id="caracteristicas"
        titulo="Características"
        resumo={`${(ficha.caracteristicas ?? []).length}`}
      >
        <Caracteristicas {...props} />
      </Acordeao>
    </div>
  );
}

/** Aba Personagem: três colunas na janela larga; acordeão na estreita. */
export function AbaPrincipal(props: PropsDaAba) {
  return props.estreita ? <PrincipalEstreita {...props} /> : <PrincipalLarga {...props} />;
}

// Q14: as seções em `memo`, cada uma com as fatias da ficha e de `d` que lê (ver `secoes.tsx`).
export const ClasseENivel = secao("ClasseENivel", ClasseENivelBruta, { ficha: ["classes"] });
export const CamposDeIdentidade = secao("CamposDeIdentidade", CamposDeIdentidadeBruta, {
  ficha: ["antecedente", "raca", "alinhamento", "xp"],
});
export const Atributos = secao("Atributos", AtributosBruta, {
  ficha: ["atributos"],
  d: ["atributos"],
});
export const Passiva = secao("Passiva", PassivaBruta, { ficha: [], d: ["percepcaoPassiva"] });
export const InspiracaoEProficiencia = secao(
  "InspiracaoEProficiencia",
  InspiracaoEProficienciaBruta,
  { ficha: ["inspiracao"], d: ["proficiencia"] },
);
export const Salvaguardas = secao("Salvaguardas", SalvaguardasBruta, {
  ficha: ["salvaguardas"],
  d: ["salvaguardas"],
});
export const Pericias = secao("Pericias", PericiasBruta, { ficha: ["pericias"], d: ["pericias"] });
export const BotaoDeIniciativa = secao("BotaoDeIniciativa", BotaoDeIniciativaBruta, {
  ficha: [],
  d: ["iniciativa"],
});
export const CampoDeCa = secao("CampoDeCa", CampoDeCaBruta, { ficha: [], d: ["ca"] });
export const CampoDeDeslocamento = secao("CampoDeDeslocamento", CampoDeDeslocamentoBruta, {
  ficha: [],
  d: ["deslocamentoFt"],
});
const CaIniciativaDeslocamento = secao("CaIniciativaDeslocamento", CaIniciativaDeslocamentoBruta, {
  ficha: [],
  d: ["ca", "iniciativa", "deslocamentoFt", "deslocamentoM"],
});
export const ControlesDePv = secao("ControlesDePv", ControlesDePvBruta, {
  ficha: ["pvAtual", "pvMax", "pvTemp"],
});
export const BarraDePv = secao("BarraDePv", BarraDePvBruta, { ficha: ["pvAtual", "pvMax"] });
export const ControlesDePvTemporario = secao(
  "ControlesDePvTemporario",
  ControlesDePvTemporarioBruta,
  { ficha: ["pvTemp"] },
);
const PontosDeVida = secao("PontosDeVida", PontosDeVidaBruta, {
  ficha: ["pvAtual", "pvMax", "pvTemp"],
});
export const DadosDeVida = secao("DadosDeVida", DadosDeVidaBruta, {
  ficha: [],
  d: ["dadosDeVida"],
});
export const ContraAMorte = secao("ContraAMorte", ContraAMorteBruta, { ficha: ["mortes"] });
export const Moedas = secao("Moedas", MoedasBruta, { ficha: ["moedas"] });
export const Ataques = secao("Ataques", AtaquesBruta, { fichaExceto: TEXTOS_LIVRES, d: "todo" });
export const Equipamento = secao("Equipamento", EquipamentoBruta, {
  ficha: ["itens", "ataques"],
  comparar: { luz: mesmaLuz },
});
export const Personalidade = secao("Personalidade", PersonalidadeBruta, {
  ficha: ["personalidade", "ideais", "ligacoes", "defeitos"],
});
export const Caracteristicas = secao("Caracteristicas", CaracteristicasBruta, {
  ficha: ["caracteristicas"],
});
