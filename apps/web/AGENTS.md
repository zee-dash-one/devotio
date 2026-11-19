# AGENTS.md — apps/web

Estende [`AGENTS.md`](../../AGENTS.md), [`docs/architecture.md`](../../docs/architecture.md) e [`docs/design.md`](../../docs/design.md), incluindo todas as regras de Git e de execução (sem PowerShell).

## Regras específicas da Web/PWA

- **Stack:** React 19 + Vite SPA + TanStack Router + Tailwind CSS 3, sem SSR.
- **Fronteira de domínio:** componentes consomem hooks de `domain/react` e contratos/validadores de `domain/core`. Nenhuma regra de negócio ou decisão de permissão vive em `apps/web`. APIs de navegador (`window`, `localStorage`, `navigator`, áudio, DOM) ficam restritas a `apps/web`.
- **UI e acessibilidade:** seguir os tokens de `packages/ui-kit` e os padrões de [`docs/design.md`](../../docs/design.md) — HTML semântico, `<dialog>` nativo acessível, foco preservado, suporte a teclado e respeito a `prefers-reduced-motion`.
- **Áudio:** `HTMLAudioElement` nativo sem autoplay e com `preload="none"`.
- **PWA e caches:** o service worker faz precache exclusivamente do shell estático (HTML, JS, CSS, fontes e ícones). Nunca registrar cache de APIs autenticadas, sessões, comunidades, recados ou áudio no service worker. O cache local de desenvolvimento é separado, isolado por conta e limpo em logout/troca/expiração.
- **Isolamento do modo local:** código de desenvolvimento (`domain/local` e endpoints `/__local/*`) só pode ser carregado sob `import.meta.env.DEV` sem URLs Convex configuradas. Nunca expor fixtures, perfis fictícios ou bypass de autenticação no bundle de produção (`npm run verify:web` valida essa barreira).
