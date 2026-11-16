import { Deslizante } from "./Deslizante";
import { mudarPrefsDeSom, usePrefsDeSom } from "./prefsDeSom";

type Props = {
  /** O navegador está bloqueando o som até alguém clicar. */
  bloqueado: boolean;
  aoAtivar: () => void;
};

/** N5: o conteúdo do cartão Som das Preferências: volume geral, da trilha e dos efeitos, e "silenciar tudo". */
export function CartaoDeSom({ bloqueado, aoAtivar }: Props) {
  const prefs = usePrefsDeSom();
  return (
    <div className="pref-som" data-testid="pref-som">
      <label className="som-opcao">
        <input
          type="checkbox"
          data-testid="som-silenciar"
          checked={prefs.silenciado}
          onChange={(e) => mudarPrefsDeSom({ silenciado: e.target.checked })}
        />
        Silenciar tudo
      </label>
      <div className="pref-som-linha">
        <span>Volume geral</span>
        <Deslizante
          testid="som-geral"
          rotulo="Volume geral"
          valor={prefs.geral}
          desligado={prefs.silenciado}
          aoMudar={(v) => mudarPrefsDeSom({ geral: v })}
        />
      </div>
      <div className="pref-som-linha">
        <span>Ambientes</span>
        <Deslizante
          testid="som-volume-trilha"
          rotulo="Volume dos ambientes"
          valor={prefs.trilha}
          desligado={prefs.silenciado}
          aoMudar={(v) => mudarPrefsDeSom({ trilha: v })}
        />
      </div>
      <div className="pref-som-linha">
        <span>Efeitos</span>
        <Deslizante
          testid="som-volume-efeitos"
          rotulo="Volume dos efeitos"
          valor={prefs.efeitos}
          desligado={prefs.silenciado}
          aoMudar={(v) => mudarPrefsDeSom({ efeitos: v })}
        />
      </div>
      {bloqueado && (
        <button type="button" data-testid="som-ativar" onClick={aoAtivar}>
          Ativar o som da mesa
        </button>
      )}
      <p className="nota">
        O navegador só toca som depois de um clique. O volume é só seu: o mestre não o vê.
      </p>
    </div>
  );
}
