import { type Caracteristica, moverNoGrupo, posicoesDoGrupo } from "@tabletop/shared";
import { ChevronRight, MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import type { PropsDaAba } from "./AbaPrincipal";
import { CampoDeNovo, CampoTexto } from "./campos";
import { useOrdemDaLista } from "./ordem";

const um = (caminho: string, valor: unknown) => [{ caminho, valor }];

/** Quanto tempo o "Enviado ao chat" fica à vista. */
const DURACAO_DO_ENVIADO_MS = 2500;

/** O botão "Mandar ao chat" de uma linha, com o aviso curto de que foi. */
export function BotaoMandarAoChat({
  testid,
  nome,
  podeMandar,
  aoMandar,
}: {
  testid: string;
  nome: string;
  podeMandar: boolean;
  aoMandar: () => void;
}) {
  const [enviado, setEnviado] = useState(false);
  useEffect(() => {
    if (!enviado) return;
    const t = setTimeout(() => setEnviado(false), DURACAO_DO_ENVIADO_MS);
    return () => clearTimeout(t);
  }, [enviado]);
  return (
    <>
      <BotaoComDica
        className="fl-ib"
        testid={testid}
        nome={`Mandar ${nome} ao chat`}
        aria-label={`Mandar ${nome} ao chat`}
        motivo={podeMandar ? null : "Só quem edita a ficha manda ao chat"}
        onClick={() => {
          aoMandar();
          setEnviado(true);
        }}
      >
        <MessageSquare size={16} aria-hidden />
      </BotaoComDica>
      {enviado && (
        <span className="fl-enviado" role="status" data-testid={`${testid}-enviado`}>
          Enviado ao chat
        </span>
      )}
    </>
  );
}

/**
 * A lista de características da ficha (V4a): cada linha tem a seta que gira, o título em destaque, a origem em
 * itálico e o botão de chat. Abrir mostra o texto, que se edita no lugar. Escrever na linha em branco do fim cria
 * o item. Serve `caracteristicas` (aba Personagem) e `outrasCaracteristicas` (aba História).
 */
export function ListaDeCaracteristicas({
  campo,
  testidBase,
  ficha,
  alterar,
  editar,
  enviar,
  personagemId,
}: Pick<PropsDaAba, "ficha" | "alterar" | "editar" | "enviar" | "personagemId"> & {
  campo: "caracteristicas" | "outrasCaracteristicas";
  testidBase: string;
}) {
  const lista: Caracteristica[] = ficha[campo] ?? [];
  const [abertas, setAbertas] = useState<Record<number, boolean>>({});
  const alternar = (i: number) => setAbertas((a) => ({ ...a, [i]: !a[i] }));
  const ordem = useOrdemDaLista({
    lista: campo,
    habilitado: editar,
    aoMover: (de, para) => {
      setAbertas({});
      alterar(
        um(
          campo,
          moverNoGrupo(
            lista,
            posicoesDoGrupo(lista, () => true),
            de,
            para,
          ),
        ),
      );
    },
  });
  return (
    <div className="fl-feats" data-testid={`${testidBase}-lista`}>
      {lista.map((c, i) => {
        const aberta = abertas[i] === true;
        return (
          <article
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
            key={`c-${i}`}
            className="fl-feat"
            data-testid={`${testidBase}-${i}`}
            data-aberta={aberta}
            {...ordem.linha(i, lista.length)}
          >
            <div className="fl-feat-linha">
              <button
                type="button"
                className="fl-feat-titulo"
                data-testid={`${testidBase}-alternar-${i}`}
                aria-expanded={aberta}
                aria-label={`${aberta ? "Recolher" : "Expandir"} ${c.nome}`}
                onClick={() => alternar(i)}
              >
                <ChevronRight size={14} className="fl-giro" aria-hidden />
                <span className="fl-feat-textos">
                  <span className="fl-fh fl-feat-nome">{c.nome}</span>
                  {c.origem && <span className="fl-sub">{c.origem}</span>}
                </span>
              </button>
              <BotaoMandarAoChat
                testid={`${testidBase}-chat-${i}`}
                nome={c.nome}
                podeMandar={editar}
                aoMandar={() =>
                  enviar("chat.caracteristica", {
                    caracteristica: {
                      nome: c.nome.trim().slice(0, 80),
                      descricao: c.descricao.slice(0, 12_000),
                      ...(c.origem ? { origem: c.origem.slice(0, 80) } : {}),
                    },
                    como: personagemId,
                  })
                }
              />
            </div>
            {aberta && (
              <div className="fl-feat-corpo">
                {editar ? (
                  <>
                    <CampoTexto
                      testid={`${testidBase}-nome-${i}`}
                      rotulo={`Título da característica ${i + 1}`}
                      valor={c.nome}
                      maxLength={80}
                      className="fl-fld"
                      aoMudar={(t) => alterar(um(`${campo}.${i}.nome`, t))}
                    />
                    <CampoTexto
                      testid={`${testidBase}-origem-${i}`}
                      rotulo={`Origem de ${c.nome}`}
                      placeholder="Origem (Classe: Patrulheiro)"
                      valor={c.origem ?? ""}
                      maxLength={80}
                      className="fl-fld"
                      aoMudar={(t) => alterar(um(`${campo}.${i}.origem`, t === "" ? null : t))}
                    />
                  </>
                ) : null}
                <CampoTexto
                  testid={`${testidBase}-descricao-${i}`}
                  rotulo={`Texto de ${c.nome}`}
                  placeholder="Descrição"
                  valor={c.descricao}
                  maxLength={20000}
                  multilinha
                  crescente
                  desabilitado={!editar}
                  className="fl-feat-texto"
                  aoMudar={(t) => alterar(um(`${campo}.${i}.descricao`, t))}
                />
                {editar && (
                  <BotaoComDica
                    className="fl-ib fl-feat-tirar"
                    testid={`${testidBase}-remover-${i}`}
                    nome={`Tirar ${c.nome}`}
                    aria-label={`Tirar ${c.nome}`}
                    onClick={() => alterar(um(`${campo}.${i}`, null))}
                  >
                    <Trash2 size={15} aria-hidden />
                  </BotaoComDica>
                )}
              </div>
            )}
          </article>
        );
      })}
      {editar && (
        <div className="fl-feat fl-feat-nova" data-testid={`${testidBase}-nova`}>
          <CampoDeNovo
            testid={`${testidBase}-nova-nome`}
            rotulo="Título da nova característica"
            placeholder="Nova característica"
            className="fl-fld"
            aoCriar={(t) => alterar(um(campo, [...lista, { nome: t, descricao: "" }]))}
          />
        </div>
      )}
      {!editar && lista.length === 0 && <p className="fl-dica">Nenhuma.</p>}
    </div>
  );
}
