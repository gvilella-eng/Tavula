import { useEffect, useState } from "react";
import { AvisoPerto } from "../AvisoPerto";
import type { DadosDaMesa } from "../api";
import { guardarMedida, ID_DA_CHAMADA, nomeDaJanela } from "../ficha/foraDaMesa";
import { aplicarTema, CHAVE_TEMA, lerTema } from "../tema/temas";
import { useSala } from "../useSala";
import { anunciarFalando } from "./canalDaChamada";
import { ControleDaChamada } from "./controlador";
import { useGravacao } from "./gravacao/useGravacao";
import { definirPessoasFalsas } from "./pessoasFalsas";
import { TelaDaChamada } from "./TelaDaChamada";

const semExportar = () => {};

type Props = {
  mesa: DadosDaMesa;
  aoPerderSessao: () => void;
};

/**
 * A chamada da mesa na janela própria do navegador (CH1): `/m/<id>/chamada`. Tem a própria conexão com a sala (a mesma
 * sessão); só o socket desta janela participa da chamada, então fechar a janela é sair da chamada. A janela da mesa não
 * é tocada: ela só mostra quem está e abre esta janela.
 */
export function ChamadaEmJanelaPropria({ mesa, aoPerderSessao }: Props) {
  const {
    status,
    estado,
    eu,
    aviso,
    dispensarAviso,
    avisar,
    enviar,
    ouvir,
    presenca,
    participantesDaChamada,
  } = useSala({ mesaId: mesa.id, aoExportar: semExportar, aoPerderSessao });
  const euId = eu?.id;
  const [controle, setControle] = useState<ControleDaChamada | null>(null);
  // CH3: a gravação para a transcrição (só o mestre grava; todos veem o aviso).
  const gravacao = useGravacao({
    mesaId: mesa.id,
    mesaNome: mesa.nome,
    legada: mesa.legada,
    controle,
    estadoSala: estado,
    eu,
    ouvir,
  });

  // O controlador nasce quando sei quem sou e morre com a janela (a StrictMode monta duas vezes: cada uma cria o seu).
  useEffect(() => {
    if (!euId) return;
    const c = new ControleDaChamada({ mesaId: mesa.id, meuId: euId, enviar });
    setControle(c);
    void c.iniciar();
    const w = window as unknown as { __tabletopChamada?: unknown };
    if (import.meta.env.MODE === "e2e") {
      w.__tabletopChamada = { diagnostico: () => c.diagnostico() };
      (window as unknown as { __tabletopChamadaFalsas?: unknown }).__tabletopChamadaFalsas =
        definirPessoasFalsas;
    }
    return () => {
      c.encerrar();
      setControle(null);
      if (import.meta.env.MODE === "e2e") w.__tabletopChamada = undefined;
    };
  }, [euId, mesa.id, enviar]);

  // O que a sala manda: o aperto de mão, a substituição por outra janela, a reconexão e as recusas.
  useEffect(() => {
    if (!controle) return;
    return ouvir((o) => {
      if (o.tipo === "chamadaSinal") {
        controle.receberSinal(o.de, {
          ...(o.descricao ? { descricao: o.descricao } : {}),
          ...(o.candidato ? { candidato: o.candidato } : {}),
        });
      } else if (o.tipo === "chamadaSubstituida") controle.aoSerSubstituida();
      else if (o.tipo === "conectado") controle.aoConectar();
      else if (o.tipo === "erro") controle.aoRecusar(o.codigo, o.mensagem);
    });
  }, [controle, ouvir]);

  useEffect(() => {
    controle?.definirParticipantes(participantesDaChamada);
  }, [controle, participantesDaChamada]);

  // Quem fala vai à janela da mesa (o anel verde na presença do topo), pelo `BroadcastChannel`; nunca pela sala.
  useEffect(() => {
    if (!controle) return;
    let ultimo = "";
    const avisar = () => {
      const ids = controle.estado.fase === "dentro" ? [...controle.estado.falando].sort() : [];
      const chave = ids.join(",");
      if (chave === ultimo) return;
      ultimo = chave;
      anunciarFalando(mesa.id, ids);
    };
    // Quem fala fica no ar enquanto a pessoa fala; um sinal a cada 2 s impede a mesa de apagar o anel por silêncio do canal.
    const manter = setInterval(
      () =>
        anunciarFalando(
          mesa.id,
          controle.estado.falando.size > 0 ? [...controle.estado.falando] : [],
        ),
      2000,
    );
    const sair = controle.assinar(avisar);
    return () => {
      sair();
      clearInterval(manter);
      anunciarFalando(mesa.id, []);
    };
  }, [controle, mesa.id]);

  // Lembra o tamanho e a posição desta janela (só a aberta pela mesa; uma aba comum não).
  useEffect(() => {
    if (window.name !== nomeDaJanela(mesa.id, ID_DA_CHAMADA)) return;
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
      guardarMedida(mesa.id, ID_DA_CHAMADA, m);
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
    document.title = "Chamada — Távola";
  }, []);

  // O tema é o da mesa: o `main.tsx` o aplica ao abrir; quando a mesa (outra janela, mesma origem) troca de tema, o evento
  // `storage` chega aqui e a janela o acompanha. Não há seletor de tema na chamada.
  useEffect(() => {
    const aoMudar = (e: StorageEvent) => {
      if (e.key === null || e.key === CHAVE_TEMA) aplicarTema(lerTema());
    };
    window.addEventListener("storage", aoMudar);
    return () => window.removeEventListener("storage", aoMudar);
  }, []);

  return (
    <div className="chamada-pagina" data-area-do-mapa="" data-testid="chamada-pagina">
      <span className="so-leitor" data-testid="status-conexao">
        {status}
      </span>
      {estado && eu && controle ? (
        <TelaDaChamada
          mesaId={mesa.id}
          mesaNome={mesa.nome}
          controle={controle}
          estadoSala={estado}
          eu={eu}
          presenca={presenca}
          enviar={enviar}
          avisar={avisar}
          gravacao={gravacao}
        />
      ) : (
        <p className="carregando">Carregando a chamada…</p>
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
