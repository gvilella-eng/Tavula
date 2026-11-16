import {
  type EspacoNoChat,
  type Mensagem,
  type ResultadoDeModelo,
  type Rolagem,
  textoDaQuantidade,
} from "@tabletop/shared";
import type { ReactNode } from "react";
import { textoDoEspacoNoCartao } from "../CartaoDaMagia";
import {
  CartaoNoChat,
  ChipsDaRolagem,
  Coluna,
  formulaDaRolagem,
  LinhaDoBalao,
  Numero,
  NumeroDeDano,
  NumeroDuplo,
  RotuloDaVantagem,
  type TomDoCartao,
} from "./CartaoNoChat";
import { tiposDeDanoDoTexto } from "./danos";
import { expressaoLegivel, lerRotuloDeDano, naturalDoD20, totaisDaVantagem } from "./totais";

type Vantagem = "normal" | "vantagem" | "desvantagem";
type Modelo = ResultadoDeModelo;

/** O nome na fita com o que vem depois dele ("Cimitarra · nível 5"), cada parte separada por um ponto. */
function Fita({ nome, partes = [] }: { nome: ReactNode; partes?: ReactNode[] }) {
  return (
    <span className="rc-fita-texto">
      {nome}
      {partes.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: as partes são fixas
        <span key={i} className="rc-fita-parte">
          <span className="rc-sep" aria-hidden="true">
            {" · "}
          </span>
          {p}
        </span>
      ))}
    </span>
  );
}

/** Uma metade com o d20: o número (ou os dois totais da vantagem) e o rótulo "vantagem"/"desvantagem". */
function ColunaDoD20({
  rolagem,
  vantagem,
  tom,
  rotulo,
}: {
  rolagem: Rolagem;
  vantagem: Vantagem;
  tom: TomDoCartao;
  rotulo?: string;
}) {
  const totais = vantagem === "normal" ? null : totaisDaVantagem(rolagem);
  return (
    <Coluna
      rotulo={rotulo}
      complemento={vantagem === "normal" ? undefined : <RotuloDaVantagem vantagem={vantagem} />}
    >
      {totais ? (
        <NumeroDuplo totais={totais} tom={tom} />
      ) : (
        <Numero valor={rolagem.total} tom={tom} />
      )}
    </Coluna>
  );
}

function Complemento({ children }: { children: ReactNode }) {
  return <span className="rc-rodape-item">{children}</span>;
}

/** "com espaço de 5º", "como ritual" ou "conjuração inata": a linha pequena embaixo do número (sem dado a mais). */
function rodapeDoEspaco(e: EspacoNoChat | undefined): ReactNode {
  if (!e || e.extra) return null;
  return (
    <span className="rc-espaco" data-testid="espaco-usado">
      {textoDoEspacoNoCartao(e)}
    </span>
  );
}

/** O bloco do balão com o dado a mais do espaço de magia (V6): o que foi rolado, o total e a metade. */
function BalaoDoExtra({ e, critico }: { e: EspacoNoChat; critico: boolean }) {
  if (!e.extra) return null;
  return (
    <div className="rc-balao-linha" data-testid="bloco-espaco" data-critico={critico || undefined}>
      <strong className="rc-balao-titulo" data-testid="bloco-espaco-titulo">
        Espaço de {e.nivel}º · +{expressaoLegivel(e.extra.expressao)}
      </strong>
      {critico && <span className="rc-balao-nota">dobrado no crítico</span>}
      <LinhaDoBalao rolagem={e.extra.rolagem} nome="extra" />
      <span className="rc-balao-total" data-testid="bloco-espaco-total">
        Total <strong>{e.extra.total}</strong>
      </span>
      {e.extra.metade !== undefined && (
        <span className="rc-balao-nota" data-testid="bloco-espaco-metade">
          metade {e.extra.metade}
        </span>
      )}
    </div>
  );
}

