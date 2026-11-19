# Arquitetura e Modelo de Dados

Visão técnica atual das camadas, contratos, persistência, caches e invariantes do repositório.

## 1. Camadas do monorepo

| Camada | Diretório | Responsabilidade |
|---|---|---|
| Domínio puro | `packages/domain` (`domain/core`) | Tipos, contratos `Repository`, validadores Zod (`validators/`), regras de negócio e permissões puras — sem DOM nem React Native |
| Hooks e adaptadores | `packages/domain/react`, `local.ts` | Provider e hooks React (`domain/react`), adaptador Convex (`domain/convex`) e adaptador HTTP/SSE com cache local (`domain/local`) |
| Backend de produção | `packages/backend/convex` | Schema Convex (`schema.ts`), queries, mutations, actions, HTTP auth, crons e renderização Node de imagens (`convex.json` aponta para `packages/backend/convex/`) |
| Backend de dev | `packages/backend/local` | Servidor SQLite (`node:sqlite`, módulos `*.local.ts`) montado apenas pelo Vite em `DEV` quando as URLs Convex não estão definidas |
| Design tokens | `packages/ui-kit` | Tokens compartilhados de cores por tema, tipografia, espaçamento e raios |
| Aplicação Web/PWA | `apps/web` | Casca de apresentação em React 19 + Vite + TanStack Router + Tailwind 3 |
| Aplicação Mobile | `apps/mobile` | Diretório reservado para futura casca nativa em Expo |

**Fronteiras estritas:**
- `apps/web` nunca decide permissões nem duplica regras de domínio; `packages/backend` importa apenas `domain/core`.
- Toda funcionalidade de produto mantém o mesmo contrato `Repository` em Convex e em SQLite local (diferenças operacionais pontuais estão documentadas abaixo).
- Módulos locais usam sufixo `.local.ts` (ignorados pelos entry points do CLI Convex) e nunca entram no bundle público da web.

## 2. Identidade, sessão e segurança

- **Produção (Convex + Better Auth):** login Google OAuth via `@convex-dev/better-auth` com `crossDomain`. Todas as queries/mutations públicas derivam o usuário autenticado da sessão no servidor e verificam `users.status === "approved"` antes de ler ou gravar dados de produto. Nunca aceitar ID de usuário do cliente como prova de autoria ou posse.
- **Painel `/gestao-acesso`:** identidade operacional separada das contas de leitores. `adminLogin` valida credenciais em variáveis de ambiente do Convex (`scrypt` + TOTP `@better-auth/utils`) após consumir cota transacional em `@convex-dev/rate-limiter` (5 tentativas iniciais, reposição de 1/minuto) e bloquear replay do contador TOTP em `adminSecurity`. O navegador mantém o token opaco apenas em memória; `adminSessions` armazena somente seu hash SHA-256 com expiração de 30 minutos.
- **Modo local (`/__local/*`):** cookie opaco `HttpOnly`/`SameSite` de 30 dias validado no SQLite a cada requisição, somado a verificação de `Origin` loopback e cabeçalho `X-Devotio-Profile` para impedir mistura de abas ao trocar perfil.

## 3. Modelo de dados Convex (`packages/backend/convex/schema.ts`)

Índices do Convex não impõem unicidade sozinhos: todas as garantias de unicidade, cotas e contadores são verificadas e gravadas na mesma transação da mutation. Tabelas de autenticação pertencem ao componente isolado Better Auth; filas e limites pertencem aos componentes isolados `workpool` e `rateLimiter` (`convex.config.ts`).

