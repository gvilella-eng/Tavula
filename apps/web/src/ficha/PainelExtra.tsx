import { Minus, Plus, Trash2 } from "lucide-react";
import { BotaoComDica } from "../BotaoComDica";
import { type PropsDaAba, um } from "./AbaPrincipal";
import { CampoNumero, CampoTexto } from "./campos";
import { secao } from "./secoes";

/** Embaixo das três colunas da aba Personagem: os recursos (flechas, usos de classe...). As condições ficam no token e as luzes na linha do equipamento (V4a2). */
function PainelExtraBruto(props: PropsDaAba) {
  const { ficha, alterar, editar } = props;
  const recursos = ficha.recursos ?? [];
  return (
    <div className="fh-extra" data-testid="fh-extra">
      <section className="fh-secao" data-testid="fh-recursos" aria-label="Recursos">
        <h4>Recursos</h4>
        {recursos.length === 0 && (
          <p className="nota">Nenhum recurso (flechas, usos de classe...).</p>
        )}
        {recursos.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
          <div key={i} className="fh-recurso" data-testid={`recurso-${i}`}>
            <CampoTexto
              testid={`recurso-nome-${i}`}
              rotulo="Nome do recurso"
              valor={r.nome}
              maxLength={80}
              desabilitado={!editar}
              aoMudar={(t) => alterar(um(`recursos.${i}.nome`, t))}
            />
            {editar && (
              <button
                type="button"
                className="botao-icone pequeno"
                data-testid={`recurso-menos-${i}`}
                aria-label={`Gastar um uso de ${r.nome}`}
                disabled={r.atual <= 0}
                onClick={() => alterar(um(`recursos.${i}.atual`, r.atual - 1))}
              >
                <Minus size={14} />
              </button>
            )}
            <CampoNumero
              testid={`recurso-atual-${i}`}
              rotulo={`${r.nome}: atual`}
              valor={r.atual}
              desabilitado={!editar}
              className="mini"
              aoMudar={(n) => alterar(um(`recursos.${i}.atual`, n))}
            />
            <span>/</span>
            <CampoNumero
              testid={`recurso-max-${i}`}
              rotulo={`${r.nome}: máximo`}
              valor={r.max}
              desabilitado={!editar}
              className="mini"
              aoMudar={(n) => alterar(um(`recursos.${i}.max`, n))}
            />
            {editar && (
              <button
                type="button"
                className="botao-icone pequeno"
                data-testid={`recurso-mais-${i}`}
                aria-label={`Recuperar um uso de ${r.nome}`}
                disabled={r.atual >= r.max}
                onClick={() => alterar(um(`recursos.${i}.atual`, r.atual + 1))}
              >
                <Plus size={14} />
              </button>
            )}
            <select
              data-testid={`recurso-recarga-${i}`}
              aria-label={`Recarga de ${r.nome}`}
              value={r.recarga}
              disabled={!editar}
              onChange={(e) => alterar(um(`recursos.${i}.recarga`, e.target.value))}
            >
              <option value="curto">descanso curto</option>
              <option value="longo">descanso longo</option>
              <option value="nenhuma">não recarrega</option>
            </select>
            {editar && (
              <BotaoComDica
                className="botao-icone pequeno"
                testid={`recurso-remover-${i}`}
                nome={`Tirar o recurso ${r.nome}`}
                aria-label={`Tirar o recurso ${r.nome}`}
                onClick={() => alterar(um(`recursos.${i}`, null))}
              >
                <Trash2 size={14} />
              </BotaoComDica>
            )}
          </div>
        ))}
        {editar && (
          <button
            type="button"
            data-testid="recurso-adicionar"
            onClick={() =>
              alterar(
                um("recursos", [
                  ...recursos,
                  { nome: "Novo recurso", atual: 1, max: 1, recarga: "longo" },
                ]),
              )
            }
          >
            <Plus size={14} /> Recurso
          </button>
        )}
      </section>
    </div>
  );
}

// Q14: só os recursos importam a esta seção.
export const PainelExtra = secao("PainelExtra", PainelExtraBruto, { ficha: ["recursos"] });
