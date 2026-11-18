import type { Ficha } from "@tabletop/shared";
import { ImagePlus } from "lucide-react";
import { BotaoComDica } from "../BotaoComDica";
import { useImagem } from "../useImagem";
import { type PropsDaAba, um } from "./AbaPrincipal";
import { CampoTexto } from "./campos";
import { ListaDeCaracteristicas } from "./ListaDeTitulos";
import { Secao } from "./livro";
import { secao } from "./secoes";

/** Uma imagem local da ficha (aparência, símbolo): clicar escolhe; sem imagem, mostra o convite. */
function ImagemDaFicha({
  hash,
  testid,
  titulo,
  props,
  aoEscolher,
}: {
  hash: string | undefined;
  testid: string;
  titulo: string;
  props: PropsDaAba;
  aoEscolher: (hash: string) => void;
}) {
  const url = useImagem(props.imagens, hash, props.versaoDasImagens);
  const podeTrocar = props.editar && props.podeTrocarImagem;
  return (
    <BotaoComDica
      className="fl-imagem"
      testid={testid}
      nome={titulo}
      motivo={podeTrocar ? null : "Só quem edita a ficha e pode enviar imagens troca"}
      data-com-imagem={url !== null}
      aria-label={titulo}
      onClick={() => props.pedirImagem(titulo, "retrato", aoEscolher)}
    >
      {url ? <img src={url} alt="" /> : <ImagePlus size={22} aria-hidden />}
    </BotaoComDica>
  );
}

type CampoCurtoDaFicha = "idade" | "altura" | "peso" | "olhos" | "pele" | "cabelos";

function campoCurto({ ficha, alterar, editar }: PropsDaAba, c: CampoCurtoDaFicha, rotulo: string) {
  return (
    <div className="fl-campo-id">
      <CampoTexto
        testid={`ficha-${c}`}
        rotulo={rotulo}
        valor={ficha[c] ?? ""}
        maxLength={40}
        desabilitado={!editar}
        className="fl-in fl-ln"
        aoMudar={(t) => alterar(um(c, t === "" ? null : t))}
      />
      <span className="fl-lbl">{rotulo}</span>
    </div>
  );
}

type TextoDaFicha = "personalidade" | "ideais" | "ligacoes" | "defeitos" | "historia" | "tesouro";

/** Q14: cada caixa de texto da História é uma seção: escrever numa só redesenha só ela. */
function caixaDeTexto(c: TextoDaFicha, rotulo: string, max: number, dica: string, altura: string) {
  return secao(
    `Historia:${c}`,
    ({ ficha, alterar, editar }: PropsDaAba) => (
      <div className="fl-cx fl-fr fl-hist-caixa" data-testid={`fh-${c}`}>
        <Secao className="fl-hist-titulo">{rotulo}</Secao>
        <CampoTexto
          testid={`ficha-${c}`}
          rotulo={rotulo}
          placeholder={dica}
          valor={ficha[c] ?? ""}
          maxLength={max}
          multilinha
          crescente
          desabilitado={!editar}
          className={`fl-in fl-rule ${altura}`}
          aoMudar={(t) => alterar(um(c, t === "" ? null : t))}
        />
      </div>
    ),
    { ficha: [c] },
  );
}

const Personalidade = caixaDeTexto(
  "personalidade",
  "Traços de personalidade",
  2000,
  "",
  "fl-h-130",
);
const Ideais = caixaDeTexto("ideais", "Ideais", 2000, "", "fl-h-130");
const Vinculos = caixaDeTexto("ligacoes", "Vínculos", 2000, "", "fl-h-100");
const Defeitos = caixaDeTexto("defeitos", "Defeitos", 2000, "", "fl-h-100");
const Historia = caixaDeTexto("historia", "História do personagem", 20_000, "", "fl-h-200");
const Tesouro = caixaDeTexto(
  "tesouro",
  "Tesouro",
  8000,
  "Anote tesouros e recompensas.",
  "fl-h-200",
);

const CHAVES_DA_APARENCIA: (keyof Ficha)[] = [
  "aparenciaHash",
  "aparencia",
  "idade",
  "altura",
  "peso",
  "olhos",
  "pele",
  "cabelos",
];

const Aparencia = secao(
  "Historia:aparencia",
  (props: PropsDaAba) => {
    const { ficha, alterar, editar } = props;
    return (
      <div className="fl-cx fl-fr fl-hist-caixa" data-testid="fh-aparencia">
        <Secao className="fl-hist-titulo">Aparência</Secao>
        <div className="fl-hist-campos">
          {campoCurto(props, "idade", "Idade")}
          {campoCurto(props, "altura", "Altura")}
          {campoCurto(props, "peso", "Peso")}
          {campoCurto(props, "olhos", "Olhos")}
          {campoCurto(props, "pele", "Pele")}
          {campoCurto(props, "cabelos", "Cabelos")}
        </div>
        <div className="fl-hist-imagem-e-texto">
          <ImagemDaFicha
            hash={ficha.aparenciaHash}
            testid="ficha-aparencia-imagem"
            titulo="Imagem da aparência"
            props={props}
            aoEscolher={(h) => alterar(um("aparenciaHash", h))}
          />
          <CampoTexto
            testid="ficha-aparencia"
            rotulo="Aparência do personagem"
            placeholder="Descreva a aparência do personagem."
            valor={ficha.aparencia ?? ""}
            maxLength={4000}
            multilinha
            crescente
            desabilitado={!editar}
            className="fl-in fl-rule fl-h-150"
            aoMudar={(t) => alterar(um("aparencia", t === "" ? null : t))}
          />
        </div>
      </div>
    );
  },
  { ficha: CHAVES_DA_APARENCIA },
);

