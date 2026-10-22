# Padrões de código, testes e UI

Fontes: [AGENTS.md §4 Convenções](../AGENTS.md#4-convenções-de-código),
[apps/web/AGENTS.md](../apps/web/AGENTS.md) e
[docs/design/experience.md](../docs/design/experience.md).

## Código

- TypeScript estrito; `any` só com comentário justificando.
- Validação de entrada com zod, definida uma vez em `packages/domain/validators`
  e reutilizada no Convex, no SQLite local e nos formulários.
- Regras puras (quem pode o quê) em `packages/domain` (ex.: `rules.ts`), com
  teste; as funções Convex chamam essas regras e fazem a checagem final.
- Erros para o usuário via `ConvexError("mensagem em português")`.
- Funções Convex: sempre `args` validados, consultas por índice (`withIndex`),
  paginação para listas que crescem; ler `packages/backend/_generated/ai/guidelines.md`.

## Testes

| Onde | Ferramenta | Comando |
|---|---|---|
| Regras do domínio | Vitest | `npm run test --workspace=domain` |
| Funções Convex | Vitest + `convex-test` (ver `social.test.ts`) | `npm run test --workspace=backend` |
| Backend local SQLite | Vitest (`packages/backend/local/*.test.ts`) | `npm run test --workspace=backend` |
| Web | Vitest + Testing Library + jsdom | `npm run test --workspace=web` |
| Tudo antes do PR | lint + typecheck + build PWA | `npm run build:ready` |

Toda regra nova tem teste; todo bug corrigido ganha teste de regressão; toda
permissão tem teste de acesso negado.

## UI

- Tom sereno, sem urgência: sem animação chamativa, som ou contador agressivo.
- HTML semântico, rótulos acessíveis (`aria-label`), foco retorna ao abrir/fechar
  modal, funciona no celular e no teclado.
- Ícones Lucide; estilos por área em `apps/web/src/styles/*.css` com tokens do `ui-kit`.

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.
