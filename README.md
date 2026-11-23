# Devotio

Um espaço calmo para ler a Palavra, meditar e orar — aplicativo devocional minimalista, com curadoria editorial humana, leitura bíblica integrada, amizades privadas e comunidades sob supervisão pastoral.

## O que temos hoje

- **Devocional diário (`/devocional`, `/devocional/favoritos`):** tema mensal e semanal, leitura liberada à meia-noite (`America/Sao_Paulo`), áudio opcional sem autoplay, seletor das 7 publicações recentes, até 3 favoritos privados em snapshot (com desfazer único), referência bíblica clicável e compartilhamento em texto ou em artes PNG geradas no servidor (3 proporções × 2 paletas).
- **Bíblia (`/biblia`):** leitura contínua ou paginada sem depender de API externa em tempo de uso, busca textual paginada, janela de 3 capítulos com cache LRU de 6 capítulos, seleção individual/múltipla de versículos e menu retrátil de compartilhamento e envio. Edição pública estática Almeida 1911 (`alm1911`) e edição local adicional Almeida Atualizada (`aa`).
- **Comunidades (`/comunidade`):** criação controlada por permissão e cota individual (0–20), papéis `owner` / `admin` / `member`, entrada mediante convite por código e aprovação de liderança, mural paginado, rascunhos de citação bíblica, listas com marcações individuais agregadas e transferência protegida de posse.
- **Amigos e recados (`/perfil`):** convites consentidos por código rotativo ou comunidade em comum (até 200 vínculos), partilha privada de trechos bíblicos com recado para até 20 amigos e marcadores discretos de envio/recebimento nos versículos.
- **Notificações:** sino discreto em tempo real (subscriptions no Convex; SSE no modo local) para recados, aprovação de entrada, remoção forçada e avisos comunitários, com leitura exclusivamente explícita.
- **Configurações de aparência e leitura:** 5 temas (`Dia`, `Noite`, `Papiro`, `Contraste` e `Pelo horário`), escala de 8 tamanhos de fonte (14–32 px), modo `Paginado` ou `Contínuo` e seletor de edição bíblica.
- **Editorial (`/editorial`, `/editorial/cadastro`):** exclusivo para contas com capacidade editorial; agendamento em datas livres, seleção bíblica somente leitura, correção auditada e retirada lógica.
- **Gestão de acesso (`/gestao-acesso`):** painel não listado do proprietário protegido por login + senha + TOTP e rate limit, gerenciando aprovação de contas (`pending` / `approved` / `disabled`), permissão editorial e governança/cotas de comunidades.

## Stack principal

| Camada | Tecnologias |
|---|---|
| Monorepo e base | Node.js `24.19.0`, npm workspaces (`11.6.2`), Turborepo, TypeScript estrito |
| Web / PWA | React 19, Vite 6, TanStack Router, Tailwind CSS 3, Lucide, fontes locais Lora e Inter, `vite-plugin-pwa` (Workbox restrito ao shell estático), Cloudflare Workers |
| Domínio compartilhado | `packages/domain` (`domain/core`, `domain/react`, `domain/convex`, `domain/local`), Zod 3 |
| Backend conectado | Convex (`packages/backend/convex`), Better Auth + Google OAuth, `@convex-dev/rate-limiter`, `@convex-dev/workpool` |
| Renderização de imagens | Node runtime com `fontkit` + `@resvg/resvg-js` (compartilhado entre Convex e modo local) |
| Backend local (dev) | SQLite nativo (`node:sqlite` em `packages/backend/local`), FTS5, cookie `HttpOnly` e SSE |
| Qualidade | ESLint 9, TypeScript (`tsc`), Vitest 3, Testing Library (`jsdom`), `convex-test` |
| Mobile (reservado) | `apps/mobile` reservado para futura etapa nativa com Expo |

## Desenvolvimento rápido

Com Node.js `24.19.0` e npm `11.6.2` na raiz (sem variáveis Convex configuradas, o app sobe automaticamente no modo local com SQLite persistente em `.data/` e 4 perfis de teste em `http://127.0.0.1:3000`):

```sh
npm ci
npm run setup:local
npm run dev
```

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia a web e o backend SQLite local (ou conecta ao Convex se configurado) |
| `npm run setup:local` | Prepara dados locais iniciais e corpus bíblico AA para SQLite |
| `npm run lint` | Executa ESLint nos workspaces e em `scripts/` |
| `npm run typecheck` | Verifica tipos em todo o monorepo |
| `npm run test` | Roda as suítes de `domain`, `backend` (Convex + SQLite) e `web` |
| `npm run build:ready` | Executa `lint`, `typecheck`, build de produção e auditoria da PWA (`verify:web`) |
| `npm run verify:local` | Valida contratos HTTP, sessão e proteção de arquivos do servidor local ativo |
| `npm run deploy:backend` | Atualiza o deployment Convex configurado (uso exclusivo do proprietário) |
| `npm run deploy:pilot` | Valida o build, atualiza o backend configurado e publica a web (uso exclusivo do proprietário) |

## Estrutura do monorepo

```text
apps/
  web/              SPA/PWA em React + Vite + TanStack Router
  mobile/           reservado para futura aplicação nativa (Expo)
packages/
  domain/           contratos, regras puras, validadores Zod, hooks React e adaptadores
  backend/          schema e funções Convex (convex/) + servidor SQLite de dev (local/)
  ui-kit/           tokens compartilhados de cores, tipografia, espaçamento e raios
docs/               documentação viva do produto, arquitetura, design, dev e operação
.todo/              planejamento e tarefas ativas da Fase 4
scripts/            preparação bíblica, imagens, verificação de build e utilitários
```

## Mapa da documentação e regras

- [`AGENTS.md`](AGENTS.md) — regras obrigatórias para agentes de IA, fluxo Git e restrições de execução.
- [`.todo/README.md`](.todo/README.md) — tarefas e decisões abertas da Fase 4.
- [`docs/README.md`](docs/README.md) — índice completo da documentação viva (`constitution`, `product`, `architecture`, `design`, `development`, `operations`).
