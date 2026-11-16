import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvisoPerto } from "../AvisoPerto";
import type { DadosDaMesa } from "../api";
import { CacheOpfs } from "../assets/cache";
import { Fontes } from "../assets/fontes";
import { ganchosDoTeste, instalarGanchoDeAssets } from "../assets/ganchoE2E";
import { type Canal, GerenteDeAssets } from "../assets/gerente";
import { Processador } from "../assets/processador";
import {
  anunciarFichaFora,
  guardarMedida,
  ID_DA_MESA_DE_SOM,
  nomeDaJanela,
} from "../ficha/foraDaMesa";
import { PainelDoSom } from "../PainelDoSom";
import { caminhoDaMesa, irPara } from "../rotas";
import { useSala } from "../useSala";
import { MotorDeSom } from "./motorDeSom";
import { assinarPrefsDeSom } from "./prefsDeSom";

const semExportar = () => {};

/** Fecha esta janela; se o navegador não deixar (a página não foi aberta pela mesa), volta para a mesa na mesma aba. */
function fecharAJanela(mesaId: string): void {
  window.close();
  setTimeout(() => {
    if (!window.closed) irPara(caminhoDaMesa(mesaId));
  }, 250);
}

type Props = {
  mesa: DadosDaMesa;
  aoPerderSessao: () => void;
};

/**
 * A mesa de som sozinha, na janela própria do navegador (Q4b): `/m/<id>/som`. Como a ficha na janela própria (V9), tem a
 * própria conexão com a sala (a mesma sessão), sem ser uma presença a mais, e a janela principal sabe que ela está aqui
 * (o mesmo aviso e o mesmo lock da ficha). Tocar, ligar ambientes, volumes, "Tocar/Parar" e a configuração funcionam
 * como na mesa. O som continua saindo da aba da mesa: esta janela é só o controle (assumido). "Ouvir" na
 * configuração toca só aqui.
 */
export function SomEmJanelaPropria({ mesa, aoPerderSessao }: Props) {
  const {
    status,
    estado,
    eu,
    aviso,
    dispensarAviso,
    enviar,
    enviarBinario,
    bufferizado,
    conectado,
    ouvir,
  } = useSala({ mesaId: mesa.id, aoExportar: semExportar, aoPerderSessao });

  // Os arquivos locais (a pasta `sons/`) e o gerente, como na mesa: o cache do navegador é o mesmo.
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
      pastaDosArquivos: () => fontes.pastaDosArquivos(),
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

  // A prévia da configuração ("Ouvir") toca só aqui: um motor sem ambientes, que nunca recebe o estado da sala.
  const gerenteAtual = useRef(gerente);
  gerenteAtual.current = gerente;
  const motor = useMemo(
    () =>
      new MotorDeSom(
        {
          urlDe: async (hash) => {
            const g = gerenteAtual.current;
            const arquivo = g ? await g.blobDe(hash) : null;
            if (!arquivo) return null;
            const mime = g?.meta(hash)?.mime;
            return URL.createObjectURL(mime ? new Blob([arquivo], { type: mime }) : arquivo);
          },
          garantir: (hash) => gerenteAtual.current?.garantir(hash),
        },
        assinarPrefsDeSom,
      ),
    [],
  );
  useEffect(() => {
    motor.iniciar();
    return () => motor.encerrar();
  }, [motor]);

  const registrarSom = useCallback(
    (arquivo: File) => {
      if (!gerente) return Promise.reject(new Error("Os arquivos da mesa ainda estão abrindo."));
      return gerente.registrarSom(arquivo);
    },
    [gerente],
  );

  // Avisa a mesa que o som está aqui (e que saiu), e lembra o tamanho e a posição desta janela.
  useEffect(() => anunciarFichaFora(mesa.id, ID_DA_MESA_DE_SOM), [mesa.id]);
  useEffect(() => {
    // Só a janela aberta pela mesa lembra a medida (uma aba comum, aberta pelo endereço, não).
    if (window.name !== nomeDaJanela(mesa.id, ID_DA_MESA_DE_SOM)) return;
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
      guardarMedida(mesa.id, ID_DA_MESA_DE_SOM, m);
    };
    const relogio = setInterval(guardar, 1000);
    window.addEventListener("pagehide", guardar);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("pagehide", guardar);
      guardar();
    };
  }, [mesa.id]);
  useEffect(() => {
    document.title = "Som — Távola";
  }, []);

  const cena = estado?.cenas.find((c) => c.id === estado.cenaAtivaId) ?? estado?.cenas[0];
  const voltar = () => fecharAJanela(mesa.id);

  return (
    <div className="ficha-propria-pagina" data-area-do-mapa="" data-testid="som-propria-pagina">
      <span className="so-leitor" data-testid="status-conexao">
        {status}
      </span>
      {estado && eu && cena ? (
        eu.papel === "mestre" ? (
          <PainelDoSom
            estado={estado}
            cena={cena}
            fontes={fontes}
            registrar={registrarSom}
            enviar={enviar}
            efeitosEmAndamento={[]}
            ouvir={(hash, volume) => motor.tocarEfeito(hash, volume)}
            aoFechar={voltar}
            propria={{ aoVoltar: voltar }}
          />
        ) : (
          <main className="ficha-propria-vazia" data-testid="som-propria-so-mestre">
            <p>A mesa de som é do mestre.</p>
            <button
              type="button"
              className="primario"
              data-testid="som-propria-fechar"
              onClick={voltar}
            >
              Fechar esta janela
            </button>
          </main>
        )
      ) : (
        <p className="carregando">Carregando a mesa de som…</p>
      )}
      {aviso && <AvisoPerto aviso={aviso} aoDispensar={dispensarAviso} />}
      {status !== "conectado" && (
        <div className="ficha-propria-selo" role="status">
          {status}
        </div>
      )}
    </div>
  );
}
