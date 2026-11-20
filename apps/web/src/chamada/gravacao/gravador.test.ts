import {
  GravacaoJsonSchema,
  inicioDoNomeDoTrecho,
  lerCabecalhoWav,
  lerEventosGravados,
} from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { Memoria } from "../../assets/fonte";
import type { Captura } from "./captura";
import { Reamostrador } from "./captura";
import { GravadorDaSessao, type PessoaNaGravacao } from "./gravador";

// CH3: o gravador da sessão, com uma captura de mentira (os testes entregam as amostras) e a pasta em memória.

const TAXA = 16_000;
const ms = (n: number) => Math.round((n / 1000) * TAXA);

class CapturaFalsa implements Captura {
  readonly ouvindo = new Map<string, (a: Float32Array) => void>();
  readonly adicionadas: string[] = [];
  fechada = false;
  adicionar(id: string, _f: MediaStream, aoBloco: (a: Float32Array) => void): void {
    this.ouvindo.set(id, aoBloco);
    this.adicionadas.push(id);
  }
  remover(id: string): void {
    this.ouvindo.delete(id);
  }
  fechar(): void {
    this.fechada = true;
  }
  /** Entrega `silencioMs` de silêncio, `falaMs` de tom e mais `silencioMs`, à voz de `id` (em blocos de 100 ms). */
  falar(id: string, silencioAntesMs: number, falaMs: number, silencioDepoisMs: number): void {
    const x = new Float32Array(ms(silencioAntesMs + falaMs + silencioDepoisMs));
    for (let i = ms(silencioAntesMs); i < ms(silencioAntesMs + falaMs); i++)
      x[i] = 0.3 * Math.sin(i * 0.3);
    const bloco = this.ouvindo.get(id);
    for (let i = 0; i < x.length; i += 1600) bloco?.(x.slice(i, i + 1600));
  }
}

const FLUXO = {} as MediaStream;
const pessoa = (
  id: string,
  nome: string,
  extra: Partial<PessoaNaGravacao> = {},
): PessoaNaGravacao => ({
  usuarioId: id,
  nome,
  fluxo: FLUXO,
  naoGravar: false,
  ...extra,
});

// 2026-11-20 21:14:00 local
const INICIO = new Date(2026, 10, 20, 21, 14, 0).getTime();

function montar() {
  const pasta = new Memoria();
  const captura = new CapturaFalsa();
  let t = INICIO;
  const g = new GravadorDaSessao({
    pasta,
    captura,
    agora: () => t,
    mesaNome: "Mesa de teste",
    intervaloDeGravacaoMs: 100_000,
  });
  return { pasta, captura, g, avancar: (n: number) => (t += n) };
}

const caminhos = (p: Memoria) => p.gravados().map((x) => x.caminho);

