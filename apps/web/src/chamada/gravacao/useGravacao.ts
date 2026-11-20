import { type Estado, gravacaoLigada, quemFicouDeFora, type Usuario } from "@tabletop/shared";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { type EstadoDaPasta, Fontes } from "../../assets/fontes";
import { instalarGanchoDaPasta } from "../../assets/ganchoE2E";
import type { Ocorrencia } from "../../useSala";
import type { ControleDaChamada } from "../controlador";
import { CapturaDeVoz } from "./captura";
import type { OpcoesDoDetector } from "./detectorDeFala";
import { nomesDaMesa, ObservadorDaMesa, personagemDaPessoa } from "./eventos";
import { type EstadoDoGravador, GravadorDaSessao, type PessoaNaGravacao } from "./gravador";

// CH3: a gravação da sessão na janela da chamada. Liga o gravador (que escuta cada voz e escreve na pasta da mesa) ao que a
// chamada sabe: quem está nela, o áudio de cada um, quem ficou de fora e o que a mesa registra. Só o mestre grava; todos
// recebem o aviso pela sala (`chamada.quem`).

const PARADO: EstadoDoGravador = {
  fase: "parada",
  pasta: null,
  trechos: 0,
  erro: null,
  inicioMs: null,
};

export type GravacaoDaTela = {
  /** Alguém (o mestre) está gravando: o aviso aparece para todos. */
  ligada: boolean;
  /** Eu sou o mestre e esta janela é quem grava. */
  euGravo: boolean;
  souMestre: boolean;
  /** Os ids de quem ficou de fora da gravação. */
  foraDe: string[];
  naoGravar: boolean;
  definirNaoGravar: (fora: boolean) => void;
  gravador: EstadoDoGravador;
  /** A pasta da mesa: sem ela autorizada, não dá para gravar. */
  pasta: { estado: EstadoDaPasta; nome: string | null; podeEscolher: boolean };
  confirmando: boolean;
  abrirConfirmacao: () => void;
  fecharConfirmacao: () => void;
  escolherPasta: () => Promise<void>;
  autorizarPasta: () => Promise<boolean>;
  comecar: () => Promise<void>;
  parar: () => Promise<void>;
  /** A pasta da última gravação que esta janela fez (para a dica de como transcrever). */
  ultima: string | null;
  /** Por que não deu para começar (o navegador não gravou áudio, por exemplo). */
  falha: string | null;
};

type Opcoes = {
  mesaId: string;
  mesaNome: string;
  legada: boolean;
  controle: ControleDaChamada | null;
  estadoSala: Estado | null;
  eu: Usuario | null;
  ouvir: (fn: (o: Ocorrencia) => void) => () => void;
};

const SEM_ASSINAR = () => () => {};
const ZERO = () => 0;

/** Só no modo e2e: ajustes do detector (o áudio falso do Chromium é uma sequência de bipes curtos). */
function opcoesDoTeste(): Partial<OpcoesDoDetector> | undefined {
  if (import.meta.env.MODE !== "e2e") return undefined;
  return (window as unknown as { __tabletopE2E?: { gravacao?: Partial<OpcoesDoDetector> } })
    .__tabletopE2E?.gravacao;
}

