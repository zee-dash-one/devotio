# Devotio — Web (`apps/web`)

Aplicação SPA/PWA construída com React 19, Vite 6, TanStack Router, Tailwind CSS 3, fontes locais Lora/Inter e tokens de `packages/ui-kit`.

## Estrutura principal

- `src/main.tsx` — bootstrap da aplicação, providers e seleção automática entre adaptador Convex e adaptador local (apenas em `DEV`).
- `src/router.tsx` — árvore de rotas públicas, administrativas, editoriais e layout autenticado (`ReaderLayout`).
- `src/pages/` — páginas de Devocional/Favoritos, Bíblia, Comunidades, Editorial, Administração (`/gestao-acesso`), Acesso, Ajuda e Privacidade.
- `src/social.tsx` — Perfil, amizades e histórico/detalhes de trechos compartilhados.
- `src/styles/` e `src/ui/` — estilos por área e componentes visuais reutilizáveis.
- `public/` — ícones, licenças OFL e corpus bíblico estático gerado (`public/bibles/`, ignorado no Git).
- `wrangler.toml` — configuração de publicação estática no Cloudflare Workers.

## Comandos do workspace

Na raiz do monorepo:

- `npm run dev --workspace=web` — prepara o corpus estático e inicia o servidor Vite em `127.0.0.1:3000`.
- `npm run build --workspace=web` — gera o corpus estático e compila a SPA/PWA em `dist/`.
- `npm run preview --workspace=web` — serve localmente o artefato compilado.
- `npm run test --workspace=web` — executa os testes integrados e de interface (`Vitest` + `jsdom`).
- `npm run lint --workspace=web` e `npm run typecheck --workspace=web` — análise estática e checagem de tipos.

## Referências

- Regras do workspace: [`AGENTS.md`](AGENTS.md) e [`../../AGENTS.md`](../../AGENTS.md)
- UI, testes e acessibilidade: [`../../docs/design.md`](../../docs/design.md)
- Ambiente local e conectado: [`../../docs/development.md`](../../docs/development.md)
- Deploy e operação: [`../../docs/operations.md`](../../docs/operations.md)
