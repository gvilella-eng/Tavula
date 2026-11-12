// Variáveis do Worker que não estão no wrangler.jsonc: só os scripts `dev` e `dev:e2e` as definem (--var).
interface Env {
  /** `teste`: liga as rotas /teste/* e o id fixo da mesa legada (só o `dev:e2e`). */
  MODO?: string;
  /** `1`: `GET /api/mesas` lista as mesas (dev e E2E). Na internet fica desligada. */
  LISTAR_MESAS?: string;
}