export function useGravacao(o: Opcoes): GravacaoDaTela {
  const { controle, estadoSala, eu } = o;
  const fontes = useMemo(() => new Fontes(o.mesaId, o.legada), [o.mesaId, o.legada]);
  useEffect(() => {
    void fontes.iniciar();
    return instalarGanchoDaPasta(fontes);
  }, [fontes]);
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  const c = useSyncExternalStore(
    controle ? controle.assinar : SEM_ASSINAR,
    controle ? controle.lerEstado : (ZERO as unknown as () => never),
  );

  const gravadorRef = useRef<GravadorDaSessao | null>(null);
  const capturaRef = useRef<CapturaDeVoz | null>(null);
  const observadorRef = useRef<ObservadorDaMesa | null>(null);
  const estadoSalaRef = useRef(estadoSala);
  estadoSalaRef.current = estadoSala;
  const [gravador, setGravador] = useState<EstadoDoGravador>(PARADO);
  const [confirmando, setConfirmando] = useState(false);
  const [ultima, setUltima] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const participantes = controle ? c.participantes : [];
  const ligada = gravacaoLigada(participantes);
  const foraDe = quemFicouDeFora(participantes);
  const souMestre = eu?.papel === "mestre";
  const euGravo = gravador.fase === "gravando";

  const parar = useCallback(async () => {
    const g = gravadorRef.current;
    if (!g?.gravando) return;
    controle?.ligarGravacao(false);
    await g.parar();
    capturaRef.current?.fechar();
    capturaRef.current = null;
    observadorRef.current = null;
    setUltima(g.estado.pasta);
  }, [controle]);

  const comecar = useCallback(async () => {
    if (!controle || !souMestre || gravadorRef.current?.gravando) return;
    const pasta = fontes.pastaDosArquivos();
    if (!pasta) {
      setFalha("Escolha (ou autorize) a pasta da mesa antes de gravar.");
      return;
    }
    setFalha(null);
    const captura = new CapturaDeVoz();
    if (!(await captura.iniciar())) {
      captura.fechar();
      setFalha("Este navegador não deixou gravar o áudio da chamada.");
      return;
    }
    const gravadorNovo = new GravadorDaSessao({
      pasta,
      captura,
      mesaNome: o.mesaNome,
      ...(opcoesDoTeste() ? { opcoesDoDetector: opcoesDoTeste() ?? {} } : {}),
    });
    gravadorRef.current = gravadorNovo;
    capturaRef.current = captura;
    observadorRef.current = new ObservadorDaMesa(() => estadoSalaRef.current);
    gravadorNovo.assinar(() => setGravador(gravadorNovo.estado));
    const e = estadoSalaRef.current;
    await gravadorNovo.iniciar(e ? nomesDaMesa(e) : "");
    setGravador(gravadorNovo.estado);
    setUltima(null);
    setConfirmando(false);
    controle.ligarGravacao(true);
  }, [controle, souMestre, fontes, o.mesaNome]);

  // O que a mesa registra enquanto grava (chat, rolagens, troca de cena, combate).
  useEffect(() => {
    return o.ouvir((oc) => {
      if (oc.tipo !== "evento") return;
      const obs = observadorRef.current;
      const g = gravadorRef.current;
      if (!obs || !g?.gravando) return;
      for (const linha of obs.observar(oc.evento)) g.registrarEvento(linha);
    });
  }, [o.ouvir]);

  // Quem está na chamada e o áudio de cada um: o gravador liga, troca ou solta a escuta de cada voz.
  useEffect(() => {
    const g = gravadorRef.current;
    if (!g?.gravando || !controle || !estadoSala || !eu) return;
    const { meu, outros } = controle.fluxosDeVoz();
    const pessoas: PessoaNaGravacao[] = c.participantes.map((p) => {
      const u = estadoSala.usuarios.find((x) => x.id === p.usuarioId);
      const euSou = p.usuarioId === eu.id;
      const personagem = personagemDaPessoa(estadoSala, p.usuarioId);
      return {
        usuarioId: p.usuarioId,
        nome: u?.nome ?? p.usuarioId,
        ...(personagem ? { personagem } : {}),
        fluxo: euSou ? meu : (outros[p.usuarioId] ?? null),
        naoGravar: euSou ? c.naoGravar || p.naoGravar : p.naoGravar,
      };
    });
    g.sincronizar(pessoas);
  });

  // Se a sala me tirou e me pôs de volta (o socket caiu), a marca "gravando" se perdeu: eu a ponho de novo.
  const meuRegistro = participantes.find((p) => p.usuarioId === eu?.id);
  useEffect(() => {
    if (euGravo && meuRegistro && !meuRegistro.gravando) controle?.ligarGravacao(true);
  }, [euGravo, meuRegistro, controle]);

  // Saiu da chamada (ou foi substituído por outra janela): a gravação para e o que já foi gravado fica salvo.
  const dentro = controle ? c.fase === "dentro" : false;
  useEffect(() => {
    if (!dentro && euGravo) void parar();
  }, [dentro, euGravo, parar]);

  // Fechar a janela ou recarregar a página também para a gravação (o que já foi escrito fica salvo).
  useEffect(() => {
    const aoSair = () => {
      const g = gravadorRef.current;
      if (g?.gravando) void g.parar();
    };
    window.addEventListener("pagehide", aoSair);
    return () => {
      window.removeEventListener("pagehide", aoSair);
      aoSair();
    };
  }, []);

  return {
    ligada,
    euGravo,
    souMestre,
    foraDe,
    naoGravar: controle ? c.naoGravar : false,
    definirNaoGravar: (fora) => controle?.definirNaoGravar(fora),
    gravador,
    pasta: {
      estado: fontes.estado,
      nome: fontes.nomeDaPasta,
      podeEscolher: true,
    },
    confirmando,
    abrirConfirmacao: () => {
      setFalha(null);
      setConfirmando(true);
    },
    fecharConfirmacao: () => setConfirmando(false),
    escolherPasta: async () => {
      try {
        await fontes.escolherPasta();
      } catch (e) {
        setFalha(
          (e as Error).name === "AbortError"
            ? null
            : "Não consegui abrir o seletor de pasta neste navegador.",
        );
      }
    },
    autorizarPasta: () => fontes.reautorizar(),
    comecar,
    parar,
    ultima,
    falha,
  };
}