describe("o gravador da sessão", () => {
  it("grava a pasta da gravação, o gravacao.json e o nomes.txt ao começar", async () => {
    const { pasta, g } = montar();
    await g.iniciar("Thorin\nTorre Negra\n");
    await g.parar();
    expect(g.estado.pasta).toBe("gravacoes/2026-11-20_21h14");
    const c = caminhos(pasta);
    expect(c).toContain("gravacoes/2026-11-20_21h14/gravacao.json");
    expect(c).toContain("gravacoes/2026-11-20_21h14/nomes.txt");
    const json = GravacaoJsonSchema.parse(
      JSON.parse(
        (await (
          await pasta.abrirPorCaminho(["gravacoes", "2026-11-20_21h14", "gravacao.json"])
        )?.text()) ?? "{}",
      ),
    );
    expect(json.inicioEpochMs).toBe(INICIO);
    expect(json.inicioLocal).toBe("2026-11-20 21:14");
    expect(json.fimEpochMs).toBe(INICIO);
    expect(json.mesaNome).toBe("Mesa de teste");
  });

  it("cada voz vai para a pasta dela, só a fala, em WAV de 16 kHz mono 16 bits, com o início em ms no nome", async () => {
    const { pasta, captura, g, avancar } = montar();
    await g.iniciar("");
    avancar(5000);
    g.sincronizar([pessoa("mestre", "Vilella"), pessoa("ana", "Ana", { personagem: "Thorin" })]);
    expect([...captura.ouvindo.keys()].sort()).toEqual(["ana", "mestre"]);
    captura.falar("ana", 1000, 1200, 2000);
    captura.falar("mestre", 3000, 800, 1500);
    await g.parar();
    const wavs = pasta.gravados().filter((x) => x.caminho.endsWith(".wav"));
    expect(wavs).toHaveLength(2);
    const ana = wavs.find((w) => w.caminho.includes("/Ana/"));
    const mestre = wavs.find((w) => w.caminho.includes("/Vilella/"));
    expect(ana).toBeDefined();
    expect(mestre).toBeDefined();
    const nome = (c: string) => c.split("/").pop() ?? "";
    // o detector começou a contar a partir de quando a voz foi ligada (5 s depois do início da gravação)
    expect(inicioDoNomeDoTrecho(nome(ana?.caminho ?? ""))).toBe(5000 + 700);
    expect(inicioDoNomeDoTrecho(nome(mestre?.caminho ?? ""))).toBe(5000 + 2700);
    const cab = lerCabecalhoWav(ana?.bytes ?? new Uint8Array());
    expect(cab).toMatchObject({ taxa: 16_000, canais: 1, bits: 16 });
    expect(cab?.duracaoMs).toBe(300 + 1200 + 300);
    expect(g.estado.trechos).toBe(2);
    const json = GravacaoJsonSchema.parse(
      JSON.parse(
        (await (
          await pasta.abrirPorCaminho(["gravacoes", "2026-11-20_21h14", "gravacao.json"])
        )?.text()) ?? "{}",
      ),
    );
    expect(json.pessoas).toEqual([
      { id: "mestre", nome: "Vilella", pasta: "Vilella" },
      { id: "ana", nome: "Ana", personagem: "Thorin", pasta: "Ana" },
    ]);
    expect(json.entradas.map((e) => [e.pessoaId, e.tipo])).toEqual([
      ["mestre", "entrou"],
      ["ana", "entrou"],
    ]);
  });

  it("quem ficou de fora não é escutado, e o que estava em curso é jogado fora", async () => {
    const { pasta, captura, g, avancar } = montar();
    await g.iniciar("");
    g.sincronizar([pessoa("mestre", "Vilella"), pessoa("beto", "Beto", { naoGravar: true })]);
    // o Beto entrou de fora: a captura da voz dele nem foi ligada
    expect(captura.adicionadas).toEqual(["mestre"]);
    // a Ana entra gravada, começa a falar e, no meio da fala, tira a própria voz
    g.sincronizar([pessoa("mestre", "Vilella"), pessoa("ana", "Ana")]);
    const bloco = captura.ouvindo.get("ana");
    expect(bloco).toBeDefined();
    const tom = new Float32Array(1600);
    for (let i = 0; i < tom.length; i++) tom[i] = 0.3 * Math.sin(i * 0.3);
    for (let i = 0; i < 12; i++) bloco?.(tom);
    avancar(2000);
    g.sincronizar([pessoa("mestre", "Vilella"), pessoa("ana", "Ana", { naoGravar: true })]);
    expect(captura.ouvindo.has("ana")).toBe(false);
    await g.parar();
    expect(caminhos(pasta).some((c) => c.includes("/Ana/") || c.includes("/Beto/"))).toBe(false);
    const json = GravacaoJsonSchema.parse(
      JSON.parse(
        (await (
          await pasta.abrirPorCaminho(["gravacoes", "2026-11-20_21h14", "gravacao.json"])
        )?.text()) ?? "{}",
      ),
    );
    expect(json.foraDaGravacao.map((x) => [x.pessoaId, x.fora])).toEqual([
      ["beto", true],
      ["ana", true],
    ]);
  });

  it("quem volta a deixar a voz entrar volta a ser escutado; quem sai tem o trecho em curso salvo", async () => {
    const { pasta, captura, g, avancar } = montar();
    await g.iniciar("");
    g.sincronizar([pessoa("mestre", "Vilella"), pessoa("ana", "Ana", { naoGravar: true })]);
    expect(captura.ouvindo.has("ana")).toBe(false);
    avancar(1000);
    g.sincronizar([pessoa("mestre", "Vilella"), pessoa("ana", "Ana")]);
    expect(captura.ouvindo.has("ana")).toBe(true);
    const bloco = captura.ouvindo.get("ana");
    const tom = new Float32Array(1600);
    for (let i = 0; i < tom.length; i++) tom[i] = 0.3 * Math.sin(i * 0.3);
    for (let i = 0; i < 12; i++) bloco?.(tom); // 1,2 s de fala, sem silêncio depois
    avancar(1500);
    g.sincronizar([pessoa("mestre", "Vilella")]); // a Ana saiu no meio da fala
    await g.parar();
    expect(caminhos(pasta).filter((c) => c.includes("/Ana/") && c.endsWith(".wav"))).toHaveLength(
      1,
    );
  });

  it("dois nomes que dão a mesma pasta não misturam as vozes", async () => {
    const { pasta, captura, g } = montar();
    await g.iniciar("");
    g.sincronizar([pessoa("a1", "Ana"), pessoa("a2", "ana")]);
    captura.falar("a1", 500, 700, 1500);
    captura.falar("a2", 500, 700, 1500);
    await g.parar();
    const pastas = new Set(
      pasta
        .gravados()
        .filter((x) => x.caminho.endsWith(".wav"))
        .map((x) => x.caminho.split("/")[2]),
    );
    expect(pastas).toEqual(new Set(["Ana", "ana-2"]));
  });

  it("os eventos da mesa vão para o eventos.jsonl (e só enquanto grava)", async () => {
    const { pasta, g } = montar();
    g.registrarEvento({ t: INICIO, tipo: "chat", texto: "antes de começar" });
    await g.iniciar("");
    g.registrarEvento({ t: INICIO + 5, tipo: "rolagem", texto: "Thorin, Percepção: 17" });
    g.registrarEvento({ t: INICIO + 9, tipo: "cena", texto: 'o grupo foi para "Corredor"' });
    await g.parar();
    g.registrarEvento({ t: INICIO + 20, tipo: "chat", texto: "depois de parar" });
    const texto = await (
      await pasta.abrirPorCaminho(["gravacoes", "2026-11-20_21h14", "eventos.jsonl"])
    )?.text();
    expect(lerEventosGravados(texto ?? "").map((e) => e.texto)).toEqual([
      "Thorin, Percepção: 17",
      'o grupo foi para "Corredor"',
    ]);
  });

  it("duas gravações no mesmo minuto ganham pastas diferentes", async () => {
    const pasta = new Memoria();
    const captura = new CapturaFalsa();
    const novo = () => new GravadorDaSessao({ pasta, captura, agora: () => INICIO });
    const a = novo();
    await a.iniciar("");
    await a.parar();
    const b = novo();
    await b.iniciar("");
    await b.parar();
    expect(a.estado.pasta).toBe("gravacoes/2026-11-20_21h14");
    expect(b.estado.pasta).toBe("gravacoes/2026-11-20_21h14-2");
  });

  it("uma pasta que não grava vira erro avisado, sem derrubar a gravação", async () => {
    const pasta = new Memoria();
    pasta.gravar = async () => {
      throw new Error("sem permissão");
    };
    const g = new GravadorDaSessao({ pasta, captura: new CapturaFalsa(), agora: () => INICIO });
    await g.iniciar("");
    expect(g.gravando).toBe(true);
    await g.parar();
    expect(g.estado.erro).toContain("sem permissão");
  });
});

describe("o reamostrador de reserva", () => {
  it("mesma taxa passa direto; 48 kHz para 16 kHz fica com um terço das amostras, na média", () => {
    const r1 = new Reamostrador(16_000);
    const a = Float32Array.from([1, 2, 3]);
    expect(r1.processar(a)).toBe(a);
    const r3 = new Reamostrador(48_000);
    const saida = r3.processar(Float32Array.from([1, 1, 1, 4, 4, 4, 7, 7]));
    expect([...saida]).toEqual([1, 4]);
    // o que sobrou (7, 7) se junta ao bloco seguinte
    expect([...r3.processar(Float32Array.from([7, 2, 2, 2]))]).toEqual([7, 2]);
  });
});
