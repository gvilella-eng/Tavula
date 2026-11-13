// O que o editor lê de um erro do zod (sem importar o zod aqui: o app não o tem como dependência).
type ZodIssue = { code: string; path: readonly PropertyKey[]; message: string };
type ZodError = { issues: readonly ZodIssue[] };

/**
 * Os erros de validação do zod em português, com o nome do campo e o que corrigir (7b-3). O zod fala inglês; o editor
 * das automações mostra estas frases no campo e na vista JSON. As mensagens que o próprio schema já escreveu em
 * português (nome de evento, "a fase precisa cair antes do fim do período") passam como estão.
 */

const ROTULO: Record<string, string> = {
  id: "Id",
  nome: "Nome",
  periodoS: "Período (segundos)",
  cenas: "Cenas",
  fases: "Fases",
  emS: "Em quantos segundos",
  evento: "Evento",
  duracaoS: "Duração (segundos)",
  liberadoParaJogadores: "Liberado aos jogadores",
  fixado: "Fixado na barra",
  cenaId: "Cena",
  ativa: "Ligada",
  fica: "Fica em",
  tipo: "Tipo",
  ao: "Evento da reação",
  se: "Condições",
  fazer: "Ações",
  condicao: "Condição",
  acao: "Ação",
  chance: "Chance",
  valor: "Valor",
  tag: "Tag",
  zona: "Zona",
  raioX: "Fator do raio",
  raioSomaM: "Soma ao raio",
  porS: "Por quantos segundos",
  penalidadeS: "Penalidade (segundos)",
  deltaS: "Ajuste do tempo (segundos)",
  alcanceM: "Alcance de visão",
  texto: "Texto",
  para: "Para quem",
  atrasoS: "Atraso (segundos)",
  alvo: "Alvo",
  modeloId: "Modelo",
  ids: "Tokens",
};

const NOME_DO_TIPO: Record<string, string> = {
  number: "um número",
  string: "um texto",
  boolean: "sim ou não",
  array: "uma lista",
  object: "um objeto",
  int: "um número inteiro",
};

const num = (n: unknown) => String(n).replace(".", ",");

/** O nome do campo a partir do caminho do erro ("fases.1.emS" vira "Fase 2: Em quantos segundos"). */
export function rotuloDoCaminho(caminho: readonly PropertyKey[]): string {
  const partes: string[] = [];
  for (let i = 0; i < caminho.length; i++) {
    const p = caminho[i];
    const proximo = caminho[i + 1];
    if (typeof p === "number") continue;
    const nome = ROTULO[String(p)] ?? String(p);
    if (typeof proximo === "number") {
      const singular =
        p === "fases"
          ? "Fase"
          : p === "fazer"
            ? "Ação"
            : p === "se"
              ? "Condição"
              : p === "cenas"
                ? "Cena"
                : nome;
      partes.push(`${singular} ${proximo + 1}`);
      i++; // consome o índice
    } else {
      partes.push(nome);
    }
  }
  return partes.join(": ");
}

function mensagemDe(issue: ZodIssue): string {
  const i = issue as ZodIssue & Record<string, unknown>;
  switch (issue.code) {
    case "invalid_type": {
      if (issue.message.includes("received undefined")) {
        return "preencha este campo.";
      }
      return `precisa ser ${NOME_DO_TIPO[String(i.expected)] ?? "outro tipo de valor"}.`;
    }
    case "too_small": {
      const origem = String(i.origin);
      if (origem === "number" || origem === "int") {
        return i.inclusive === false
          ? `precisa ser maior que ${num(i.minimum)}.`
          : `precisa ser pelo menos ${num(i.minimum)}.`;
      }
      if (origem === "string") {
        return Number(i.minimum) <= 1
          ? "não pode ficar vazio."
          : `precisa ter pelo menos ${num(i.minimum)} letras.`;
      }
      if (origem === "array") {
        return Number(i.minimum) <= 1
          ? "inclua pelo menos um item."
          : `inclua pelo menos ${num(i.minimum)} itens.`;
      }
      return "valor pequeno demais.";
    }
    case "too_big": {
      const origem = String(i.origin);
      if (origem === "number" || origem === "int")
        return `precisa ser no máximo ${num(i.maximum)}.`;
      if (origem === "string") return `precisa ter no máximo ${num(i.maximum)} letras.`;
      if (origem === "array") return `use no máximo ${num(i.maximum)} itens.`;
      return "valor grande demais.";
    }
    case "invalid_value": {
      const valores = (i.values as unknown[] | undefined) ?? [];
      return valores.length > 0
        ? `escolha um destes: ${valores.map(String).join(", ")}.`
        : "valor não aceito.";
    }
    case "invalid_union":
      return i.discriminator !== undefined
        ? `escolha um tipo válido (campo "${String(i.discriminator)}").`
        : "valor inválido.";
    case "unrecognized_keys":
      return "campo que não existe aqui.";
    default:
      // `custom` e os formatos (regex) trazem a frase já escrita em português pelo schema.
      return /[a-zç]/i.test(issue.message) ? issue.message : "valor inválido.";
  }
}

export type ErroDeCampo = {
  /** O caminho com pontos ("fases.1.emS"); vazio é o objeto inteiro. */
  caminho: string;
  /** "Fase 2: Em quantos segundos: precisa ser pelo menos 0." */
  texto: string;
  /** Só a frase, sem o nome do campo (para mostrar ao lado do campo). */
  mensagem: string;
};

/** Os erros de um `safeParse` em português, um por campo e frase. */
export function errosEmPortugues(erro: ZodError): ErroDeCampo[] {
  const saida: ErroDeCampo[] = [];
  const visto = new Set<string>();
  for (const issue of erro.issues) {
    const mensagem = mensagemDe(issue);
    const rotulo = rotuloDoCaminho(issue.path);
    const caminho = issue.path.join(".");
    const texto = rotulo === "" ? mensagem : `${rotulo}: ${mensagem}`;
    const chave = `${caminho}|${mensagem}`;
    if (visto.has(chave)) continue;
    visto.add(chave);
    saida.push({ caminho, texto, mensagem });
  }
  return saida;
}

/** O primeiro erro de exatamente este caminho (para o campo), ou `undefined`. */
export function erroDoCampo(erros: readonly ErroDeCampo[], caminho: string): string | undefined {
  return erros.find((e) => e.caminho === caminho)?.mensagem;
}

/** O erro de escrita do JSON (onde, se o navegador diz) em português, sem a frase em inglês dele. */
export function erroDeSintaxeDoJson(texto: string, erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : "";
  const dica = "Confira as vírgulas, as aspas e as chaves.";
  const posicao = /position (\d+)/.exec(mensagem);
  if (posicao) {
    const pos = Number(posicao[1]);
    const antes = texto.slice(0, pos);
    const linha = antes.split("\n").length;
    const coluna = pos - antes.lastIndexOf("\n");
    return `O JSON tem um erro de escrita na linha ${linha}, coluna ${coluna}. ${dica}`;
  }
  if (/end of JSON input/i.test(mensagem)) {
    return `O JSON parece incompleto: falta fechar alguma chave, colchete ou aspas. ${dica}`;
  }
  const token = /Unexpected token '(.+?)'/.exec(mensagem);
  if (token) return `O JSON tem um erro de escrita perto de "${token[1]}". ${dica}`;
  return `O JSON tem um erro de escrita. ${dica}`;
}
