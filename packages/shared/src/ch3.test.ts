import { describe, expect, it } from "vitest";
import {
  capacidadeDaIntencao,
  dividirEmNotas,
  type EntradaNaChamada,
  ehCapacidadeDelegavel,
  entrarNaChamada,
  escreverWav,
  estadoDaGravacao,
  estimarTempoQueFalta,
  formatarDuracao,
  gravacaoLigada,
  horaLocalDe,
  IntencaoSchema,
  inicioDoNomeDoTrecho,
  instanteNaSessao,
  lerCabecalhoWav,
  lerEventosGravados,
  lerJsonDoWhisper,
  ligarGravacao,
  misturarLinhaDoTempo,
  montarMarkdownDaTranscricao,
  nomeDaPastaDaGravacao,
  nomeDoArquivoDoTrecho,
  pastaDaPessoa,
  pcm16DeFloat,
  planejarEmenda,
  promptDosNomes,
  quemFicouDeFora,
  tempoDoWhisperEmMs,
  tirarMinhaVoz,
  tituloDaTranscricao,
  trechoDoInstante,
  visaoDaChamada,
} from "./index.ts";

// CH3: as regras puras da gravação para a transcrição.

describe("nomes e caminhos seguros", () => {
  it("a pasta da gravação é AAAA-MM-DD_HHhMM, na hora local", () => {
    expect(nomeDaPastaDaGravacao(new Date(2026, 10, 20, 21, 5))).toBe("2026-11-20_21h05");
  });

  it("o nome da pessoa passa pelo caminho seguro e dois nomes iguais não se misturam", () => {
    expect(pastaDaPessoa("Ana/Beto", new Set())).toBe("Ana_Beto");
    expect(pastaDaPessoa("..\\..", new Set())).toBe("arquivo");
    expect(pastaDaPessoa("AUX", new Set())).toBe("_AUX");
    const usadas = new Set<string>();
    const a = pastaDaPessoa("Ana", usadas);
    usadas.add(a.toLowerCase());
    const b = pastaDaPessoa("ana", usadas);
    expect(a).toBe("Ana");
    expect(b).toBe("ana-2");
    expect(a.toLowerCase()).not.toBe(b.toLowerCase());
  });

  it("o arquivo do trecho é só o início em ms e .wav; outro nome não é trecho", () => {
    expect(nomeDoArquivoDoTrecho(1234.6)).toBe("1235.wav");
    expect(nomeDoArquivoDoTrecho(-5)).toBe("0.wav");
    expect(inicioDoNomeDoTrecho("1235.wav")).toBe(1235);
    for (const ruim of ["a.wav", "12.wav.exe", "12.exe", "../12.wav", "12 .wav", "1.mp3", ""]) {
      expect(inicioDoNomeDoTrecho(ruim)).toBeNull();
    }
  });
});

describe("o escritor de WAV", () => {
  it("tem o cabeçalho de 44 bytes, 16 kHz, mono, 16 bits, e as amostras no fim", () => {
    const pcm = Int16Array.from([0, 1, -1, 32767, -32768]);
    const wav = escreverWav(pcm);
    expect(wav.length).toBe(44 + 10);
    const txt = (de: number, n: number) => String.fromCharCode(...wav.subarray(de, de + n));
    expect(txt(0, 4)).toBe("RIFF");
    expect(txt(8, 4)).toBe("WAVE");
    expect(txt(12, 4)).toBe("fmt ");
    expect(txt(36, 4)).toBe("data");
    const v = new DataView(wav.buffer);
    expect(v.getUint32(4, true)).toBe(36 + 10);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint32(28, true)).toBe(32_000);
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(10);
    expect(v.getInt16(44 + 6, true)).toBe(32767);
    expect(v.getInt16(44 + 8, true)).toBe(-32768);
  });

  it("lê de volta a taxa, os bytes e a duração (e acha o `data` depois de um bloco extra)", () => {
    const wav = escreverWav(new Int16Array(16_000)); // 1 s
    const l = lerCabecalhoWav(wav);
    expect(l).toMatchObject({
      taxa: 16_000,
      canais: 1,
      bits: 16,
      bytesDeDados: 32_000,
      duracaoMs: 1000,
    });
    // um bloco "LIST" entre o `fmt ` e o `data`
    const extra = new Uint8Array(wav.length + 12);
    extra.set(wav.subarray(0, 36), 0);
    extra.set([76, 73, 83, 84, 4, 0, 0, 0, 1, 2, 3, 4], 36);
    extra.set(wav.subarray(36), 48);
    expect(lerCabecalhoWav(extra)).toMatchObject({ inicioDosDados: 56, bytesDeDados: 32_000 });
    expect(lerCabecalhoWav(new Uint8Array(10))).toBeNull();
    expect(
      lerCabecalhoWav(new TextEncoder().encode("não sou um wav, sou um texto qualquer")),
    ).toBeNull();
  });

  it("de ponto flutuante para 16 bits, com corte", () => {
    expect([...pcm16DeFloat(Float32Array.from([0, 1, -1, 2, -2, 0.5]))]).toEqual([
      0, 32767, -32768, 32767, -32768, 16384,
    ]);
  });
});