| Grupo | Tabela | Papel principal e invariantes | Índices principais |
|---|---|---|---|
| **Usuários e acesso** | `users` | Conta vinculada (`tokenIdentifier`, `authId` legado), nome/e-mail normalizados, `status` (`pending`/`approved`/`disabled`), `editorial`, `communityCreationAllowed`, `communityCreationLimit` e contador agregado `notificationUnread` | `by_tokenIdentifier`, `by_authId`, `by_email`, `by_normalizedEmail`, `by_normalizedName`, `by_status_and_*` |
| | `accessSettings` | Singleton (`key: "main"`) que controla `approvalRequired` para novos cadastros | `by_key` |
| | `adminSessions` | Sessões ativas do proprietário (`tokenHash`, `credentialVersion`, `expiresAt`) | `by_tokenHash` |
| | `adminSecurity` | Singleton (`key: "owner"`) com `lastTotpCounter` e `credentialVersion` anti-replay | `by_key` |
| | `userAdminEvents` | Trilha de auditoria das ações administrativas (`actor`, `target`, `action`, `at`) | `by_target` |
| **Devocional e editorial** | `devotionals` | Registro único por `date` (`YYYY-MM-DD`), `selection` bíblica estruturada, textos, crédito, licença, `reviewedBy`, `publishedAt`, `audioUrl`, `withdrawn`, `imageSetId` e `imageRevision` | `by_date` |
| | `editorialEvents` | Auditoria de publicações, correções e retiradas (`devotionalId`, `actor`, `reason`, `action`, `at`) | `by_devotional` |
| | `globalSettings` | Singleton (`key: "main"`) com versículos e referências dos temas mensal e semanal | `by_key` |
| | `devotionalFavorites` | Até 3 snapshots JSON privados por usuário (`userId`, `date`, `snapshot`, `favoritedAt`) | `by_userId_and_date`, `by_userId` |
| | `favoriteRestoreReceipts` | Recibo privado de uso único (`token`) para desfazer a última remoção de favorito | `by_userId`, `by_token` |
| **Imagens editoriais** | `devotionalImageSets` | Conjunto renderizável por revisão (`devotionalId`, `revision`, `status`, `generation`, `attempts`, `expiresAt`, manifesto `files`) | `by_devotional_revision`, `by_status_updatedAt`, `by_expiresAt` |
| | `devotionalImageUploads` | Rastreamento de uploads por `sha256` e `storageId` antes do vínculo final para limpeza segura de órfãos | `by_sha256`, `by_storageId`, `by_expiresAt` |
| **Comunidades** | `communities` | Dados do grupo, `inviteCode`, `ownerId` e contador monotônico `membershipVersion` | `by_invite`, `by_ownerId` |
| | `communityMembers` | Vínculo (`communityId`, `userId`), `role` (`owner`/`admin`/`member`), `joinSequence` e `notificationUnread` daquela participação | `by_user`, `by_community`, `by_pair` |
| | `communityJoinRequests` | Pedidos de entrada (`pending`/`approved`/`rejected`/`cancelled`) e metadados de decisão | `by_communityId_and_state`, `by_communityId_and_userId`, `by_userId_and_state`, `by_userId` |
| | `communityMessages` | Mensagens do mural ordenadas por tempo e `notificationAudienceVersion` no instante do envio | `by_community_time` |
| | `checklists` | Listas de acompanhamento vinculadas à comunidade | `by_community` |
| | `checklistItems` | Itens ordenados (`order`) de uma lista | `by_checklist` |
| | `checklistTicks` | Marcação individual única por par (`itemId`, `userId`) | `by_item`, `by_pair` |
| **Amigos e recados** | `friendCodes` | Código de convite rotativo de 12 caracteres por usuário | `by_userId`, `by_code` |
| | `friendships` | Par canônico ordenado (`low`, `high`), `requesterId` e `state` (`pending`/`accepted`) | `by_low_and_high`, `by_high` |
| | `scriptureShares` | Snapshot canônico do trecho bíblico, `message`, `recipients` (visível só ao remetente) e chave idempotente (`senderId`, `requestId`) | `by_senderId_and_requestId` |
| | `shareViews` | Índice de leitura e paginação individual por dono (`ownerId`), direção (`sent`/`received`) e localização bíblica | `by_ownerId*` (5 índices) |
| | `shareMarkers` | Marcadores compactos por versículo inicial e direção dentro de um capítulo | `by_ownerId_version_book_chapter_first_direction` |
| **Notificações** | `notifications` | Avisos pessoais idempotentes por `sourceKey`, referências de destino, `readAt` explícito e flag `hidden` para revogações | `by_userId`, `by_userId_and_hidden`, `by_sourceKey`, `by_recipientMembershipId` |

