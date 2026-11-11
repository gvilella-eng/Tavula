import type { Estado, Personagem, Usuario } from "@tabletop/shared";
import { FileText } from "lucide-react";
import { useImportadorDePdf } from "./useImportadorDePdf";

type Props = {
  estado: Estado;
  /** Quem importa: só os personagens que ele edita são destino da importação. */
  eu: Usuario;
  enviar: (tipo: string, dados: object) => string | null;
  /** O personagem que recebe a ficha lida (a ficha dele é trocada, depois da revisão). */
  personagem: Personagem;
};

/**
 * O botão "Importar PDF" da ficha (V3): vive na aba Configurar e traz junto o seletor de arquivo e a tela de
 * revisão. O V4 refaz a ficha e reaproveita este componente onde quiser pôr o botão: ele não depende do lugar.
 */
export function BotaoImportarPdf({ estado, eu, enviar, personagem }: Props) {
  const importador = useImportadorDePdf({ estado, eu, enviar });
  return (
    <>
      {importador.elementos}
      <button
        type="button"
        data-testid="editor-importar-pdf"
        title="Lê o PDF impresso da ficha (no seu navegador) e mostra uma tela de revisão antes de trocar a ficha"
        onClick={() => importador.escolher(personagem)}
      >
        <FileText size={16} /> Importar PDF
      </button>
    </>
  );
}
