import type { Estado } from "@tabletop/shared";
import { Circle, FolderOpen } from "lucide-react";
import { useRef } from "react";
import { BotaoComDica } from "../../BotaoComDica";
import { useDialogo } from "../../useDialogo";
import { listaDeNomes } from "../puras";
import type { GravacaoDaTela } from "./useGravacao";

// CH3: as peças da gravação na janela da chamada: o aviso (para todos, no topo), o botão do mestre e a confirmação.

/**
 * O aviso "● Gravando para transcrição", no topo da janela, para todo mundo (também antes de entrar). Cada um tem o
 * "Não gravar a minha voz"; o mestre vê quem ficou de fora e quantos trechos já foram gravados.
 */
export function AvisoDeGravacao({
  gravacao,
  estadoSala,
}: {
  gravacao: GravacaoDaTela;
  estadoSala: Estado;
}) {
  if (!gravacao.ligada) return null;
  const nomesDeFora = gravacao.foraDe
    .map((id) => estadoSala.usuarios.find((u) => u.id === id)?.nome)
    .filter((n): n is string => n !== undefined);
  return (
    <div className="chamada-gravando" role="status" data-testid="chamada-aviso-gravacao">
      <span className="chamada-gravando-texto">
        <span className="chamada-gravando-ponto" aria-hidden="true">
          ●
        </span>{" "}
        Gravando para transcrição
      </span>
      <span className="chamada-gravando-dica">
        A voz de cada um é gravada no computador do mestre, para virar texto depois.
      </span>
      <label className="chamada-marca chamada-gravando-marca">
        <input
          type="checkbox"
          data-testid="chamada-nao-gravar"
          checked={gravacao.naoGravar}
          onChange={(ev) => gravacao.definirNaoGravar(ev.target.checked)}
        />
        Não gravar a minha voz
      </label>
      {gravacao.souMestre && (
        <span className="chamada-gravando-mestre" data-testid="chamada-gravando-mestre">
          {nomesDeFora.length > 0
            ? `Fora da gravação: ${listaDeNomes(nomesDeFora)}.`
            : "Ninguém ficou de fora."}
          {gravacao.euGravo && (
            <span data-testid="chamada-gravando-trechos">
              {" "}
              {gravacao.gravador.trechos}{" "}
              {gravacao.gravador.trechos === 1 ? "trecho gravado" : "trechos gravados"}.
            </span>
          )}
        </span>
      )}
      {gravacao.souMestre && gravacao.gravador.erro && (
        <span className="chamada-gravando-erro" role="alert" data-testid="chamada-gravando-erro">
          {gravacao.gravador.erro}
        </span>
      )}
    </div>
  );
}

/** O botão do mestre na barra de baixo: liga (pedindo a confirmação) e desliga a gravação. */
export function BotaoDeGravar({
  gravacao,
  motivo,
}: {
  gravacao: GravacaoDaTela;
  motivo: string | null;
}) {
  if (!gravacao.souMestre) return null;
  return (
    <BotaoComDica
      testid="chamada-gravar"
      className="chamada-botao-redondo"
      nome={gravacao.euGravo ? "Parar de gravar" : "Gravar para transcrição"}
      aria-pressed={gravacao.euGravo}
      data-gravando={gravacao.euGravo ? "sim" : undefined}
      motivo={motivo}
      onClick={() => {
        if (gravacao.euGravo) void gravacao.parar();
        else gravacao.abrirConfirmacao();
      }}
    >
      <Circle size={20} aria-hidden="true" fill={gravacao.euGravo ? "currentColor" : "none"} />
    </BotaoComDica>
  );
}

/** A confirmação curta antes de gravar: o que é gravado, onde, quem sabe e o que fazer depois. */
export function ConfirmarGravacao({ gravacao }: { gravacao: GravacaoDaTela }) {
  return gravacao.confirmando ? <DialogoDaGravacao gravacao={gravacao} /> : null;
}

function DialogoDaGravacao({ gravacao }: { gravacao: GravacaoDaTela }) {
  const caixa = useRef<HTMLDivElement>(null);
  const nivel = useDialogo(caixa, gravacao.fecharConfirmacao);
  const { estado, nome } = gravacao.pasta;
  const pronta = estado === "autorizada";
  return (
    <div className="fundo-modal" style={{ zIndex: 80 + nivel }}>
      <div
        ref={caixa}
        className="modal modal-pequeno chamada-confirma-gravacao"
        role="alertdialog"
        aria-label="Gravar para transcrição"
        data-testid="chamada-confirmar-gravacao"
      >
        <strong>Gravar a sessão para a transcrição?</strong>
        <ul className="chamada-confirma-lista">
          <li>Só a fala de cada pessoa é gravada, em trechos curtos, sem o silêncio.</li>
          <li>
            O áudio fica na pasta da mesa, no seu computador (<code>gravacoes/…</code>); nada vai
            para a internet nem para os jogadores.
          </li>
          <li>
            Todos na chamada veem o aviso “Gravando para transcrição”, e cada um pode marcar “Não
            gravar a minha voz”.
          </li>
          <li>Depois você transcreve com o whisper.cpp e pode apagar o áudio.</li>
        </ul>
        {!pronta && (
          <div className="chamada-confirma-pasta" data-testid="chamada-confirmar-pasta">
            <p className="nota">
              {estado === "reautorizar"
                ? "O navegador pede de novo a permissão da pasta da mesa."
                : estado === "negada"
                  ? "A permissão da pasta da mesa foi negada. Escolha a pasta de novo."
                  : "Escolha a pasta da mesa: é nela que a gravação é guardada."}
            </p>
            <button
              type="button"
              data-testid="chamada-gravacao-pasta"
              onClick={() =>
                void (estado === "reautorizar"
                  ? gravacao.autorizarPasta()
                  : gravacao.escolherPasta())
              }
            >
              <FolderOpen size={16} aria-hidden="true" />{" "}
              {estado === "reautorizar" ? "Autorizar a pasta" : "Escolher a pasta da mesa"}
            </button>
          </div>
        )}
        {pronta && nome && (
          <p className="nota" data-testid="chamada-confirmar-onde">
            Pasta da mesa: <strong>{nome}</strong>
          </p>
        )}
        {gravacao.falha && (
          <p className="chamada-erro" role="alert" data-testid="chamada-gravacao-falha">
            {gravacao.falha}
          </p>
        )}
        <div className="linha-botoes fim">
          <button
            type="button"
            data-testid="chamada-gravacao-cancelar"
            onClick={gravacao.fecharConfirmacao}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primario"
            data-testid="chamada-gravacao-comecar"
            disabled={!pronta}
            onClick={() => void gravacao.comecar()}
          >
            Começar a gravar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Depois de parar: onde ficou a gravação e o comando para transcrever. */
export function AvisoDeGravacaoPronta({ gravacao }: { gravacao: GravacaoDaTela }) {
  if (!gravacao.ultima || gravacao.euGravo) return null;
  return (
    <div className="chamada-gravou" role="status" data-testid="chamada-gravacao-pronta">
      Gravação salva em <code>{gravacao.ultima}</code>. Para transcrever, rode{" "}
      <code>pnpm transcrever "{gravacao.ultima}"</code> (a pasta da mesa vem antes) e depois use
      “Trazer a transcrição” na aba Mesa.
    </div>
  );
}