/** O bloco do balão com os dardos ou raios rolados um por um (N2). */
function BalaoDaQuantidade({ e }: { e: EspacoNoChat }) {
  const q = e.quantidade;
  if (!q?.rolagens) return null;
  return (
    <div className="rc-balao-linha" data-testid="bloco-quantidade">
      <strong className="rc-balao-titulo" data-testid="bloco-quantidade-titulo">
        {textoDaQuantidade(q.total, q.unidade)} · {expressaoLegivel(q.rolagens[0]?.expressao ?? "")}{" "}
        cada
      </strong>
      <span className="rc-chips">
        {q.rolagens.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a lista é fixa
          <span key={i} className="rc-balao-dardo">
            <ChipsDaRolagem rolagem={r} />
            <span className="rc-balao-nota">{r.total}</span>
          </span>
        ))}
      </span>
      <span className="rc-balao-total" data-testid="bloco-quantidade-total">
        Total <strong>{q.soma}</strong>
      </span>
    </div>
  );
}

function BalaoDoEspaco({ e, critico }: { e: EspacoNoChat | undefined; critico: boolean }) {
  if (!e) return null;
  return (
    <>
      <BalaoDoExtra e={e} critico={critico} />
      <BalaoDaQuantidade e={e} />
    </>
  );
}

function tomDeTeste(critico: boolean, falhaCritica: boolean): TomDoCartao {
  return critico ? "critico" : falhaCritica ? "falha" : "normal";
}

