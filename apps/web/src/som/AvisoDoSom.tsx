import { Volume2 } from "lucide-react";
import { mudarPrefsDeSom, usePrefsDeSom } from "./prefsDeSom";

type Props = {
  /** O navegador está bloqueando o som até alguém clicar. */
  bloqueado: boolean;
  aoAtivar: () => void;
};

/**
 * N5: o aviso pequeno do primeiro som. O navegador só toca som depois de um gesto, então a mesa pede um clique:
 * "Clique para ativar o som da mesa". "Agora não" guarda a escolha neste navegador (o cartão Som das Preferências
 * continua com o botão para ativar quando a pessoa quiser).
 */
export function AvisoDoSom({ bloqueado, aoAtivar }: Props) {
  const prefs = usePrefsDeSom();
  if (!bloqueado || prefs.avisoDispensado || prefs.silenciado) return null;
  return (
    <div className="aviso-do-som" role="status" data-testid="aviso-som">
      <Volume2 size={16} aria-hidden="true" />
      <button type="button" className="primario" data-testid="aviso-som-ativar" onClick={aoAtivar}>
        Clique para ativar o som da mesa
      </button>
      <button
        type="button"
        data-testid="aviso-som-dispensar"
        onClick={() => mudarPrefsDeSom({ avisoDispensado: true })}
      >
        Agora não
      </button>
    </div>
  );
}
