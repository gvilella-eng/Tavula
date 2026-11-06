import { ListOrdered } from "lucide-react";

/**
 * Painel flutuante da ordem de turno. Liga e desliga para todos (inclusive o mestre) pelo menu
 * superior; o conteúdo (iniciativa, condições) chega no Lote 11, por ora está vazio.
 */
export function OrdemDeTurno() {
  return (
    <aside className="ordem-de-turno" data-testid="ordem-de-turno" aria-label="Ordem de turno">
      <header>
        <ListOrdered size={16} /> <strong>Ordem de turno</strong>
      </header>
      <p className="nota">Ninguém na ordem ainda. A iniciativa chega no Lote 11.</p>
    </aside>
  );
}
