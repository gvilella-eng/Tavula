import { NOME_DO_ARQUIVO_DA_CHAVE } from "@tabletop/shared";
import { useState } from "react";
import { registrarChaveDaPasta } from "../api";
import {
  conferirPastaLivreParaMesa,
  escolherPastaDoMestre,
  navegadorEscolhePasta,
  prepararChave,
  TEXTO_SO_CHROME_E_EDGE,
} from "./pastaDoMestre";

/**
 * A mesa legada acabou de ganhar a conta do mestre e o código foi anotado: oferece, na hora, "Proteger com a pasta
 * da mesa" (a chave que também recupera o acesso). A senha acabou de ser digitada na tela anterior, então não se
 * pergunta de novo. "Agora não" entra na mesa; a proteção continua em Mesa, Contas.
 */
export function OfertaDePasta({
  mesaId,
  mesaNome,
  login,
  senha,
  aoSeguir,
}: {
  mesaId: string;
  mesaNome: string;
  login: string;
  senha: string;
  aoSeguir: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const podePasta = navegadorEscolhePasta();

  async function proteger() {
    if (ocupado) return;
    setErro(null);
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
      aoSeguir();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="entrada-form entrada-cartao destaque" data-testid="oferta-de-pasta">
      <h2 className="entrada-subtitulo">Proteger com a pasta da mesa?</h2>
      <p className="nota">
        Escolha uma pasta neste computador para guardar a chave do mestre (
        {NOME_DO_ARQUIVO_DA_CHAVE}). Com ela você recupera o acesso se esquecer a senha. Não
        compartilhe esse arquivo.
      </p>
      {!podePasta && (
        <p className="nota" data-testid="oferta-sem-pasta">
          {TEXTO_SO_CHROME_E_EDGE}
        </p>
      )}
      {erro && (
        <p className="nota erro" role="alert" data-testid="oferta-erro">
          {erro}
        </p>
      )}
      <div className="linha-botoes">
        <button
          type="button"
          className="primario"
          disabled={ocupado || !podePasta}
          data-testid="oferta-proteger"
          onClick={proteger}
        >
          Proteger com a pasta da mesa
        </button>
        <button type="button" disabled={ocupado} data-testid="oferta-agora-nao" onClick={aoSeguir}>
          Agora não
        </button>
      </div>
    </div>
  );
}
