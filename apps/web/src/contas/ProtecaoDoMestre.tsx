import { NOME_DO_ARQUIVO_DA_CHAVE, TAMANHO_MAXIMO_DA_SENHA } from "@tabletop/shared";
import { useState } from "react";
import { gerarNovoCodigo, registrarChaveDaPasta } from "../api";
import { CampoDeConta } from "./CampoDeConta";
import { CodigoDeRecuperacao } from "./CodigoDeRecuperacao";
import {
  conferirPastaLivreParaMesa,
  escolherPastaDoMestre,
  navegadorEscolhePasta,
  prepararChave,
  TEXTO_SO_CHROME_E_EDGE,
} from "./pastaDoMestre";

/**
 * Proteção da conta do mestre (C3), na seção Contas da aba Mesa: a chave da pasta da mesa ("Proteger com a pasta
 * da mesa" ou "Trocar a chave da pasta") e o código de recuperação ("Gerar novo código"). As duas ações pedem a
 * senha atual. A chave privada só vai para o arquivo da pasta; o servidor recebe a pública.
 */
export function ProtecaoDoMestre({
  mesaId,
  mesaNome,
  login,
  temChave,
  temCodigo,
  aoMudar,
}: {
  mesaId: string;
  mesaNome: string;
  login: string;
  temChave: boolean;
  temCodigo: boolean;
  aoMudar: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [anotado, setAnotado] = useState(false);
  const podePasta = navegadorEscolhePasta();

  function conferirSenha(): boolean {
    if (senha === "") {
      setErro("Escreva a sua senha atual para confirmar.");
      return false;
    }
    return true;
  }

  /** Escolher a pasta precisa de um clique: o seletor abre logo, depois a senha vai ao servidor. */
  async function protegerComAPasta() {
    setErro(null);
    setAviso(null);
    if (!conferirSenha() || ocupado) return;
    setOcupado(true);
    try {
      const pasta = await escolherPastaDoMestre();
      if (!pasta) return;
      await conferirPastaLivreParaMesa(pasta, mesaId);
      const chave = await prepararChave(pasta, { id: mesaId, nome: mesaNome });
      // O servidor aceita primeiro (confere a senha); só então a privada vai para a pasta.
      await registrarChaveDaPasta(mesaId, login, senha, chave.publica);
      await chave.gravar();
      await pasta.lembrarPara(mesaId).catch(() => {});
      setSenha("");
      setAviso(
        `Chave gravada em ${NOME_DO_ARQUIVO_DA_CHAVE}, na pasta ${pasta.nome}. Não compartilhe esse arquivo.`,
      );
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function novoCodigo() {
    setErro(null);
    setAviso(null);
    if (!conferirSenha() || ocupado) return;
    setOcupado(true);
    try {
      const novo = await gerarNovoCodigo(mesaId, login, senha);
      setSenha("");
      setAnotado(false);
      setCodigo(novo);
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="protecao-do-mestre" data-testid="protecao-do-mestre">
      <h4 className="contas-subtitulo">Proteção do mestre</h4>
      <p className="nota">
        Se você esquecer a senha, recupera o acesso pela pasta da mesa (a chave) ou pelo código de
        recuperação.
      </p>
      <ul className="lista-simples nota">
        <li data-testid="protecao-chave-estado">
          Pasta com chave: {temChave ? "protegida" : "ainda sem chave"}
        </li>
        <li data-testid="protecao-codigo-estado">
          Código de recuperação: {temCodigo ? "gerado" : "ainda sem código"}
        </li>
      </ul>
      {codigo ? (
        <>
          <CodigoDeRecuperacao
            codigo={codigo}
            mesaNome={mesaNome}
            anotado={anotado}
            aoMudarAnotei={setAnotado}
          />
          <p className="nota">O código anterior deixou de valer.</p>
          <div className="linha-botoes">
            <button
              type="button"
              className="primario"
              disabled={!anotado}
              data-testid="protecao-codigo-fechar"
              onClick={() => setCodigo(null)}
            >
              Fechar
            </button>
          </div>
        </>
      ) : (
        <>
          <CampoDeConta
            testid="protecao-senha"
            rotulo="Sua senha atual (para confirmar)"
            tipo="password"
            valor={senha}
            aoMudar={setSenha}
            autoComplete="current-password"
            maxLength={TAMANHO_MAXIMO_DA_SENHA}
          />
          {!podePasta && (
            <p className="nota" data-testid="protecao-sem-pasta">
              {TEXTO_SO_CHROME_E_EDGE}
            </p>
          )}
          <div className="linha-botoes">
            <button
              type="button"
              disabled={ocupado || !podePasta}
              data-testid="protecao-pasta"
              onClick={protegerComAPasta}
            >
              {temChave ? "Trocar a chave da pasta" : "Proteger com a pasta da mesa"}
            </button>
            <button
              type="button"
              disabled={ocupado}
              data-testid="protecao-novo-codigo"
              onClick={novoCodigo}
            >
              Gerar novo código
            </button>
          </div>
          {temChave && (
            <p className="nota">
              Trocar a chave invalida a anterior: o arquivo antigo deixa de servir.
            </p>
          )}
        </>
      )}
      {erro && (
        <p className="nota erro" role="alert" data-testid="protecao-erro">
          {erro}
        </p>
      )}
      <div role="status">
        {aviso && (
          <p className="nota" data-testid="protecao-aviso">
            {aviso}
          </p>
        )}
      </div>
    </section>
  );
}
