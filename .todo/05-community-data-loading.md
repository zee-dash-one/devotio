# 05 — Carregamento da Comunidade em produção

Status: em andamento; backend atualizado em 2026-10-23, confirmação autenticada da tela em produção pendente.

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
- [x] Validar a versão atual antes da publicação.
- [x] Documentar recuperação e verificação de contratos antes de futuros merges.
- [x] Abrir PR com diagnóstico e otimização do grafo, sem merge automático.
- [x] Publicar o backend mediante decisão explícita do Hil (2026-10-23).
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
  `TURBO_FORCE=true`: sucesso, sem build concorrente; 234 testes passaram
  (98 domínio, 76 backend, 60 web). O teste que excedera o tempo passou sem mudanças.
- Verificação PowerShell dos links relativos nos quatro documentos alterados:
  sucesso. `git diff --check`: sucesso.
- `git add -- .graphifyignore docs/engineering/graphify.md` e
  `git commit -m 'chore(graphify): focus graph on application code'`: sucesso,
  commit `577e272`, preservando integralmente a alteração autorizada do Hil.
- `git add` do índice, tarefa e roteiro; `git commit -m 'docs(operations): diagnose community backend version mismatch'`:
  sucesso, `d74d86c`.
- `git push -u origin fix/community-data-loading`: sucesso; main não alterada.
- Primeira tentativa de `gh pr create --body-file`: falhou porque o TEMP do
  sandbox difere do TEMP da sessão elevada. Corpo recriado no TEMP correto;
  repetição bem-sucedida, PR aberto e anexado ao chat.

PR: https://github.com/zee-dash-one/devotio/pull/10

## Resultado desta preparação

Diagnóstico, validações locais e PR preparados. A correção do contrato está no
código existente; falta publicá-lo no piloto e confirmar a tela com sessão real.
O registro permanece aberto por essa razão. A migração de posse é uma operação
separada, conforme o roteiro de lançamento aprovado anteriormente.

Nenhum deploy, backfill, merge ou mudança de regra de negócio executado.

## Verificação após nova publicação — 2026-10-23

Hil informou nova versão em produção com comunidades ainda quebrando e pediu
iniciar o desenvolvimento para teste local antes de continuar a análise.

- `git status --short --branch`: sucesso; árvore limpa na branch anterior.
- `git fetch origin`: sucesso; main remota em `90d53fc`, integração do PR #10.
- `git log HEAD..origin/main` e `git diff --stat HEAD...origin/main`: sucesso;
  a integração acrescenta somente documentação e exclusões do Graphify, sem
  alterar código de comunidades ou publicar funções Convex.
- `git switch main` e `git pull --ff-only origin main`: sucesso; checkout atualizado.
- `npm run dev`: sucesso; Vite em `http://127.0.0.1:3000/`, mantido em execução.
- HTTP local: raiz e entrada da aplicação responderam 200. A entrada servida
  aponta para `upbeat-jellyfish-720.convex.cloud`: é web em desenvolvimento
  com login real e dados do piloto, não o ambiente simulado SQLite.
- `convex function-spec --deployment upbeat-jellyfish-720`, filtrado aos cinco
  contratos do incidente: sucesso; `list` ainda aceita `{}`, `detail` apenas
  `id`/`cursor`; as três queries de gestão/notificações continuam ausentes.
- `convex logs --deployment upbeat-jellyfish-720 --history 60`: leitura bem-sucedida;
  eventos de 23/10 repetem o campo `governance` rejeitado e funções ausentes.
  Stream encerrado intencionalmente após o diagnóstico; servidor web mantido.
- `git switch -c docs/community-runtime-followup`: sucesso; registro desta
  verificação em branch própria a partir da main atualizada.

Conclusão: a incompatibilidade remota anterior permanece no backend que a web
local usa. Uma nova publicação da web não atualiza esse backend. Não houve nova
alteração de código de produto que justifique repetir os 234 testes anteriores;
esta revisão verifica Git, HTTP local, contratos e logs remotos.

Publicação do backend e migração de posse continuam pendentes de decisão do Hil.

`git diff --check`, commit documental `17e0ad0`, envio da branch e abertura do
PR: sucesso. Registro desta verificação:
https://github.com/zee-dash-one/devotio/pull/11 (anexado ao chat).

