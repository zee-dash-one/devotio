# 12 — Devocionais recentes e favoritos

**Status:** concluída em 26/10/2026; publicação e homologação de produção pendentes do Hil.
**Branch:** `feat/recent-devotionals-favorites`.
**Origem:** pedido detalhado do Hil em 26/10/2026. Substitui a janela anterior de oito datas e os favoritos sem limite da spec 001.

## Escopo e decisões

- Reutilizar `ReadingPage`, `DevotionalPage`, `ReadingRepository` e os snapshots existentes. A cópia privada continua legível após retirada editorial, conforme a spec 001.
- Recentes mostra as sete publicações mais novas, incluindo hoje quando publicado. Ignora datas sem publicação e retiradas; seleciona hoje ou o mais recente disponível.
- `MAX_FAVORITE_DEVOTIONALS` no domínio define três como limite inicial. Convex e SQLite aplicam o limite na transação. Preservar o desfazer de uso único após remoção.
- O menu do perfil abre a mesma tela em Favoritos; navegação principal abre Recentes. Compartilhamento usa sempre a leitura selecionada.
- Backend aditivo sobe antes do merge da web. O agente não publica nem faz merge.

## Plano

1. Contrato limitado de publicações e favoritos privados, com índice usuário/data e recibo de restauração de uso único no Convex.
2. Mesmo contrato e limite no SQLite e cache local.
3. Entradas do perfil/navegação na mesma tela, rótulos/estado vazio e compartilhamento preservado.
4. Cobertura de domínio, backend, local e web; lint, typecheck e build.

## Registro de comandos

- `git status --short --branch`: branch limpa antes do trabalho.
- `git fetch origin main`, `git switch main`, `git pull --ff-only origin main`, `git switch -c feat/recent-devotionals-favorites`: sucesso; main `3f1c854`.
- `npm run graphify -- query 'recent devotional reading favorites profile navigation storage' --budget 1200`: sucesso como localizador; contratos confirmados no código.
- `npm run typecheck`: primeira execução falhou por narrowing do estado no modal; corrigido, repetição passou.
- `npm run test --workspace=domain -- --maxWorkers=1 --testTimeout=15000`: uma expectativa antiga de consulta na virada falhou; corrigida e `local.test.ts` passou (27 testes).
- `npm run test --workspace=backend -- --maxWorkers=1 --testTimeout=30000`: passou (81 testes), incluindo duas verificações Convex e a nova regra SQLite.
- `npm run test --workspace=web -- --maxWorkers=1 --testTimeout=15000`: primeira execução encontrou expectativa antiga de oito itens e instabilidade na rolagem bíblica; ambos passaram na repetição direcionada de `local-app.test.tsx` (44 testes).
- `npm run test --workspace=web -- local-app.test.tsx -t 'reinicia no devocional de hoje' --maxWorkers=1 --testTimeout=15000`: passou após corrigir a navegação na mesma rota.
- `npm run build:ready`: passou com lint, typecheck, build web/PWA e verificação do bundle público.
- `npm run test --workspace=domain -- --maxWorkers=1 --testTimeout=15000`: repetição completa passou (104 testes).
- `npm run test --workspace=web -- --maxWorkers=1 --testTimeout=15000`: repetição completa passou (75 testes).
- `git diff --check`: passou.
- `git push -u origin feat/recent-devotionals-favorites`: passou; quatro commits por escopo enviados.
- `gh pr create --repo zee-dash-one/devotio --base main --head feat/recent-devotionals-favorites`: passou; PR #15 aberto.

## Resultado e publicação

- Sete publicações recentes e favoritos privados implementados na mesma leitura para Convex e SQLite; limite de três aplicado na persistência.
- O novo schema do Convex é aditivo. Não há migração SQLite; a tabela local de favoritos existente é reutilizada.
- Publicar o backend do piloto (`npm run deploy:backend`, deployment `upbeat-jellyfish-720`) antes de fazer merge do PR, que publica a web pela main. Não executar `deploy:backend:prod` neste piloto.
- Validar em produção após a publicação: recentes com lacunas de data, favorito no limite, item antigo preservado, navegação pelo perfil e compartilhamento do selecionado.
- **PR:** https://github.com/zee-dash-one/devotio/pull/15
