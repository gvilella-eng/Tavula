import type { AssetMeta } from "./assets.ts";
import {
  type AlvoDoEnvio,
  type OpcoesDoEnvio,
  ROTULO_DO_USO,
  type UsoDeEnvio,
  usoDoArquivo,
} from "./envios.ts";
import type { Estado, Usuario } from "./estado.ts";
import { processar } from "./nucleo.ts";
import { IntencaoSchema, VERSAO_PROTOCOLO } from "./protocolo.ts";

// M1: a checagem de permissão do envio, antes de dar o link. Fica à parte de `envios.ts` porque usa `processar` (que usa o protocolo,
// e o protocolo usa os esquemas de `envios.ts`).

const HASH_DE_PROVA = "f".repeat(64);

/**
 * Antes de dar o link: a pessoa pode pôr este uso neste alvo? Roda as regras de verdade (`processar`) sobre uma cópia do
 * estado com um arquivo de mentira já registrado, então a resposta é a que a mesa daria ao aplicar de fato. `null` se pode.
 */
export function negarEnvio(
  estado: Estado,
  usuario: Usuario,
  uso: UsoDeEnvio,
  alvo: AlvoDoEnvio,
  opcoes: OpcoesDoEnvio,
): string | null {
  if (
    usuario.papel !== "mestre" &&
    (uso === "mapa" || uso === "mapa-uvtt" || uso === "som" || uso === "compendio")
  ) {
    return `Só o mestre põe ${ROTULO_DO_USO[uso]}.`;
  }
  const falso: AssetMeta = {
    hash: HASH_DE_PROVA,
    tipo:
      uso === "mapa" || uso === "mapa-uvtt"
        ? "mapa"
        : uso === "som"
          ? "som"
          : uso === "compendio"
            ? "compendio"
            : "retrato",
    mime: "image/webp",
    bytes: 1,
    largura: 1000,
    altura: 1000,
    donoId: usuario.id,
    nomeOriginal: "prova",
    pedacos: [],
  };
  const aplicar = usoDoArquivo(uso, alvo, HASH_DE_PROVA, falso, opcoes, { magias: 0 });
  if (!aplicar.ok) return aplicar.motivo;
  if (aplicar.tipo === null) return null;
  const lida = IntencaoSchema.safeParse({
    v: VERSAO_PROTOCOLO,
    id: "prova-de-envio",
    tipo: aplicar.tipo,
    dados: aplicar.dados,
  });
  if (!lida.success) return "Os dados do pedido não servem para este uso.";
  const r = processar(
    { ...estado, assets: [...(estado.assets ?? []), falso] },
    usuario.id,
    lida.data,
    new Date(0).toISOString(),
    undefined,
    [],
    { claude: true },
  );
  return r.ok ? null : r.erro.mensagem;
}