describe("o mapa de deslocamentos e a volta à hora da sessão", () => {
  const duracoes = [2000, 500, 3000];
  const plano = planejarEmenda(duracoes);

  it("cada trecho começa depois do anterior, com 1 s de silêncio entre eles", () => {
    expect(plano.iniciosNaEmendaMs).toEqual([0, 3000, 4500]);
    expect(plano.totalMs).toBe(7500);
    expect(planejarEmenda([]).totalMs).toBe(0);
    expect(planejarEmenda([700]).iniciosNaEmendaMs).toEqual([0]);
  });

  it("acha o trecho de um instante, e o silêncio da emenda fica com o trecho anterior", () => {
    expect(trechoDoInstante(plano, 0)).toBe(0);
    expect(trechoDoInstante(plano, 2999)).toBe(0);
    expect(trechoDoInstante(plano, 3000)).toBe(1);
    expect(trechoDoInstante(plano, 4499)).toBe(1);
    expect(trechoDoInstante(plano, 99_999)).toBe(2);
  });

  it("volta à hora da sessão: início do trecho (o nome do arquivo) mais o quanto se andou dentro dele", () => {
    const inicios = [10_000, 50_000, 120_000];
    expect(instanteNaSessao(plano, inicios, 500)).toEqual({ trecho: 0, sessaoMs: 10_500 });
    expect(instanteNaSessao(plano, inicios, 3200)).toEqual({ trecho: 1, sessaoMs: 50_200 });
    expect(instanteNaSessao(plano, inicios, 5000)).toEqual({ trecho: 2, sessaoMs: 120_500 });
    // no silêncio entre o 1º e o 2º trecho, prende ao fim do 1º
    expect(instanteNaSessao(plano, inicios, 2500)).toEqual({ trecho: 0, sessaoMs: 12_000 });
  });
});

describe("a leitura do JSON do whisper", () => {
  const EXEMPLO = JSON.stringify({
    systeminfo: "AVX = 1 | CUDA = 1",
    model: { type: "large" },
    result: { language: "pt" },
    transcription: [
      {
        timestamps: { from: "00:00:00,000", to: "00:00:02,500" },
        offsets: { from: 0, to: 2500 },
        text: " Eu abro a porta   devagar.",
      },
      {
        timestamps: { from: "00:00:03,000", to: "00:00:04,000" },
        offsets: { from: 3000, to: 4000 },
        text: " [BLANK_AUDIO]",
      },
      { timestamps: { from: "00:01:02,500", to: "00:01:05,000" }, text: " Sem offsets." },
      { offsets: { from: 9000, to: 9500 }, text: " (música)" },
      { offsets: { from: 9600, to: 9700 }, text: " ♪ " },
      { offsets: { from: 10_000, to: 11_000 }, text: " Tem [um colchete] no meio." },
      { text: " sem tempo nenhum" },
    ],
  });

  it("lê os tempos em ms, limpa os espaços e descarta ruído e o que não tem tempo", () => {
    expect(lerJsonDoWhisper(EXEMPLO)).toEqual([
      { inicioMs: 0, fimMs: 2500, texto: "Eu abro a porta devagar." },
      { inicioMs: 62_500, fimMs: 65_000, texto: "Sem offsets." },
      { inicioMs: 10_000, fimMs: 11_000, texto: "Tem [um colchete] no meio." },
    ]);
  });

  it("recusa o que não é do formato, com a razão", () => {
    expect(() => lerJsonDoWhisper("não é json")).toThrow(/JSON válido/);
    expect(() => lerJsonDoWhisper("{}")).toThrow(/transcription/);
    expect(lerJsonDoWhisper('{"transcription":[]}')).toEqual([]);
  });

  it("os tempos em texto do whisper", () => {
    expect(tempoDoWhisperEmMs("01:02:03,450")).toBe(3_723_450);
    expect(tempoDoWhisperEmMs("00:00:01.5")).toBe(1500);
    expect(tempoDoWhisperEmMs("1:2")).toBeNull();
  });

  it("o prompt: nomes sem repetir, cortado no último nome inteiro que cabe", () => {
    expect(promptDosNomes("Thorin\nGandalf\nthorin\n\n  Torre Negra  ")).toBe(
      "Nomes: Thorin, Gandalf, Torre Negra.",
    );
    expect(promptDosNomes("")).toBe("");
    const longo = promptDosNomes(
      Array.from({ length: 200 }, (_, i) => `Nome Comprido ${i}`).join("\n"),
      60,
    );
    expect(longo.length).toBeLessThanOrEqual(61);
    expect(longo.endsWith(".")).toBe(true);
  });
});

