# 03 - Notificações no sino (amigos, comunidades, publicações)

**Status:** concluída em 2026-10-21 — implementação verificada e PR aberto; publicação/homologação pendentes do Hil.
Depende de [01](./01-estrutura-agentes.md), concluída. Os avisos
"aceito numa comunidade" dependem do pedido de entrada da [02](./02-comunidades-permissoes-papeis.md), implementada no PR #7;
os demais podem começar antes.
**Branch sugerida:** `feat/notifications`.

## Objetivo

Sino com contador de não lidas e lista de notificações **na versão publicada**
(Convex), com quatro tipos: texto recebido de amigo, aceite numa comunidade,
remoção de uma comunidade e nova publicação numa comunidade. Notificação de
texto bíblico abre a Bíblia no endereço (versão, livro, capítulo, versículo);
recado de comunidade abre a comunidade na mensagem.

## Leia antes

[AGENTS.md](../../AGENTS.md), [.todo/README.md](../README.md),
[.docs/arquitetura.md](../../.docs/arquitetura.md),
[specs/008](../../specs/008-selecao-compartilhamento-notificacoes/spec.md) (§ Centro de notificações),
[specs/014](../../specs/014-amigos-compartilhamento/spec.md),
`packages/backend/_generated/ai/guidelines.md`.

## O que existe hoje (levantado no código em 21/10/2026)

- **UI pronta, só no modo local.** `apps/web/src/notifications.tsx` tem
  `NotificationsBell` (ícone `Bell`, badge com `unread`, modal com lista
  paginada, botão "Lida" por item, "Ver anteriores", "Atualizar avisos").
  `reader-shell.tsx` só mostra o sino se `repository.notifications` existir.
- **Contrato** em `packages/domain/sharing.ts`: `NotificationsRepository`
  (`watchSummary`, `watchPage(cursor)`, `markRead(id)`, `refresh`) e
  `AppNotification { type: "system" | "community", entity, text, communityId,
  messageId, createdAt, readAt }`.
- **Só o SQLite local implementa** (`database.local.ts`: tabela `notifications`
  com `sourceKey` único, aviso de mensagem no mural para os outros membros,
  aviso de boas-vindas; `http.local.ts` empurra mudanças por SSE).
- **Convex não tem nada:** sem tabela, sem funções, e `createConvexRepository`
  (`packages/domain/react/convex.ts`) não expõe `notifications`. Resultado: em
  produção **o sino não aparece**.
- Textos de amigos = recados bíblicos de `social.send` (`scriptureShares` +
  `shareViews` com `direction: "received"`). A citação guarda `version`, `book`,
  `chapter`, `first`, `last`.
- A Bíblia já abre num versículo: rota `/biblia?book=&chapter=&verse=&version=`
  (`bibleParamsSchema`), com rolagem até `verse-<cap>-<vers>` (`pages/bible.tsx`);
  `bibleQuotePath()` em `domain/sharing.ts` monta esse link.
- A comunidade já abre numa mensagem: `/comunidade/$communityId?message=<id>`.
- Só admin publica no mural (`communities.send`). Remoção hoje acontece em
  `communities.removeMember` e no painel (`administration.setCommunity` com `none`).
- Decisão já registrada na spec 008 (item 23): marcar como lida **só** pelo botão
  "Lida"; abrir o sino ou navegar pelo item **não** zera o contador. Sem push,
  som ou animação (item 18). Ver D1 e D6.

## Mini-spec

- **Escopo:** notificações persistidas no Convex para os 4 tipos; contador e
  lista em tempo real por subscription Convex (sem polling); navegação para a
  Bíblia/comunidade; paridade no SQLite local.
- **Fora do escopo:** push do navegador/PWA, e-mail, som (ver D6), app mobile.
- **Riscos:** comunidade grande gerando muitas linhas por publicação (fan-out em
  lotes pelo scheduler); vazamento de conteúdo para quem saiu da comunidade
  (filtrar na leitura); contador caro (limitar a contagem).

