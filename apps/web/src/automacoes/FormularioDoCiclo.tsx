import { type Ciclo, CicloSchema } from "@tabletop/shared";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CampoDecimal } from "../Campo";
import { CampoDeTexto, EscolhaDeCenas, Marcador } from "./campos";
import { EditorDaPeca } from "./Editor";
import { erroDoCampo, errosEmPortugues } from "./erros";
import { definir, idDoNome, ler } from "./rascunho";

type Props = {
  /** O ciclo a editar; `null` cria um novo. */
  inicial: Ciclo | null;
  cenas: readonly { id: string; nome: string }[];
  /** Os ids de ciclo já usados (para o id novo não repetir). */
  idsUsados: ReadonlySet<string>;
  eventos: readonly string[];
  aoSalvar: (ciclo: Ciclo, novo: boolean) => void;
  aoCancelar: () => void;
};

const NOVO = {
  id: "",
  nome: "",
  periodoS: 180,
  cenas: [] as string[],
  fases: [{ emS: 0, evento: "" }] as unknown[],
};

/** O formulário de um ciclo: nome, período, cenas e as fases (em quantos segundos, nome do evento, duração). */
export function FormularioDoCiclo(p: Props) {
  const ehNovo = p.inicial === null;
  const [rascunho, setRascunho] = useState<unknown>(p.inicial ?? NOVO);
  // No ciclo novo o id acompanha o nome até a pessoa mexer nele (pelo JSON).
  const [idManual, setIdManual] = useState(false);
  const nomeAtual = String(ler(rascunho, ["nome"]) ?? "");
  const idAutomatico = idDoNome(nomeAtual, p.idsUsados, "ciclo");
  const comId = useMemo(
    () => (ehNovo && !idManual ? definir(rascunho, ["id"], idAutomatico) : rascunho),
    [rascunho, ehNovo, idManual, idAutomatico],
  );

  const idMostrado = idDoJson(comId);
  const resultado = CicloSchema.safeParse(comId);
  const erros = resultado.success ? [] : errosEmPortugues(resultado.error);
  const mudar = (caminho: ReadonlyArray<string | number>, valor: unknown) =>
    setRascunho(definir(comId, caminho, valor));
  const fases = (ler(comId, ["fases"]) as unknown[] | undefined) ?? [];
  const cenasDele = (ler(comId, ["cenas"]) as string[] | undefined) ?? [];

  return (
    <EditorDaPeca
      testid="form-ciclo"
      titulo={ehNovo ? "Novo ciclo" : "Editar ciclo"}
      rascunho={comId}
      aoMudarRascunho={(v) => {
        if (idDoJson(v) !== idMostrado) setIdManual(true);
        setRascunho(v);
      }}
      erros={erros}
      aoSalvar={() => resultado.success && p.aoSalvar(resultado.data, ehNovo)}
      aoCancelar={p.aoCancelar}
    >
      {(mostrar) => {
        const e = (caminho: string) => (mostrar ? erroDoCampo(erros, caminho) : undefined);
        return (
          <>
            <CampoDeTexto
              testid="form-ciclo-nome"
              rotulo="Nome"
              valor={nomeAtual}
              maxLength={64}
              placeholder="Ex.: Respiração da Montanha"
              aoMudar={(v) => mudar(["nome"], v)}
              erro={e("nome")}
            />
            <CampoDecimal
              testid="form-ciclo-periodo"
              rotulo="Período (segundos): de quanto em quanto tempo o ciclo recomeça"
              valor={ler(comId, ["periodoS"]) as number | undefined}
              aoConfirmar={(v) => mudar(["periodoS"], v ?? undefined)}
              erro={e("periodoS")}
            />
            <fieldset className="quem-controla">
              <legend>Onde vale</legend>
              <EscolhaDeCenas
                testid="form-ciclo-cena"
                cenas={p.cenas}
                valor={cenasDele}
                aoMudar={(ids) => mudar(["cenas"], ids)}
              />
              <p className="nota">Nenhuma marcada: vale em todas as cenas.</p>
            </fieldset>
            <fieldset className="quem-controla" data-testid="form-ciclo-fases">
              <legend>Fases</legend>
              {fases.map((_, i) => {
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a fase não tem id; a posição é a identidade na lista
                  <div className="linha-da-fase" key={i} data-testid={`form-ciclo-fase-${i}`}>
                    <CampoDecimal
                      testid={`form-ciclo-fase-${i}-em`}
                      rotulo="Em quantos segundos"
                      valor={ler(comId, ["fases", i, "emS"]) as number | undefined}
                      aoConfirmar={(v) => mudar(["fases", i, "emS"], v ?? undefined)}
                      erro={e(`fases.${i}.emS`)}
                    />
                    <CampoDeTexto
                      testid={`form-ciclo-fase-${i}-evento`}
                      rotulo="Evento que ela dispara"
                      valor={String(ler(comId, ["fases", i, "evento"]) ?? "")}
                      maxLength={48}
                      placeholder="Ex.: inspiracao"
                      sugestoes={p.eventos}
                      aoMudar={(v) => mudar(["fases", i, "evento"], v)}
                      erro={e(`fases.${i}.evento`)}
                    />
                    <CampoDecimal
                      testid={`form-ciclo-fase-${i}-duracao`}
                      rotulo="Duração dos efeitos (segundos)"
                      placeholder="opcional"
                      dica="O prazo padrão dos efeitos que as reações a este evento criarem."
                      valor={ler(comId, ["fases", i, "duracaoS"]) as number | undefined}
                      aoConfirmar={(v) => mudar(["fases", i, "duracaoS"], v ?? undefined)}
                      erro={e(`fases.${i}.duracaoS`)}
                    />
                    <button
                      type="button"
                      className="botao-icone pequeno"
                      data-testid={`form-ciclo-fase-${i}-tirar`}
                      aria-label={`Tirar a fase ${i + 1}`}
                      disabled={fases.length <= 1}
                      onClick={() => mudar(["fases", i], undefined)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              {e("fases") !== undefined && (
                <p className="erro-do-campo" role="alert">
                  {e("fases")}
                </p>
              )}
              <button
                type="button"
                data-testid="form-ciclo-add-fase"
                onClick={() => mudar(["fases", fases.length], { emS: 0, evento: "" })}
              >
                <Plus size={14} /> Adicionar fase
              </button>
            </fieldset>
            <Marcador
              testid="form-ciclo-fixado"
              rotulo="Fixar na barra de cima"
              marcado={ler(comId, ["fixado"]) === true}
              aoMudar={(v) => mudar(["fixado"], v ? true : undefined)}
            />
            <Marcador
              testid="form-ciclo-liberado"
              rotulo="Liberar os botões aos jogadores"
              marcado={ler(comId, ["liberadoParaJogadores"]) === true}
              aoMudar={(v) => mudar(["liberadoParaJogadores"], v ? true : undefined)}
            />
          </>
        );
      }}
    </EditorDaPeca>
  );
}

function idDoJson(v: unknown): string {
  return String(ler(v, ["id"]) ?? "");
}
