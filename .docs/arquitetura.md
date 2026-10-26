# Arquitetura (resumo para agentes)

Detalhe completo em [docs/architecture.md](../docs/architecture.md) e
[docs/engineering/stack.md](../docs/engineering/stack.md). Aqui fica o que um
agente precisa para não quebrar nada.

## Camadas

| Camada | Pasta | Papel |
|---|---|---|
| Web/PWA | `apps/web` | React 19 + Vite + TanStack Router; casca fina, sem regra de negócio |
| Domínio | `packages/domain` | tipos, validadores zod, regras puras (`rules.ts`, `social.ts`...), hooks em `react/`, adaptadores `react/convex.ts` (produção) e `local.ts` (dev) |
| Backend | `packages/backend` | funções Convex direto na pasta (`convex.json`: `functions: packages/backend/`), `schema.ts`, auth Better Auth |
| Backend local | `packages/backend/local` | SQLite (`node:sqlite`) que implementa os **mesmos contratos** do domínio para `npm run dev` sem Convex |
| Tokens | `packages/ui-kit` | cores, espaçamento, tipografia |

Toda funcionalidade nova precisa existir nos dois backends (Convex e SQLite
local) com o mesmo contrato de `packages/domain`, ou registrar a diferença.

## Deploy

- Web: Cloudflare Worker `devotio`, Workers Builds ligado à `main` de
  `zee-dash-one/devotio`. Push/merge na `main` = publicação em produção.
  Branches geram versões de preview (`wrangler versions upload`).
- Backend: Convex `upbeat-jellyfish-720` (deployment de *desenvolvimento* usado
  pelo piloto), publicado com `npm run deploy:backend`. O deployment de produção
  do Convex (`acrobatic-mandrill-347`) ainda não tem as variáveis de auth.
- Previews de branch usam o mesmo Convex do piloto: não há banco isolado.
- Ordem obrigatória: backend primeiro, web depois. Schema e funções novas têm
  de ser compatíveis com a web que já está no ar (campos novos `v.optional`,
  funções antigas mantidas até a web nova subir; remover depois, em PR próprio).

## Armadilhas conhecidas do repositório

- `.gitignore` ignora `packages/**` (com algumas exceções). Arquivo **novo** em
  `packages/` precisa de `git add -f`; confira com `git status`.
- `.gitignore` também lista `AGENTS.md` e `CLAUDE.md`. `AGENTS.md` já é
  versionado, então alterações aparecem normalmente.
- `packages/backend/_generated/api.*` e `_generated/ai/` são gerados e ignorados.
- Windows PowerShell 5.1: sem `&&`; `$` expande em aspas duplas.

## Modelo de dados

Tabelas atuais em `packages/backend/schema.ts`. Tabela nova exige atualizar
`schema.ts` **e** [docs/architecture.md § Modelo de Dados](../docs/architecture.md).

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.

## Imagens editoriais — 25/10/2026

Geração no servidor, armazenamento por revisão e download da variante escolhida; SQLite usa o mesmo renderer. Tabelas e índices em docs/architecture.md. Procedimento de backend antes da web, preparação do dia e troca de arte: [operação](../docs/operations/devotional-images.md).
