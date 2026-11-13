import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AvisoPerto } from "../AvisoPerto";
import type { DadosDaMesa } from "../api";
import { CacheOpfs } from "../assets/cache";
import { Fontes } from "../assets/fontes";
import { ganchosDoTeste, instalarGanchoDeAssets } from "../assets/ganchoE2E";
import { type Canal, GerenteDeAssets } from "../assets/gerente";
import { Processador } from "../assets/processador";
import type { PedirImagem } from "../FaixaDeCenas";
import type { ImagensDoMapa } from "../mapa/mapaPixi";
import { caminhoDaMesa, irPara } from "../rotas";
import { SeletorDeImagem } from "../SeletorDeImagem";
import { useTempoDaSala } from "../tempo";
import { useSala } from "../useSala";
import { anunciarFichaFora, guardarMedida, nomeDaJanela } from "./foraDaMesa";
import { JanelaDaFicha } from "./JanelaDaFicha";
import type { AbaDaFicha } from "./janelas";

const semAssinatura = () => () => {};
const versaoZero = () => 0;
const semExportar = () => {};

type PedidoDeImagem = {
  titulo: string;
  tipo: "mapa" | "token" | "retrato";
  aoUsar: (hash: string) => void;
};

/** Fecha esta janela; se o navegador não deixar (a página não foi aberta pela mesa), volta para a mesa na mesma aba. */
function fecharAJanela(mesaId: string): void {
  window.close();
  setTimeout(() => {
    if (!window.closed) irPara(caminhoDaMesa(mesaId));
  }, 250);
}

type Props = {
  mesa: DadosDaMesa;
  fichaId: string;
  aoPerderSessao: () => void;
};

/**
 * A ficha sozinha, na janela própria do navegador (V9): `/m/<id>/ficha/<fichaId>`. Tem a própria conexão com a sala
 * (a mesma sessão: o cookie vale para `/api/m/<id>`), mas não é uma presença a mais: a sala junta as conexões por
 * usuário. Não tem mapa, painéis, topo nem tour. Editar, rolar (vai ao chat), conjurar e os avisos funcionam como
 * na mesa; arrastar entre janelas não (o arrasto do navegador não atravessa janelas).
 */
