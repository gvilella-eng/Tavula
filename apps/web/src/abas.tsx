import type { Papel } from "@tabletop/shared";
import {
  Boxes,
  FolderOpen,
  Map as IconeDoMapa,
  Keyboard,
  KeyRound,
  LifeBuoy,
  Lock,
  Palette,
  ShieldCheck,
  User,
  Volume2,
} from "lucide-react";
import { memo, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AssetsDaMesa, type PropsDosAssetsDaMesa } from "./AssetsDaMesa";
import { type ArquivoDaFonte, temSeletorDePasta } from "./assets/fonte";
import type { Fontes } from "./assets/fontes";
import type { GerenteDeAssets, StatusDeAsset } from "./assets/gerente";
import { IDS_DOS_ATALHOS } from "./atalhos";
import { ConectarOClaude } from "./claude/ConectarOClaude";
import { haQuanto } from "./claude/textosDoClaude";
import { TrocarSenha } from "./contas/TrocarSenha";
import { definirDicasLigadas, useDicasLigadas } from "./dicasLigadas";
import { ListaDeAtalhos } from "./ListaDeAtalhos";
import { SeletorDoEstilo } from "./rolagem/SeletorDoEstilo";
import { MarcaSoNesteNavegador, SecaoDePreferencias } from "./SecaoDePreferencias";
import { SeletorDeTema } from "./SeletorDeTema";
import { CartaoDeSom } from "./som/CartaoDeSom";
import { resumoDoSom, usePrefsDeSom } from "./som/prefsDeSom";
import { lerTema, NOMES_DOS_TEMAS } from "./tema/temas";
import { definirUnidade, useUnidade } from "./unidade";
import { useMinuto } from "./useMinuto";

const ROTULO_DO_ESTADO: Record<StatusDeAsset["estado"], string> = {
  pedindo: "pedindo",
  baixando: "recebendo",
  pronto: "pronto",
  indisponivel: "indisponível (ninguém com o arquivo está online)",
  erro: "erro",
};

type PropsPreferencias = {
  nome: string;
  papel: Papel;
  encaixe: boolean;
  aoMudarEncaixe: (v: boolean) => void;
  aoSair: () => void;
  aoTrocarDeMesa: () => void;
  /** Abre o tour de introdução de novo. */
  aoFazerOTour: () => void;
  /** C2: a mesa e o login da conta (a troca de senha precisa dos dois; sem login, não há conta). */
  mesaId: string;
  login?: string | undefined;
  fontes: Fontes;
  gerente: GerenteDeAssets | null;
  /** P1: o Claude desta pessoa está conectado agora (a presença do 12-1). */
  claudeConectado: boolean;
  /** N5: o navegador está bloqueando o som até alguém clicar (o cartão Som mostra o botão para ativar). */
  somBloqueado: boolean;
  aoAtivarSom: () => void;
  /** AS1: os arquivos da mesa que o jogador vê (estável entre renders; o mestre usa a seção da aba Mesa). */
  assets?: PropsDosAssetsDaMesa | undefined;
};