## Proposta técnica

### Domínio (`packages/domain`)

1. `sharing.ts`: ampliar o tipo, mantendo compatibilidade com os dados locais:

   ```ts
   type NotificationKind =
     | "friendShare"        // recado bíblico recebido de amigo
     | "communityAccepted"  // pedido de entrada aprovado (tarefa 02)
     | "communityRemoved"   // removido da comunidade
     | "communityPost"      // nova publicação no mural
     | "system";            // avisos do Devotio (já existe no local)
   interface AppNotification {
     id: string; kind: NotificationKind;
     actorName: string | null; communityId: string | null; communityName: string | null;
     messageId: string | null; shareId: string | null;
     target: { version: BibleVersion; book: string; chapter: number; verse: number } | null;
     text: string; createdAt: number; readAt: number | null;
   }
   ```

   Mapear o antigo `type: "community"` para `communityPost`.
2. Função pura `notificationTarget(item)` → `{ to: "/biblia", search }` para
   `friendShare` (e qualquer item com `target`), `{ to: "/comunidade/$communityId",
   params, search: { message } }` para `communityPost`, comunidade para
   `communityAccepted`, `/comunidade` (lista) para `communityRemoved`. Com teste.
3. `notificationSummarySchema`: `{ unread: number, capped: boolean }` (badge "99+").

### Schema Convex (aditivo)

```ts
notifications: defineTable({
  userId: v.id("users"),
  kind: v.union(v.literal("friendShare"), v.literal("communityAccepted"),
    v.literal("communityRemoved"), v.literal("communityPost"), v.literal("system")),
  actorName: v.optional(v.string()),          // snapshot (nome de quem enviou/publicou)
  communityId: v.optional(v.id("communities")),
  communityName: v.optional(v.string()),      // snapshot: aviso de remoção continua legível
  messageId: v.optional(v.id("communityMessages")),
  shareId: v.optional(v.id("scriptureShares")),
  target: v.optional(v.object({ version: scriptureSelectionValidator.fields.version,
    book: v.string(), chapter: v.number(), verse: v.number() })),
  text: v.string(),
  readAt: v.union(v.number(), v.null()),
  sourceKey: v.string(),                      // idempotency, ex. "share:<shareId>:<userId>"
})
  .index("by_userId", ["userId"])
  .index("by_userId_and_readAt", ["userId", "readAt"])
  .index("by_sourceKey", ["sourceKey"])
```

Ordem da lista: `by_userId` + `.order("desc")` (usa `_creationTime`). Recado do
amigo **não** é copiado: a notificação guarda só o `shareId`; o texto é lido de
`scriptureShares` validando que o usuário é destinatário.

### Funções Convex (novo `packages/backend/notifications.ts`, `git add -f`)

| Função | Tipo | O que faz |
|---|---|---|
| `notifications.summary` | query | `findUser`; conta `by_userId_and_readAt` com `readAt = null` usando `.take(100)` → `{ unread, capped }` |
| `notifications.page({ cursor })` | query | `findUser`; pagina 30 por `by_userId` desc; esconde `communityPost` de comunidade em que o usuário não é mais membro; devolve só dados do próprio usuário |
| `notifications.markRead({ id })` | mutation | confere `userId` do item = usuário; grava `readAt` uma vez |
| `notifications.markAllRead()` | mutation | só se D1 pedir; em lotes |
| `notifications.fanOutPost` | internalMutation | recebe `communityId, messageId, cursor`; insere `communityPost` para cada membro ativo exceto o autor, 100 por lote; reagenda com `ctx.scheduler.runAfter(0, ...)` |
| helper `notify(ctx, row)` | interno | insere se `sourceKey` ainda não existe |

Produtores (no mesmo arquivo de cada ação, dentro da mesma transação):
- `social.send` → `friendShare` para cada destinatário (`target` = primeiro
  versículo da citação, `shareId`, `actorName` = remetente). Repetir o mesmo
  `requestId` não duplica (já é idempotente + `sourceKey`).