const AliadosESimbolo = secao(
  "Historia:aliados",
  (props: PropsDaAba) => {
    const { ficha, alterar, editar } = props;
    return (
      <div className="fl-cx fl-fr fl-hist-caixa" data-testid="fh-aliados">
        <Secao className="fl-hist-titulo">Aliados e organizações</Secao>
        <CampoTexto
          testid="ficha-aliados"
          rotulo="Aliados e organizações"
          placeholder="Liste aliados, contatos e grupos."
          valor={ficha.aliados ?? ""}
          maxLength={8000}
          multilinha
          crescente
          desabilitado={!editar}
          className="fl-in fl-rule fl-h-150"
          aoMudar={(t) => alterar(um("aliados", t === "" ? null : t))}
        />
        <div className="fl-simbolo" data-testid="fh-simbolo">
          <ImagemDaFicha
            hash={ficha.simboloHash}
            testid="ficha-simbolo-imagem"
            titulo="Imagem do símbolo"
            props={props}
            aoEscolher={(h) => alterar(um("simboloHash", h))}
          />
          <div className="fl-campo-id fl-simbolo-nome">
            <CampoTexto
              testid="ficha-simbolo-nome"
              rotulo="Nome do símbolo"
              placeholder="Nome"
              valor={ficha.simboloNome ?? ""}
              maxLength={80}
              desabilitado={!editar}
              className="fl-in fl-ln"
              aoMudar={(t) => alterar(um("simboloNome", t === "" ? null : t))}
            />
            <span className="fl-lbl">Símbolo</span>
          </div>
        </div>
      </div>
    );
  },
  { ficha: ["aliados", "simboloHash", "simboloNome"] },
);

const OutrasCaracteristicas = secao(
  "Historia:outrasCaracteristicas",
  (props: PropsDaAba) => (
    <div className="fl-cx fl-fr fl-hist-caixa" data-testid="fh-outras-caracteristicas">
      <Secao className="fl-hist-titulo">Outras características</Secao>
      <ListaDeCaracteristicas
        campo="outrasCaracteristicas"
        testidBase="outra-caracteristica"
        ficha={props.ficha}
        alterar={props.alterar}
        editar={props.editar}
        enviar={props.enviar}
        personagemId={props.personagemId}
      />
    </div>
  ),
  { ficha: ["outrasCaracteristicas"] },
);

const Idiomas = secao(
  "Historia:idiomas",
  ({ ficha, alterar, editar }: PropsDaAba) => (
    <div className="fl-cx fl-fr fl-hist-caixa" data-testid="fh-idiomas">
      <Secao className="fl-hist-titulo">Idiomas e outras proficiências</Secao>
      <CampoTexto
        testid="ficha-idiomas"
        rotulo="Idiomas e outras proficiências"
        valor={ficha.outrasProficiencias ?? (ficha.idiomas ?? []).join(", ")}
        maxLength={4000}
        multilinha
        crescente
        desabilitado={!editar}
        className="fl-in fl-rule fl-h-100"
        aoMudar={(t) => alterar(um("outrasProficiencias", t === "" ? null : t))}
      />
    </div>
  ),
  { ficha: ["outrasProficiencias", "idiomas"] },
);

const Notas = secao(
  "Historia:notas",
  ({ ficha, alterar, editar }: PropsDaAba) =>
    ficha.notas !== undefined || editar ? (
      <div className="fl-cx fl-fr fl-hist-caixa" data-testid="fh-notas">
        <Secao className="fl-hist-titulo">Notas</Secao>
        <CampoTexto
          testid="ficha-notas"
          rotulo="Notas da ficha"
          valor={ficha.notas ?? ""}
          maxLength={50000}
          multilinha
          crescente
          desabilitado={!editar}
          className="fl-in fl-rule fl-h-100"
          aoMudar={(t) => alterar(um("notas", t === "" ? null : t))}
        />
      </div>
    ) : null,
  { ficha: ["notas"] },
);

/** Aba História: personalidade, aparência, aliados, símbolo, história e tesouro, em caixas com linhas de caderno. */
export function AbaHistoria(props: PropsDaAba) {
  return (
    <div className="fl-historia" data-testid="fh-aba-historia">
      <div className="fl-hist-grade">
        <Personalidade {...props} />
        <Ideais {...props} />
        <Vinculos {...props} />
        <Defeitos {...props} />
        <Aparencia {...props} />
        <AliadosESimbolo {...props} />
        <Historia {...props} />
        <Tesouro {...props} />
        <OutrasCaracteristicas {...props} />
        <Idiomas {...props} />
        <Notas {...props} />
      </div>
    </div>
  );
}
