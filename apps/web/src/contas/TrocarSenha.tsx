import { erroDaSenha, TAMANHO_MAXIMO_DA_SENHA } from "@tabletop/shared";
import { type FormEvent, useState } from "react";
import { trocarSenha } from "../api";
import { CampoDeConta } from "./CampoDeConta";

/** Preferências: trocar a própria senha (a atual, a nova e a confirmação). As outras sessões da conta caem. */
export function TrocarSenha({ mesaId, login }: { mesaId: string; login: string }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setFeito(false);
    const falta =
      erroDaSenha(nova) ?? (nova !== confirmar ? "A confirmação não é igual à nova senha." : null);
    if (falta) {
      setErro(falta);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await trocarSenha(mesaId, login, atual, nova);
      setAtual("");
      setNova("");
      setConfirmar("");
      setFeito(true);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="trocar-senha" onSubmit={aoEnviar} data-testid="trocar-senha">
      <h4 className="trocar-senha-titulo">Trocar a senha</h4>
      <p className="nota">Entrar em outro lugar com a senha antiga deixa de valer.</p>
      <CampoDeConta
        testid="senha-atual"
        rotulo="Senha atual"
        tipo="password"
        valor={atual}
        aoMudar={setAtual}
        autoComplete="current-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <CampoDeConta
        testid="senha-nova"
        rotulo="Nova senha (pelo menos 5 caracteres)"
        tipo="password"
        valor={nova}
        aoMudar={setNova}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <CampoDeConta
        testid="senha-confirmar"
        rotulo="Confirme a nova senha"
        tipo="password"
        valor={confirmar}
        aoMudar={setConfirmar}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      {erro && (
        <p className="nota erro" role="alert" data-testid="senha-erro">
          {erro}
        </p>
      )}
      {feito && (
        <p className="nota" role="status" data-testid="senha-trocada">
          Senha trocada. As outras sessões foram encerradas.
        </p>
      )}
      <div className="linha-botoes">
        <button type="submit" disabled={enviando} data-testid="senha-trocar">
          Trocar a senha
        </button>
      </div>
    </form>
  );
}
