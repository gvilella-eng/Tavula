import {
  aplicarOperacoes,
  derivar,
  descansoCurto,
  descansoLongo,
  type Estado,
  operacoesDeDiferenca,
  type Personagem,
  pode,
  podeEditarPersonagem,
  ROTULO_DA_VANTAGEM,
  type Usuario,
  VANTAGENS,
  type Vantagem,
} from "@tabletop/shared";
import { BedDouble, BookOpen, Coffee } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Fontes } from "../assets/fontes";
import type { GerenteDeAssets } from "../assets/gerente";
import { BotaoComDica } from "../BotaoComDica";
import { EditorDoItem } from "../EditorDoItem";
import type { PedirImagem } from "../FaixaDeCenas";
import { Janela } from "../janelas/Janela";
import type { ImagensDoMapa } from "../mapa/mapaPixi";
import type { TempoDaTela } from "../tempo";
import { useCompendio } from "../useCompendio";
import { AbaHistoria } from "./AbaHistoria";
import { AbaMagias } from "./AbaMagias";
import {
  AbaPrincipal,
  BarraDePv,
  BotaoDeIniciativa,
  CampoDeCa,
  CampoDeDeslocamento,
  CamposDeIdentidade,
  ClasseENivel,
  ControlesDePv,
  ControlesDePvTemporario,
  type PropsDaAba,
} from "./AbaPrincipal";
import {
  APARENCIAS,
  type AparenciaDaFicha,
  gravarAparencia,
  ROTULO_DA_APARENCIA,
  useAparencia,
} from "./aparencia";
import { exportarFicha, lerFichaDoArquivo } from "./arquivo";
import { CampoNumero } from "./campos";
import type { AlvoDoEditor } from "./EditorDeAtaque";
import {
  ABAS_DA_FICHA,
  type AbaDaFicha,
  ALTURA_MINIMA,
  idDaJanelaDaFicha,
  type JanelaDeFicha,
  LARGURA_DA_FICHA_ESTREITA,
  LARGURA_MINIMA,
  LARGURA_PADRAO,
} from "./janelas";
import { Caixa, Secao } from "./livro";
import { PainelExtra } from "./PainelExtra";
import { criarRolador } from "./rolador";
import { useFichaEditavel } from "./useFicha";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  janela: JanelaDeFicha;
  /** Quantas fichas abriram antes desta: sem posição guardada, abre deslocada em cascata. */
  cascata: number;
  personagem: Personagem;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  /** O token selecionado no mapa desta tela (V2): a Iniciativa da ficha o põe na ordem de turno. */
  selecionadoId?: string | null;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  pedirImagem: PedirImagem;
  cenaVista: { id: string; nome: string };
  tempo: TempoDaTela;
  fontes: Fontes;
  /** Para ler o compêndio de magias da mesa (as linhas de magia ganham o cartão dele). */
  gerente: GerenteDeAssets | null;
  aoFechar: () => void;
  aoMudar: (mudancas: Partial<JanelaDeFicha>) => void;
};

/** Deslocamento de cada ficha a mais aberta (cascata) e a folga da primeira. */
const PASSO_DA_CASCATA = 32;
const FOLGA = 12;

/** "Clérigo 5 / Patrulheiro 5 · Elfo da floresta · Forasteiro": a linha de baixo do nome. */
function resumoDaFicha(p: Personagem): string {
  const f = p.ficha;
  if (!f) return "Ficha oculta";
  const classes = (f.classes ?? []).map((c) => `${c.classe} ${c.nivel}`).join(" / ");
  return (
    [classes, f.raca, f.antecedente, f.alinhamento].filter(Boolean).join(" · ") || "Sem classe"
  );
}

/**
 * Mede a largura de um elemento (a ficha é estreita pela janela, não pela tela). A `Janela` só monta o conteúdo
 * depois de achar a área do mapa, então o elemento chega depois do primeiro render: por isso a ref é um estado.
 */
function useLargura<T extends HTMLElement>() {
  const [el, ref] = useState<T | null>(null);
  const [largura, setLargura] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const mede = () => setLargura((antes) => (antes === el.clientWidth ? antes : el.clientWidth));
    mede();
    const obs = new ResizeObserver(mede);
    obs.observe(el);
    return () => obs.disconnect();
  }, [el]);
  return { ref, largura };
}