describe("a linha do tempo misturada com o que a mesa registrou", () => {
  // 2026-11-20 21:14:00 em UTC-3 (fusoMin = 180)
  const inicio = Date.UTC(2026, 10, 21, 0, 14, 0);
  const FUSO = 180;

  it("a hora local, o título e o formato das linhas", () => {
    expect(horaLocalDe(inicio, FUSO)).toBe("21:14");
    expect(tituloDaTranscricao(inicio, FUSO)).toBe("Sessão de 20/11 — transcrição");
  });

  it("ordena por horário, a fala antes do evento no empate, e monta o markdown do exemplo do pedido", () => {
    const falas = [
      { t: inicio + 55_000, pessoa: "Vilella", texto: "Do outro lado, um corredor úmido..." },
      { t: inicio + 2000, pessoa: "Ana", personagem: "Thorin", texto: "Eu abro a porta devagar." },
    ];
    const eventos = lerEventosGravados(
      [
        JSON.stringify({ t: inicio + 2000, tipo: "rolagem", texto: "Thorin, Percepção: 17" }),
        "{linha quebrada",
        JSON.stringify({ t: inicio + 9000, tipo: "outra-coisa", texto: "fora do formato" }),
        JSON.stringify({ t: inicio + 30_000, tipo: "cena", texto: 'foi para "Corredor"' }),
      ].join("\n"),
    );
    expect(eventos).toHaveLength(2);
    const linhas = misturarLinhaDoTempo(falas, eventos, FUSO);
    expect(linhas.map((l) => l.texto)).toEqual([
      "Ana (Thorin): Eu abro a porta devagar.",
      "[rolagem] Thorin, Percepção: 17",
      '[cena] foi para "Corredor"',
      "Vilella: Do outro lado, um corredor úmido...",
    ]);
    const md = montarMarkdownDaTranscricao(tituloDaTranscricao(inicio, FUSO), linhas);
    expect(md).toBe(
      [
        "# Sessão de 20/11 — transcrição",
        "",
        "21:14  Ana (Thorin): Eu abro a porta devagar.",
        "21:14  [rolagem] Thorin, Percepção: 17",
        '21:14  [cena] foi para "Corredor"',
        "21:14  Vilella: Do outro lado, um corredor úmido...",
        "",
      ].join("\n"),
    );
  });

  it("o tempo que falta e a duração em texto", () => {
    expect(estimarTempoQueFalta(0, 0, 1000)).toBeNull();
    expect(estimarTempoQueFalta(10_000, 20_000, 40_000)).toBe(20_000);
    expect(formatarDuracao(45_000)).toBe("45 s");
    expect(formatarDuracao(125_000)).toBe("2 min 05 s");
    expect(formatarDuracao(3_780_000)).toBe("1 h 03 min");
  });
});

describe("trazer para a mesa", () => {
  it("o estado da gravação vem dos arquivos da pasta", () => {
    expect(estadoDaGravacao(["gravacao.json"])).toBe("gravada");
    expect(estadoDaGravacao(["gravacao.json", "transcricao.md"])).toBe("transcrita");
    expect(estadoDaGravacao(["gravacao.json", "transcricao.md", "trazida.json"])).toBe("trazida");
  });

  it("uma nota que cabe fica inteira; a longa vira partes, sempre entre linhas", () => {
    expect(dividirEmNotas("a\nb", 100)).toEqual(["a\nb"]);
    const texto = Array.from({ length: 50 }, (_, i) => `linha ${i}`).join("\n");
    const partes = dividirEmNotas(texto, 100);
    expect(partes.length).toBeGreaterThan(1);
    for (const p of partes) expect(p.length).toBeLessThanOrEqual(100);
    expect(partes.join("\n")).toBe(texto);
  });
});

