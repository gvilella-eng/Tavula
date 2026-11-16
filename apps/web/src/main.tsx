import "@fontsource-variable/caveat/wght.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/lora/wght.css";
import "@fontsource-variable/space-grotesk";
import "@fontsource/alegreya/latin-400.css";
import "@fontsource/alegreya/latin-400-italic.css";
import "@fontsource/alegreya/latin-500.css";
import "@fontsource/alegreya/latin-700.css";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/cormorant-sc/latin-600.css";
import "@fontsource/cormorant-sc/latin-700.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-500.css";
import "@fontsource/eb-garamond/latin-600.css";
import "@fontsource/im-fell-english-sc/latin-400.css";
import "@fontsource/medievalsharp/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./ficha/ficha.css";
import "./rolagem/rolagem.css";
import { aplicarTema, lerTema } from "./tema/temas";

// O tema vale desde antes da primeira renderização (preferência deste navegador).
aplicarTema(lerTema());

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Elemento #raiz não encontrado");

/**
 * Espera as duas fontes (empacotadas, locais) antes de desenhar a interface: sem isso o texto troca de
 * fonte no meio do uso e a tela "pula" (botões mudam de lugar entre o olhar e o clique). Com teto de 1,5 s
 * para nunca travar a abertura.
 */
async function fontesProntas(): Promise<void> {
  try {
    const carregar = Promise.all([
      document.fonts.load('400 14px "Inter Variable"'),
      document.fonts.load('700 14px "Inter Variable"'),
      document.fonts.load('700 14px "Space Grotesk Variable"'),
    ]);
    await Promise.race([carregar, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    // segue com a fonte de reserva
  }
}

void fontesProntas().then(() => {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