/** A rolagem de um teste, ataque ou dado de vida (`mensagem.modelo`) como um cartão. */
export function CorpoDoModelo({ mensagem, modelo: m }: { mensagem: Mensagem; modelo: Modelo }) {
  const oculta = !!mensagem.oculta;
  const espaco = mensagem.espaco;

  if (m.modelo === "vida") {
    return (
      <CartaoNoChat
        testid="modelo-vida"
        nome={<Fita nome={m.nome} />}
        secreta={oculta}
        resumoSecreto={
          <>
            {m.nome}: <Numero valor={m.rolagem.total} />
          </>
        }
        colunas={[
          <Coluna key="v">
            <Numero valor={m.rolagem.total} />
          </Coluna>,
        ]}
        rodape={
          <Complemento>
            <span data-testid="modelo-vida-pv">
              +{m.curou} PV ({m.pvAtual}/{m.pvMax})
            </span>
          </Complemento>
        }
        baloes={[() => <LinhaDoBalao rolagem={m.rolagem} />]}
      />
    );
  }

  if (m.modelo === "teste") {
    const tom = tomDeTeste(m.critico, m.falhaCritica);
    const veredito =
      m.sucesso === undefined ? null : (
        <span data-testid="modelo-veredito">{m.sucesso ? "Sucesso" : "Falha"}</span>
      );
    const natural =
      m.sucesso === undefined
        ? m.critico
          ? "20 natural"
          : m.falhaCritica
            ? "1 natural"
            : null
        : null;
    return (
      <CartaoNoChat
        testid="modelo-teste"
        tom={tom}
        dados={{
          "data-sucesso": m.sucesso === undefined ? undefined : String(m.sucesso),
          "data-critico": m.critico ? "true" : undefined,
          "data-falha-critica": m.falhaCritica ? "true" : undefined,
        }}
        nome={<Fita nome={m.nome} partes={[veredito, natural].filter((x) => x !== null)} />}
        secreta={oculta}
        resumoSecreto={
          <>
            {m.nome}: <Numero valor={m.rolagem.total} />
            {m.cd !== undefined && ` (CD ${m.cd})`}
          </>
        }
        colunas={[<ColunaDoD20 key="t" rolagem={m.rolagem} vantagem={m.vantagem} tom={tom} />]}
        rodape={m.cd === undefined ? null : <Complemento>CD {m.cd}</Complemento>}
        baloes={[() => <LinhaDoBalao rolagem={m.rolagem} />]}
      />
    );
  }

  // ataque (com ou sem salvaguarda, com dano extra, truque por nível, dardos)
  // com salvaguarda a frente do cartão é a CD: o 20 e o 1 naturais do acerto ficam só no balão
  const tom = m.salvaguarda ? "normal" : tomDeTeste(m.critico, m.falhaCritica);
  const tipos = tiposDeDanoDoTexto(m.danoTipo);
  const danoTotal = espaco?.extra ? espaco.extra.total : m.dano.total;
  const metade = m.salvaguarda?.sucesso === "metade" ? Math.floor(danoTotal / 2) : null;
  const sufixos: ReactNode[] = [];
  if (m.nivelDoTruque) sufixos.push(`nível ${m.nivelDoTruque}`);
  if (espaco?.extra) sufixos.push(`${espaco.nivel}º espaço`);
  if (m.critico && !m.salvaguarda) sufixos.push(<span data-testid="modelo-veredito">Crítico</span>);
  if (m.falhaCritica && !m.salvaguarda)
    sufixos.push(<span data-testid="modelo-veredito">1 natural</span>);
  const colunaDoDano = (
    <Coluna
      key="d"
      rotulo={m.critico ? "dano crítico" : "dano"}
      complemento={metade !== null ? `metade ${metade}` : undefined}
    >
      <NumeroDeDano valor={danoTotal} tipos={tipos} tom={m.critico ? "critico" : "normal"} />
    </Coluna>
  );
  const colunaDaEsquerda = m.salvaguarda ? (
    <Coluna
      key="a"
      testid="modelo-cd"
      rotulo={<>CD {m.salvaguarda.atributo}</>}
      complemento={m.salvaguarda.sucesso === "metade" ? "metade no sucesso" : "nada no sucesso"}
    >
      <Numero valor={m.salvaguarda.cd} testid="modelo-cd-valor" />
    </Coluna>
  ) : (
    <ColunaDoD20 key="a" rolagem={m.acerto} vantagem={m.vantagem} tom={tom} rotulo="acerto" />
  );
  const formulaDoDano = `${expressaoLegivel(m.dano.expressao)}${m.danoTipo ? ` ${m.danoTipo.toLowerCase()}` : ""}${m.nivelDoTruque ? ` (nível ${m.nivelDoTruque})` : ""}${metade !== null ? ` · metade: ${Math.floor(m.dano.total / 2)}` : ""}`;
  return (
    <CartaoNoChat
      testid="modelo-ataque"
      tom={tom}
      dados={{
        "data-critico": m.critico ? "true" : undefined,
        "data-falha-critica": m.falhaCritica ? "true" : undefined,
      }}
      nome={<Fita nome={m.nome} partes={sufixos} />}
      secreta={oculta}
      resumoSecreto={
        <>
          {m.nome}:{" "}
          {m.salvaguarda ? (
            `CD ${m.salvaguarda.cd}`
          ) : (
            <>
              acerto <Numero valor={m.acerto.total} />
            </>
          )}
          ,{" dano "}
          <Numero valor={danoTotal} testid="rolagem-total-dano" />
        </>
      }
      colunas={[colunaDaEsquerda, colunaDoDano]}
      rodape={rodapeDoEspaco(espaco)}
      nomesDasMetades={[m.salvaguarda ? "salvaguarda" : "acerto", "dano"]}
      baloes={[
        // com salvaguarda a CD não tem dado: o acerto (e o 20 natural) ficam no balão da metade da CD
        () => <LinhaDoBalao rolagem={m.acerto} nome="acerto" />,
        () => (
          <>
            <LinhaDoBalao
              rolagem={m.dano}
              nome="dano"
              texto={formulaDoDano}
              testidDaFormula="modelo-dano-formula"
            />
            <BalaoDoEspaco e={espaco} critico={m.critico} />
          </>
        ),
      ]}
    />
  );
}