- `communities.send` → agenda `fanOutPost` (não notifica o autor).
- `communities.decideJoinRequest` (tarefa 02, aprovação) → `communityAccepted`.
- `communities.removeMember` e `administration.setCommunity(role: "none")` →
  `communityRemoved` com `communityName` gravado (o removido não pode mais abrir
  a comunidade).

### Backend local (SQLite)

Migrar a tabela `notifications` (CHECK de `type` hoje só aceita `system` e
`community`): nova coluna `kind`, `shareId`, `target` (JSON), `communityName`;
migração versionada em `metadata`, sem perder dados de dev. Produzir os mesmos
quatro tipos. SSE continua só no modo local.

### Web

- `domain/react/convex.ts`: adicionar `notifications` ao `createConvexRepository`
  usando `client.watchQuery` (tempo real, sem polling). `refresh()` pode só
  reassinar.
- `apps/web/src/notifications.tsx`: texto por tipo, por exemplo
  **Ana** te enviou João 3:16 · **Comunidade X** aceitou você · Você saiu de
  **Comunidade X** · Nova publicação em **Comunidade X**; link via
  `notificationTarget`; comportamento de leitura conforme D1; badge "99+".
- Recado de amigo: ao abrir na Bíblia, opcionalmente abrir o detalhe do recado
  junto ao versículo (o leitor já mostra os ícones de enviado/recebido).

## Verificação (escrever os testes antes do código)

| Parte | Prova |
|---|---|
| Domínio | `notificationTarget` para os 4 tipos; mapeamento `community` → `communityPost` |
| Recado | `convex-test`: `social.send` para 2 amigos → 2 notificações com `target` certo; reenvio idempotente não duplica; remetente não recebe |
| Mural | publicar notifica todos os membros ativos menos o autor; comunidade com 250 membros conclui em lotes |
| Aceite/remoção | aprovar pedido gera `communityAccepted`; remover gera `communityRemoved` com nome; o removido não vê mais `communityPost` daquela comunidade |
| Isolamento | usuário B não lê nem marca notificação de A; conta pendente/desativada não lê nada |
| Contador | `summary` reflete leitura; cap em 100 |
| Local | mesmos cenários em `packages/backend/local/*.test.ts` |
| Web | clique em `friendShare` navega para `/biblia?book&chapter&verse&version`; `communityPost` para `/comunidade/<id>?message=<id>`; badge some com 0 |
| Tudo | `npm run build:ready` passa |

## Passos (depois das respostas do Hil)

1. Registrar as respostas em "Decisões do Hil" e criar
   `specs/016-notificacoes/spec.md` só com requisitos e decisões (revisão da
   spec 008); linha 016 em `specs/README.md`.
2. Branch, a partir da `main` atualizada:

   ```powershell
   git switch main
   git pull --ff-only origin main
   git switch -c feat/notifications
   ```

3. Domínio + testes → `feat(domain): add notification kinds and targets`.
4. Schema, `notifications.ts`, produtores em `social.ts`/`communities.ts`/
   `administration.ts` + testes → `feat(backend): persist notifications in convex`.
5. SQLite local + testes → `feat(local): mirror notification kinds`.
6. Adaptador Convex + UI → `feat(web): enable notification bell for connected app`.
7. Docs (`docs/architecture.md § Modelo de Dados`, spec 016, `.docs/regras.md`)
   → `docs: document notifications`.
8. Validar, enviar e abrir o PR:

   ```powershell
   npm run lint
   npm run typecheck
   npm run test
   npm run build:ready
   git push -u origin feat/notifications
   gh pr create --base main --head feat/notifications --title 'feat: notifications for friends and communities' --body-file $env:TEMP\pr-body.md
   ```

   No corpo: `- [ ] Backend: run npm run deploy:backend before merging`.
9. Parar. Deploy do backend e merge são do Hil.

## Aceite

