# 05 — Carregamento da Comunidade em produção

Status: em andamento em 2026-10-22; publicação depende da decisão do Hil.

## Escopo e decisões

- Relato do Hil: a aba Comunidade não traz os dados.
- Usar o grafo local otimizado para localizar os fluxos envolvidos.
- Hil autorizou incluir sua alteração em `.graphifyignore` neste PR.
- Branch: `fix/community-data-loading`, criada da main atualizada.
- Requisitos já aprovados: [spec 015](../specs/015-comunidade-papeis-permissoes/spec.md)
  e [spec 016](../specs/016-notificacoes/spec.md). Sem novos requisitos de produto.

## Diagnóstico confirmado

O deployment `upbeat-jellyfish-720` é classificado como development pelo Convex,
mas atende a web publicada do piloto. A consulta remota de contratos mostrou
`communities:list` com argumentos `{}` e `communities:detail` apenas com `id` e
`cursor`. A web atual envia também `governance: true`, suportado pelo código
atual de `packages/backend/communities.ts`, mas ausente no deployment.

Na janela dos 80 registros mais recentes, logs de 22/10/2026 repetem:

```text
communities:list: ArgumentValidationError: Object contains extra field `governance` that is not in the validator.
communityGovernance:creation: Could not find public function.
communityGovernance:myJoinRequests: Could not find public function.
notifications:summary: Could not find public function.
```

Isso confirma a divergência entre web e backend. Não há evidência de perda dos
dados nem de lentidão como causa deste incidente. Remover `governance` do cliente
não entregaria a gestão aprovada e deixaria as demais funções ausentes.

## Plano e checklist

- [x] Consultar grafo, código e contratos remotos; identificar o erro nos logs.
- [x] Preservar a otimização de `.graphifyignore` autorizada pelo Hil.
- [ ] Validar a versão atual antes da publicação.
- [x] Documentar recuperação e verificação de contratos antes de futuros merges.
- [ ] Abrir PR com diagnóstico e otimização do grafo, sem merge automático.
- [ ] Publicar o backend mediante decisão explícita do Hil.
- [ ] Confirmar contratos remotos e carregamento autenticado da Comunidade.
- [ ] Encerrar e mover este registro para `.done/` somente após a recuperação.

## Comandos e resultados

- `git status --short --branch`: sucesso; apenas `.graphifyignore` alterado pelo Hil.
- `git pull --ff-only origin main`: sucesso, main já atualizada.
- `git switch -c fix/community-data-loading`: sucesso.
- `npm run graphify -- query 'community communities governance detail' --budget 1800`:
  sucesso; grafo local com 1.038 nós, usado sem regeneração.
- `convex logs --help` e `convex function-spec --help`, pelo CLI instalado:
  sucesso; confirmadas opções somente de leitura e seleção explícita de deployment.
- `convex function-spec --deployment upbeat-jellyfish-720`: sucesso; contratos
  antigos confirmados. Nenhum dado de usuário consultado.
- `convex logs --deployment upbeat-jellyfish-720 --history 80`: leitura bem-sucedida;
  stream encerrado intencionalmente após capturar as falhas (saída 1 por interrupção).
- `rg` com caminhos `specs/015*` e `specs/016*`: falhou porque o PowerShell não
  expande esses argumentos; documentação de rollout lida por caminhos explícitos.
- Nova leitura de `convex function-spec` filtrada localmente aos cinco contratos:
  confirmou os dois validadores antigos e as três funções ausentes.
- `$env:TURBO_FORCE = 'true'` e `npm run build:ready`: sucesso, sem cache; lint,
  typecheck, build e verificações de manifest/PWA/corpus concluídos.
- Primeira suíte `npm run test -- -- --maxWorkers=1`, concorrente com o build:
  falhou por timeout de 5s em `local/bible.test.ts` (rollback de importação).
  Testes de comunidades e notificações passaram. Nenhum limite ou teste alterado.
- Repetição `npm run test -- --concurrency=1 -- --maxWorkers=1`, com
  `TURBO_FORCE=true`: em execução, sem build concorrente.
- Verificação PowerShell dos links relativos nos quatro documentos alterados:
  sucesso. `git diff --check`: sucesso.
- `git add -- .graphifyignore docs/engineering/graphify.md` e
  `git commit -m 'chore(graphify): focus graph on application code'`: sucesso,
  commit `577e272`, preservando integralmente a alteração autorizada do Hil.

Nenhum deploy, backfill, merge ou mudança de regra de negócio executado.
