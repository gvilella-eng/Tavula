import type { EfeitosDaZona, Gatilho, Zona } from "@tabletop/shared";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Fontes } from "./assets/fontes";
import { CampoDecimal, CampoDeDistancia } from "./Campo";
import { dasFerramentas } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { Deslizante } from "./som/Deslizante";
import { EscolherSom, type SomEscolhido } from "./som/EscolherSom";

type Props = {
  /** N5: de onde vêm os sons e como adicionar um (o "Som enquanto dentro"). */
  fontes: Fontes;
  registrarSom: (arquivo: File) => Promise<SomEscolhido>;
  /** A zona selecionada, se houver. */
  selecionada: Zona | null;
  /** As automações que usam esta zona (o editor delas é o das automações). */
  automacoes: readonly { id: string; nome: string }[];
  /** Abre o editor das automações: numa existente, ou numa nova (com o gatilho de entrar na zona já posto). */
  aoAbrirAutomacao: (fluxoId: string | null, gatilho?: Gatilho) => void;
  enviar: (tipo: string, dados: object) => string | null;
  aoApagar: (id: string) => void;
  aoFechar: () => void;
};

type EfeitoDaZona = "luzRaioX" | "luzSomaM" | "visaoMaxM";

/** Os limites de cada efeito (os do schema da zona); o valor fora deles é preso ao limite. Distâncias em metros. */
const LIMITES: Record<EfeitoDaZona, { min: number; max: number }> = {
  luzRaioX: { min: 0.1, max: 5 },
  luzSomaM: { min: -100, max: 100 },
  visaoMaxM: { min: 0.5, max: 1000 },
};

/**
 * Painel pequeno da ferramenta Zonas (só do mestre, 7b-2): como desenhar e, com uma zona selecionada, o nome, se está
 * ligada, os efeitos enquanto algo está dentro e apagar. Cada mudança vai na hora. As automações da zona são editadas no
 * editor das automações; aqui a lista das que usam a zona e o atalho para criar uma.
 */
