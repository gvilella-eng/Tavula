// Variável do Worker que não está no wrangler.jsonc: só o script `dev:e2e` a define (--var MODO:teste).
interface Env {
  MODO?: string;
}