export function FichaEmJanelaPropria({ mesa, fichaId, aoPerderSessao }: Props) {
  const {
    status,
    estado,
    eu,
    aviso,
    avisar,
    dispensarAviso,
    enviar,
    enviarBinario,
    bufferizado,
    conectado,
    ouvir,
  } = useSala({ mesaId: mesa.id, aoExportar: semExportar, aoPerderSessao });
  const tempo = useTempoDaSala(estado);
  const [aba, setAba] = useState<AbaDaFicha>("principal");

  // Os arquivos locais (retratos e o compêndio de magias), como na mesa: o cache do navegador é o mesmo.
  const processador = useMemo(() => new Processador(), []);
  const fontes = useMemo(() => new Fontes(mesa.id, mesa.legada), [mesa.id, mesa.legada]);
  const [gerente, setGerente] = useState<GerenteDeAssets | null>(null);
  const canal = useRef<Canal>({ conectado, enviar, enviarBinario, bufferizado });
  canal.current = { conectado, enviar, enviarBinario, bufferizado };
  const estadoAtual = useRef(estado);
  estadoAtual.current = estado;
  const euAtual = useRef(eu);
  euAtual.current = eu;
  const euId = eu?.id;
  useEffect(() => {
    void fontes.iniciar();
  }, [fontes]);
  useEffect(() => {
    if (!euId) return;
    const g = new GerenteDeAssets({
      cache: new CacheOpfs(),
      processador,
      canal: () => canal.current,
      meuId: euId,
      euMestre: () => euAtual.current?.papel === "mestre",
      nomeDoUsuario: (id) => estadoAtual.current?.usuarios.find((u) => u.id === id)?.nome,
      destinoDeCopia: () => fontes.destinoDeCopia(),
      ganchos: ganchosDoTeste,
    });
    let vivo = true;
    const desinstalar = instalarGanchoDeAssets(g, fontes);
    g.iniciar()
      .then(() => {
        if (!vivo) return;
        setGerente(g);
        g.aoConectar();
      })
      .catch((e) => console.error("Falha ao iniciar os arquivos locais", e));
    return () => {
      vivo = false;
      desinstalar();
      g.encerrar();
      setGerente(null);
    };
  }, [euId, fontes, processador]);
  useEffect(() => {
    if (!gerente) return;
    return ouvir((o) => {
      if (o.tipo === "asset") gerente.aoMensagem(o.mensagem);
      else if (o.tipo === "binario") gerente.aoPedaco(o.dados);
      else if (o.tipo === "conectado") gerente.aoConectar();
      else if (o.tipo === "erro") gerente.aoErro(o.idPedido, o.codigo);
    });
  }, [gerente, ouvir]);
  const versaoDosProntos = useSyncExternalStore(
    gerente?.assinarProntos ?? semAssinatura,
    gerente?.versaoDeProntos ?? versaoZero,
  );
  const imagens = useMemo<ImagensDoMapa | null>(
    () =>
      gerente
        ? {
            meta: (h) => gerente.meta(h),
            pronto: (h) => gerente.estaPronto(h),
            blob: (h) => gerente.blobDe(h),
          }
        : null,
    [gerente],
  );
  const [pedidoDeImagem, setPedidoDeImagem] = useState<PedidoDeImagem | null>(null);
  const pedirImagem: PedirImagem = (titulo, tipo, aoUsar) =>
    setPedidoDeImagem({ titulo, tipo, aoUsar });

  // Avisa a mesa que esta ficha está aqui (e que saiu), e lembra o tamanho e a posição desta janela.
  useEffect(() => anunciarFichaFora(mesa.id, fichaId), [mesa.id, fichaId]);
  useEffect(() => {
    // Só a janela aberta pela mesa lembra a medida (uma aba comum, aberta pelo endereço, não).
    if (window.name !== nomeDaJanela(mesa.id, fichaId)) return;
    let ultima = "";
    const guardar = () => {
      const m = {
        largura: window.innerWidth,
        altura: window.innerHeight,
        x: window.screenX,
        y: window.screenY,
      };
      const chave = JSON.stringify(m);
      if (chave === ultima) return;
      ultima = chave;
      guardarMedida(mesa.id, fichaId, m);
    };
    const relogio = setInterval(guardar, 1000);
    window.addEventListener("pagehide", guardar);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("pagehide", guardar);
      guardar();
    };
  }, [mesa.id, fichaId]);

  const personagem = estado?.personagens.find((p) => p.id === fichaId);
  const nome = personagem?.nome;
  useEffect(() => {
    document.title = nome ? `${nome} — Távola` : "Távola";
  }, [nome]);

  const cena = estado?.cenas.find((c) => c.id === estado.cenaAtivaId) ?? estado?.cenas[0];
  const voltar = () => fecharAJanela(mesa.id);

  return (
    <div className="ficha-propria-pagina" data-area-do-mapa="" data-testid="ficha-propria-pagina">
      <span className="so-leitor" data-testid="status-conexao">
        {status}
      </span>
      {estado && eu ? (
        personagem ? (
          <JanelaDaFicha
            janela={{ personagemId: personagem.id, aba }}
            cascata={0}
            personagem={personagem}
            estado={estado}
            eu={eu}
            enviar={enviar}
            imagens={imagens}
            versaoDasImagens={versaoDosProntos}
            pedirImagem={pedirImagem}
            cenaVista={{ id: cena?.id ?? estado.cenaAtivaId, nome: cena?.nome ?? "" }}
            tempo={tempo}
            fontes={fontes}
            gerente={gerente}
            avisar={avisar}
            aoFechar={voltar}
            aoMudar={(mudancas) => mudancas.aba && setAba(mudancas.aba)}
            propria={{ aoVoltar: voltar }}
          />
        ) : (
          <main className="ficha-propria-vazia" data-testid="ficha-propria-sumiu">
            <p>Esta ficha foi apagada, ou você não tem mais acesso a ela.</p>
            <button
              type="button"
              className="primario"
              data-testid="ficha-propria-fechar"
              onClick={voltar}
            >
              Fechar esta janela
            </button>
          </main>
        )
      ) : (
        <p className="carregando">Carregando a ficha…</p>
      )}
      {aviso && <AvisoPerto aviso={aviso} aoDispensar={dispensarAviso} />}
      {pedidoDeImagem && gerente && (
        <SeletorDeImagem
          titulo={pedidoDeImagem.titulo}
          fontes={fontes}
          processador={processador}
          aoEscolher={async (arquivo) => {
            const hash = await gerente.usarArquivo(arquivo, pedidoDeImagem.tipo);
            pedidoDeImagem.aoUsar(hash);
          }}
          aoFechar={() => setPedidoDeImagem(null)}
        />
      )}
      {status !== "conectado" && (
        <div className="ficha-propria-selo" role="status">
          {status}
        </div>
      )}
    </div>
  );
}
