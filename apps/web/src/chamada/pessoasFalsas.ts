import { useSyncExternalStore } from "react";
import type { DadosDoQuadro } from "./Quadros";

// CH2: gancho de teste. Só o modo "e2e" liga `window.__tabletopChamadaFalsas(n, quemFala?)`, que põe `n` quadros de
// pessoas falsas na grade (sem conexão nenhuma) para o teste conferir a grade com 5, 9 ou 11 pessoas. Fora do e2e a
// lista fica sempre vazia e nada aparece.

type Estado = { n: number; falando: number | null };

let estado: Estado = { n: 0, falando: null };
let lista: DadosDoQuadro[] = [];
const ouvintes = new Set<() => void>();

const CORES = [
  "#3cb44b",
  "#4363d8",
  "#e6194b",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
];

function montar(e: Estado): DadosDoQuadro[] {
  return Array.from({ length: e.n }, (_, i) => {
    const id = `falso-${i + 1}`;
    return {
      usuario: {
        id,
        nome: `Pessoa ${i + 1}`,
        papel: "jogador",
        cor: CORES[i % CORES.length] ?? "#888",
      },
      participante: {
        usuarioId: id,
        microfone: true,
        camera: false,
        fundo: "nenhum",
        surdo: false,
        soOuvindo: false,
      },
      euSou: false,
      papel: "Jogador",
      fluxo: null,
      falando: e.falando === i,
      conectando: false,
    } satisfies DadosDoQuadro;
  });
}

export function definirPessoasFalsas(n: number, falando: number | null = null): void {
  estado = { n: Math.max(0, Math.floor(n)), falando };
  lista = montar(estado);
  for (const o of ouvintes) o();
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};

export const usePessoasFalsas = (): DadosDoQuadro[] => useSyncExternalStore(assinar, () => lista);
