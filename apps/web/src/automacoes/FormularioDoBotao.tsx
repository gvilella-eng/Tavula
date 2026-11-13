import { type BotaoDeEvento, BotaoDeEventoSchema } from "@tabletop/shared";
import { useMemo, useState } from "react";
import { CampoDeTexto, Marcador } from "./campos";
import { EditorDaPeca } from "./Editor";
import { erroDoCampo, errosEmPortugues } from "./erros";
import { definir, idDoNome, ler } from "./rascunho";

type Props = {
  /** O botão a editar; `null` cria um novo. */
  inicial: BotaoDeEvento | null;
  cenas: readonly { id: string; nome: string }[];
  idsUsados: ReadonlySet<string>;
  eventos: readonly string[];
  aoSalvar: (botao: BotaoDeEvento, novo: boolean) => void;
  aoCancelar: () => void;
};

const idDoJson = (v: unknown) => String(ler(v, ["id"]) ?? "");

/** O formulário de um botão de evento do mestre: o rótulo, o evento que ele dispara e, se quiser, a cena. */
export function FormularioDoBotao(p: Props) {
  const ehNovo = p.inicial === null;
  const [rascunho, setRascunho] = useState<unknown>(p.inicial ?? { id: "", nome: "", evento: "" });
  const [idManual, setIdManual] = useState(false);
  const nome = String(ler(rascunho, ["nome"]) ?? "");
  const idAutomatico = idDoNome(nome, p.idsUsados, "botao");
  const comId = useMemo(
    () => (ehNovo && !idManual ? definir(rascunho, ["id"], idAutomatico) : rascunho),
    [rascunho, ehNovo, idManual, idAutomatico],
  );
  const idMostrado = idDoJson(comId);
  const resultado = BotaoDeEventoSchema.safeParse(comId);
  const erros = resultado.success ? [] : errosEmPortugues(resultado.error);
  const mudar = (caminho: ReadonlyArray<string | number>, valor: unknown) =>
    setRascunho(definir(comId, caminho, valor));

  return (
    <EditorDaPeca
      testid="form-botao"
      titulo={ehNovo ? "Novo botão de evento" : "Editar botão de evento"}
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
              testid="form-botao-nome"
              rotulo="Nome do botão"
              valor={nome}
              maxLength={40}
              placeholder="Ex.: Soprar o vento"
              aoMudar={(v) => mudar(["nome"], v)}
              erro={e("nome")}
            />
            <CampoDeTexto
              testid="form-botao-evento"
              rotulo="Evento que ele dispara"
              valor={String(ler(comId, ["evento"]) ?? "")}
              maxLength={48}
              placeholder="Ex.: rajada"
              sugestoes={p.eventos}
              aoMudar={(v) => mudar(["evento"], v)}
              erro={e("evento")}
            />
            <label className="campo-coluna">
              Onde vale
              <select
                data-testid="form-botao-cena"
                value={String(ler(comId, ["cenaId"]) ?? "")}
                onChange={(ev) =>
                  mudar(["cenaId"], ev.target.value === "" ? undefined : ev.target.value)
                }
              >
                <option value="">Em todas as cenas</option>
                {p.cenas.map((c) => (
                  <option key={c.id} value={c.id}>
                    Só em {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <Marcador
              testid="form-botao-fixado"
              rotulo="Fixar na barra de cima"
              marcado={ler(comId, ["fixado"]) === true}
              aoMudar={(v) => mudar(["fixado"], v ? true : undefined)}
            />
            <Marcador
              testid="form-botao-liberado"
              rotulo="Liberar o botão aos jogadores"
              marcado={ler(comId, ["liberadoParaJogadores"]) === true}
              aoMudar={(v) => mudar(["liberadoParaJogadores"], v ? true : undefined)}
            />
          </>
        );
      }}
    </EditorDaPeca>
  );
}
