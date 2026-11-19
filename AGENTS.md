# AGENTS.md — Regras de Desenvolvimento Agêntico

Este arquivo define **como trabalhar** neste repositório. Overrides específicos de plataforma estão em [`apps/web/AGENTS.md`](apps/web/AGENTS.md) e [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md).

## 1. Ordem de leitura e mapa do projeto

Antes de iniciar qualquer tarefa, leia nesta ordem:
1. `AGENTS.md` (este arquivo)
2. [`.todo/README.md`](.todo/README.md) (tarefas e decisões abertas da Fase 4)
3. [`docs/README.md`](docs/README.md) e os documentos relevantes para o escopo

| Arquivo | Papel | Quando consultar |
|---|---|---|
| [`README.md`](README.md) | Visão geral, stack e comandos rápidos | Primeiro contato |
| `AGENTS.md` | Fluxo de trabalho, Git, execução e restrições | Antes de qualquer tarefa |
| [`.todo/README.md`](.todo/README.md) | Índice único de planos, tarefas e decisões abertas | Antes de planejar ou executar |
| [`docs/constitution.md`](docs/constitution.md) | Princípios permanentes do produto | Sempre |
| [`docs/product.md`](docs/product.md) | Funcionalidades e regras de negócio vigentes | Ao mexer em comportamento ou permissões |
| [`docs/architecture.md`](docs/architecture.md) | Camadas, schema Convex/SQLite, caches e armadilhas | Ao mexer em estrutura, dados ou integração |
| [`docs/design.md`](docs/design.md) | Padrões de código, testes, UI/UX e acessibilidade | Ao escrever código, testes ou interface |
| [`docs/development.md`](docs/development.md) | Ambiente local, scripts e Graphify | Ao rodar, testar ou inspecionar o código |
| [`docs/operations.md`](docs/operations.md) | Deploy, Cloudflare, Convex, `/gestao-acesso` e imagens | Ao preparar release ou operação |

## 2. Execução no Windows e no servidor

- **Proibido usar PowerShell para trabalho:** não executar comandos, scripts, builds, testes, comandos Git, diagnósticos ou edições pelo PowerShell.
- **Único uso permitido do PowerShell:** abrir uma sessão SSH interativa limpa, sem comando remoto anexado.
- **No servidor:** após conectar via SSH interativo, executar comandos dentro do shell Linux da sessão em passos curtos, legíveis, um por vez, conferindo o código de saída antes do próximo.
- **Sem atalhos remotos a partir do Windows:** não usar `ssh host "comando"`, encadeamentos, pipelines, scripts intermediários, outros interpretadores locais nem payloads codificados (como Base64/`exec`).
- **Arquivos locais:** usar exclusivamente ferramentas diretas de leitura, busca e edição de arquivos. Qualquer necessidade excepcional de execução local no Windows exige autorização prévia do Hil.
- Falha de ferramenta ou ambiente não autoriza contornar este fluxo; informe a limitação ao Hil.

## 3. Fluxo de planejamento e entregas (Fase 4)

- **Índice único em `.todo/`:** toda entrega nova nasce como arquivo de tarefa em `.todo/` listado em [`.todo/README.md`](.todo/README.md), reunindo objetivo, requisitos aprovados, plano técnico e checklist executável.
- **Dúvidas antes de código:** não iniciar implementação de tarefa com decisões de produto, escopo ou visibilidade em aberto sem resposta do Hil registrada.
- **Documentação sem histórico:** `docs/` descreve exclusivamente **o que existe hoje** e as regras vigentes. Ao concluir uma entrega que mude comportamento, schema ou operação, atualize o estado atual em `docs/` sem criar registros cronológicos de "o que mudou".
- **Encerramento:** após abrir o PR e atualizar `docs/`, remover a tarefa concluída da listagem ativa conforme orientação do `.todo/README.md`.

## 4. Fluxo Git e publicação

A branch `main` publica a web automaticamente em produção via Cloudflare Workers Builds.

