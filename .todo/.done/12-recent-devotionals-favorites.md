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

## Consolidação dos PRs — 26/10/2026

- A pedido do Hil, o PR #15 passou a reunir também as tarefas 10 e 11 do PR #14. O plano do PR #13 está contido no #14; o registro comunitário do PR #11 já estava na `main` pelo PR #12.
- `gh pr list --state all`, `git fetch origin`, `git diff` dos PRs: sucesso; quatro PRs abertos e o #12 já integrado.
- `git merge --no-ff --no-commit origin/feat/devotional-share-images`: encontrou dois conflitos textuais em `.todo/README.md` e `packages/domain/react/convex.ts`; resolvidos preservando tarefas arquivadas, favoritos e imagens.
- `npm run typecheck`: passou nos quatro workspaces após a resolução.
- `npm run build:ready`: passou após a integração (lint, typecheck, build PWA e verificação do pacote público). As suítes de testes já tinham passado isoladamente nos PRs #14 e #15; não foram repetidas nesta consolidação.
- `git diff --check`, `git ls-files -u`: passaram; nenhum marcador ou entrada de conflito remanescente.
- `git commit -m 'chore(integration): consolidate devotional pull requests'`, `git push`: passaram; o PR #15 contém todos os commits do #14.
- `gh pr edit 15`: passou; título, escopo e ordem de release atualizados. GitHub indicou `CLEAN` e `MERGEABLE` para o PR #15.
- `gh pr close 14`, `gh pr close 13`, `gh pr close 11`: passaram. O #12 já tinha estado `MERGED`; resta somente o #15 aberto.
- O merge desta seção é entre branches locais; publicação e merge na `main` continuam pendentes do Hil.
