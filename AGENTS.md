# AGENTS.md — Configuração de Desenvolvimento Agêntico

> Este arquivo é lido por qualquer agente de IA (Claude Code, Cursor, etc.) antes de
> tocar em código neste repositório. Ele define **como trabalhar**, não **o que construir**
> — isso vive em `/specs`. Overrides específicos de plataforma estão em
> `apps/web/AGENTS.md` e `apps/mobile/AGENTS.md`.

## Ordem de leitura e mapa do projeto

Antes de qualquer trabalho, leia nesta ordem: `AGENTS.md` (este arquivo) →
[`.todo/README.md`](.todo/README.md) → [`.docs/README.md`](.docs/README.md) e os
docs que ele indicar → o arquivo da tarefa. Só `.todo/README.md` lista tarefas.

| Arquivo | Para que serve | Quando ler |
|---|---|---|
| [`README.md`](README.md) | visão geral, stack e como rodar | primeiro contato |
| `AGENTS.md` | regras para agentes, fluxo Git e ordem de leitura | antes de qualquer tarefa |
| [`.todo/README.md`](.todo/README.md) | tarefas abertas (links) e decisões pendentes do Hil | antes de executar |
| [`.docs/README.md`](.docs/README.md) | índice da especificação viva (aponta para `docs/` e `specs/`) | antes de decidir algo |
| [`.docs/regras.md`](.docs/regras.md) | regras do projeto e de negócio | sempre |
| [`.docs/arquitetura.md`](.docs/arquitetura.md) | arquitetura, deploy e armadilhas do repo | ao mexer em estrutura, schema ou deploy |
| [`.docs/design.md`](.docs/design.md) | padrões de código, testes e UI | ao escrever código/UI |

Regras gerais (valem para todo agente):

- Commits, branches, PRs, identificadores e comentários de código em **inglês**;
  textos para o usuário em português.
- Nunca gravar senha, token ou chave em arquivo versionado. Segredos ficam em
  `.env*` (ignorados pelo Git); nunca copiar, ler em voz alta ou imprimir `.env*`.
- Shell do Hil: Windows PowerShell 5.1. `&&` não funciona; use um comando por
  linha (ou `;` só quando a falha do primeiro não importa). Use aspas simples em
  mensagens de commit para o `$` não ser expandido.
- Registrar no arquivo da tarefa cada comando relevante e se deu certo ou falhou.
- Não publicar nada (Convex, Cloudflare, `npm run deploy:*`) e não fazer merge:
  isso é decisão do Hil.
- Ao concluir uma tarefa: registrar data e resultado no próprio arquivo, tirar a
  linha dela do `.todo/README.md`, atualizar `.docs/` se a decisão mudou algo,
  mover o arquivo para `.todo/.done/` e apagar o que ficou obsoleto (sem cópias).

## Fluxo de mudanças — pré-beta (obrigatório desde 21/10/2026)

O Devotio está em **testes pré-beta**. A `main` é produção: cada push/merge nela
dispara o Cloudflare Workers Builds e publica a web automaticamente. Por isso:

1. **Toda mudança nasce numa branch nova**, criada a partir da `main` atualizada.
2. **Commits separados por escopo** (Conventional Commits, em inglês).
3. **Toda mudança termina com um PR aberto** para a `main`.
4. **Nada vai direto na `main`**: nada de commit, push, merge ou force-push nela.
   Quem faz o merge é o Hil, depois de revisar o PR.

### Passo a passo (PowerShell 5.1)

Execute um comando por vez e confira se terminou sem erro antes do próximo
(`$LASTEXITCODE` deve ser `0` nos comandos `git`, `npm` e `gh`).

**1. Partir da `main` limpa e atualizada**

```powershell
git status
git switch main
git pull --ff-only origin main
```

Se `git status` mostrar mudanças que não são suas, pare e pergunte ao Hil.

**2. Criar a branch da tarefa**

Nome: `<tipo>/<descricao-curta-em-ingles>`, em kebab-case. Tipos: `feat/`,
`fix/`, `chore/`, `docs/`, `refactor/`, `test/`. Uma branch por tarefa do
`.todo/`. Exemplos: `feat/community-roles`, `feat/notifications`,
`fix/bible-verse-scroll`, `docs/agent-structure`.

```powershell
git switch -c feat/community-roles
```

**3. Trabalhar e validar** (na raiz do repo)

```powershell
npm run lint
npm run typecheck
npm run test
npm run build:ready
```

**4. Commitar por escopo.** Cada commit agrupa um assunto só e passa sozinho no
typecheck. Formato `tipo(escopo): resumo no imperativo`. Escopos usuais:
`domain`, `backend`, `web`, `local` (adaptador SQLite), `docs`, `ci`.

