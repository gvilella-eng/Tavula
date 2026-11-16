import { FileDown, X } from "lucide-react";

// Q3: o aviso da importação de um mapa do Dungeondraft (Universal VTT): "Lendo…" enquanto o worker trabalha, depois o resumo
// ("Cena criada: 1 mapa, 142 paredes, 6 portas, 9 luzes.") ou o motivo de não ter dado. Fica até a pessoa dispensar.

export type EstadoDaImportacao =
  | { fase: "lendo"; nome: string }
  | { fase: "pronto"; texto: string }
  | { fase: "erro"; texto: string };

export function AvisoDaImportacao({
  estado,
  aoDispensar,
}: {
  estado: EstadoDaImportacao | null;
  aoDispensar: () => void;
}) {
  if (!estado) return null;
  const lendo = estado.fase === "lendo";
  return (
    <div
      className={`aviso-caixa aviso-importacao${estado.fase === "erro" ? " com-erro" : ""}`}
      role="status"
      data-testid="aviso-importacao"
      data-estado={estado.fase}
    >
      <FileDown size={16} aria-hidden="true" />
      <span data-testid="aviso-importacao-texto">
        {lendo ? (
          <>
            Importando <strong>{estado.nome}</strong>…
          </>
        ) : estado.fase === "erro" ? (
          <>Não importei o mapa: {estado.texto}</>
        ) : (
          estado.texto
        )}
      </span>
      {!lendo && (
        <button
          type="button"
          className="aviso-importacao-fechar"
          aria-label="Dispensar o aviso"
          data-testid="aviso-importacao-fechar"
          onClick={aoDispensar}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
