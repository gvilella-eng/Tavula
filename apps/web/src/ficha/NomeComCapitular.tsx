import { type ReactNode, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------------------------
// O nome com a capitular (V4b2), a mesma peça no personagem (pele Livro) e no monstro. A capitular é só desenho: mostra
// a primeira letra do nome (maiúscula) e nunca recebe foco nem texto; clicar nela foca o campo. O campo mostra o resto
// do nome; em edição (com foco) mostra o nome inteiro, e Enter ou sair do campo grava, de modo que a primeira letra
// "pula" para a capitular. Esc desfaz. Nome vazio não grava; o limite é 64 letras.
// ---------------------------------------------------------------------------------------------

const LIMITE = 64;

type Props = {
  nome: string;
  podeEditar: boolean;
  /** Grava o nome novo (já aparado, nunca vazio e diferente do atual). */
  aoMudar: (nome: string) => void;
  /** Livro: a inicial vira capitular e o campo mostra o resto. Clássica: o nome inteiro num campo só. */
  capitular: boolean;
  /** O rótulo do campo ("Nome do personagem" ou "Nome do monstro"). */
  rotulo: string;
  /** Personagem: a moldura da capitular e o campo ficam dentro de `fl-nome`. Monstro: no estandarte do bloco. */
  variante: "personagem" | "monstro";
  /** Personagem: o nome é longo e a peça encolhe. */
  pequeno?: boolean;
  /** Monstro: o que vai logo abaixo do nome (tamanho, tipo, tendência). */
  filhos?: ReactNode;
};

export function NomeComCapitular({
  nome,
  podeEditar,
  aoMudar,
  capitular,
  rotulo,
  variante,
  pequeno,
  filhos,
}: Props) {
  const [texto, setTexto] = useState(nome);
  const [foco, setFoco] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const desistiu = useRef(false);
  const comPonteiro = useRef(false);
  useEffect(() => {
    if (!foco) setTexto(nome);
  }, [nome, foco]);
  const base = foco ? texto : nome;
  const letra = (capitular ? base.charAt(0) : "").toUpperCase();
  const valorDoCampo = capitular && !foco ? nome.slice(1) : texto;

  function sair() {
    comPonteiro.current = false;
    setFoco(false);
    if (desistiu.current) {
      desistiu.current = false;
      setTexto(nome);
      return;
    }
    const novo = texto.trim().slice(0, LIMITE);
    if (novo !== "" && novo !== nome) aoMudar(novo);
    else setTexto(nome);
  }

  const desenho = capitular ? (
    <div
      className={variante === "personagem" ? "fl-capitular" : "npc-inicial fl-fh"}
      data-testid="ficha-nome-capitular"
      aria-hidden
      onMouseDown={(e) => {
        // Não tira o foco do campo se ele já está em edição.
        e.preventDefault();
        if (podeEditar) {
          comPonteiro.current = true;
          campo.current?.focus();
        }
      }}
    >
      {variante === "personagem" ? (
        <span className="fl-fh fl-capitular-letra">{letra || "?"}</span>
      ) : (
        letra || "?"
      )}
    </div>
  ) : null;

  const entrada = (
    <input
      ref={campo}
      type="text"
      className={variante === "personagem" ? "fl-fh fl-in fl-ln fl-nome-campo" : "npc-nome-campo"}
      data-tamanho={
        variante === "monstro"
          ? base.length > 22
            ? "pequeno"
            : base.length > 14
              ? "medio"
              : undefined
          : undefined
      }
      data-testid="ficha-nome"
      // Fora de edição o campo mostra só o resto: o leitor de tela ainda lê o nome inteiro.
      aria-label={foco ? rotulo : `${rotulo}: ${nome}`}
      maxLength={LIMITE}
      value={valorDoCampo}
      disabled={!podeEditar}
      onFocus={(e) => {
        desistiu.current = false;
        // O campo passa a mostrar o nome inteiro. Troca o valor já, antes de qualquer seleção (a de quem digita por
        // cima, por exemplo), e leva o cursor para o fim; o estado só confirma o mesmo valor.
        const el = e.currentTarget;
        // Com o ponteiro (clique no campo ou na capitular) o cursor vai para o fim; pelo teclado (Tab) ou por código o
        // nome inteiro fica selecionado, como num campo de texto comum.
        el.value = nome;
        if (comPonteiro.current) el.setSelectionRange(nome.length, nome.length);
        else el.select();
        setTexto(nome);
        setFoco(true);
      }}
      onPointerDown={() => {
        comPonteiro.current = true;
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={sair}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape" && foco) {
          e.stopPropagation();
          desistiu.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );

  if (variante === "monstro") {
    return (
      <>
        {desenho}
        <div className="npc-estandarte-textos">
          <fieldset className="npc-nome" aria-label={rotulo} data-testid="ficha-nome-bloco">
            {entrada}
          </fieldset>
          {filhos}
        </div>
      </>
    );
  }
  return (
    <fieldset
      className={`fl-nome ${pequeno ? "pequeno" : ""}`}
      aria-label={rotulo}
      data-testid="ficha-nome-bloco"
    >
      {desenho}
      <div className="fl-nome-resto">
        <span className="fl-lbl">{rotulo}</span>
        {entrada}
      </div>
    </fieldset>
  );
}
