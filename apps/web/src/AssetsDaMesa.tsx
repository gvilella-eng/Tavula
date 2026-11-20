import {
  type Estado,
  type LinhaDeAsset,
  listarAssetsDaMesa,
  lugaresDe,
  pode,
  type Usuario,
} from "@tabletop/shared";
import { memo, useCallback, useEffect, useState } from "react";
import type { GerenteDeAssets } from "./assets/gerente";
import { SecaoDosAssets } from "./SecaoDosAssets";
import type { Aviso } from "./useSala";

/** As chaves do estado de que a lista de assets precisa (o uso de cada arquivo depende de quase tudo da mesa). */
export const FATIA_DOS_ASSETS = [
  "usuarios",
  "assets",
  "cenas",
  "cenaAtivaId",
  "tokens",
  "personagens",
  "pastas",
  "handouts",
  "permissoes",
  "mesaDeSom",
  "zonas",
  "automacoes",
  "musica",
  "modelos",
  "trilha",
  "compendio",
  "retratosDoChat",
] as const;
export type EstadoDosAssets = Pick<Estado, (typeof FATIA_DOS_ASSETS)[number]>;

export type PropsDosAssetsDaMesa = {
  estado: EstadoDosAssets;
  eu: Usuario;
  enviar: (tipo: string, dados: object) => string | null;
  avisar: (texto: string, acao?: Aviso["acao"]) => void;
  gerente: GerenteDeAssets | null;
  /** Pôr o arquivo na cena, no centro da tela (a Mesa sabe onde é). */
  aoPorNaCena: (hash: string) => void;
  /** Só o jogador: a lista que a sala montou para ele (resposta de `assets.listar`), ou `null` enquanto não veio. */
  linhasDoJogador: readonly LinhaDeAsset[] | null;
};

/**
 * AS1: os "Assets da mesa". O mestre vê a lista calculada aqui mesmo (ao vivo, com a regra de sempre); o jogador recebe da
 * sala a lista dele (a sala aplica a regra de visão, então nada que ele não vê chega ao navegador dele).
 */
function AssetsDaMesaBase({
  estado,
  eu,
  enviar,
  avisar,
  gerente,
  aoPorNaCena,
  linhasDoJogador,
}: PropsDosAssetsDaMesa) {
  const euMestre = eu.papel === "mestre";
  const [linhasDoMestre, setLinhasDoMestre] = useState<LinhaDeAsset[]>([]);
  // A lista do mestre acompanha a mesa, mas sem refazer a conta a cada passo de token (espera um instante).
  useEffect(() => {
    if (!euMestre) return;
    const espera = setTimeout(() => {
      setLinhasDoMestre(listarAssetsDaMesa(estado as unknown as Estado, eu));
    }, 250);
    return () => clearTimeout(espera);
  }, [estado, eu, euMestre]);

  const pedirLista = useCallback(() => {
    enviar("assets.listar", {});
  }, [enviar]);

  const lugares = lugaresDe(estado.mesaDeSom).ambientes;
  const livre = lugares.indexOf(null);
  const podeColocar = euMestre || pode(eu, "imagem.colocar", estado.permissoes);
  const linhas = euMestre ? linhasDoMestre : (linhasDoJogador ?? []);

  return (
    <SecaoDosAssets
      linhas={linhas}
      metasDaMesa={euMestre ? estado.assets : undefined}
      euMestre={euMestre}
      euId={eu.id}
      gerente={gerente}
      enviar={enviar}
      avisar={avisar}
      podeColocar={podeColocar}
      aoPorNaCena={aoPorNaCena}
      proximoLugarDeSom={livre >= 0 ? livre : null}
      aoPrecisarDaLista={euMestre ? undefined : pedirLista}
    />
  );
}

export const AssetsDaMesa = memo(AssetsDaMesaBase);
