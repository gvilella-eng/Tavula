import type { EfeitosDaZona, Zona } from "@tabletop/shared";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";

type Props = {
  /** A zona selecionada, se houver. */
  selecionada: Zona | null;
  /** Quantas reações a zona carrega (o editor delas é o das automações). */
  reacoes: number;
  enviar: (tipo: string, dados: object) => string | null;
  aoApagar: (id: string) => void;
  aoFechar: () => void;
};

type EfeitoDaZona = "luzRaioX" | "luzSomaM" | "visaoMaxM";

/** Um campo numérico que só envia ao sair do campo ou com Enter; vazio tira o efeito. */
function CampoDoEfeito(p: {
  testid: string;
  rotulo: string;
  dica: string;
  valor: number | undefined;
  min: number;
  max: number;
  passo: number;
  aoConfirmar: (v: number | undefined) => void;
}) {
  const [texto, setTexto] = useState(p.valor === undefined ? "" : String(p.valor));
  useEffect(() => setTexto(p.valor === undefined ? "" : String(p.valor)), [p.valor]);
  function confirmar() {
    const limpo = texto.trim().replace(",", ".");
    if (limpo === "") {
      if (p.valor !== undefined) p.aoConfirmar(undefined);
      return;
    }
    const n = Number(limpo);
    if (!Number.isFinite(n)) {
      setTexto(p.valor === undefined ? "" : String(p.valor));
      return;
    }
    const preso = Math.min(p.max, Math.max(p.min, n));
    setTexto(String(preso));
    if (preso !== p.valor) p.aoConfirmar(preso);
  }
  return (
    <label>
      {p.rotulo}
      <input
        type="number"
        data-testid={p.testid}
        value={texto}
        min={p.min}
        max={p.max}
        step={p.passo}
        placeholder="sem efeito"
        title={p.dica}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
        }}
      />
    </label>
  );
}

/**
 * Painel pequeno da ferramenta Zonas (só do mestre, 7b-2): como desenhar e, com uma zona selecionada, o nome, se está
 * ligada, os efeitos enquanto algo está dentro e apagar. Cada mudança vai na hora. As reações da zona são editadas no
 * editor das automações; aqui só a contagem.
 */
export function PainelDasZonas(p: Props) {
  const z = p.selecionada;
  const [nome, setNome] = useState(z?.nome ?? "");
  const zonaId = z?.id;
  const nomeDaSala = z?.nome;
  // biome-ignore lint/correctness/useExhaustiveDependencies: o campo recomeça quando a seleção ou o nome na sala mudam
  useEffect(() => setNome(nomeDaSala ?? ""), [zonaId, nomeDaSala]);

  // Os efeitos vão inteiros em cada edição: o que se acabou de mandar fica nesta referência, para duas edições seguidas (antes de
  // a sala responder à primeira) não se pisarem. Ela volta ao que a sala tem quando a zona ou os efeitos mudam lá.
  const efeitosDaSala = JSON.stringify(z?.efeitos ?? {});
  const efeitosMandados = useRef<EfeitosDaZona>(z?.efeitos ?? {});
  // biome-ignore lint/correctness/useExhaustiveDependencies: recomeça da sala quando a zona ou os efeitos dela mudam
  useEffect(() => {
    efeitosMandados.current = z?.efeitos ?? {};
  }, [zonaId, efeitosDaSala]);

  function mudarEfeito(chave: EfeitoDaZona, valor: number | undefined) {
    if (!z) return;
    const efeitos = { ...efeitosMandados.current };
    if (valor === undefined) delete efeitos[chave];
    else efeitos[chave] = valor;
    efeitosMandados.current = efeitos;
    p.enviar("zona.editar", { id: z.id, mudancas: { efeitos } });
  }
  function confirmarNome() {
    if (!z) return;
    const limpo = nome.trim();
    if (limpo === "") setNome(z.nome);
    else if (limpo !== z.nome) p.enviar("zona.editar", { id: z.id, mudancas: { nome: limpo } });
  }

  return (
    <Janela
      id="zonas"
      titulo="Zonas"
      testid="painel-zonas"
      classeDoCorpo="painel-token"
      padrao={noCanto("topo-esquerda", 316)}
      largura={248}
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar a ferramenta"
      testidDoFechar="zonas-fechar"
    >
      <p className="nota">
        Clique para marcar os cantos; duplo clique ou Enter fecha, Esc cancela. Alt solta do grid.
        Só você vê as zonas.
      </p>
      {z ? (
        <fieldset className="quem-controla" data-testid="zona-selecionada">
          <legend>Zona selecionada</legend>
          <label>
            Nome
            <input
              type="text"
              data-testid="zona-nome"
              value={nome}
              maxLength={64}
              onChange={(e) => setNome(e.target.value)}
              onBlur={confirmarNome}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarNome();
              }}
            />
          </label>
          <label className="linha-opcao">
            <input
              type="checkbox"
              data-testid="zona-ativa"
              checked={z.ativa}
              onChange={(e) =>
                p.enviar("zona.editar", { id: z.id, mudancas: { ativa: e.target.checked } })
              }
            />
            Ligada
          </label>
          <fieldset className="quem-controla" data-testid="zona-efeitos">
            <legend>Enquanto algo está dentro</legend>
            <CampoDoEfeito
              testid="zona-luz-fator"
              rotulo="Luz × fator"
              dica="Multiplica o raio das luzes dentro (0,5 = metade)."
              valor={z.efeitos.luzRaioX}
              min={0.1}
              max={5}
              passo={0.1}
              aoConfirmar={(v) => mudarEfeito("luzRaioX", v)}
            />
            <CampoDoEfeito
              testid="zona-luz-soma"
              rotulo="Luz ± metros"
              dica="Soma metros ao raio das luzes dentro (negativo diminui)."
              valor={z.efeitos.luzSomaM}
              min={-100}
              max={100}
              passo={0.5}
              aoConfirmar={(v) => mudarEfeito("luzSomaM", v)}
            />
            <CampoDoEfeito
              testid="zona-visao"
              rotulo="Visão máxima (m)"
              dica="Limita o alcance de visão dos tokens dentro."
              valor={z.efeitos.visaoMaxM}
              min={0.5}
              max={1000}
              passo={0.5}
              aoConfirmar={(v) => mudarEfeito("visaoMaxM", v)}
            />
          </fieldset>
          <p className="nota" data-testid="zona-reacoes">
            {p.reacoes === 0
              ? "Sem reações"
              : p.reacoes === 1
                ? "1 reação"
                : `${p.reacoes} reações`}
          </p>
          <p className="nota">Arraste as bolinhas para mexer nos cantos.</p>
          <button
            type="button"
            className="perigo"
            data-testid="zona-apagar"
            onClick={() => p.aoApagar(z.id)}
          >
            <Trash2 size={16} /> Apagar
          </button>
        </fieldset>
      ) : (
        <p className="nota" data-testid="zona-nenhuma">
          Clique numa zona para editar.
        </p>
      )}
    </Janela>
  );
}
