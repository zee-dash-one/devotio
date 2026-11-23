# Ambiente de Desenvolvimento e Scripts

Guia para executar o monorepo em modo local ou conectado. Respeite sempre as regras de execução definidas em [`../AGENTS.md`](../AGENTS.md).

## 1. Requisitos e execução local (SQLite)

- **Runtime:** Node.js `24.19.0` (fixado em `.node-version`) e npm `11.6.2`.
- Quando `VITE_CONVEX_URL` e `VITE_CONVEX_SITE_URL` **não** estão definidas, `npm run dev` sobe a SPA junto com o servidor local `packages/backend/local` em `http://127.0.0.1:3000` (apenas loopback; nunca usar `--host 0.0.0.0` no modo local).

```sh
npm ci
npm run setup:local
npm run dev
```

- **Arquivos locais gerados (ignorados pelo Git):**
  - `.data/devotio.sqlite` (e `-wal`/`-shm`): contas simuladas, sessões, devocionais, favoritos, comunidades, amizades, notificações e corpus AA. Bloqueado contra leitura direta pelo servidor de arquivos do Vite (`403`).
  - `.data/bible/`: arquivos baixados uma única vez por `setup:local` para importação atômica e idempotente da AA (66 livros, 1.189 capítulos, 31.104 versículos).
  - `.data/bibles/corpus.sqlite` e `apps/web/public/bibles/`: corpus padronizado e pacotes estáticos da `alm1911` gerados por `scripts/prepare-bible.mjs` a partir de `docs/bibles/ALM1911.json`.
  - `.data/devotional-images/` e `.data/image-preview/`: PNGs renderizados localmente.
- Para reiniciar o banco local do zero sem perder estado anterior, pare o servidor e renomeie `.data/devotio.sqlite*`; uma nova base com seed inicial será criada na próxima subida.

## 2. Perfis fictícios do modo local

| Perfil | Papel inicial no seed | Uso principal em testes |
|---|---|---|
| **Daniel Almeida** | `owner` da comunidade *Esperança* (cota de criação: 1, já em uso) | Gestão comunitária, aprovação de pedidos, mural, rascunhos e listas |
| **Marina Oliveira** | `member` de *Esperança* | Leitura diária, favoritos, marcação de listas e troca de recados |
| **Lucas Santos** | Leitor sem comunidade | Fluxo de entrada por código (`ESPERANC`) e estados vazios |
| **Ester Costa** | Capacidade `editorial` + `owner` da comunidade *Caminho* (cota: 2) | Cadastro/edição/retirada de devocionais e envio multi-comunidade |

Para testar interações simultâneas entre duas contas locais (como convites de amizade, pedidos comunitários ou SSE de notificações), utilize janelas anônimas ou perfis distintos do navegador, pois abas comuns compartilham o mesmo cookie `HttpOnly`.

## 3. Ambiente conectado (Convex + Google OAuth)

1. Selecionar o deployment Convex de desenvolvimento (`convex.json` aponta para `packages/backend/convex/`).
2. No deployment Convex, garantir as variáveis privadas: `SITE_URL` (origem exata da web), `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (com callback `https://<deployment>.convex.site/api/auth/callback/google` autorizado no Google Cloud), além das variáveis administrativas descritas em [`operations.md`](operations.md) quando usar `/gestao-acesso`.
3. Copiar `apps/web/.env.example` para `apps/web/.env.local` preenchendo ambos os endpoints públicos HTTPS do mesmo deployment:
   ```dotenv
   VITE_CONVEX_URL=https://<deployment>.convex.cloud
   VITE_CONVEX_SITE_URL=https://<deployment>.convex.site
   ```
   *(Configuração parcial bloqueia o acesso em vez de cair silenciosamente no modo fictício; nunca usar prefixo `VITE_` para segredos.)*
4. Rodar `npm run dev --workspace=backend` e `npm run dev --workspace=web` em sessões separadas.

## 4. Referência de scripts na raiz

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia `apps/web` (com backend SQLite local se sem variáveis Convex) |
| `npm run setup:local` | Baixa e prepara a fonte oficial da Bíblia AA em `.data/bible/` |
| `npm run verify:local` | Exercita sessão, consultas, escrita negada e bloqueio do SQLite contra o servidor local ativo |
| `npm run lint` | Executa ESLint nos workspaces e na pasta `scripts/` |
| `npm run typecheck` | Executa `tsc --noEmit` em todos os workspaces via Turborepo |
| `npm run test` | Executa todas as suítes Vitest (`domain`, `backend` e `web`) |
| `npm run build` | Compila pacotes compartilhados, gera corpus estático `alm1911` e gera `apps/web/dist` |
| `npm run verify:web` | Compila e audita manifest PWA, ícones, licenças OFL, corpus `alm1911`, service worker e ausência de fixtures |
| `npm run build:ready` | Portão completo pré-PR: `lint` + `typecheck` + `verify:web` (sem publicar nada) |
| `node scripts/preview-devotional-images.mjs` | Renderiza localmente exemplos das 6 variantes PNG em `.data/image-preview/` |
