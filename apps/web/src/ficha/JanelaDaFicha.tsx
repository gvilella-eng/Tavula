import {
  aplicarOperacoes,
  derivar,
  descansoCurto,
  descansoLongo,
  type Estado,
  operacoesDeDiferenca,
  type Personagem,
  podeEditarPersonagem,
  ROTULO_DA_VANTAGEM,
  type Usuario,
  VANTAGENS,
  type Vantagem,
} from "@tabletop/shared";
import { BedDouble, Coffee } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "../Avatar";
import type { Fontes } from "../assets/fontes";
import { EditorDoItem } from "../EditorDoItem";
import type { PedirImagem } from "../FaixaDeCenas";
import { Janela } from "../janelas/Janela";
import type { ImagensDoMapa } from "../mapa/mapaPixi";
import type { TempoDaTela } from "../tempo";
import { AbaMagias } from "./AbaMagias";
import { AbaPrincipal, type PropsDaAba } from "./AbaPrincipal";
import { exportarFicha, lerFichaDoArquivo } from "./arquivo";
import {
  ABAS_DA_FICHA,
  type AbaDaFicha,
  ALTURA_MINIMA,
  idDaJanelaDaFicha,
  type JanelaDeFicha,
  LARGURA_MINIMA,
} from "./janelas";
import { AbaCaracteristicas, AbaEquipamento, AbaNotas } from "./OutrasAbas";
import { criarRolador } from "./rolador";
import { useFichaEditavel } from "./useFicha";
import { useImportadorDePdf } from "./useImportadorDePdf";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  janela: JanelaDeFicha;
  /** Quantas fichas abriram antes desta: sem posição guardada, abre deslocada em cascata. */
  cascata: number;
  personagem: Personagem;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  pedirImagem: PedirImagem;
  cenaVista: { id: string; nome: string };
  tempo: TempoDaTela;
  fontes: Fontes;
  aoFechar: () => void;
  aoMudar: (mudancas: Partial<JanelaDeFicha>) => void;
};

/** Deslocamento de cada ficha a mais aberta (cascata) e a folga da primeira. */
const PASSO_DA_CASCATA = 32;
const FOLGA = 12;
/** A ordem de turno (364 px) mais as folgas: o que a ficha deixa livre à direita quando cabe. */
const LARGURA_DA_ORDEM_E_FOLGAS = 364 + 3 * FOLGA;

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
 * Janela flutuante da ficha 5e (Lote 9), agora uma `Janela` (R3): arrastável pelo cabeçalho, minimiza com
 * dois cliques, redimensionável pela quina, várias ao mesmo tempo; posição e tamanho de cada ficha
 * ficam no navegador de cada pessoa. Abas: Principal, Magias, Características,
 * Equipamento, Notas e Configurar (o editor do item).
 */