- Na versão conectada o sino aparece, com contador de não lidas em tempo real.
- Os 4 tipos são gerados no servidor, sem duplicar e sem notificar o autor.
- Recado de amigo abre a Bíblia na versão/livro/capítulo/versículo do trecho;
  publicação abre a comunidade na mensagem.
- Ninguém vê notificação de outra conta; quem saiu da comunidade não vê mais
  as publicações dela.
- Modo local continua funcionando; testes novos passam; PR aberto.

## Dúvidas abertas para o Hil

Não decidir sem resposta. Sugestões entre parênteses só para facilitar.

1. **D1 — Quando o contador zera?** Hoje (spec 008, item 23, decisão sua em
   07/10) só pelo botão "Lida" de cada item. Mantém, ou: (a) zera ao abrir a
   lista, (b) marca como lido ao clicar no item, (c) adiciona "Marcar todas
   como lidas"?
2. **D2 — Publicação no mural:** notifica todos os membros sempre? O autor não
   recebe, certo? Membros que entraram depois recebem as publicações antigas (a
   spec 008 diz que não)?
3. **D3 — Remoção:** quem sai por conta própria também recebe aviso, ou só quem é
   removido por owner/admin/painel? O aviso diz quem removeu?
4. **D4 — Outros eventos:** notificar também pedido de amizade recebido/aceito,
    pedido de entrada pendente para owner/admin (tarefa 02), recusa do pedido,
   virar admin/owner, permissão de criar comunidade concedida? O aviso de
   sistema "Você tem direito a criar uma comunidade" continua (só para quem tem
   a permissão)?
5. **D5 — Recado de amigo:** a notificação mostra o recado e o trecho, ou só "Ana
   te enviou João 3:16"? Se a amizade for desfeita, a notificação continua?
6. **D6 — Push do PWA:** notificação fora do app (Web Push, celular bloqueado)
   entra agora? Hoje a spec 008 proíbe push, som e animação.
7. **D7 — Retenção:** apagar notificações lidas depois de X dias (sugestão: 90)?
   Limite de itens por pessoa? O usuário pode apagar uma notificação?
8. **D8 — Comunidade apagada ou sem acesso:** some a notificação, ou ela fica sem
   link?
9. **D9 — Tempo real:** a lista atualiza sozinha via subscription do Convex
   (proposto, sem polling). Ok manter o botão "Atualizar avisos" só no modo local?
10. **D10 — Agrupar:** várias publicações seguidas da mesma comunidade viram uma
    só ("3 novas publicações em X") ou uma por publicação?

## Decisões do Hil

Em 2026-10-21, Hil respondeu "Adotar essas decisões na tarefa 03" no chat:

- D1: leitura exclusivamente pelo botão Lida de cada aviso.
- D2: avisar membros atuais, exceto autor; sem histórico para novos membros.
- D3: apenas remoção forçada gera aviso; não identificar quem removeu.
- D4: apenas os quatro eventos definidos; retirar aviso fixo de criação.
- D5: mostrar remetente/referência; manter histórico após desfazer amizade.
- D6: sem push, som ou animação.
- D7: sem exclusão automática ou manual nesta etapa.
- D8: ocultar publicações sem acesso; outros avisos sem destino ficam sem link.
- D9: subscriptions Convex; botão Atualizar avisos exclusivo do modo local.
- D10: uma notificação por publicação.

## Resultado

- `git switch main`, `git pull --ff-only origin main`, `git switch -c feat/notifications`:
  sucesso, main limpa e atualizada. `git rebase feat/community-roles`: sucesso;
  avançou a branch nova, ainda sem commits próprios, até a dependência PR #7,
  preservando as branches anteriores e main.
- Leitura da tarefa, specs 008/014/015, contratos, produtores e UI existente:
  concluída. Decisões aprovadas registradas antes de criar a spec 016.
- `git add` da spec, índice e tarefa e `git commit -m 'docs: record approved notification requirements'`:
  sucesso, `4986a29`, antes do código de produto.
