import { corDoTextoSobre } from "./contrasteDeCor";
import type { ImagensDoMapa } from "./mapa/mapaPixi";
import { useImagem } from "./useImagem";

type Props = {
  imagens: ImagensDoMapa | null;
  versao: number;
  hash: string | undefined;
  nome: string;
  cor: string;
  redondo?: boolean;
  className?: string;
};

export function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length >= 2)
    return `${palavras[0]?.[0] ?? ""}${palavras[1]?.[0] ?? ""}`.toUpperCase();
  return (palavras[0] ?? "?").slice(0, 2).toUpperCase();
}

/** Imagem do cache local (retrato ou token) ou, enquanto não há, as iniciais sobre a cor. */
export function Avatar({ imagens, versao, hash, nome, cor, redondo, className }: Props) {
  const url = useImagem(imagens, hash, versao);
  return (
    <span
      className={`avatar-item ${redondo ? "redondo" : ""} ${className ?? ""}`}
      style={{ background: cor, color: corDoTextoSobre(cor) }}
      data-com-imagem={url !== null}
    >
      {url ? <img src={url} alt="" /> : <span aria-hidden="true">{iniciais(nome)}</span>}
    </span>
  );
}
