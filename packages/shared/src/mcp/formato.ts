import {
  ATRIBUTOS,
  type Ataque,
  bonusDeAcerto,
  type Cena,
  derivar,
  expressaoDeDano,
  type Ficha,
  formatarBonus,
  type Mensagem,
  ROTULO_DO_ATRIBUTO,
  SIGLA_DO_ATRIBUTO,
  type Visibilidade,
} from "../index.ts";

/** Um número sem ruído de ponto flutuante: 12.500000001 -> 12.5. */
export function num(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

export function emCelulas(cena: Pick<Cena, "larguraM" | "alturaM" | "grid">): {
  largura: number;
  altura: number;
} {
  return {
    largura: Math.round((cena.larguraM / cena.grid.quadradoM) * 100) / 100,
    altura: Math.round((cena.alturaM / cena.grid.quadradoM) * 100) / 100,
  };
}

/** "todos", "só o mestre" ou os nomes de quem vê. */
export function textoDaVisibilidade(v: Visibilidade, nomeDe: (id: string) => string): string {
  if (v.tipo === "todos") return "todos";
  if (v.tipo === "mestre") return "só o mestre";
  return v.ids.length === 0 ? "só o mestre" : v.ids.map(nomeDe).join(", ");
}

function acertoDoAtaque(f: Ficha, a: Ataque): string {
  const b = bonusDeAcerto(f, a);
  return b === undefined ? "" : `${formatarBonus(b)} para acertar`;
}

/** Uma linha com o essencial da ficha, para dizer o que ficou depois de criar ou editar. */
export function linhaDaFicha(f: Ficha): string {
  const d = derivar(f);
  const classes = (f.classes ?? []).map((c) => `${c.classe} ${c.nivel}`).join(" / ");
  const partes = [
    [f.raca, classes].filter(Boolean).join(" "),
    `PV ${f.pvAtual}/${f.pvMax}`,
    `CA ${d.ca}`,
    `iniciativa ${formatarBonus(d.iniciativa)}`,
    ATRIBUTOS.map((a) => `${SIGLA_DO_ATRIBUTO[a]} ${d.atributos[a].valor}`).join(" "),
  ].filter((x) => x !== "");
  return partes.join("; ");
}

/** O resumo da ficha: tudo o que a IA precisa para decidir, sem despejar o JSON inteiro. */
export function resumoDaFicha(f: Ficha): string[] {
  const d = derivar(f);
  const linhas: string[] = [];
  const classes = (f.classes ?? [])
    .map((c) => `${c.classe}${c.subclasse ? ` (${c.subclasse})` : ""} ${c.nivel}`)
    .join(" / ");
  linhas.push(
    [
      [f.raca, f.antecedente, f.alinhamento].filter(Boolean).join(" · "),
      classes ? `${classes} (nível ${d.nivelTotal})` : "",
      `proficiência ${formatarBonus(d.proficiencia)}`,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  linhas.push(
    `Atributos: ${ATRIBUTOS.map((a) => `${SIGLA_DO_ATRIBUTO[a]} ${d.atributos[a].valor} (${formatarBonus(d.atributos[a].mod)})`).join("  ")}`,
  );
  linhas.push(
    `PV ${f.pvAtual}/${f.pvMax}${f.pvTemp ? ` (+${f.pvTemp} temp.)` : ""} · CA ${d.ca} · deslocamento ${num(d.deslocamentoM)} m · iniciativa ${formatarBonus(d.iniciativa)} · percepção passiva ${d.percepcaoPassiva}`,
  );
  const salvas = ATRIBUTOS.filter((a) => d.salvaguardas[a].nivel !== "nenhuma");
  if (salvas.length > 0) {
    linhas.push(
      `Salvaguardas proficientes: ${salvas.map((a) => `${ROTULO_DO_ATRIBUTO[a]} ${formatarBonus(d.salvaguardas[a].total)}`).join(", ")}`,
    );
  }
  const pericias = d.pericias.filter((p) => p.nivel !== "nenhuma");
  if (pericias.length > 0) {
    linhas.push(
      `Perícias proficientes: ${pericias.map((p) => `${p.nome} ${formatarBonus(p.total)}${p.nivel === "especialista" ? " (esp.)" : ""}`).join(", ")}`,
    );
  }
  if (f.npc) {
    const n = f.npc;
    const tipo = [n.tamanho, n.tipo].filter(Boolean).join(" ");
    const extras = [
      tipo,
      n.nd ? `ND ${n.nd}` : "",
      n.sentidos ? `Sentidos: ${n.sentidos}` : "",
    ].filter(Boolean);
    if (extras.length > 0) linhas.push(extras.join(" · "));
  }
  if ((f.ataques ?? []).length > 0) {
    linhas.push(
      `Ataques: ${(f.ataques ?? [])
        .map((a) => {
          const dano = expressaoDeDano(f, a);
          return `${a.nome} (${[acertoDoAtaque(f, a), dano ? `${dano}${a.tipo ? ` ${a.tipo}` : ""}` : ""].filter(Boolean).join(", ") || "sem rolagem"})`;
        })
        .join("; ")}`,
    );
  }
  const magias = f.magias ?? [];
  if (magias.length > 0) {
    const porNivel = new Map<number, string[]>();
    for (const m of magias) porNivel.set(m.nivel, [...(porNivel.get(m.nivel) ?? []), m.nome]);
    linhas.push(
      `Magias: ${[...porNivel.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([n, nomes]) => `${n === 0 ? "truques" : `${n}º`}: ${nomes.join(", ")}`)
        .join(" | ")}`,
    );
  }
  const espacos = d.espacos.filter((e) => e.total > 0);
  if (espacos.length > 0) {
    linhas.push(
      `Espaços de magia: ${espacos.map((e) => `${e.nivel}º ${e.restantes}/${e.total}`).join(", ")}`,
    );
  }
  if ((f.itens ?? []).length > 0) {
    linhas.push(
      `Itens: ${(f.itens ?? []).map((i) => (i.quantidade === 1 ? i.nome : `${i.nome} (${i.quantidade})`)).join(", ")}`,
    );
  }
  if ((f.caracteristicas ?? []).length > 0) {
    linhas.push(`Traços: ${(f.caracteristicas ?? []).map((c) => c.nome).join(", ")}`);
  }
  if (f.historia) linhas.push(`História: ${cortar(f.historia, 240)}`);
  return linhas;
}

export function cortar(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length <= max ? limpo : `${limpo.slice(0, max - 1)}…`;
}

/** Quanto vale cada bônus do teste de uma perícia, atributo ou salvaguarda da ficha. */
export function bonusDoTeste(
  f: Ficha,
  tipo: "pericia" | "atributo" | "salvaguarda" | "iniciativa",
  idOuAtributo: string,
): { nome: string; bonus: number } | null {
  const d = derivar(f);
  if (tipo === "iniciativa") return { nome: "Iniciativa", bonus: d.iniciativa };
  if (tipo === "pericia") {
    const p = d.pericias.find((x) => x.id === idOuAtributo);
    return p ? { nome: p.nome, bonus: p.total } : null;
  }
  const a = ATRIBUTOS.find((x) => x === idOuAtributo);
  if (!a) return null;
  return tipo === "atributo"
    ? { nome: `Teste de ${ROTULO_DO_ATRIBUTO[a]}`, bonus: d.atributos[a].mod }
    : { nome: `Salvaguarda de ${ROTULO_DO_ATRIBUTO[a]}`, bonus: d.salvaguardas[a].total };
}

/** O resultado de uma mensagem do chat (rolagem ou modelo), em uma linha. */
export function textoDaRolagem(m: Mensagem): string {
  const formatar = (r: NonNullable<Mensagem["rolagens"]>[number]) => {
    const dados = r.termos
      .filter((t) => t.tipo === "dados")
      .map(
        (t) =>
          `[${t.dados.map((d) => (d.descartado ? `~${d.valor}~` : String(d.valor))).join(", ")}]`,
      )
      .join(" ");
    return `${r.expressao}${dados ? ` ${dados}` : ""} = ${r.total}`;
  };
  if (m.modelo) {
    const x = m.modelo;
    if (x.modelo === "teste") {
      const veredito =
        x.sucesso === undefined
          ? ""
          : x.sucesso
            ? ` — sucesso (CD ${x.cd})`
            : ` — falha (CD ${x.cd})`;
      return `${x.nome}: ${formatar(x.rolagem)}${x.critico ? " (crítico)" : ""}${x.falhaCritica ? " (falha crítica)" : ""}${veredito}`;
    }
    if (x.modelo === "ataque") {
      return `${x.nome}: acerto ${formatar(x.acerto)}${x.critico ? " (crítico)" : ""}${x.falhaCritica ? " (falha crítica)" : ""}; dano ${formatar(x.dano)}${x.danoTipo ? ` ${x.danoTipo}` : ""}`;
    }
    return `${x.nome}: ${formatar(x.rolagem)}`;
  }
  const rolagens = m.rolagens ?? [];
  return rolagens.length > 0 ? rolagens.map(formatar).join("; ") : (m.texto ?? "");
}
