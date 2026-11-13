import type { Estado } from "@tabletop/shared";
import cincoEPadrao from "../../../fixtures/campanhas/5e-padrao.json?raw";
import chamaPrimordial from "../../../fixtures/campanhas/chama-primordial.json?raw";

// As campanhas prontas (7b-3): os mesmos arquivos de `fixtures/campanhas/`, empacotados no build. Nada vem da internet.
// Carregam pelo mesmo caminho da importação de campanha (Mesa → Campanha → "Importar e substituir").

export type CampanhaDeExemplo = {
  id: string;
  nome: string;
  descricao: string;
  /** O texto do arquivo (JSON). */
  texto: string;
};

export const CAMPANHAS_DE_EXEMPLO: readonly CampanhaDeExemplo[] = [
  {
    id: "5e-padrao",
    nome: "5e padrão",
    descricao: "Uma mesa limpa, sem automação, só com a tocha, a lanterna e a fogueira.",
    texto: cincoEPadrao,
  },
  {
    id: "chama-primordial",
    nome: "A Chama Primordial",
    descricao:
      "Tochas de 30 minutos e a respiração do Pulmão: a inspiração encolhe e apaga chamas, a expiração fecha a visão. Com zonas de ar ruim.",
    texto: chamaPrimordial,
  },
];

/**
 * O arquivo de exemplo pronto para esta mesa: os usuários e as permissões são os da mesa de agora (o arquivo traz os da
 * semente), senão quem importa não seria mestre na campanha nova e a sala recusaria. Devolve `null` se o texto não é
 * JSON (não acontece com os arquivos empacotados).
 */
export function exemploParaEstaMesa(
  texto: string,
  estado: Pick<Estado, "usuarios" | "permissoes">,
): unknown {
  try {
    const arquivo = JSON.parse(texto) as { dados: Record<string, unknown> };
    return {
      ...arquivo,
      dados: { ...arquivo.dados, usuarios: estado.usuarios, permissoes: estado.permissoes },
    };
  } catch {
    return null;
  }
}