/** A pasta local de imagens: escolher, reautorizar e ver o que há nela. */
function PastaLocal({ fontes }: { fontes: Fontes }) {
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  const [arquivos, setArquivos] = useState<ArquivoDaFonte[]>([]);
  const versao = fontes.versaoAtual();
  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega quando as fontes mudam
  useEffect(() => {
    let cancelado = false;
    fontes
      .listar()
      .then((l) => !cancelado && setArquivos(l))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [fontes, versao]);
  return (
    <>
      <div className="pref-sub-titulo">
        <h4>Pasta local de imagens</h4>
        <MarcaSoNesteNavegador />
      </div>
      <p className="nota">
        As imagens ficam no seu computador. A mesa só recebe o que você usa (retrato, token, mapa) e
        o servidor não guarda nada.
      </p>
      <div className="linha-botoes">
        {temSeletorDePasta() && (
          <button
            type="button"
            data-testid="biblioteca-pasta"
            onClick={() => void fontes.escolherPasta().catch(() => {})}
          >
            <FolderOpen size={16} /> {fontes.nomeDaPasta ? "Trocar pasta" : "Escolher pasta"}
          </button>
        )}
      </div>
      {fontes.nomeDaPasta ? (
        <p className="nota" data-testid="biblioteca-pasta-estado">
          Pasta: <strong>{fontes.nomeDaPasta}</strong> · {arquivos.length}{" "}
          {arquivos.length === 1 ? "imagem" : "imagens"}
          {fontes.estado === "reautorizar" && (
            <>
              {" "}
              (o navegador pede permissão de novo){" "}
              <button
                type="button"
                data-testid="biblioteca-reautorizar"
                onClick={() => void fontes.reautorizar().then(() => undefined)}
              >
                <ShieldCheck size={14} /> Reautorizar
              </button>
            </>
          )}
          {fontes.estado === "negada" && " (permissão negada)"}
        </p>
      ) : (
        <p className="nota" data-testid="biblioteca-pasta-estado">
          Nenhuma pasta escolhida.
        </p>
      )}
      {arquivos.length > 0 && (
        <ul className="lista-simples nomes-de-arquivos" data-testid="biblioteca-lista">
          {arquivos.slice(0, 8).map((a) => (
            <li key={a.id}>{a.nome}</li>
          ))}
          {arquivos.length > 8 && <li className="nota">e mais {arquivos.length - 8}…</li>}
        </ul>
      )}
    </>
  );
}

/** O que está chegando e quantos arquivos o cache deste navegador já tem. */
function Transferencias({ gerente }: { gerente: GerenteDeAssets }) {
  useSyncExternalStore(gerente.assinar, gerente.versaoAtual);
  const emAndamento = gerente.listarStatus().filter((s) => s.estado !== "pronto");
  // Conta o cache (o que está no disco deste navegador), não só o que veio por transferência.
  const prontos = gerente.inventario().length;
  return (
    <>
      <h4>Transferências</h4>
      <ul className="lista-simples transferencias" data-testid="transferencias">
        {emAndamento.map((s) => (
          <li key={s.hash} data-testid="transferencia" data-hash={s.hash} data-estado={s.estado}>
            <span className="nome" title={s.nome}>
              {s.nome}
            </span>
            <span className="estado-presenca">{ROTULO_DO_ESTADO[s.estado]}</span>
            {s.total > 0 && <progress value={s.recebidos} max={s.total} />}
          </li>
        ))}
        {emAndamento.length === 0 && <li className="nota">Nenhuma transferência em andamento.</li>}
      </ul>
      <p className="nota" data-testid="transferencias-prontas">
        {prontos} {prontos === 1 ? "arquivo pronto" : "arquivos prontos"} neste navegador.
      </p>
    </>
  );
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function assinarNada(): () => void {
  return () => {};
}
function zero(): number {
  return 0;
}

/**
 * Aba Preferências (todos): o que é de cada pessoa. Oito seções recolhíveis, cada uma com o resumo do estado (P1): Conta,
 * Aparência, Som (N5), No mapa, Ajuda e arquivos, Conectar o Claude, Segurança (só com login) e Atalhos do teclado. O que vale para a
 * sala (regras, modelos de luz, papéis) está na aba Mesa, só do mestre.
 */
function AbaPreferenciasBase({
  nome,
  papel,
  encaixe,
  aoMudarEncaixe,
  aoSair,
  aoTrocarDeMesa,
  aoFazerOTour,
  mesaId,
  login,
  fontes,
  gerente,
  claudeConectado,
  somBloqueado,
  aoAtivarSom,
  assets,
}: PropsPreferencias) {
  const dicas = useDicasLigadas();
  const prefsDeSom = usePrefsDeSom();
  const unidade = useUnidade();
  const [tema, setTema] = useState(() => lerTema());
  const [tokens, setTokens] = useState<number | null>(null);
  const [ultimoUsoDoClaude, setUltimoUsoDoClaude] = useState<number | null>(null);
  const contarTokens = useCallback((n: number, uso: number | null) => {
    setTokens(n);
    setUltimoUsoDoClaude(uso);
  }, []);
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  useSyncExternalStore(
    gerente ? gerente.assinar : assinarNada,
    gerente ? gerente.versaoAtual : zero,
  );
  // "usado há 5 min" (aqui e na seção do Claude) envelhece sozinho: a aba não re-renderiza mais a cada evento da sala.
  useMinuto(ultimoUsoDoClaude !== null && !claudeConectado);
  const emAndamento = gerente
    ? gerente.listarStatus().filter((s) => s.estado !== "pronto").length
    : 0;

  const resumoDoMapa = [
    unidade === "m" ? "Metros" : "Pés",
    encaixe ? "encaixe ligado" : "encaixe desligado",
    dicas ? "dicas ligadas" : "dicas desligadas",
  ].join(" · ");
  const resumoDaAjuda =
    (fontes.nomeDaPasta ? `Pasta ${fontes.nomeDaPasta}` : "Nenhuma pasta escolhida") +
    (emAndamento > 0 ? ` · ${plural(emAndamento, "transferência", "transferências")}` : "");
  const resumoDoClaude =
    tokens === null
      ? "Carregando…"
      : (tokens === 0 ? "Nenhum token" : plural(tokens, "token", "tokens")) +
        (claudeConectado
          ? " · conectado agora"
          : ultimoUsoDoClaude !== null
            ? ` · usado ${haQuanto(ultimoUsoDoClaude)}`
            : "");

  return (
    <div className="pref-lista" data-testid="preferencias">
      <SecaoDePreferencias
        id="conta"
        titulo="Conta"
        icone={<User size={16} />}
        resumo={`${nome} (${papel})`}
      >
        <p>
          Você é <strong>{nome}</strong> ({papel}).
        </p>
        <div className="linha-botoes">
          <button type="button" data-testid="trocar-usuario" onClick={aoSair}>
            {login ? "Sair" : "Trocar usuário"}
          </button>
          <button type="button" data-testid="trocar-de-mesa" onClick={aoTrocarDeMesa}>
            Trocar de mesa
          </button>
        </div>
      </SecaoDePreferencias>
      <SecaoDePreferencias
        id="aparencia"
        titulo="Aparência"
        icone={<Palette size={16} />}
        resumo={NOMES_DOS_TEMAS[tema]}
      >
        <div className="pref-marca-linha">
          <MarcaSoNesteNavegador />
        </div>
        <SeletorDeTema aoEscolher={setTema} />
        <SeletorDoEstilo />
      </SecaoDePreferencias>
      <SecaoDePreferencias
        id="som"
        titulo="Som"
        icone={<Volume2 size={16} />}
        resumo={resumoDoSom(prefsDeSom)}
      >
        <div className="pref-marca-linha">
          <MarcaSoNesteNavegador />
        </div>
        <CartaoDeSom bloqueado={somBloqueado} aoAtivar={aoAtivarSom} />
      </SecaoDePreferencias>
      <SecaoDePreferencias
        id="mapa"
        titulo="No mapa"
        icone={<IconeDoMapa size={16} />}
        resumo={resumoDoMapa}
      >
        <div className="pref-marca-linha">
          <MarcaSoNesteNavegador />
        </div>
        <fieldset className="quem-controla" data-testid="pref-unidade">
          <legend>Unidade de distância</legend>
          <div className="chips">
            {(["m", "pes"] as const).map((u) => (
              <button
                key={u}
                type="button"
                className="chip"
                data-testid={`pref-unidade-${u}`}
                aria-pressed={unidade === u}
                onClick={() => definirUnidade(u)}
              >
                {u === "m" ? "Metros" : "Pés"}
              </button>
            ))}
          </div>
          <p className="nota">
            Vale para a régua, as luzes e o quadrado da cena. A mesa guarda tudo em metros (1,5 m =
            5 pés).
          </p>
        </fieldset>
        <label className="linha-opcao">
          <input
            type="checkbox"
            data-testid="pref-encaixe"
            checked={encaixe}
            onChange={(e) => aoMudarEncaixe(e.target.checked)}
          />
          Encaixar tokens no grid (segure Alt ao arrastar para soltar sem encaixe)
        </label>
        <label className="linha-opcao">
          <input
            type="checkbox"
            data-testid="pref-dicas"
            checked={dicas}
            onChange={(e) => definirDicasLigadas(e.target.checked)}
          />
          Dicas ao passar o mouse (o nome e o atalho dos botões só de ícone)
        </label>
      </SecaoDePreferencias>
      {assets && papel !== "mestre" && (
        <SecaoDePreferencias
          id="assets"
          titulo="Arquivos da mesa"
          icone={<Boxes size={16} />}
          resumo="O que você vê e o que enviou"
        >
          <AssetsDaMesa {...assets} />
        </SecaoDePreferencias>
      )}
      <SecaoDePreferencias
        id="ajuda"
        titulo="Ajuda e arquivos"
        icone={<LifeBuoy size={16} />}
        resumo={resumoDaAjuda}
        destaque={emAndamento > 0}
      >
        <div className="linha-botoes">
          <button type="button" data-testid="tour-refazer" onClick={aoFazerOTour}>
            Fazer o tour de novo
          </button>
        </div>
        <div className="pref-sub">
          <PastaLocal fontes={fontes} />
        </div>
        {gerente && (
          <div className="pref-sub">
            <Transferencias gerente={gerente} />
          </div>
        )}
      </SecaoDePreferencias>
      <SecaoDePreferencias
        id="claude"
        titulo="Conectar o Claude"
        icone={<KeyRound size={16} />}
        resumo={resumoDoClaude}
      >
        <ConectarOClaude
          mesaId={mesaId}
          aoContarTokens={contarTokens}
          conectado={claudeConectado}
        />
      </SecaoDePreferencias>
      {login && (
        <SecaoDePreferencias
          id="seguranca"
          titulo="Segurança"
          icone={<Lock size={16} />}
          resumo="Trocar a senha"
        >
          <TrocarSenha mesaId={mesaId} login={login} />
        </SecaoDePreferencias>
      )}
      <SecaoDePreferencias
        id="atalhos"
        titulo="Atalhos do teclado"
        icone={<Keyboard size={16} />}
        resumo={plural(IDS_DOS_ATALHOS.length, "atalho", "atalhos")}
      >
        <ListaDeAtalhos />
      </SecaoDePreferencias>
    </div>
  );
}

// `memo`: não recebe o estado da sala, só props estáveis na Mesa; evento da sala não a re-renderiza.
export const AbaPreferencias = memo(AbaPreferenciasBase);
