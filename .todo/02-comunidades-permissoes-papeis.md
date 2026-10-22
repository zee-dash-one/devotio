# 02 - Permissão de criar comunidade e papéis (owner/admin/membro)

**Status:** em execução — decisões aprovadas pelo Hil em 2026-10-21.
Depende de [01](./.done/01-estrutura-agentes.md), concluída (PR #6).
**Branch sugerida:** `feat/community-roles`.

## Objetivo

Só cria comunidade quem recebeu permissão na gestão de usuários, até um limite
por usuário (padrão 1). Cada comunidade passa a ter um **owner** (criador),
quantos **admins** quiser e quantos **membros** quiser; owner e admins aprovam
ou recusam quem pede para entrar.

## Leia antes

[AGENTS.md](../AGENTS.md), [.todo/README.md](./README.md),
[.docs/regras.md](../.docs/regras.md), [.docs/arquitetura.md](../.docs/arquitetura.md),
[specs/002](../specs/002-comunidade-v1/spec.md), [specs/011](../specs/011-gestao-usuarios-aprovacao/spec.md),
[docs/operations/user-administration.md](../docs/operations/user-administration.md),
`packages/backend/_generated/ai/guidelines.md`.

## O que existe hoje (levantado no código em 21/10/2026)

- `packages/backend/communities.ts` → `create`: **qualquer usuário aprovado** cria
  comunidades, sem limite; o criador vira `admin`. Não existe "owner".
- `communities.join(code)`: quem tem o código de convite entra **na hora** como
  `member`. Não há pedido nem aprovação. O código só aparece para admins.
- `communityMembers.role` = `"admin" | "member"`. `canManage(role)` em
  `packages/domain/rules.ts` = só `admin`. Só admin publica no mural, fixa
  escritura, cria listas e remove membros (`membership(ctx, id, true)` em
  `access.ts`). `canRemoveMember` impede remover o último admin ativo.
- Não existe "sair da comunidade" nem "promover a admin" dentro da comunidade.
- Gestão de usuários: `/gestao-acesso` (`apps/web/src/pages/administration.tsx`,
  `packages/backend/administration.ts`), acessada por **uma única credencial de
  proprietário** (login + senha + TOTP em variáveis do Convex, `requireAdmin`).
  Ela aprova/desativa contas, liga `editorial` e, por usuário, define o papel em
  cada comunidade (`setCommunity`: `admin`/`member`/`none`), com
  `protectLastAdmin` e auditoria em `userAdminEvents`.
- Modo local (SQLite, `packages/backend/local/database.local.ts`) replica
  comunidades, com a mesma ausência de permissão; tem até um aviso fixo
  "Você tem direito a criar uma comunidade." para todo perfil.

## Mini-spec

- **Escopo:** permissão + limite de criação; papel `owner`; pedidos de entrada com
  aprovação; promover/rebaixar admin; UI correspondente; paridade no SQLite local.
- **Fora do escopo:** notificações (tarefa 03), comunidades públicas sem convite
  (se o Hil quiser, vira tarefa própria), app mobile, exclusão de comunidade.
- **Riscos:** quebrar a web que está no ar ao publicar o backend antes (usar
  campos opcionais e manter `join` funcionando até a web nova subir);
  comunidades antigas sem owner (migração); usuários que já criaram comunidades
  sem ter a permissão nova.

## Proposta técnica (ajustar conforme as respostas do Hil)

### Domínio (`packages/domain`)

1. `types.ts`: `Role = "owner" | "admin" | "member"`. Em `Community`, expor
   `role` e, para owner/admin, `inviteCode` e `pendingRequests: number`.
2. `rules.ts` (funções puras, com testes em `rules.test.ts`):
   - `canManage(role)` → `owner` ou `admin`.
   - `canCreateCommunity({ allowed, limit, owned })` → `allowed && owned < limit`.
   - `canDecideJoin(role)` → `owner` ou `admin`.
   - `canChangeRole(actorRole, targetRole, nextRole)` → owner muda qualquer um
     (menos a si mesmo); admin promove membro a admin; admin x admin conforme
     resposta do Hil (D3).
   - `canRemoveMember(actorRole, targetRole, activeManagers)` → ninguém remove o
     owner; admin remove membro; admin x admin conforme D3.
3. `validators/administration.ts`: `communityCreationSchema = z.object({ userId,
   allowed: z.boolean(), limit: z.number().int().min(0).max(LIMIT_MAX) })`
   (`LIMIT_MAX` a confirmar, sugestão 20). `communityPermissionSchema.role`
   ganha `"owner"` só se o Hil quiser transferência pelo painel (D2).
4. `validators/` (comunidade): `joinDecisionSchema` (`approve`/`reject`).
5. `administration.ts` (`ManagedUser`): `communityCreation: { allowed, limit, owned }`.
   `AccessState` (users.access): `canCreateCommunity: boolean` e `communityLimit`.

### Schema Convex (`packages/backend/schema.ts`) — tudo aditivo/opcional

```ts
users: { ...,
  communityCreationAllowed: v.optional(v.boolean()),   // default false
  communityCreationLimit: v.optional(v.number()),      // default 1 when allowed
}
communities: { ...,
  ownerId: v.optional(v.id("users")),                  // backfilled, then required in a later PR
  joinPolicy: v.optional(v.union(v.literal("approval"), v.literal("open"))), // only if D4 = configurable
}.index("by_invite", ["inviteCode"]).index("by_ownerId", ["ownerId"])
communityMembers.role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member"))
communityJoinRequests: defineTable({
  communityId: v.id("communities"),
  userId: v.id("users"),
  state: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("cancelled")),
  requestedAt: v.number(),
  decidedAt: v.optional(v.number()),
  decidedBy: v.optional(v.id("users")),
})
  .index("by_communityId_and_state", ["communityId", "state"])
  .index("by_communityId_and_userId", ["communityId", "userId"])
  .index("by_userId_and_state", ["userId", "state"])
```

Contagem para o limite: `communities.by_ownerId` (comunidades em que a pessoa é
owner hoje). Se o Hil decidir "criadas na vida" (D7), guardar `createdBy` e contar
por ele.

### Funções Convex

| Função | Tipo | Quem pode | O que faz |
|---|---|---|---|
| `communities.create` | mutation | aprovado **com** permissão e abaixo do limite | cria comunidade, `ownerId = user`, membro `owner`; erro claro em português se faltar permissão/limite |
| `communities.requestJoin(code)` | mutation | aprovado, não membro | cria pedido `pending` (idempotente: devolve o existente); se `joinPolicy = open`, entra direto |
| `communities.join(code)` | mutation | — | **mantida** durante a transição chamando `requestJoin`; remover num PR posterior |
| `communities.myJoinRequests` | query | o próprio usuário | pedidos pendentes dele (para mostrar "aguardando aprovação") |
| `communities.cancelJoinRequest(id)` | mutation | autor do pedido | `cancelled` |
| `communities.joinRequests(id, cursor)` | query (paginada) | owner/admin | pendentes com nome do solicitante |
| `communities.decideJoinRequest(requestId, decision)` | mutation | owner/admin da comunidade do pedido | aprova (insere `member`, se ainda não for) ou recusa; grava `decidedBy/At`; recusa de pedido já decidido não faz nada |
| `communities.setMemberRole(id, memberId, role)` | mutation | ver `canChangeRole` | promove/rebaixa admin; nunca altera o owner por aqui |
| `communities.removeMember` | mutation | ver `canRemoveMember` | já existe; passa a proteger o owner |
| `communities.leave(id)` | mutation | membro/admin; owner conforme D2 | sai da comunidade |
| `communities.transferOwnership(id, memberId)` | mutation | owner | só se D2 = sim; alvo vira owner, antigo vira admin |
| `administration.setCommunityCreation(token, userId, allowed, limit)` | mutation | `requireAdmin` | grava permissão/limite (limite padrão 1 ao ligar), audita `community-creation:<allowed>:<limit>` |
| `administration.list` | mutation | `requireAdmin` | passa a devolver `communityCreation { allowed, limit, owned }` |
| `users.access` | query | o próprio usuário | devolve `canCreateCommunity` para a UI |
| `communities.backfillOwners` | internalMutation | — | para cada comunidade sem `ownerId`: owner = admin mais antigo ativo (`_creationTime` do vínculo); muda o papel dele para `owner`. Paginado, repetível |

Checagens no servidor (obrigatórias, a UI só esconde):
- todo `communities.*` começa com `findUser`/`ensureUser` (conta aprovada);
- `membership(ctx, id, true)` passa a aceitar `owner` (via `canManage`);
- `decideJoinRequest` confere que o pedido é da comunidade em que o ator é
  owner/admin **no momento** da decisão;
- `create` verifica permissão e limite dentro da mesma mutation (transação Convex);
- `administration.update` (desativar conta) e `setCommunity` continuam protegendo
  o último gestor ativo; desativar um owner segue a resposta D6.

### Backend local (SQLite)

`packages/backend/local/database.local.ts`: mesmas regras, chamando as funções
de `packages/domain`. Migração do SQLite: `ALTER TABLE` idempotente (a tabela
`members` tem `CHECK(role IN ('admin','member'))` — recriar a tabela com o novo
CHECK numa migração versionada pelo `metadata`). Remover o aviso fixo "Você tem
direito a criar uma comunidade." para quem não tem a permissão. Perfis mock:
Daniel com permissão (limite 1), Ester com limite 2, Marina e Lucas sem.

### Web (`apps/web`)

- `pages/community.tsx` (lista): botão **Criar comunidade** só com
  `canCreateCommunity`; sem permissão, texto discreto ("Para criar uma
  comunidade, fale com a administração."), conforme D8. Entrar com código mostra
  "Pedido enviado. Aguarde a aprovação." e lista pedidos pendentes do usuário.
- `pages/community.tsx` (aba membros): seção **Pedidos para entrar** (owner/admin)
  com Aprovar/Recusar; selo de papel (Owner/Admin/Membro); menu por membro com
  "Tornar admin"/"Remover admin"/"Remover"; botão "Sair da comunidade".
- `pages/administration.tsx`: no cadastro do usuário, interruptor **Pode criar
  comunidades** + campo **Limite** (preenche 1 ao ligar) e "usadas: N".
- `domain/react/convex.ts` e `domain/local.ts`: novos métodos do `Repository`.

## Verificação (escrever os testes antes do código)

| Parte | Prova |
|---|---|
| Regras | `rules.test.ts`: `canCreateCommunity`, `canDecideJoin`, `canChangeRole`, `canRemoveMember` com todas as combinações owner/admin/member |
| Criar | `convex-test`: sem permissão → erro; com permissão e limite 1 → cria 1, a 2ª falha; ao ligar a permissão no painel o limite fica 1 |
| Entrar | pedido pendente não dá acesso a `detail`/`send`; membro comum não vê nem decide pedidos; admin de outra comunidade não decide; aprovar cria `member`; repetir `requestJoin` não duplica |
| Papéis | ninguém remove o owner; admin promove membro; regra admin x admin conforme D3; último gestor ativo protegido |
| Migração | `backfillOwners` define exatamente um owner por comunidade antiga e é idempotente |
| Painel | `setCommunityCreation` exige sessão admin e grava auditoria |
| Local | `packages/backend/local/*.test.ts` com os mesmos cenários |
| Web | testes de UI: botão Criar oculto sem permissão; pedidos aparecem para admin; mensagem de "aguardando aprovação" |
| Tudo | `npm run build:ready` passa |

## Passos (depois das respostas do Hil)

1. Registrar as respostas na seção "Decisões do Hil" abaixo e criar
   `specs/015-comunidade-papeis-permissoes/spec.md` só com requisitos e decisões
   (a tarefa continua sendo o plano). Adicionar a linha 015 em `specs/README.md`.
2. Seguir o fluxo do [AGENTS.md](../AGENTS.md#fluxo-de-mudanças--pré-beta-obrigatório-desde-21102026):

   ```powershell
   git switch main
   git pull --ff-only origin main
   git switch -c feat/community-roles
   ```

3. Domínio + testes → `feat(domain): add community creation and role rules`.
4. Schema, funções, backfill + testes `convex-test` →
   `feat(backend): add community owner, creation limit and join requests`
   (arquivo novo em `packages/`: `git add -f`).
5. Painel de gestão → `feat(admin): manage community creation permission`.
6. SQLite local + testes → `feat(local): mirror community roles and join requests`.
7. Web → `feat(web): join approval and role management in communities`.
8. Docs: `docs/architecture.md § Modelo de Dados`, `docs/operations/user-administration.md`,
   `.docs/regras.md`, spec 015 → `docs: document community roles and permissions`.
9. Validar e abrir o PR:

   ```powershell
   npm run lint
   npm run typecheck
   npm run test
   npm run build:ready
   git push -u origin feat/community-roles
   gh pr create --base main --head feat/community-roles --title 'feat: community roles, creation limit and join approval' --body-file $env:TEMP\pr-body.md
   ```

   No corpo do PR: `- [ ] Backend: run npm run deploy:backend before merging`
   e `- [ ] After deploy: run communities:backfillOwners once`.
10. Parar. O Hil publica o backend, roda o backfill e faz o merge.

## Aceite

- Usuário sem permissão não cria comunidade (servidor recusa; UI esconde).
- Ligar a permissão no painel define limite 1; o limite é respeitado no servidor.
- Toda comunidade tem exatamente um owner; antigas recebem owner pelo backfill.
- Entrar pelo código gera pedido; só owner/admin daquela comunidade aprovam ou
  recusam; pedido pendente não acessa nada da comunidade.
- Owner não pode ser removido por admin; regras de admin conforme decisões.
- Web antiga continua funcionando entre o deploy do backend e o merge.
- Testes novos passando; `npm run build:ready` passa; PR aberto.

## Dúvidas abertas para o Hil

Não decidir sem resposta. Sugestões entre parênteses só para facilitar.

1. **D1 — Quem acessa a gestão de usuários?** Hoje é só a credencial única de
   proprietário (`/gestao-acesso`, login + senha + TOTP). Fica só ela
   (superadmin) ou outras contas também poderão dar permissão de criar comunidade?
2. **D2 — Owner pode transferir a posse? Pode sair da comunidade?** Se sair sem
   transferir, o que acontece (bloquear a saída? passar ao admin mais antigo?).
   O painel de gestão também poderá trocar o owner?
3. **D3 — Admin pode remover ou rebaixar outro admin?** Ou só o owner faz isso?
   Admin pode promover membro a admin, ou só o owner?
4. **D4 — Comunidade pública ou só por aprovação?** Sempre por aprovação, ou o
   owner escolhe por comunidade ("entrada livre com código" x "com aprovação")?
   Haverá comunidades visíveis numa busca, sem código?
5. **D5 — Comunidades e membros que já existem:** quem vira owner nas atuais (o
   admin mais antigo?). Quem já criou comunidade ganha a permissão
   automaticamente? Membros atuais continuam sem passar por aprovação?
6. **D6 — Permissão revogada ou conta desativada do owner:** a comunidade e o
   conteúdo continuam como estão? A posse passa a um admin? Revogar a permissão
   só impede criar novas?
7. **D7 — Limite menor que o número atual** (ex.: tem 2 e o limite vira 1): só
   bloqueia novas ou exige ação? O limite conta comunidades em que é owner hoje
   ou todas que já criou (transferir/apagar libera vaga?). Qual o limite máximo
   que o painel aceita?
8. **D8 — Quem não tem permissão** vê o botão "Criar comunidade" desabilitado com
   explicação, ou o botão some? Pode pedir a permissão pelo app?
9. **D9 — Pedidos de entrada:** expiram? Quem foi recusado pode pedir de novo
   (quando)? O solicitante fica sabendo da recusa ou só da aprovação?
10. **D10 — Código de convite:** continua obrigatório para pedir entrada? Owner e
    admin podem gerar um novo código (invalidar o antigo)?
11. **D11 — O que o admin pode fazer além de aprovar:** publicar no mural, fixar
    escritura e criar listas continuam iguais para owner e admin? Algo exclusivo
    do owner (editar nome/descrição, apagar a comunidade)?
12. **D12 — Membros podem publicar no mural?** Hoje só admin publica. Fica assim?

## Decisões do Hil

Em 2026-10-21, Hil respondeu "Adotar essas decisões na tarefa 02" no chat:

- D1: gestão exclusiva da credencial do proprietário.
- D2: owner e painel transferem posse; owner deve transferir antes de sair.
- D3: admin promove membro; só owner remove ou rebaixa outro admin.
- D4: convite por código e aprovação obrigatórios; sem busca pública.
- D5: admin ativo mais antigo vira owner; membros preservados; sem concessão
  automática da permissão de criar.
- D6: revogação só bloqueia novas criações; owner transfere antes de desativar.
- D7: contar comunidades atualmente possuídas; máximo 20; redução só bloqueia novas.
- D8: ocultar botão sem permissão, com explicação discreta; sem solicitação no app.
- D9: sem expiração; recusa visível; novo pedido permitido após recusa.
- D10: código obrigatório; sem renovação nesta etapa.
- D11/D12: owner/admin publicam, fixam escritura e criam listas; posse e
  remoção/rebaixamento de admins são exclusivos do owner (ou painel proprietário).

## Checklist de execução

- [x] Spec 015 e decisões registradas.
- [x] Regras, contratos e testes do domínio.
- [x] Convex: permissão, owner, pedidos, papéis, transferência e backfill.
- [x] Painel: permissão, limite e transferência de posse.
- [x] SQLite e adaptadores com regras equivalentes.
- [x] Web: criação, pedidos, papéis e saída.
- [x] Lint, typecheck, testes e build:ready.
- [ ] Documentação, PR e encerramento. Mobile permanece adiado.

## Resultado

- `git switch main`, `git pull --ff-only origin main`,
  `git switch -c feat/community-roles`: sucesso; main já atualizada.
- `git cherry-pick origin/main..docs/agent-structure`: sucesso; trouxe a
  estrutura documental do PR #6 como dependência, sem modificar main.
- Leituras de specs 002/011, regras Convex geradas, skill convex/convex-expert,
  contratos e implementação vigente: concluídas. A instrução de deploy da skill
  não se aplica porque o Hil reservou publicação para si.
- `Get-Content packages/domain/repository.ts`: falhou; o contrato está em types.ts,
  lido em seguida. Nenhuma alteração decorrente dessa tentativa.
- `git reset --soft docs/agent-structure`: sucesso; antes de publicar a branch,
  alinhou a dependência aos commits originais do PR #6, preservando todo o índice
  e trabalho local; eliminou cópias dos commits do cherry-pick.
- `git add` da spec e decisões e `git commit --only -m 'docs: record approved community governance requirements' ...`:
  sucesso, commit `a59653e`, antes dos commits de implementação.
- Testes de regras e backend foram escritos antes das respectivas implementações.
  Adicionados também cenários locais, painel e UI; casos antigos foram atualizados
  para pedido de entrada e ausência de aviso de criação sem permissão.
- Primeiro `npm run typecheck`: falhou por ID string em um teste novo; corrigido
  para Id tipado. Repetição `npm run typecheck`: sucesso nos quatro workspaces.
- `npm run lint`: sucesso nos quatro workspaces e scripts.
- Primeiro `npm run test`: falhou por expectativas anteriores, testes HTTP
  bloqueados no sandbox e timeouts sob excesso de processos. Sem ignorar testes.
- `npm run test --workspace=backend -- community-governance.test.ts --maxWorkers=1`:
  sucesso, 4 testes. Confirmou que os timeouts não eram falha da regra de limite.
- `npm run test -- -- --maxWorkers=1` fora do sandbox: sucesso, 218 testes
  (96 domínio, 65 backend, 57 web), incluindo HTTP/SSE.
- Depois de ampliar auditoria e validar retornos, `npm run test --workspace=backend -- --maxWorkers=1`
  fora do sandbox: sucesso, 66 testes.
- Depois do cenário integrado de pedido de entrada, `npm run test --workspace=web -- src/local-app.test.tsx --maxWorkers=1`:
  sucesso, 31 testes; total distinto atualizado: 220 (96 domínio, 66 backend, 58 web).
- `git add -f` dos nove arquivos novos em packages/: sucesso, conferidos no índice.
- `$env:TURBO_FORCE = 'true'` seguido de `npm run build:ready`: sucesso; lint,
  typecheck e build sem reutilizar cache; PWA com 22 recursos, corpus ARC1911 fora
  do JS/precache, sem fixtures ou cache de API. Avisos existentes de anotações de
  dependências e SQLite experimental, sem falhas.

Limites: não houve deploy, execução de backfill em dados reais nem merge.
Homologação visual em aparelhos e Google real permanece com o Hil; mobile adiado.

Commits por escopo (`git commit --only -m ... -- <escopo>`, todos com sucesso):
`69226c4` domínio; `1e364a6` backend/painel; `bfdd5cc` SQLite; `c5e6475` web.
Arquivos web novos foram incluídos com `git add` antes do commit.

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.