```powershell
git add packages/domain/rules.ts packages/domain/rules.test.ts
git commit -m 'feat(domain): add community creation rules'
git add packages/backend/schema.ts packages/backend/communities.ts
git commit -m 'feat(backend): require join approval for communities'
git add apps/web/src/pages/community.tsx
git commit -m 'feat(web): show pending join requests to managers'
```

**Atenção — `.gitignore` ignora `packages/**`.** Arquivos já versionados em
`packages/` funcionam normalmente, mas **arquivo novo** em `packages/` não entra
no `git add` comum. Para cada arquivo novo ali, use `git add -f <caminho>` e
confira com `git status` que ele aparece como novo (`A`). Nunca use `-f` em
`.env*`, `.convex/`, `_generated/ai/` ou credenciais.

**5. Enviar a branch**

```powershell
git push -u origin feat/community-roles
```

**6. Abrir o PR** (com o `gh`, já instalado). Escreva o corpo num arquivo fora do
repo, por exemplo `$env:TEMP\pr-body.md`, com: o que mudou, como testar, link da
tarefa do `.todo/` e, se o backend mudou, a linha
`- [ ] Backend: run npm run deploy:backend before merging`.

```powershell
gh pr create --base main --head feat/community-roles --title 'feat: community roles and join approval' --body-file $env:TEMP\pr-body.md
```

Copie a URL do PR para o arquivo da tarefa e **pare**. Não faça merge.

**7. Backend antes da web.** Se o PR mexe em `packages/backend` (schema ou
funções Convex), o Hil publica o backend **antes** do merge, porque o merge
publica a web na hora:

```powershell
npm run deploy:backend
```

Hoje o backend do piloto é o deployment `upbeat-jellyfish-720` (ver
[`docs/operations/release.md`](docs/operations/release.md)); `npm run
deploy:backend:prod` / `npx convex deploy` apontam para outro deployment, ainda
sem as variáveis de auth. Por isso, mudança de schema tem de ser **compatível
com a web antiga** (campos novos opcionais, funções antigas mantidas até o
merge), já que o backend sobe primeiro.

**8. Ajustes de revisão** entram como novos commits na mesma branch
(`git push` de novo). Não reescrever histórico já enviado sem pedir ao Hil.

## 0. Antes de qualquer coisa

1. Leia `docs/constitution.md`. Os princípios ali são inegociáveis. Consulte também
   `docs/README.md`, `docs/engineering/status.md` e a spec da feature: documentação
   de destino não comprova implementação pronta.
2. Toda feature nova começa em `/specs/NNN-nome-da-feature/spec.md`, **nunca** direto no
   código. Se não existe spec para o que você está prestes a construir, pare e crie a
   spec primeiro (use `specs/_templates/spec-template.md`).
3. Nunca escreva lógica de negócio dentro de `apps/web` ou `apps/mobile`. Se você se
   pegar escrevendo uma regra de permissão, validação ou cálculo dentro de um app,
   ela pertence a `packages/domain` ou `packages/backend`.

## 1. Estrutura do monorepo

```
devocional-app/
├── docs/                    # constituição, arquitetura, ADRs
├── specs/                   # spec-driven development (uma pasta por feature)
├── packages/
│   ├── backend/             # Convex: schema, queries, mutations, actions, cron
│   ├── domain/              # núcleo TS puro + hooks React em fronteira separada
│   │                        # tipos, zod e permissões; adaptadores Convex e prévia separados
│   └── ui-kit/              # design tokens (cores, spacing, tipografia, raio)
│                            # consumidos por Tailwind (web) e NativeWind (mobile)
├── apps/
│   ├── web/                 # React 19 + Vite SPA + Tailwind; PWA implementada
│   └── mobile/              # reservado para Expo + NativeWind; ainda sem workspace
├── turbo.json
└── package.json
```

**Regra de ouro:** `packages/backend` e `packages/domain` são a única fonte de verdade.
`apps/web` e `apps/mobile` são cascas de apresentação finas — roteamento, layout,
gestos e chamadas aos hooks do `domain`. Se uma regra precisa existir nos dois apps,
ela está no lugar errado.

## 2. Fluxo de trabalho (Spec → Plan → Tasks → Code)

Para cada feature:

1. **`spec.md`** — o quê e por quê (sem tecnologia). Escrito/aprovado antes do plano.
2. **`plan.md`** — como, tecnicamente: schema Convex necessário, funções, impacto em
   web e mobile, decisões de UI por plataforma.
