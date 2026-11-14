import {
  type ModoDaNevoa,
  RAIO_MAXIMO_DO_PINCEL_M,
  RAIO_MINIMO_DO_PINCEL_M,
} from "@tabletop/shared";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { CampoDeDistancia } from "./Campo";
import { dasFerramentas } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import type { ConfigDaNevoa } from "./mapa/mapaPixi";

type Props = {
  config: ConfigDaNevoa;
  aoMudar: (c: ConfigDaNevoa) => void;
  /** A cena tem alguma área coberta (para o "Revelar tudo" fazer sentido). */
  temNevoa: boolean;
  /** Quantos traços a cena guarda (zero: nada a desfazer). */
  tracos: number;
  /** "Cobrir tudo" e "Revelar tudo", depois da confirmação. */
  aoTracarTudo: (modo: ModoDaNevoa) => void;
  aoDesfazer: () => void;
  aoFechar: () => void;
};

const FORMAS: { id: ConfigDaNevoa["forma"]; nome: string }[] = [
  { id: "pincel", nome: "Pincel" },
  { id: "retangulo", nome: "Retângulo" },
  { id: "poligono", nome: "Polígono" },
];

const AJUDA_DA_FORMA: Record<ConfigDaNevoa["forma"], string> = {
  pincel: "Arraste para pintar. O círculo mostra o tamanho.",
  retangulo: "Arraste de um canto ao outro. Alt solta do grid.",
  poligono: "Clique para marcar os cantos; duplo clique ou Enter fecha, Esc cancela.",
};

/**
 * Painel da ferramenta Névoa (N4, só do mestre): cobrir ou revelar, a forma, o tamanho do pincel, "Cobrir tudo" e
 * "Revelar tudo" (com confirmação aqui na página) e o desfazer do último traço. É configuração só da tela dele.
 */
export function PainelDaNevoa(p: Props) {
  const { config } = p;
  const [confirmando, setConfirmando] = useState<ModoDaNevoa | null>(null);

  return (
    <Janela
      id="nevoa"
      titulo="Névoa"
      testid="painel-nevoa"
      classeDoCorpo="painel-token"
      padrao={dasFerramentas}
      largura={248}
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar a ferramenta"
      testidDoFechar="nevoa-fechar"
    >
      <fieldset className="quem-controla">
        <legend>O que fazer</legend>
        <div className="chips">
          {(["cobrir", "revelar"] as const).map((modo) => (
            <button
              key={modo}
              type="button"
              className="chip"
              data-testid={`nevoa-modo-${modo}`}
              aria-pressed={config.modo === modo}
              onClick={() => p.aoMudar({ ...config, modo })}
            >
              {modo === "cobrir" ? "Cobrir" : "Revelar"}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="quem-controla">
        <legend>Forma</legend>
        <div className="chips">
          {FORMAS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="chip"
              data-testid={`nevoa-forma-${f.id}`}
              aria-pressed={config.forma === f.id}
              onClick={() => p.aoMudar({ ...config, forma: f.id })}
            >
              {f.nome}
            </button>
          ))}
        </div>
        {config.forma === "pincel" && (
          <CampoDeDistancia
            testid="nevoa-raio"
            rotulo="Raio do pincel"
            valorM={config.raioM}
            minM={RAIO_MINIMO_DO_PINCEL_M}
            maxM={RAIO_MAXIMO_DO_PINCEL_M}
            aoConfirmar={(v) => {
              if (v !== null) p.aoMudar({ ...config, raioM: v });
            }}
          />
        )}
        <p className="nota">{AJUDA_DA_FORMA[config.forma]}</p>
      </fieldset>
      <div className="linha-botoes">
        <button
          type="button"
          data-testid="nevoa-desfazer"
          disabled={p.tracos === 0}
          onClick={p.aoDesfazer}
        >
          <Undo2 size={16} /> Desfazer
        </button>
      </div>
      <div className="linha-botoes">
        <button
          type="button"
          data-testid="nevoa-cobrir-tudo"
          onClick={() => setConfirmando("cobrir")}
        >
          Cobrir tudo
        </button>
        <button
          type="button"
          data-testid="nevoa-revelar-tudo"
          disabled={!p.temNevoa}
          onClick={() => setConfirmando("revelar")}
        >
          Revelar tudo
        </button>
      </div>
      {confirmando && (
        <div className="confirmar-limpar" role="alertdialog" data-testid="nevoa-confirmacao">
          <p>
            {confirmando === "cobrir"
              ? "Cobrir a cena inteira? Os jogadores deixam de ver o mapa e os tokens que não são deles."
              : "Revelar a cena inteira? Os jogadores voltam a ver tudo o que a luz e a visão deixarem."}
          </p>
          <div className="acoes-confirmar">
            <button
              type="button"
              className="perigo"
              data-testid="nevoa-confirmar"
              onClick={() => {
                p.aoTracarTudo(confirmando);
                setConfirmando(null);
              }}
            >
              {confirmando === "cobrir" ? "Cobrir tudo" : "Revelar tudo"}
            </button>
            <button type="button" data-testid="nevoa-cancelar" onClick={() => setConfirmando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <p className="nota">
        Você vê a área coberta como um véu; os jogadores, como escuridão total.
      </p>
    </Janela>
  );
}