1. **Branch nova por tarefa:** partir sempre da `main` limpa e atualizada (`git status` → `git switch main` → `git pull --ff-only origin main` → `git switch -c <tipo>/<descricao-curta>`). Tipos: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`. Se houver alterações não reconhecidas na árvore, pare e pergunte ao Hil.
2. **Validação obrigatória na raiz antes de abrir PR:**
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build:ready
   ```
3. **Commits por escopo em inglês:** Conventional Commits (`tipo(escopo): resumo no imperativo`), escopos usuais: `domain`, `backend`, `web`, `local`, `docs`, `ci`. Cada commit deve manter o typecheck íntegro.
4. **Atenção ao `.gitignore` em `packages/**`:** arquivos já rastreados funcionam normalmente, mas **arquivos novos** dentro de `packages/` exigem `git add -f <caminho>` e conferência no `git status`. Nunca usar `-f` em `.env*`, `.convex/`, `_generated/` ou credenciais.
5. **Pull Request:** enviar a branch (`git push -u origin <branch>`) e abrir PR para `main` (`gh pr create`), incluindo resumo, como testar e, se `packages/backend` mudou, o aviso `- [ ] Backend: run npm run deploy:backend before merging`.
6. **Sem deploy nem merge pelo agente:** nunca executar `npm run deploy:*`, `npx convex deploy`, `wrangler deploy` nem fazer merge/push direto na `main`. Quem publica o backend e faz merge é o Hil.
7. **Compatibilidade retroativa de backend:** como o backend sobe antes do merge da web, alterações de schema e funções Convex precisam manter compatibilidade com a web já em produção (campos novos `v.optional`, contratos anteriores preservados até a subida da web). Ajustes de revisão entram como novos commits na mesma branch (sem reescrever histórico publicado sem autorização).

## 5. Regras de arquitetura, código e segurança

- **Fonte única de verdade:** toda regra de negócio, validação, cálculo e permissão vive em `packages/domain` e `packages/backend`. `apps/web` e `apps/mobile` são cascas finas de apresentação (rotas, layout, gestos e chamadas aos hooks de `domain/react`).
- **Paridade de backends:** toda funcionalidade nova deve funcionar em Convex (`packages/backend/convex`) e no SQLite de desenvolvimento (`packages/backend/local`) sob o mesmo contrato de `packages/domain`, ou ter a diferença documentada em [`docs/architecture.md`](docs/architecture.md).
- **Permissões sempre no servidor:** toda autorização é validada nas funções de `packages/backend` usando regras de `packages/domain`. O cliente apenas oculta controles indisponíveis.
- **Validação única com Zod:** schemas de entrada definidos em `packages/domain/validators` e reutilizados nos backends e formulários.
- **TypeScript estrito:** `any` é proibido sem comentário justificando. `packages/domain` não importa DOM nem React Native (apenas `react` e `convex/react`).
- **Idiomas:** código, identificadores, branches, commits e PRs em **inglês**; textos visíveis e mensagens de erro ao usuário em **português** (`ConvexError("mensagem")`).
- **Segredos:** nunca ler em voz alta, imprimir, copiar para tarefas/PRs ou versionar `.env*`, chaves, tokens ou credenciais.
- **Limites de produto:** nunca adicionar gamificação, streaks, rankings, contadores de urgência ou ampliar visibilidade de dados privados sem decisão explícita do Hil; nunca criar tabela nova sem atualizar `packages/backend/convex/schema.ts` e [`docs/architecture.md`](docs/architecture.md).

## 6. Ferramentas do repositório

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `packages/backend/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

<!-- convex-ai-end -->

- **Graphify (mapa AST local):** disponível via `npm run graphify:code` e `npm run graphify -- query "<pergunta>"` (no shell Linux permitido). Usa apenas AST local em `graphify-out/` (ignorado pelo Git) e respeita `.graphifyignore`; confirme sempre os achados no código-fonte. Detalhes em [`docs/development.md`](docs/development.md).