- Testes de alvos, produtores Convex/SQLite e navegação web foram escritos antes
  das respectivas implementações; depois ampliados com migração/reabertura,
  leitura de mensagem antiga e remoção pelo painel.
- `npm run typecheck -- --force`: sucesso no monorepo sem cache.
- `npm run test --workspace=backend -- notifications.test.ts --maxWorkers=1`:
  sucesso, 7 testes iniciais, incluindo 250 destinatários e entrada posterior.
- `npm run test --workspace=web -- src/notifications.test.tsx --maxWorkers=1`:
  sucesso, 2 testes; o aviso scrollTo não implementado do jsdom foi resolvido
  com stub de apresentação, sem alterar o código do produto.
- `git add -f` dos sete arquivos novos em packages/: sucesso; inclusão explícita
  evita omissão pelo .gitignore.
- Primeira suíte integral com TURBO_FORCE=true e um processo por workspace:
  as asserções executadas passaram, mas houve rejeição não tratada no agendador
  simulado, logo a validação falhou. Corrigidos hooks de testes para aguardar jobs
  com finishAllScheduledFunctions, conforme os tipos do convex-test instalado.
- O contador foi revisto para agregados transacionais, evitando leitura de um
  histórico arbitrário de avisos revogados. Testes conferem remoção e leitura
  sem dupla subtração.
- `$env:TURBO_FORCE = 'true'` seguido de `npm run test -- -- --maxWorkers=1`, fora
  do sandbox: sucesso, 234 testes (98 domínio, 76 backend, 60 web), sem skips ou
  rejeições não tratadas; HTTP/SSE incluído.
- `$env:TURBO_FORCE = 'true'` seguido de `npm run build:ready`: sucesso, lint,
  typecheck e build sem cache. PWA com 22 recursos, corpus ARC1911 fora do
  JS/precache, ausência de fixtures/cache de API. Apenas avisos existentes de
  anotações de dependências e SQLite experimental.

Limites: nenhum deploy, dado real ou merge alterado. Homologação física e Google
real permanecem com o Hil; mobile adiado. Backend/backfill de owners devem subir
antes dos merges de web, conforme PRs.

Commits por escopo (`git commit --only -m ... -- <escopo>`, todos com sucesso):
`a222aca` domínio; `8ad7bb1` Convex; `b534d0f` SQLite; `82f995b` web.
Teste web novo incluído com `git add` antes do commit.
- Verificação PowerShell de links relativos: sucesso, 218 links em 19 documentos,
  nenhum destino ausente. `git diff --check`: sucesso, apenas avisos LF/CRLF.
- `git add` da documentação e `git commit -m 'docs: document notification privacy and rollout'`:
  sucesso, `449be93`.
- `git status --short --branch`, `git diff --check feat/community-roles..HEAD`,
  `git ls-files` dos oito arquivos novos e `git rev-list --left-right --count origin/main...main`:
  sucesso; árvore limpa, arquivos novos versionados e main sem commits novos (`0 0`).
- `git push -u origin feat/notifications`: sucesso.
- `Set-Content` do corpo no TEMP e `gh pr create --repo zee-dash-one/devotio --base main --head feat/notifications ...`:
  sucesso; PR aberto e anexado ao chat. Registro movido para .todo/.done/, com
  links e índice atualizados. Backend, backfill e merges continuam com o Hil.

PR: https://github.com/zee-dash-one/devotio/pull/8

- Verificação de links após arquivar as três tarefas: sucesso, 220 links em
  19 documentos; `git diff --check`: sucesso.
- `gh pr list --repo zee-dash-one/devotio --state open --json number,url,headRefName,baseRefName`:
  sucesso; confirmou PRs #6, #7 e #8 abertos, em branches próprias e base main.

## Checklist de execução