/** Uma rolagem solta (`/r`, a barra de dados, dano de magia mandado como `/r`): `mensagem.rolagens` com o comentário. */
export function CorpoDaRolagemLivre({ mensagem }: { mensagem: Mensagem }) {
  const rolagens = mensagem.rolagens ?? [];
  const oculta = !!mensagem.oculta;
  const espaco = mensagem.espaco;
  const primeira = rolagens[0];
  if (!primeira) return null;
  const rotulo = lerRotuloDeDano(mensagem.texto);
  const natural = rolagens.length === 1 ? naturalDoD20(primeira) : "";
  const tom: TomDoCartao = natural === "20" ? "critico" : natural === "1" ? "falha" : "normal";
  const vantagemDoD20 = (r: Rolagem): Vantagem => {
    const t = r.termos.find((x) => x.tipo === "dados" && x.faces === 20 && x.sinal === 1);
    if (t?.tipo !== "dados" || !t.manter) return "normal";
    return t.manter.modo === "kh" ? "vantagem" : "desvantagem";
  };

  // o dano de uma magia ou ataque mandado como `/r` (sem acerto): "CD | dano" com o ícone do tipo
  if (rotulo && rolagens.length === 1) {
    const total = espaco?.quantidade?.soma ?? espaco?.extra?.total ?? primeira.total;
    const colunas: ReactNode[] = [];
    if (rotulo.cd !== undefined) {
      colunas.push(
        <Coluna key="cd" testid="modelo-cd" rotulo="CD">
          <Numero valor={rotulo.cd} testid="modelo-cd-valor" />
        </Coluna>,
      );
    }
    colunas.push(
      <Coluna key="d" rotulo="dano">
        <NumeroDeDano valor={total} tipos={rotulo.tipos} />
      </Coluna>,
    );
    const sufixos: ReactNode[] = [];
    if (rotulo.nivelDoTruque) sufixos.push(`nível ${rotulo.nivelDoTruque}`);
    if (espaco?.extra) sufixos.push(`${espaco.nivel}º espaço`);
    return (
      <CartaoNoChat
        testid="modelo-livre"
        nome={<Fita nome={rotulo.nome || "Dano"} partes={sufixos} />}
        secreta={oculta}
        resumoSecreto={
          <>
            {rotulo.nome}: {rotulo.cd !== undefined && `CD ${rotulo.cd}, `}dano{" "}
            <Numero valor={total} />
          </>
        }
        colunas={colunas}
        rodape={rodapeDoEspaco(espaco)}
        nomesDasMetades={rotulo.cd !== undefined ? ["CD", "dano"] : ["dano"]}
        baloes={[
          ...(rotulo.cd !== undefined ? [null] : []),
          () => (
            <>
              <LinhaDoBalao
                rolagem={primeira}
                texto={`${formulaDaRolagem(primeira)}${rotulo.tipoTexto ? ` ${rotulo.tipoTexto.toLowerCase()}` : ""}`}
              />
              <BalaoDoEspaco e={espaco} critico={false} />
            </>
          ),
        ]}
      />
    );
  }

  const total = espaco?.quantidade?.soma ?? espaco?.extra?.total ?? primeira.total;
  const nome: ReactNode = mensagem.texto ? (
    mensagem.texto
  ) : (
    <span data-testid="rolagem-expressao">{expressaoLegivel(primeira.expressao)}</span>
  );
  const partes: ReactNode[] = [];
  if (espaco?.extra) partes.push(`${espaco.nivel}º espaço`);
  if (natural === "20") partes.push("20 natural");
  if (natural === "1") partes.push("1 natural");
  return (
    <CartaoNoChat
      testid="modelo-livre"
      tom={tom}
      dados={{ "data-natural": natural || undefined }}
      nome={<Fita nome={nome} partes={partes} />}
      secreta={oculta}
      resumoSecreto={
        <>
          {mensagem.texto ?? expressaoLegivel(primeira.expressao)}: <Numero valor={total} />
        </>
      }
      colunas={
        rolagens.length > 1
          ? rolagens.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a lista é fixa
              <Coluna key={i}>
                <Numero valor={r.total} />
              </Coluna>
            ))
          : [
              <ColunaDoD20
                key="l"
                rolagem={primeira}
                vantagem={vantagemDoD20(primeira)}
                tom={tom}
              />,
            ]
      }
      rodape={rodapeDoEspaco(espaco)}
      nomesDasMetades={rolagens.map((_, i) => `rolagem ${i + 1}`)}
      baloes={rolagens.map((r, i) => () => (
        <>
          <LinhaDoBalao rolagem={r} />
          {i === rolagens.length - 1 && <BalaoDoEspaco e={espaco} critico={false} />}
        </>
      ))}
    />
  );
}
