import { useEffect } from "react";
import { AvisoPerto } from "../AvisoPerto";
import type { DadosDaMesa } from "../api";
import {
  anunciarFichaFora,
  guardarMedida,
  idDaJanelaDaAutomacao,
  nomeDaJanela,
} from "../ficha/foraDaMesa";
import { caminhoDaMesa, irPara } from "../rotas";
import { useSala } from "../useSala";
import { EditorDeFluxo } from "./EditorDeFluxo";

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
  /** O id da automação, ou `nova`. */
  automacaoId: string;
  aoPerderSessao: () => void;
};

/**
 * O editor de uma automação sozinho, na janela própria do navegador (AU1): `/m/<id>/automacao/<fluxoId>`. Como a ficha (V9)
 * e a mesa de som (Q4b), tem a própria conexão com a sala (a mesma sessão), sem ser uma presença a mais, e a janela
 * principal sabe que ela está aqui (o mesmo aviso e o mesmo lock da ficha). Salvar e voltar fecham a janela. Só o mestre. Os
 * sons: escolhe-se entre os que já estão na mesa; para adicionar um, use a janela da mesa (assumido).
 */
export function AutomacaoEmJanelaPropria({ mesa, automacaoId, aoPerderSessao }: Props) {
  const { status, estado, eu, aviso, dispensarAviso, enviar } = useSala({
    mesaId: mesa.id,
    aoExportar: semExportar,
    aoPerderSessao,
  });
  const fluxoId = automacaoId === "nova" ? null : automacaoId;
  const idDaJanela = idDaJanelaDaAutomacao(fluxoId);

  useEffect(() => anunciarFichaFora(mesa.id, idDaJanela), [mesa.id, idDaJanela]);
  useEffect(() => {
    // Só a janela aberta pela mesa lembra a medida (uma aba comum, aberta pelo endereço, não).
    if (window.name !== nomeDaJanela(mesa.id, idDaJanela)) return;
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
      guardarMedida(mesa.id, idDaJanela, m);
    };
    const relogio = setInterval(guardar, 1000);
    window.addEventListener("pagehide", guardar);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("pagehide", guardar);
      guardar();
    };
  }, [mesa.id, idDaJanela]);
  useEffect(() => {
    document.title = "Automação — Távola";
  }, []);

  const voltar = () => fecharAJanela(mesa.id);

  return (
    <div
      className="ficha-propria-pagina"
      data-area-do-mapa=""
      data-testid="automacao-propria-pagina"
    >
      <span className="so-leitor" data-testid="status-conexao">
        {status}
      </span>
      {estado && eu ? (
        eu.papel === "mestre" ? (
          <EditorDeFluxo
            estado={estado}
            enviar={enviar}
            fluxoId={fluxoId}
            fontes={null}
            registrarSom={null}
            aoVoltar={voltar}
          />
        ) : (
          <main className="ficha-propria-vazia" data-testid="automacao-propria-so-mestre">
            <p>As automações são do mestre.</p>
            <button type="button" className="primario" onClick={voltar}>
              Fechar esta janela
            </button>
          </main>
        )
      ) : (
        <p className="carregando">Carregando a automação…</p>
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