### Correção da inicialização local solicitada pelo Hil

Hil esclareceu que queria login e dados mockados. A primeira inicialização
herdara a configuração Convex; foi encerrada e substituída pelo Vite com as duas
URLs vazias somente no processo, preservando os arquivos de ambiente.

Comando usado na raiz (após preparar o corpus, já disponível):

```powershell
node --input-type=module -e "process.env.VITE_CONVEX_URL = ''; process.env.VITE_CONVEX_SITE_URL = ''; process.chdir('apps/web'); const { createServer } = await import('vite'); const server = await createServer(); await server.listen(); server.printUrls();"
```

- Servidor reiniciado com sucesso em `http://127.0.0.1:3000/`, agora com SQLite
  e quatro perfis fictícios. As duas URLs Convex servidas ao cliente estão vazias.
- Uma verificação Node inline falhou por escape de regex no PowerShell; repetida
  por here-string. A consulta autenticada dessa tentativa recebeu 401 porque
  omitiu o cabeçalho obrigatório `X-Devotio-Profile`; não era erro da aplicação.
- `npm run verify:local`: sucesso; roteiro existente confirmou login mockado,
  oito datas, 66 livros AA, leitura, busca, comunidades, bloqueio de escrita sem
  permissão e proteção do SQLite. Sessão temporária de verificação encerrada.
- Nenhum código de produto ou configuração persistente foi alterado. O servidor
  mockado permanece ativo para teste do Hil; esta inicialização substitui a
  inicialização conectada descrita acima.

## Atualização dos bancos autorizada — 2026-10-23

Hil solicitou explicitamente atualizar o banco local e o Convex. Essa solicitação
autoriza a publicação do backend do piloto e o preenchimento de responsáveis
previsto na spec 015; preservação de dados e validação continuam obrigatórias.

- SQLite verificado em leitura: marcadores `governance-v1=1` e
  `notifications-v2=1`; quatro usuários, duas comunidades, três participações,
  uma mensagem, zero pedidos e zero notificações. Nenhuma comunidade sem owner;
  `PRAGMA integrity_check` retornou `ok`. Migrações já aplicadas pelo servidor.
- Contagens Convex antes da atualização: quatro usuários, duas comunidades,
  oito participações e zero mensagens; duas comunidades sem owner.
- Primeira consulta inline Convex falhou por aspas removidas ao passar argumento
  pelo PowerShell. Repetição via `spawnSync` do Node preservou o código e passou.
- `convex dev --help` e `convex run --help`: sucesso; opções de seleção e
  argumentos confirmadas no CLI instalado, sem atualização de dependências.
- Arquivo temporário de seleção criado fora do repo, contendo somente
  `CONVEX_DEPLOYMENT=dev:upbeat-jellyfish-720`, sem credenciais.
- `npm run deploy:backend -- --env-file <TEMP>/devotio-pilot-deployment.txt`:
  sucesso, com typecheck habilitado; CLI confirmou explicitamente
  `upbeat-jellyfish-720` no projeto `adm-zone:devotio-pilot`, o deployment de
  desenvolvimento usado pelo piloto. Nove índices adicionados; funções prontas.
- `convex run --deployment upbeat-jellyfish-720 communities:backfillOwners`,
  com `{"cursor":null}` transmitido via Node: sucesso. Os dois grupos receberam
  responsável conforme a regra aprovada do admin ativo mais antigo.
- Consulta somente de leitura após migração: quatro usuários, duas comunidades,
  oito participações, zero mensagens, zero pedidos e zero notificações. Totais
  anteriores preservados; zero comunidades sem owner ou com owner inconsistente.
- `convex function-spec --deployment upbeat-jellyfish-720`: sucesso; as cinco
  queries esperadas existem e `governance` é opcional em list/detail.
- `npm run verify:local`: sucesso novamente após a publicação remota; o servidor
  local continua com login simulado e SQLite. `git status` confirmou que o deploy
  não alterou código versionado ou a configuração persistente do repositório.

A publicação e a migração autorizadas estão concluídas. O teste autenticado da
tela em produção deve ser confirmado pelo Hil após recarregar a aplicação; a
tarefa permanece aberta somente por essa homologação. Não houve merge ou
publicação da web pelo agente.