describe("na sala: só o mestre liga a gravação; cada um tira só a própria voz", () => {
  const ENTRAR = { microfone: true, camera: true, soOuvindo: false };
  const membro = (usuarioId: string) => ({ usuarioId, conexaoId: `c-${usuarioId}`, membro: true });
  function com(...ids: string[]): EntradaNaChamada[] {
    let entradas: EntradaNaChamada[] = [];
    for (const id of ids) {
      const r = entrarNaChamada(entradas, membro(id), ENTRAR);
      if (r.erro) throw new Error(r.erro.mensagem);
      entradas = r.entradas;
    }
    return entradas;
  }

  it("quem entra começa gravado, a menos que já tenha marcado 'Não gravar' antes de entrar", () => {
    const r = entrarNaChamada([], membro("a"), { ...ENTRAR, naoGravar: true });
    expect(r.entradas?.[0]).toMatchObject({ gravando: false, naoGravar: true });
    expect(com("b")[0]).toMatchObject({ gravando: false, naoGravar: false });
  });

  it("LP1: a tabela de capacidades e a sala dizem a mesma coisa: gravar é só do mestre, sem delegar; não gravar é de cada um", () => {
    const cap = capacidadeDaIntencao["chamada.gravar"];
    expect(cap).not.toBeNull();
    // exclusiva do mestre: nunca delegável, e o jogador não a tem nem com tudo liberado
    expect(ehCapacidadeDelegavel(cap as string)).toBe(false);
    expect(capacidadeDaIntencao["chamada.naoGravar"]).toBeNull();
    const e = com("mestre", "ana");
    expect(ligarGravacao(e, "c-ana", false, true).erro?.codigo).toBe("sem_permissao");
    expect(ligarGravacao(e, "c-mestre", true, true).erro).toBeUndefined();
    expect(tirarMinhaVoz(e, "c-ana", true).erro).toBeUndefined();
  });

  it("o jogador não liga a gravação (sem_permissao); o mestre liga e desliga", () => {
    const e = com("mestre", "ana");
    expect(ligarGravacao(e, "c-ana", false, true).erro?.codigo).toBe("sem_permissao");
    const ligada = ligarGravacao(e, "c-mestre", true, true);
    expect(ligada.erro).toBeUndefined();
    expect(gravacaoLigada(visaoDaChamada(ligada.entradas ?? []))).toBe(true);
    expect(ligada.entradas?.find((x) => x.usuarioId === "mestre")?.gravando).toBe(true);
    expect(ligada.entradas?.find((x) => x.usuarioId === "ana")?.gravando).toBe(false);
    const desligada = ligarGravacao(ligada.entradas ?? [], "c-mestre", true, false);
    expect(gravacaoLigada(visaoDaChamada(desligada.entradas ?? []))).toBe(false);
  });

  it("só de dentro da chamada; e a gravação some quando o mestre sai", () => {
    expect(ligarGravacao(com("ana"), "fora", true, true).erro?.codigo).toBe("fora_da_chamada");
    expect(tirarMinhaVoz(com("ana"), "fora", true).erro?.codigo).toBe("fora_da_chamada");
    const e = ligarGravacao(com("mestre", "ana"), "c-mestre", true, true).entradas ?? [];
    const semMestre = e.filter((x) => x.usuarioId !== "mestre");
    expect(gravacaoLigada(semMestre)).toBe(false);
  });

  it("cada um tira só a própria voz: a marca é da conexão que pediu, nunca de outra", () => {
    const e = com("mestre", "ana", "beto");
    const r = tirarMinhaVoz(e, "c-ana", true);
    expect(quemFicouDeFora(r.entradas ?? [])).toEqual(["ana"]);
    // o Beto não consegue tirar a voz da Ana: a intenção não tem destinatário, vale só para quem pediu
    const b = tirarMinhaVoz(r.entradas ?? [], "c-beto", true);
    expect(quemFicouDeFora(b.entradas ?? []).sort()).toEqual(["ana", "beto"]);
    const volta = tirarMinhaVoz(b.entradas ?? [], "c-ana", false);
    expect(quemFicouDeFora(volta.entradas ?? [])).toEqual(["beto"]);
  });

  it("mudar o estado (microfone, fundo) não mexe na gravação nem na marca de ficar de fora", () => {
    const e = ligarGravacao(com("mestre", "ana"), "c-mestre", true, true).entradas ?? [];
    expect(e.find((x) => x.usuarioId === "mestre")?.gravando).toBe(true);
  });

  it("as intenções novas: o esquema, e a capacidade (a do mestre; a de tirar a própria voz, nenhuma)", () => {
    expect(
      IntencaoSchema.safeParse({ v: 1, id: "1", tipo: "chamada.gravar", dados: { ligada: true } })
        .success,
    ).toBe(true);
    expect(
      IntencaoSchema.safeParse({ v: 1, id: "1", tipo: "chamada.gravar", dados: {} }).success,
    ).toBe(false);
    expect(
      IntencaoSchema.safeParse({ v: 1, id: "1", tipo: "chamada.naoGravar", dados: { fora: true } })
        .success,
    ).toBe(true);
    // "chamada.naoGravar" não aceita apontar outra pessoa: o campo extra é ignorado, e a sala só usa a conexão de quem pediu
    expect(capacidadeDaIntencao["chamada.gravar"]).toBe("mesa.configurar");
    expect(capacidadeDaIntencao["chamada.naoGravar"]).toBeNull();
  });
});
