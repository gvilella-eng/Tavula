import { FolderOpen, ShieldCheck } from "lucide-react";
import { useSyncExternalStore } from "react";
import { temSeletorDePasta } from "./assets/fonte";
import type { Fontes } from "./assets/fontes";
import type { GerenteDeAssets } from "./assets/gerente";

const semAssinatura = () => () => {};
const versaoZero = () => 0;

/** Q1: o que falta resolver com a pasta da mesa neste navegador (só o mestre). */
export type CasoDaPasta =
  /** O navegador pede permissão de novo para a pasta que já era da mesa. */
  | "reautorizar"
  /** Este navegador não tem a pasta (ou a perdeu) e há arquivos da mesa que ninguém online pode mandar. */
  | "escolher"
  /** Há pasta, mas ela não tem os arquivos que faltam: provavelmente é outra pasta. */
  | "trocar";

export const TEXTO_DO_CASO: Record<CasoDaPasta, string> = {
  reautorizar:
    "A pasta da mesa precisa de permissão de novo: o navegador pede isso depois de fechar. Sem ela, os arquivos que só estão na pasta não carregam.",
  escolher:
    "Os arquivos desta mesa ficam numa pasta do seu computador. Escolha a pasta da mesa neste navegador.",
  trocar:
    "Faltam arquivos desta mesa e a pasta escolhida neste navegador não os tem. Escolha a pasta certa da mesa.",
};

/**
 * Q1: o caso em que a pasta da mesa precisa de uma ação do mestre, ou `null`. `faltando` são os arquivos que a mesa usa, este
 * navegador não tem e ninguém online pode mandar. Quem não é mestre, ou o navegador sem seletor de pasta, nunca vê isso.
 */
export function casoDaPasta(
  euMestre: boolean,
  fontes: Fontes,
  gerente: GerenteDeAssets | null,
): CasoDaPasta | null {
  if (!euMestre || !(temSeletorDePasta() || fontes.memoria !== null)) return null;
  if (fontes.estado === "reautorizar") return "reautorizar";
  const faltando = gerente?.listarStatus().some((s) => s.estado === "indisponivel") ?? false;
  if (!faltando) return null;
  return fontes.estado === "autorizada" ? "trocar" : "escolher";
}

/** O botão do caso: reautoriza ou escolhe a pasta (precisa do clique, o navegador exige gesto). */
export function BotaoDaPasta({
  caso,
  fontes,
  testid,
}: {
  caso: CasoDaPasta;
  fontes: Fontes;
  testid: string;
}) {
  const reautorizar = caso === "reautorizar";
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={() =>
        void (
          reautorizar ? fontes.reautorizar().then(() => undefined) : fontes.escolherPasta()
        ).catch(() => {})
      }
    >
      {reautorizar ? (
        <>
          <ShieldCheck size={14} aria-hidden="true" /> Reautorizar a pasta da mesa
        </>
      ) : (
        <>
          <FolderOpen size={14} aria-hidden="true" />{" "}
          {caso === "trocar" ? "Trocar a pasta da mesa" : "Escolher a pasta da mesa"}
        </>
      )}
    </button>
  );
}

/** Quem acompanha o caso da pasta: reavalia quando a pasta ou os arquivos mudam. */
export function useCasoDaPasta(
  euMestre: boolean,
  fontes: Fontes,
  gerente: GerenteDeAssets | null,
): CasoDaPasta | null {
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  useSyncExternalStore(gerente?.assinar ?? semAssinatura, gerente?.versaoAtual ?? versaoZero);
  return casoDaPasta(euMestre, fontes, gerente);
}

/**
 * O aviso na mesa (não só em Preferências): o mestre vê, com um clique, o que fazer com a pasta da mesa. Some sozinho quando
 * a pasta está liberada e os arquivos chegaram.
 */
export function AvisoDaPasta({
  euMestre,
  fontes,
  gerente,
}: {
  euMestre: boolean;
  fontes: Fontes;
  gerente: GerenteDeAssets | null;
}) {
  const caso = useCasoDaPasta(euMestre, fontes, gerente);
  if (!caso) return null;
  return (
    <div className="aviso-pasta" role="alert" data-testid="aviso-pasta" data-caso={caso}>
      <span>{TEXTO_DO_CASO[caso]}</span>
      <BotaoDaPasta caso={caso} fontes={fontes} testid="aviso-pasta-acao" />
    </div>
  );
}
