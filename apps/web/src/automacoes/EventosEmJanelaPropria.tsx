import { useEffect } from "react";
import { AvisoPerto } from "../AvisoPerto";
import type { DadosDaMesa } from "../api";
import {
  anunciarFichaFora,
  guardarMedida,
  ID_DA_MESA_DE_EVENTOS,
  nomeDaJanela,
} from "../ficha/foraDaMesa";
import { caminhoDaMesa, irPara } from "../rotas";
import { useSala } from "../useSala";
import { MesaDeEventos } from "./MesaDeEventos";

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
 * A mesa de eventos sozinha, na janela própria do navegador (AU2): `/m/<id>/eventos`. Como a mesa de som (Q4b), tem a
 * própria conexão com a sala (a mesma sessão), sem ser uma presença a mais, e a janela principal sabe que ela está aqui.
 * Os botões funcionam como na mesa; o jogador vê só os que o mestre liberou.
 */
export function EventosEmJanelaPropria({ mesa, aoPerderSessao }: Props) {
  const { status, estado, eu, aviso, dispensarAviso, enviar } = useSala({
    mesaId: mesa.id,
    aoExportar: semExportar,
    aoPerderSessao,
  });

  useEffect(() => anunciarFichaFora(mesa.id, ID_DA_MESA_DE_EVENTOS), [mesa.id]);
  useEffect(() => {
    // Só a janela aberta pela mesa lembra a medida (uma aba comum, aberta pelo endereço, não).
    if (window.name !== nomeDaJanela(mesa.id, ID_DA_MESA_DE_EVENTOS)) return;
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
      guardarMedida(mesa.id, ID_DA_MESA_DE_EVENTOS, m);
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
    document.title = "Mesa de eventos — Távola";
  }, []);

  return (
    <div className="ficha-propria-pagina" data-area-do-mapa="" data-testid="eventos-propria-pagina">
      <span className="so-leitor" data-testid="status-conexao">
        {status}
      </span>
      {estado && eu ? (
        <MesaDeEventos
          estado={estado}
          euMestre={eu.papel === "mestre"}
          enviar={enviar}
          aoFechar={() => fecharAJanela(mesa.id)}
          propria={{ aoVoltar: () => fecharAJanela(mesa.id) }}
        />
      ) : (
        <p className="carregando">Carregando a mesa de eventos…</p>
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