export function PainelDasZonas(p: Props) {
  const z = p.selecionada;
  const [nome, setNome] = useState(z?.nome ?? "");
  const zonaId = z?.id;
  const nomeDaSala = z?.nome;
  // biome-ignore lint/correctness/useExhaustiveDependencies: o campo recomeça quando a seleção ou o nome na sala mudam
  useEffect(() => setNome(nomeDaSala ?? ""), [zonaId, nomeDaSala]);

  // Os efeitos vão inteiros em cada edição: o que se acabou de mandar fica nesta referência, para duas edições seguidas (antes de
  // a sala responder à primeira) não se pisarem. Ela volta ao que a sala tem quando a zona ou os efeitos mudam lá.
  const efeitosDaSala = JSON.stringify(z?.efeitos ?? {});
  const efeitosMandados = useRef<EfeitosDaZona>(z?.efeitos ?? {});
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomeça da sala quando a zona ou os efeitos dela mudam
  useEffect(() => {
    efeitosMandados.current = z?.efeitos ?? {};
  }, [zonaId, efeitosDaSala]);

  function mudarEfeito(chave: EfeitoDaZona, valor: number | null) {
    if (!z) return;
    const efeitos = { ...efeitosMandados.current };
    if (valor === null) delete efeitos[chave];
    else efeitos[chave] = Math.min(LIMITES[chave].max, Math.max(LIMITES[chave].min, valor));
    efeitosMandados.current = efeitos;
    p.enviar("zona.editar", { id: z.id, mudancas: { efeitos } });
  }
  /** N5: o som da zona (sem ele a zona não toca nada). Vai junto com os outros efeitos. */
  function mudarSom(som: EfeitosDaZona["som"] | null) {
    if (!z) return;
    const { som: _antigo, ...resto } = efeitosMandados.current;
    const efeitos: EfeitosDaZona = som ? { ...resto, som } : resto;
    efeitosMandados.current = efeitos;
    p.enviar("zona.editar", { id: z.id, mudancas: { efeitos } });
  }
  const [escolhendoSom, setEscolhendoSom] = useState(false);
  function confirmarNome() {
    if (!z) return;
    const limpo = nome.trim();
    if (limpo === "") setNome(z.nome);
    else if (limpo !== z.nome) p.enviar("zona.editar", { id: z.id, mudancas: { nome: limpo } });
  }

  return (
    <Janela
      id="zonas"
      titulo="Zonas"
      testid="painel-zonas"
      classeDoCorpo="painel-token"
      padrao={dasFerramentas}
      largura={248}
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar a ferramenta"
      testidDoFechar="zonas-fechar"
    >
      <p className="nota">
        Clique para marcar os cantos; duplo clique ou Enter fecha, Esc cancela. Alt solta do grid.
        Só você vê as zonas.
      </p>
      {z ? (
        <fieldset className="quem-controla" data-testid="zona-selecionada">
          <legend>Zona selecionada</legend>
          <label>
            Nome
            <input
              type="text"
              data-testid="zona-nome"
              value={nome}
              maxLength={64}
              onChange={(e) => setNome(e.target.value)}
              onBlur={confirmarNome}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarNome();
              }}
            />
          </label>
          <label className="linha-opcao">
            <input
              type="checkbox"
              data-testid="zona-ativa"
              checked={z.ativa}
              onChange={(e) =>
                p.enviar("zona.editar", { id: z.id, mudancas: { ativa: e.target.checked } })
              }
            />
            Ligada
          </label>
          <fieldset className="quem-controla" data-testid="zona-efeitos">
            <legend>Enquanto algo está dentro</legend>
            <CampoDecimal
              testid="zona-luz-fator"
              rotulo="Luz × fator"
              dica="Multiplica o raio das luzes dentro (0,5 = metade). Vazio tira o efeito."
              placeholder="sem efeito"
              valor={z.efeitos.luzRaioX}
              min={LIMITES.luzRaioX.min}
              max={LIMITES.luzRaioX.max}
              limitar
              aoConfirmar={(v) => mudarEfeito("luzRaioX", v)}
            />
            <CampoDeDistancia
              testid="zona-luz-soma"
              rotulo="Luz ±"
              nota="negativo diminui"
              valorM={z.efeitos.luzSomaM}
              minM={LIMITES.luzSomaM.min}
              maxM={LIMITES.luzSomaM.max}
              aoConfirmar={(v) => mudarEfeito("luzSomaM", v)}
            />
            <CampoDeDistancia
              testid="zona-visao"
              rotulo="Visão máxima"
              nota="vazio tira o limite"
              valorM={z.efeitos.visaoMaxM}
              minM={LIMITES.visaoMaxM.min}
              maxM={LIMITES.visaoMaxM.max}
              aoConfirmar={(v) => mudarEfeito("visaoMaxM", v)}
            />
          </fieldset>
          <fieldset className="quem-controla" data-testid="zona-som">
            <legend>Som enquanto dentro</legend>
            {z.efeitos.som ? (
              <>
                <p className="som-agora" data-testid="zona-som-nome">
                  {z.efeitos.som.nome}
                </p>
                <Deslizante
                  testid="zona-som-volume"
                  rotulo="Volume do som da zona"
                  valor={z.efeitos.som.volume}
                  aoMudar={(volume) => z.efeitos.som && mudarSom({ ...z.efeitos.som, volume })}
                />
                <label className="som-opcao">
                  <input
                    type="checkbox"
                    data-testid="zona-som-laco"
                    checked={z.efeitos.som.laco}
                    onChange={(e) =>
                      z.efeitos.som && mudarSom({ ...z.efeitos.som, laco: e.target.checked })
                    }
                  />
                  Repetir em laço
                </label>
                <div className="linha-botoes">
                  <button
                    type="button"
                    data-testid="zona-som-trocar"
                    onClick={() => setEscolhendoSom(true)}
                  >
                    Trocar
                  </button>
                  <button type="button" data-testid="zona-som-tirar" onClick={() => mudarSom(null)}>
                    Tirar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="nota">Quem estiver dentro ouve; o resto da mesa não.</p>
                {!escolhendoSom && (
                  <button
                    type="button"
                    data-testid="zona-som-escolher"
                    onClick={() => setEscolhendoSom(true)}
                  >
                    Escolher um som…
                  </button>
                )}
              </>
            )}
            {escolhendoSom && (
              <EscolherSom
                fontes={p.fontes}
                registrar={p.registrarSom}
                testid="zona-som-escolher-lista"
                aoEscolher={(s) => {
                  mudarSom({
                    hash: s.hash,
                    nome: s.nome,
                    volume: z.efeitos.som?.volume ?? 0.8,
                    laco: z.efeitos.som?.laco ?? true,
                  });
                  setEscolhendoSom(false);
                }}
              />
            )}
          </fieldset>
          <div className="zona-automacoes" data-testid="zona-reacoes">
            <p className="nota" data-testid="zona-automacoes-titulo">
              {p.automacoes.length === 0
                ? "Nenhuma automação usa esta zona"
                : p.automacoes.length === 1
                  ? "1 automação usa esta zona"
                  : `${p.automacoes.length} automações usam esta zona`}
            </p>
            {p.automacoes.length > 0 && (
              <ul className="lista-simples">
                {p.automacoes.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="link-da-entrada"
                      data-testid={`zona-auto-${a.id}`}
                      onClick={() => p.aoAbrirAutomacao(a.id)}
                    >
                      {a.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              data-testid="zona-nova-automacao"
              onClick={() =>
                p.aoAbrirAutomacao(null, { tipo: "zona", quando: "entra", zona: z.id })
              }
            >
              + automação para esta zona
            </button>
          </div>
          <p className="nota">Arraste as bolinhas para mexer nos cantos.</p>
          <button
            type="button"
            className="perigo"
            data-testid="zona-apagar"
            onClick={() => p.aoApagar(z.id)}
          >
            <Trash2 size={16} /> Apagar
          </button>
        </fieldset>
      ) : (
        <p className="nota" data-testid="zona-nenhuma">
          Clique numa zona para editar.
        </p>
      )}
    </Janela>
  );
}