/** O nome do personagem com a capitular: a inicial grande numa moldura e o resto ao lado. */
function NomeDoPersonagem({
  nome,
  podeEditar,
  aoMudar,
  pequeno,
  capitular,
}: {
  nome: string;
  podeEditar: boolean;
  aoMudar: (nome: string) => void;
  pequeno?: boolean;
  /** Livro: a inicial numa moldura e o resto ao lado. Clássica: o nome inteiro num campo só. */
  capitular: boolean;
}) {
  const [ini, setIni] = useState(capitular ? nome.charAt(0) : "");
  const [resto, setResto] = useState(capitular ? nome.slice(1) : nome);
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    if (foco) return;
    setIni(capitular ? nome.charAt(0) : "");
    setResto(capitular ? nome.slice(1) : nome);
  }, [nome, foco, capitular]);
  const confirmar = (i: string, r: string) => {
    const novo = `${i}${r}`.trim().slice(0, 64);
    if (novo !== "" && novo !== nome) aoMudar(novo);
  };
  const saiu = (e: React.FocusEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setFoco(false);
    confirmar(ini, resto);
  };
  return (
    <fieldset
      className={`fl-nome ${pequeno ? "pequeno" : ""}`}
      aria-label="Nome do personagem"
      onFocus={() => setFoco(true)}
      onBlur={saiu}
      data-testid="ficha-nome-bloco"
    >
      {capitular && (
        <div className="fl-capitular">
          <input
            type="text"
            className="fl-fh fl-capitular-campo"
            data-testid="ficha-nome-inicial"
            aria-label="Inicial do nome"
            maxLength={1}
            value={ini}
            disabled={!podeEditar}
            onChange={(e) => setIni(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>
      )}
      <div className="fl-nome-resto">
        <span className="fl-lbl">Nome do personagem</span>
        <input
          type="text"
          className="fl-fh fl-in fl-ln fl-nome-campo"
          data-testid="ficha-nome"
          aria-label="Nome do personagem"
          maxLength={63}
          value={resto}
          disabled={!podeEditar}
          onChange={(e) => setResto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </div>
    </fieldset>
  );
}

/**
 * Janela flutuante da ficha 5e (Lote 9), uma `Janela` (R3) no desenho aprovado do V4a: abre com ~880 px, move-se
 * livre pelo cabeçalho e fica na camada mais alta; minimizada, é só o nome do personagem. Abas como fitas: Personagem,
 * Magias, História e Configurar. Abaixo de ~620 px de largura (da janela, não da tela) vira o layout estreito.
 */
export function JanelaDaFicha({
  janela,
  cascata,
  personagem: p,
  estado,
  eu,
  enviar,
  selecionadoId = null,
  imagens,
  versaoDasImagens,
  pedirImagem,
  cenaVista,
  tempo,
  fontes,
  gerente,
  aoFechar,
  aoMudar,
}: Props) {
  const editar = podeEditarPersonagem(p, eu);
  const temFicha = p.ficha !== undefined;
  const { ficha, alterar, enviarAgora } = useFichaEditavel(p, enviar, editar && temFicha);
  const d = useMemo(() => derivar(ficha), [ficha]);
  const aparencia = useAparencia();
  const [vantagem, setVantagem] = useState<Vantagem>("normal");
  const [descanso, setDescanso] = useState<"curto" | "longo" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoDaOrdem, setAvisoDaOrdem] = useState<string | null>(null);
  const [editorAberto, setEditorAberto] = useState<(AlvoDoEditor & { aba: AbaDaFicha }) | null>(
    null,
  );
  const aba: AbaDaFicha = temFicha ? janela.aba : "configurar";
  const { ref: raiz, largura } = useLargura<HTMLDivElement>();
  const estreita = largura !== null && largura < LARGURA_DA_FICHA_ESTREITA;
  // Trocar de aba volta ao topo (cada aba é uma página) e fecha o editor da engrenagem.
  const corpo = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a aba é o gatilho
  useEffect(() => {
    corpo.current?.scrollTo({ top: 0 });
    setEditorAberto(null);
  }, [aba]);
  useEffect(() => {
    if (aviso === null) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);
  useEffect(() => {
    if (avisoDaOrdem === null) return;
    const t = setTimeout(() => setAvisoDaOrdem(null), 5000);
    return () => clearTimeout(t);
  }, [avisoDaOrdem]);

  const rolador = criarRolador({
    personagemId: p.id,
    podeRolar: editar && temFicha,
    enviar,
    vantagem,
  });
  // Iniciativa na ficha (V2): com a ordem aberta, rola na sala e põe o token na lista.
  function entrarNaOrdem() {
    if (!editar || !temFicha) return;
    if (!estado.ordemDeTurnoVisivel) return rolador.teste("Iniciativa", d.iniciativa);
    const doPersonagem = estado.tokens.filter(
      (t) => t.personagemId === p.id && t.cenaId === estado.cenaAtivaId,
    );
    const alvo =
      doPersonagem.find((t) => t.id === selecionadoId) ??
      (doPersonagem.length === 1 ? doPersonagem[0] : undefined);
    if (!alvo) return setAvisoDaOrdem("Selecione o seu token no mapa.");
    if (estado.combate?.entradas.some((e) => e.tokenId === alvo.id)) {
      return setAvisoDaOrdem("Já está na ordem de turno.");
    }
    setAvisoDaOrdem(null);
    enviar("combate.entrar", { tokenId: alvo.id });
  }
  const compendio = useCompendio({
    referencia: estado.compendio,
    euMestre: false,
    conectado: true,
    gerente,
    fontes,
    enviar,
  }).compendio;
  const propsDaAba: PropsDaAba = {
    nomeDoPersonagem: p.nome,
    enviar,
    compendio,
    imagens,
    versaoDasImagens,
    pedirImagem,
    podeTrocarImagem:
      editar && (eu.papel === "mestre" || pode(eu, "asset.subir", estado.permissoes)),
    ordem: { aberta: estado.ordemDeTurnoVisivel, entrar: entrarNaOrdem },
    personagemId: p.id,
    ficha,
    d,
    alterar,
    editar: editar && temFicha,
    rolador,
    estreita,
    editorAberto: editorAberto && editorAberto.aba === aba ? editorAberto : null,
    abrirEditor: (alvo) => setEditorAberto({ ...alvo, aba }),
    fecharEditor: () => setEditorAberto(null),
    avisar: setAviso,
    // As condições moram no token: o do personagem na cena ativa (o que quem olha recebe).
    token: estado.tokens.find((t) => t.personagemId === p.id && t.cenaId === estado.cenaAtivaId),
  };

  function confirmarDescanso() {
    if (!descanso) return;
    const nova = descanso === "curto" ? descansoCurto(ficha) : descansoLongo(ficha);
    const ops = operacoesDeDiferenca(ficha, nova);
    setDescanso(null);
    if (ops.length === 0 || !aplicarOperacoes(ficha, ops).ok) {
      setAviso("Nada a recuperar.");
      return;
    }
    alterar(ops);
    enviarAgora();
    setAviso(descanso === "curto" ? "Descanso curto feito." : "Descanso longo feito.");
  }

  const abas = ABAS_DA_FICHA.filter(([id]) => temFicha || id === "configurar");
  const fitas = (
    <div className="fl-fitas" role="tablist" aria-label="Abas da ficha">
      {abas.map(([id, titulo]) => (
        <button
          key={id}
          type="button"
          role="tab"
          className="fl-fita"
          data-testid={`ficha-aba-${id}`}
          aria-selected={aba === id}
          onClick={() => aoMudar({ aba: id })}
        >
          {titulo}
        </button>
      ))}
    </div>
  );
  const modos = (
    <fieldset
      className="fl-modos"
      data-testid="fh-vantagem"
      disabled={!editar}
      aria-label="Modo das rolagens"
    >
      {VANTAGENS.map((v) => (
        <button
          key={v}
          type="button"
          className="fl-seg"
          data-testid={`vantagem-${v}`}
          aria-pressed={vantagem === v}
          onClick={() => setVantagem(v)}
        >
          {ROTULO_DA_VANTAGEM[v]}
        </button>
      ))}
    </fieldset>
  );
  const nomeEditavel = (pequeno: boolean) => (
    <NomeDoPersonagem
      nome={p.nome}
      podeEditar={editar}
      pequeno={pequeno}
      capitular={aparencia === "livro"}
      aoMudar={(nome) => enviar("personagem.editar", { id: p.id, mudancas: { nome } })}
    />
  );
  const titulo = (
    <>
      <BookOpen size={19} className="fl-livro" aria-hidden />
      <strong className="fl-fh fl-titulo-nome" data-testid="janela-ficha-nome">
        {p.nome}
      </strong>
    </>
  );

  return (
    <Janela
      id={idDaJanelaDaFicha(p.id)}
      titulo={`Ficha de ${p.nome}`}
      testid="janela-ficha"
      testidDoCabecalho="janela-ficha-cabecalho"
      testidDoFechar="janela-ficha-fechar"
      testidDoRedimensionar="janela-ficha-redimensionar"
      rotuloDoFechar="Fechar a ficha"
      dados={{ "data-personagem-id": p.id, "data-aba": aba }}
      classe="janela-ficha"
      corpoLivre
      camadaAlta
      redimensionar="ambos"
      minLargura={LARGURA_MINIMA}
      minAltura={ALTURA_MINIMA}
      largura={(area) =>
        Math.max(LARGURA_MINIMA, Math.min(LARGURA_PADRAO, area.largura - 2 * FOLGA))
      }
      altura={(area) => Math.max(ALTURA_MINIMA, Math.min(900, area.altura - 2 * FOLGA))}
      padrao={() => ({
        x: FOLGA + cascata * PASSO_DA_CASCATA,
        y: FOLGA + cascata * PASSO_DA_CASCATA,
      })}
      aoFechar={aoFechar}
      cabecalho={titulo}
      cabecalhoMinimizado={titulo}
      acoes={
        temFicha && editar ? (
          <>
            <BotaoComDica
              className="botao-icone"
              testid="descanso-curto"
              nome="Descanso curto"
              aria-label="Descanso curto"
              onClick={() => setDescanso("curto")}
            >
              <Coffee size={16} />
            </BotaoComDica>
            <BotaoComDica
              className="botao-icone"
              testid="descanso-longo"
              nome="Descanso longo"
              aria-label="Descanso longo"
              onClick={() => setDescanso("longo")}
            >
              <BedDouble size={16} />
            </BotaoComDica>
          </>
        ) : null
      }
    >
      <div
        className="fl-raiz"
        ref={raiz}
        data-pele={aparencia}
        data-estreita={estreita}
        data-testid="ficha-raiz"
      >
        {temFicha && !estreita && (
          <header className="fl-cab" data-testid="ficha-cabecalho">
            {fitas}
            <div className="fl-cab-nome">{nomeEditavel(false)}</div>
            <span className="fl-sr" data-testid="janela-ficha-resumo">
              {resumoDaFicha(p)}
            </span>
            {modos}
            <div className="fl-cab-campos">
              <div className="fl-campo-id fl-campo-classe">
                <ClasseENivel {...propsDaAba} />
                <span className="fl-lbl">Classe e nível</span>
              </div>
              <CamposDeIdentidade {...propsDaAba} />
            </div>
          </header>
        )}
        {temFicha && estreita && (
          <header className="fl-cab fl-cab-estreito" data-testid="ficha-cabecalho">
            <div className="fl-cab-estreito-topo">
              <span className="fl-resumo-id" data-testid="janela-ficha-resumo">
                {resumoDaFicha(p)}
              </span>
              {fitas}
            </div>
            <div className="fl-cab-estreito-linha">
              <div className="fl-cab-estreito-nome">{nomeEditavel(true)}</div>
              <div className="fl-cx fl-mini-caixa">
                <span className="fl-lbl">CA</span>
                <CampoDeCa {...propsDaAba} className="fl-ca-mini" />
              </div>
              <div className="fl-cx fl-mini-caixa">
                <span className="fl-lbl">Inic.</span>
                <BotaoDeIniciativa d={d} rolador={rolador} ordem={propsDaAba.ordem} />
              </div>
              <div className="fl-cx fl-mini-caixa">
                <span className="fl-lbl">Desloc.</span>
                <CampoDeDeslocamento {...propsDaAba} className="fl-desloc-mini" />
              </div>
            </div>
            {modos}
            <div className="fl-pv-estreito">
              <ControlesDePv {...propsDaAba} />
              <span className="fl-barra-barra">/</span>
              <CampoNumero
                testid={`pv-max-${p.id}`}
                rotulo="PV máximos"
                valor={ficha.pvMax}
                desabilitado={!propsDaAba.editar}
                className="fl-in fl-fn fl-pv-max-mini"
                aoMudar={(n) => alterar([{ caminho: "pvMax", valor: n }])}
              />
              <BarraDePv ficha={ficha} />
              <ControlesDePvTemporario {...propsDaAba} />
            </div>
          </header>
        )}
        {!temFicha && (
          <div className="fl-cab fl-cab-sem-ficha">
            <div className="fl-cab-nome">{nomeEditavel(false)}</div>
            {fitas}
          </div>
        )}

        {descanso && (
          <div className="fh-confirmar" role="alertdialog" data-testid="descanso-confirmar">
            <p>
              {descanso === "curto" ? (
                <>
                  <strong>Descanso curto:</strong> os recursos de recarga curta voltam ao máximo e
                  os espaços de pacto são recuperados.
                </>
              ) : (
                <>
                  <strong>Descanso longo:</strong> PV ao máximo, metade dos dados de vida, todos os
                  espaços de magia e os recursos de recarga curta ou longa; zera os testes contra a
                  morte e os PV temporários.
                </>
              )}
            </p>
            <button type="button" data-testid="descanso-confirmar-sim" onClick={confirmarDescanso}>
              Confirmar
            </button>
            <button
              type="button"
              data-testid="descanso-confirmar-nao"
              onClick={() => setDescanso(null)}
            >
              Cancelar
            </button>
          </div>
        )}
        {aviso && (
          <p className="nota fh-aviso" role="status" data-testid="ficha-aviso">
            {aviso}
          </p>
        )}

        {avisoDaOrdem && (
          <p className="nota fh-aviso" role="status" data-testid="ficha-aviso-ordem">
            {avisoDaOrdem}
          </p>
        )}

        <div className="fl-corpo" ref={corpo} data-testid={`ficha-painel-${aba}`}>
          {!temFicha && (
            <p className="nota fh-oculta" data-testid="ficha-oculta">
              Você não vê a ficha deste personagem (o mestre pode liberar em "Ver fichas dos
              outros").
            </p>
          )}
          {aba === "principal" && (
            <>
              <AbaPrincipal {...propsDaAba} />
              {temFicha && (
                <PainelExtra {...propsDaAba} estado={estado} eu={eu} personagem={p} tempo={tempo} />
              )}
            </>
          )}
          {aba === "magias" && <AbaMagias {...propsDaAba} />}
          {aba === "historia" && <AbaHistoria {...propsDaAba} />}
          {aba === "configurar" && (
            <div className="fl-configurar">
              <EditorDoItem
                personagem={p}
                estado={estado}
                eu={eu}
                enviar={enviar}
                imagens={imagens}
                versaoDasImagens={versaoDasImagens}
                pedirImagem={pedirImagem}
                cenaVista={cenaVista}
                aoFechar={aoFechar}
                exportar={() => {
                  enviarAgora();
                  return exportarFicha(p, fontes);
                }}
                importar={async (arquivo) => {
                  const lida = await lerFichaDoArquivo(arquivo);
                  if (!lida.ok) return lida.motivo;
                  alterar([{ caminho: "", valor: lida.ficha }]);
                  enviarAgora();
                  return null;
                }}
              />
              <Caixa moldura className="fl-conf-caixa" testid="ficha-aparencia-escolha">
                <Secao>Aparência da ficha</Secao>
                <div className="fl-conf-linha">
                  <fieldset className="fl-modos" aria-label="Aparência da ficha">
                    {APARENCIAS.map((a: AparenciaDaFicha) => (
                      <button
                        key={a}
                        type="button"
                        className="fl-seg fl-seg-grande"
                        data-testid={`aparencia-${a}`}
                        aria-pressed={aparencia === a}
                        onClick={() => gravarAparencia(a)}
                      >
                        {ROTULO_DA_APARENCIA[a]}
                      </button>
                    ))}
                  </fieldset>
                  <span className="fl-dica fl-conf-dica">
                    Livro é o padrão. Clássica é a ficha tradicional. O arranjo é o mesmo. Vale só
                    neste navegador.
                  </span>
                </div>
              </Caixa>
            </div>
          )}
        </div>
      </div>
    </Janela>
  );
}
