import { useEffect, useRef, useState } from "react";
import { apagarRascunho, chaveDoRascunho, gravarRascunho, lerRascunho } from "./rascunho";
import type { Ocorrencia } from "./useSala";

const ESPERA_DO_ENVIO_MS = 300;

type Props = {
  testid: string;
  rotulo: string;
  /** Nome do campo no rascunho e do tipo de evento que o atualiza. */
  campo: "mesa" | "mestre";
  usuarioId: string;
  /** Texto que a sala tem agora. */
  servidor: string;
  editavel: boolean;
  /** `true` depois de conectar e receber o snapshot. */
  pronto: boolean;
  enviar: (tipo: string, dados: object) => string | null;
  ouvir: (fn: (o: Ocorrencia) => void) => () => void;
};

/**
 * Campo de texto sem botão "salvar": envia depois de 300 ms parado e guarda o que ainda não foi
 * confirmado pela sala como rascunho no localStorage (sobrevive ao refresh).
 */
export function CampoNota(props: Props) {
  const { campo, usuarioId, servidor, editavel, pronto, enviar, ouvir } = props;
  const chave = chaveDoRascunho(usuarioId, campo);
  const tipoDaIntencao = campo === "mesa" ? "nota.editar" : "notaMestre.editar";
  const tipoDoEvento = campo === "mesa" ? "nota.alterada" : "notaMestre.alterada";

  const [rascunho, setRascunho] = useState<string | null>(() => lerRascunho(chave));
  const rascunhoAtual = useRef(rascunho);
  const ultimoEnvio = useRef<{ id: string; texto: string } | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const servidorAtual = useRef(servidor);
  servidorAtual.current = servidor;

  function definirRascunho(texto: string | null) {
    rascunhoAtual.current = texto;
    setRascunho(texto);
    if (texto === null) apagarRascunho(chave);
    else gravarRascunho(chave, texto);
  }

  function enviarAgora(texto: string) {
    const id = enviar(tipoDaIntencao, { texto });
    ultimoEnvio.current = id ? { id, texto } : null;
  }

  // Conectou (ou reconectou): reenvia o rascunho que sobrou, ou o descarta se já não vale.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só na transição de `pronto`
  useEffect(() => {
    if (!pronto) return;
    const texto = rascunhoAtual.current;
    if (texto === null) return;
    if (!editavel || texto === servidorAtual.current) definirRascunho(null);
    else enviarAgora(texto);
  }, [pronto]);

  // Perdeu a permissão: o rascunho não vale mais.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando `editavel` muda
  useEffect(() => {
    if (!editavel && rascunhoAtual.current !== null) definirRascunho(null);
  }, [editavel]);

  // A sala confirmou (ou recusou) o meu envio: o rascunho cumpriu o papel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ouvir` é estável
  useEffect(
    () =>
      ouvir((o) => {
        const envio = ultimoEnvio.current;
        if (!envio) return;
        const meu =
          o.tipo === "evento"
            ? o.evento.tipo === tipoDoEvento && o.evento.origem.idPedido === envio.id
            : o.idPedido === envio.id;
        if (!meu) return;
        ultimoEnvio.current = null;
        // Se digitei mais depois do envio, o rascunho novo continua valendo.
        if (o.tipo === "erro" || rascunhoAtual.current === envio.texto) definirRascunho(null);
      }),
    [ouvir, tipoDoEvento],
  );

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function aoDigitar(texto: string) {
    definirRascunho(texto);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => enviarAgora(texto), ESPERA_DO_ENVIO_MS);
  }

  const valor = editavel ? (rascunho ?? servidor) : servidor;
  return (
    <label className="campo-nota">
      <span>{props.rotulo}</span>
      <textarea
        data-testid={props.testid}
        value={valor}
        disabled={!editavel}
        rows={5}
        onChange={(e) => aoDigitar(e.target.value)}
      />
    </label>
  );
}