## 4. Persistência local e corpus bíblico

- **Banco de aplicação local (`.data/devotio.sqlite`):** espelha em SQLite com transações e FTS5 as tabelas de usuários/sessões fictícias, devocionais/auditoria/favoritos, comunidades/governança/rascunhos (`quoteDrafts`)/listas, amizades/recados, notificações, conjuntos de imagens (arquivos PNG em `.data/devotional-images/`) e o corpus `aa`. O painel `/gestao-acesso` é exclusivo do caminho Convex conectado.
- **Corpus padronizado por edição (`.data/bibles/corpus.sqlite` e `apps/web/public/bibles/`):**
  - `docs/bibles/ALM1911.json` (SHA-256 validado pelo domínio) é a fonte canônica da Almeida 1911.
  - `scripts/prepare-bible.mjs` valida integridade/contagens e gera catálogo, capítulos JSON individuais e índice de busca estático em `apps/web/public/bibles/<hash>/`, fora do bundle JS e fora do precache do service worker.
  - Nas mutations do Convex (editorial, recados e citações), o servidor reconstrói o texto bíblico diretamente dessa fonte validada, nunca confiando em texto livre enviado pelo cliente nem consultando API externa.

## 5. Processamento assíncrono, tempo real e caches

- **Fila e geração de imagens:** salvar um devocional calcula o hash determinístico dos elementos visuais; se a revisão ainda não existir, agenda renderização serial via `@convex-dev/workpool` (paralelismo 1, até 3 tentativas) usando `fontkit` (fonte Lora OFL empacotada em `rendering/font.data.ts`) + `@resvg/resvg-js`. Crons limpam jobs órfãos/interrompidos a cada 30 min, expiram arquivos após 30 dias da data editorial e invalidam leituras na virada diária.
- **Tempo real sem polling:** Convex utiliza subscriptions nativas (`watchQuery`), liberadas ao desmontar telas. O modo local usa um único stream SSE autenticado em `/__local/events` emitido após commit, sem polling HTTP periódico.
- **PWA e armazenamento no navegador:**
  - O service worker (`vite-plugin-pwa`) faz precache apenas do shell estático (verificado automaticamente por `scripts/verify-web-build.mjs`). Conteúdo autenticado nunca entra no cache do service worker.
  - Preferências visuais persistem no navegador por perfil/aparelho.
  - No modo local, `localStorage` (`devotio:cache:v1:*`) guarda de forma validada por Zod a janela recente de devocionais, favoritos, catálogo bíblico e até 6 capítulos LRU por conta (fixando a janela ativa de leitura e separando visitas reais de prefetch), limpando tudo em logout, troca de perfil ou expiração. Dados de comunidades e recados ficam apenas em memória.

## 6. Armadilhas conhecidas do repositório

1. **`.gitignore` ignora `packages/**` por padrão:** arquivos já rastreados pelo Git em `packages/` aparecem normalmente no `git status`, mas **qualquer arquivo novo** criado dentro de `packages/` precisa de `git add -f <caminho>`. Nunca usar `-f` em `.env*`, `.convex/` ou `_generated/`.
2. **Pacote nativo na raiz para o bundler Convex:** `@resvg/resvg-js` precisa constar também no `package.json` da raiz (ao lado de `convex.json`), além de `packages/backend/package.json`, para que o CLI do Convex externalize o binário nativo corretamente no bundle de actions Node.
3. **Ordem de publicação:** o backend Convex atende tanto a produção quanto previews de branch no Cloudflare. Qualquer mudança em `packages/backend/convex` deve ser aditiva/compatível com a web já no ar e publicada pelo proprietário **antes** do merge do PR.
