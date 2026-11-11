import { type Cena, type ConfigIluminacao, luzAmbienteDa } from "@tabletop/shared";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Campo } from "./Campo";
import { noTopoAoCentro } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";

type Props = {
  cena: Cena;
  config: ConfigIluminacao;
  enviar: (tipo: string, dados: object) => string | null;
  aoFechar: () => void;
};

/**
 * Configurações de iluminação (só do mestre): a luz ambiente da cena que ele vê e os parâmetros da
 * memória do mapa (ligar, modo pela Inteligência ou fixo, valores, tom), mais o botão que manda todos
 * esquecerem a memória desta cena.
 */
export function PainelDeIluminacao({ cena, config, enviar, aoFechar }: Props) {
  const ambiente = luzAmbienteDa(cena);
  const [local, setLocal] = useState(Math.round(ambiente * 100));
  const arrastando = useRef(false);
  const [esquecida, setEsquecida] = useState(false);
  useEffect(() => {
    if (!arrastando.current) setLocal(Math.round(ambiente * 100));
  }, [ambiente]);
  // O aviso de "esquecida" some sozinho.
  useEffect(() => {
    if (!esquecida) return;
    const t = setTimeout(() => setEsquecida(false), 3000);
    return () => clearTimeout(t);
  }, [esquecida]);

  const mudar = (mudancas: Partial<ConfigIluminacao>) => enviar("config.iluminacao", { mudancas });
  const numero = (campo: keyof ConfigIluminacao) => (t: string) => {
    const n = Number(t.replace(",", "."));
    if (t !== "" && Number.isFinite(n) && n >= 0) mudar({ [campo]: n });
  };

  return (
    <Janela
      id="iluminacao"
      titulo="Configurações de iluminação"
      icone={<SlidersHorizontal size={16} />}
      testid="painel-config-iluminacao"
      classeDoCorpo="painel-config-luz"
      padrao={noTopoAoCentro()}
      largura={340}
      aoFechar={aoFechar}
      rotuloDoFechar="Fechar"
      testidDoFechar="config-fechar"
    >
      <fieldset className="quem-controla">
        <legend>Luz ambiente de “{cena.nome}”</legend>
        <div className="deslizante">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            aria-label="Luz ambiente"
            data-testid="config-luz-ambiente"
            value={local}
            onPointerDown={() => {
              arrastando.current = true;
            }}
            onPointerUp={() => {
              arrastando.current = false;
            }}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocal(v);
              enviar("cena.configurarIluminacao", { cenaId: cena.id, luzAmbiente: v / 100 });
            }}
          />
          <output data-testid="config-luz-ambiente-valor">{local}%</output>
        </div>
        <p className="nota">0% é escuridão total; 100%, dia (todos veem o que a visão alcança).</p>
      </fieldset>

      <fieldset className="quem-controla">
        <legend>Memória do mapa</legend>
        <label className="linha-opcao">
          <input
            type="checkbox"
            data-testid="config-memoria-ligada"
            checked={config.memoriaLigada}
            onChange={(e) => mudar({ memoriaLigada: e.target.checked })}
          />
          Lembrar o que já viu
        </label>
        <label className="campo-coluna">
          Alcance
          <select
            data-testid="config-memoria-modo"
            value={config.memoriaModo}
            disabled={!config.memoriaLigada}
            onChange={(e) =>
              mudar({ memoriaModo: e.target.value as ConfigIluminacao["memoriaModo"] })
            }
          >
            <option value="inteligencia">Pela Inteligência</option>
            <option value="fixo">Valor fixo</option>
          </select>
        </label>
        {config.memoriaModo === "inteligencia" ? (
          <div className="linha-par">
            <Campo
              testid="config-memoria-base"
              rotulo="Base (m)"
              tipo="number"
              min={0}
              desabilitado={!config.memoriaLigada}
              valor={String(config.memoriaBaseM)}
              aoConfirmar={numero("memoriaBaseM")}
            />
            <Campo
              testid="config-memoria-pormod"
              rotulo="Por modificador (m)"
              tipo="number"
              min={0}
              desabilitado={!config.memoriaLigada}
              valor={String(config.memoriaPorModM)}
              aoConfirmar={numero("memoriaPorModM")}
            />
          </div>
        ) : (
          <Campo
            testid="config-memoria-fixa"
            rotulo="Alcance fixo (m)"
            tipo="number"
            min={0}
            desabilitado={!config.memoriaLigada}
            valor={String(config.memoriaFixaM)}
            aoConfirmar={numero("memoriaFixaM")}
          />
        )}
        <label className="campo-coluna">
          Tom da lembrança
          <input
            type="color"
            data-testid="config-memoria-tom"
            value={config.tomDaMemoria}
            onChange={(e) => mudar({ tomDaMemoria: e.target.value })}
          />
        </label>
        <p className="nota">
          {config.memoriaModo === "inteligencia"
            ? "Alcance = base + valor por modificador de Inteligência do personagem (nunca abaixo de 0). "
            : "Todos se lembram até o mesmo alcance. "}
          O que passa do alcance é esquecido.
        </p>
        <button
          type="button"
          className="perigo"
          data-testid="config-esquecer"
          onClick={() => {
            enviar("memoria.esquecer", { cenaId: cena.id });
            setEsquecida(true);
          }}
        >
          Esquecer a memória desta cena
        </button>
        {esquecida && (
          <p className="nota" role="status" data-testid="config-esquecida">
            Todos esqueceram o mapa de “{cena.nome}”.
          </p>
        )}
      </fieldset>
    </Janela>
  );
}