- [x] Spec 016 e decisões aprovadas registradas.
- [x] Contratos, alvos e testes de domínio.
- [x] Tabela, consultas, leitura e produtores Convex com testes de isolamento.
- [x] Fan-out em lotes com audiência estável e revogação de acesso.
- [x] Migração, produtores e leitura equivalentes no SQLite.
- [x] Subscription conectada, sino e navegação para trecho/mensagem.
- [x] Lint, typecheck, testes e build:ready.
- [x] Documentação, PR e encerramento. Mobile permanece adiado.

Detalhe de implementação: cada participação recebe uma sequência monotônica
comunitária; publicação captura a sequência atual para excluir entradas posteriores
mesmo no mesmo milissegundo. Avisos de mural referenciam a participação, evitando
reviver avisos antigos após reingresso. Remoção oculta os avisos antigos em lotes,
sem apagar dados ou marcá-los lidos. Demais decisões técnicas seguem a proposta.

O contador Convex usa agregados opcionais em users e communityMembers, mantidos
nas mesmas transações. Isso evita percorrer histórico revogado antes de atingir
o cap e permite subtrair imediatamente a parcela comunitária sem alterar readAt.
Não exige backfill, pois a tabela notifications é nova neste deployment.

## Revisão do PR #8 — conflitos com a main (2026-10-21)

Solicitação do Hil: corrigir os conflitos do PR #8 com a main na própria branch.
A integração do PR #6 em um único commit (`cb0758e`) deixou documentação antiga
em conflito com os registros concluídos desta branch.

- `git status --short --branch`: sucesso; árvore limpa em feat/notifications,
  sincronizada com origin/feat/notifications antes da revisão.
- `git fetch origin`: sucesso; origin/main atualizado de 444f17c para cb0758e.
- `gh pr view 8 --repo zee-dash-one/devotio --json ...`: sucesso; confirmou a
  branch feat/notifications, base main e estado CONFLICTING/DIRTY.
- `git log --oneline --decorate -8 origin/main`, `git diff --stat 444f17c origin/main`
  e leitura dos conflitos: sucesso; a atualização da main contém só documentação.
- `git merge --no-commit --no-ff origin/main`: saída 1 esperada, com conflitos
  add/add em .docs/regras.md, .todo/README.md e .todo/.done/01-estrutura-agentes.md.
- Resolução: preservar decisões aprovadas das specs 015/016 e tarefas arquivadas;
  atualizar o registro do PR #6 integrado; retirar as cópias antigas das tarefas
  02/03 que a main reintroduziu em .todo/. Nenhum código de produto alterado.
- Verificação PowerShell de links: sucesso, 99 links relativos em 10 documentos,
  sem destinos ausentes. `git diff --check`: sucesso.
- `$env:TURBO_FORCE = 'true'` seguido de `npm run build:ready`: sucesso; lint,
  typecheck e build sem cache. Verificados manifest, licenças, 22 recursos
  estáticos, ausência de fixtures/cache de API e corpus fora do JS/precache.
  Apenas avisos existentes de SQLite experimental e anotações de dependências.
- `git add -- <arquivos resolvidos>`, `git diff --name-only --diff-filter=U`,
  `git diff --cached --check` e busca de marcadores: sucesso; nenhum conflito
  pendente. Comparação com HEAD confirmou ausência de mudanças fora de Markdown.
- Suíte de testes anterior não reexecutada nesta revisão exclusivamente documental.
- `git commit -m 'chore: reconcile notifications with main'`: sucesso, d4495d1,
  com pais 3ccdae1 e cb0758e; `git push origin feat/notifications`: sucesso.
- `git status --short --branch` e `git merge-base --is-ancestor origin/main HEAD`:
  sucesso; árvore limpa, branch sincronizada e main incorporada.
- `gh pr view 8 --repo zee-dash-one/devotio --json ...`: sucesso após o envio;
  GitHub confirmou MERGEABLE e CLEAN, base cb0758e e resolução d4495d1.

A revisão incorpora a main na branch de notificações, preservando o histórico
publicado. Publicação do backend e merge do PR na main continuam com o Hil.

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.
