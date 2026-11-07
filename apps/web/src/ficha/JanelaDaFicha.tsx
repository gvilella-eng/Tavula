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
import { BedDouble, Coffee, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "../Avatar";
import type { Fontes } from "../assets/fontes";
import { EditorDoItem } from "../EditorDoItem";
import type { PedirImagem } from "../FaixaDeCenas";
import type { ImagensDoMapa } from "../mapa/mapaPixi";
import type { TempoDaTela } from "../tempo";
import { AbaMagias } from "./AbaMagias";
import { AbaPrincipal, type PropsDaAba } from "./AbaPrincipal";
import { exportarFicha, lerFichaDoArquivo } from "./arquivo";
import {
  ABAS_DA_FICHA,
  type AbaDaFicha,
  ALTURA_MINIMA,
  type JanelaDeFicha,
  LARGURA_MINIMA,
} from "./janelas";
import { AbaCaracteristicas, AbaEquipamento, AbaNotas } from "./OutrasAbas";
import { criarRolador } from "./rolador";
import { useFichaEditavel } from "./useFicha";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  janela: JanelaDeFicha;
  /** Posição na pilha (0 = a de trás), para o `z-index`. */
  camada: number;
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
  aoFocar: () => void;
  aoMudar: (mudancas: Partial<JanelaDeFicha>) => void;
};

const BASE_DO_Z = 45;

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
 * Janela flutuante da ficha 5e (Lote 9): arrastável pelo cabeçalho, redimensionável pela quina, várias
 * ao mesmo tempo, em tema escuro, como nas mesas virtuais. Abas: Principal, Magias, Características,
 * Equipamento, Notas e Configurar (o editor do item).
 */
export function JanelaDaFicha({
  janela,
  camada,
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
  aoFocar,
  aoMudar,
}: Props) {
  const editar = podeEditarPersonagem(p, eu);
  const temFicha = p.ficha !== undefined;
  const { ficha, alterar, enviarAgora } = useFichaEditavel(p, enviar, editar && temFicha);
  const d = useMemo(() => derivar(ficha), [ficha]);
  const [vantagem, setVantagem] = useState<Vantagem>("normal");
  const [descanso, setDescanso] = useState<"curto" | "longo" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
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

  // --- arrastar e redimensionar ---------------------------------------------------------------
  const gesto = useRef<{
    tipo: "mover" | "tamanho";
    x: number;
    y: number;
    j: JanelaDeFicha;
  } | null>(null);
  function iniciar(tipo: "mover" | "tamanho", e: React.PointerEvent) {
    if (e.button !== 0) return;
    aoFocar();
    gesto.current = { tipo, x: e.clientX, y: e.clientY, j: janela };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function seguir(e: React.PointerEvent) {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.tipo === "mover") {
      aoMudar({
        x: Math.min(Math.max(g.j.x + dx, 80 - g.j.largura), window.innerWidth - 80),
        y: Math.min(Math.max(g.j.y + dy, 0), window.innerHeight - 40),
      });
    } else {
      aoMudar({
        largura: Math.min(
          Math.max(g.j.largura + dx, LARGURA_MINIMA),
          Math.max(LARGURA_MINIMA, window.innerWidth - g.j.x),
        ),
        altura: Math.min(
          Math.max(g.j.altura + dy, ALTURA_MINIMA),
          Math.max(ALTURA_MINIMA, window.innerHeight - g.j.y),
        ),
      });
    }
  }
  function soltar(e: React.PointerEvent) {
    gesto.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <section
      className="janela-ficha"
      role="dialog"
      aria-label={`Ficha de ${p.nome}`}
      data-testid="janela-ficha"
      data-personagem-id={p.id}
      data-aba={aba}
      style={{
        left: janela.x,
        top: janela.y,
        width: janela.largura,
        height: janela.altura,
        zIndex: BASE_DO_Z + camada,
      }}
      onPointerDownCapture={aoFocar}
    >
      <header
        className="janela-ficha-cabecalho"
        data-testid="janela-ficha-cabecalho"
        onPointerDown={(e) => {
          // Botões e campos do cabeçalho não arrastam.
          if ((e.target as Element).closest("button, input, select, textarea")) return;
          iniciar("mover", e);
        }}
        onPointerMove={seguir}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
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
        {temFicha && (
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
        )}
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid="janela-ficha-fechar"
          title="Fechar"
          aria-label="Fechar a ficha"
          onClick={aoFechar}
        >
          <X size={16} />
        </button>
      </header>

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
          />
        )}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a alça de redimensionar é só um ponto de arrasto */}
      <div
        className="janela-ficha-alca"
        role="separator"
        aria-label="Redimensionar a janela"
        data-testid="janela-ficha-redimensionar"
        onPointerDown={(e) => iniciar("tamanho", e)}
        onPointerMove={seguir}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      />
    </section>
  );
}
