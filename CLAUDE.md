# Távola: instruções para agentes

Antes de trabalhar, leia `PROJETO.md` (seção 9) e `docs/explicacao/12-testes-e-fluxo-de-trabalho.md`. As regras moram
lá; este arquivo só aponta e guarda o essencial. Respostas e docs em português, frases curtas, suposições marcadas
"(assumido)".

## Branches

- `main`: só releases. Anda por `merge --no-ff` do `develop` mais uma tag `vX.Y.Z`.
- `develop`: onde o desenvolvimento se junta. Ninguém commita direto nele.
- Todo trabalho sai do `develop` num branch `<tipo>-<breve-descricao>` (`feature-`, `fix-`, `docs-`, `chore-`), num
  worktree em `.claude/worktrees/<nome>`, e volta por `merge --no-ff` depois de implementado e validado.
- Push para o GitHub só com pedido do usuário.

## O que não pode falhar

- A pasta principal roda o `pnpm dev` do Vilella (portas 8787/5173, a campanha real): não rode nada nela e nunca encerre
  processo que você não iniciou. Testes usam 8788/5174.
- Migração SQL sempre nova no fim de `MIGRACOES` (`apps/server/src/armazenamento.ts`), aditiva e idempotente.
- O repositório é público: nada pessoal entra no git; fichas e campanha de referência ficam em `privado/`.
- Commit com `git commit -F <arquivo>` (o PowerShell 5.1 quebra o `-m` com aspas).