3. **`tasks.md`** — checklist executável, dividido em `backend/domain`, `web`, `mobile`,
   `cross-cutting`. Cada task deve ser pequena o suficiente pra um agente completar
   e verificar sozinha.
4. **Código** — só começa depois que `spec.md` e `plan.md` existem e fazem sentido.

Tarefas executáveis novas vivem em `.todo/` (índice único em `.todo/README.md`).
Quando uma tarefa do `.todo/` já traz o plano e o checklist, ela faz o papel de
`plan.md`/`tasks.md`; a `spec.md` continua registrando requisitos e decisões
aprovadas pelo Hil. [a confirmar com o Hil: aposentar `plan.md`/`tasks.md` nas
features novas]

Um agente que recebe "implemente a feature X" e não encontra `specs/XXX-x/spec.md`
deve **gerar a spec primeiro**, mostrar ao humano e obter aprovação dos requisitos
antes de seguir para plan/tasks/code.

## 3. Comandos (Turborepo + npm workspaces)

```bash
npm install                            # instala tudo no monorepo
npm run dev --workspace=web            # roda apenas o app web
npm run dev                            # roda apenas web; backend em terminal separado
npm run dev --workspace=backend        # Convex watch (credenciais/deployment real pendentes)
npm run test --workspace=domain        # testes de regras de negócio (o mais importante)
npm run lint && npm run typecheck      # requisito antes de commit; lint configurado nos workspaces
```

> Nota: `--workspace=nome` pode ser abreviado como `-w nome`. O `name` de cada
> workspace é o campo `"name"` do `package.json` de cada pasta em `apps/*` e
> `packages/*` (ex: `web`, `mobile`, `domain`, `backend`), não o caminho da pasta.

## 4. Convenções de código

- **TypeScript estrito** em todo o repositório. `any` é proibido sem comentário
  justificando.
- **Validação de entrada sempre com zod**, definida uma única vez em
  `packages/domain/validators` e reusada nas mutations do Convex e nos forms dos apps.
- **Permissões nunca no client.** Toda checagem de papel (AG/AC/membro) é feita dentro
  da function do Convex (`packages/backend`), usando helpers de
  `packages/domain/permissions/`. O client só *esconde* UI que o usuário não pode
  usar — ele nunca é a barreira de segurança.
- **Português para conteúdo e mensagens ao usuário; inglês para identificadores de
  código**, seguindo nomes existentes como `devotionals.scripture`. Não renomear o
  schema por tradução nem misturar idiomas no mesmo identificador.
- **Sem dependências pesadas de UI dentro de `packages/domain`.** Esse pacote não
  importa React DOM nem React Native — só `react` (para hooks) e `convex/react` puro,
  para poder ser consumido pelos dois apps sem conflito de bundler.

## 5. O que um agente NUNCA deve fazer neste projeto

- Adicionar gamificação, streaks, ranking ou qualquer mecanismo de engajamento
  comportamental não pedido na spec — viola o princípio de "reverência sobre
  engajamento" da constituição.
- Tornar um comentário de `bibleMarkings` visível além do escopo definido em
  `visibility` sem uma spec explícita autorizando.
- Criar tabela nova no schema do Convex sem atualizar `packages/backend/schema.ts`
  E documentar a decisão em `docs/architecture.md § Modelo de Dados`.
- Duplicar uma regra de negócio em `apps/web` e `apps/mobile` "pra ir mais rápido".
  Sempre subir a regra para `packages/domain` primeiro.

## 6. Definição de pronto (Definition of Done)

Uma task só é considerada concluída quando:

- [ ] Typecheck e lint passam no monorepo inteiro.
- [ ] Regra de negócio nova tem teste em `packages/domain`.
- [ ] Funciona igual (ou com a diferença documentada) em web e mobile.
- [ ] Nenhuma checagem de permissão foi feita só no client.
- [ ] `tasks.md` da feature foi atualizado marcando o item concluído.

## 7. Direção documental do lançamento

Consulte `docs/adr/001-web-first-free-launch.md`: a proposta é publicar a web
primeiro dentro de cotas gratuitas. Expo fica para outra etapa; não marcar tasks
mobile como concluídas. A diferença entre plataformas deve aparecer na spec/plano.
Novos requisitos de acesso, instalação e operação estão em
`specs/004-fundacao-lancamento/spec.md`, autorizada para reconstrução; homologação pendente.

O comando lint na raiz não comprova análise enquanto os workspaces não tiverem
scripts/configuração. Não declarar DoD atendida com execução vazia. Para revisão
somente documental, verificar links, comandos, fontes datadas e consistência das
specs; registrar checks indisponíveis sem alterar código para maquiar a verificação.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`packages/backend/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.