export function JanelaDaFicha({
  janela,
  cascata,
  personagem: p,
  estado,
  eu,
  enviar,
  imagens,
  versaoDasImagens,
  pedirImagem,
  cenaVista,
  tempo,
  fontes,
  aoFechar,
  aoMudar,
}: Props) {
  const editar = podeEditarPersonagem(p, eu);
  const temFicha = p.ficha !== undefined;
  const { ficha, alterar, enviarAgora } = useFichaEditavel(p, enviar, editar && temFicha);
  const d = useMemo(() => derivar(ficha), [ficha]);
  const [vantagem, setVantagem] = useState<Vantagem>("normal");
  const [descanso, setDescanso] = useState<"curto" | "longo" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const importadorDePdf = useImportadorDePdf({ estado, enviar });
  const aba: AbaDaFicha = temFicha ? janela.aba : "configurar";
  // Trocar de aba volta ao topo (cada aba é uma página).
  const corpo = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a aba é o gatilho
  useEffect(() => {
    corpo.current?.scrollTo({ top: 0 });
  }, [aba]);

  const rolador = criarRolador({
    personagemId: p.id,
    podeRolar: editar && temFicha,
    enviar,
    vantagem,
    aoRolarD20: () => setVantagem("normal"),
  });
  const propsDaAba: PropsDaAba = {
    personagemId: p.id,
    ficha,
    d,
    alterar,
    editar: editar && temFicha,
    rolador,
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
      redimensionar="ambos"
      minLargura={LARGURA_MINIMA}
      minAltura={ALTURA_MINIMA}
      // No máximo ~60% da largura da área (não menos que o mínimo, e sem passar por cima da ordem de
      // turno, no alto à direita) e três quartos da altura.
      largura={(area) =>
        Math.max(
          LARGURA_MINIMA,
          Math.min(860, Math.round(area.largura * 0.6), area.largura - LARGURA_DA_ORDEM_E_FOLGAS),
        )
      }
      altura={(area) => Math.max(ALTURA_MINIMA, Math.min(640, Math.round(area.altura * 0.75)))}
      padrao={() => ({
        x: FOLGA + cascata * PASSO_DA_CASCATA,
        y: FOLGA + cascata * PASSO_DA_CASCATA,
      })}
      aoFechar={aoFechar}
      cabecalho={
        <>
          <Avatar
            imagens={imagens}
            versao={versaoDasImagens}
            hash={p.retratoHash}
            nome={p.nome}
            cor={p.tokenPadrao.cor}
            className="pequeno"
          />
          <div className="janela-ficha-titulo">
            <strong data-testid="janela-ficha-nome">{p.nome}</strong>
            <span className="nota" data-testid="janela-ficha-resumo">
              {resumoDaFicha(p)}
            </span>
          </div>
        </>
      }
      acoes={
        temFicha ? (
          <>
            <fieldset
              className="fh-vantagem"
              data-testid="fh-vantagem"
              disabled={!editar}
              aria-label="Próxima rolagem"
            >
              {VANTAGENS.map((v) => (
                <button
                  key={v}
                  type="button"
                  data-testid={`vantagem-${v}`}
                  aria-pressed={vantagem === v}
                  title={`${ROTULO_DA_VANTAGEM[v]} no próximo d20`}
                  onClick={() => setVantagem(v)}
                >
                  {ROTULO_DA_VANTAGEM[v]}
                </button>
              ))}
            </fieldset>
            {editar && (
              <>
                <button
                  type="button"
                  className="botao-icone"
                  data-testid="descanso-curto"
                  title="Descanso curto"
                  aria-label="Descanso curto"
                  onClick={() => setDescanso("curto")}
                >
                  <Coffee size={16} />
                </button>
                <button
                  type="button"
                  className="botao-icone"
                  data-testid="descanso-longo"
                  title="Descanso longo"
                  aria-label="Descanso longo"
                  onClick={() => setDescanso("longo")}
                >
                  <BedDouble size={16} />
                </button>
              </>
            )}
          </>
        ) : null
      }
    >
      <div className="janela-ficha-abas" role="tablist" aria-label="Abas da ficha">
        {ABAS_DA_FICHA.filter(([id]) => temFicha || id === "configurar").map(([id, titulo]) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-testid={`ficha-aba-${id}`}
            aria-selected={aba === id}
            onClick={() => aoMudar({ aba: id })}
          >
            {titulo}
          </button>
        ))}
      </div>

      {descanso && (
        <div className="fh-confirmar" role="alertdialog" data-testid="descanso-confirmar">
          <p>
            {descanso === "curto" ? (
              <>
                <strong>Descanso curto:</strong> os recursos de recarga curta voltam ao máximo e os
                espaços de pacto são recuperados.
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

      <div className="janela-ficha-corpo" ref={corpo} data-testid={`ficha-painel-${aba}`}>
        {!temFicha && (
          <p className="nota" data-testid="ficha-oculta">
            Você não vê a ficha deste personagem (o mestre pode liberar em "Ver fichas dos outros").
          </p>
        )}
        {aba === "principal" && <AbaPrincipal {...propsDaAba} />}
        {aba === "magias" && <AbaMagias {...propsDaAba} />}
        {aba === "caracteristicas" && <AbaCaracteristicas {...propsDaAba} />}
        {aba === "equipamento" && (
          <AbaEquipamento
            {...propsDaAba}
            estado={estado}
            eu={eu}
            personagem={p}
            enviar={enviar}
            tempo={tempo}
          />
        )}
        {aba === "notas" && <AbaNotas {...propsDaAba} />}
        {aba === "configurar" && (
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
            importarPdf={() => importadorDePdf.escolher(p)}
          />
        )}
      </div>
      {importadorDePdf.elementos}
    </Janela>
  );
}
