# Operação, Deploy, Administração e Privacidade

Procedimentos vigentes de publicação, administração de contas, imagens editoriais, controle de cotas e proteção de dados. **Nenhuma operação de deploy ou merge é executada por agentes — são exclusivas do proprietário (Hil).**

## 1. Topologia de publicação

- **Web / PWA (Cloudflare Workers):** Worker `devotio` conectado via Cloudflare Workers Builds ao repositório `zee-dash-one/devotio`.
  - **Produção (`main`):** cada merge/push na `main` compila e publica automaticamente a web.
  - **Previews (branches/PRs):** geram URLs de versão via `wrangler versions upload` (`preview_urls = true` em `apps/web/wrangler.toml`), sem promover à produção. As previews apontam para o mesmo backend Convex configurado nas variáveis do Worker (não há banco isolado por PR).
- **Backend (Convex):**
  - **Ambiente ativo do piloto:** `dev:upbeat-jellyfish-720`, atualizado via `npm run deploy:backend` na raiz (`convex dev --once --typecheck enable`). Esse comando lê o `.env.local` da raiz, ao lado de `convex.json`. Um `.env.local` dentro de `packages/backend` pode apontar para outro deployment quando o Convex é iniciado só nesse workspace.
  - **Ambiente de produção reservado:** `acrobatic-mandrill-347` (`npm run deploy:backend:prod`), reservado para migração futura após configuração própria de variáveis de autenticação e URLs da web.
- **Ordem obrigatória de release:** sempre que um PR alterar `packages/backend/convex` (schema, funções, índices ou componentes), publicar primeiro o backend (`npm run deploy:backend`), confirmar contratos/logs (`npx convex function-spec --deployment upbeat-jellyfish-720`) e **só depois** fazer o merge do PR na `main`.

### Configuração do Cloudflare Workers Builds

| Campo no painel Cloudflare | Valor |
|---|---|
| Git repository | `zee-dash-one/devotio` |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm run build:ready` |
| Deploy command | `npm run deploy:web:built` |
| Preview command (branches) | `npm run deploy:web:preview` |
| Variáveis públicas de build | `VITE_CONVEX_URL` e `VITE_CONVEX_SITE_URL` apontando para o deployment Convex ativo (opcional: `VITE_PUBLIC_APP_URL`) |

## 2. Gestão de acesso (`/gestao-acesso`)

O painel administrativo não aparece em nenhum menu da interface pública; o acesso é feito diretamente pela URL `/gestao-acesso` com login, senha e código TOTP do proprietário.

### Preparação ou rotação de credenciais do proprietário

1. Em terminal seguro na raiz do repositório, executar:
   ```sh
   node scripts/setup-admin.mjs
   ```
2. Informar e-mail de login e senha forte (mínimo 14 caracteres) e cadastrar a chave Base32 exibida em aplicativo autenticador (TOTP SHA-1, 6 dígitos, 30s).
3. O script gera localmente `.env.admin.local` (ignorado pelo Git) com `ADMIN_LOGIN`, `ADMIN_PASSWORD_HASH` e `ADMIN_TOTP_SECRET`.
4. Configurar essas três variáveis e `PILOT_EXISTING_USERS_BEFORE` (timestamp ISO UTC de referência para contas anteriores ao controle) nas variáveis privadas do deployment Convex — nunca com prefixo `VITE_` e nunca em arquivos versionados. Rotacionar qualquer uma dessas variáveis invalida imediatamente todas as sessões administrativas anteriores.

### Operação cotidiana do painel

- **Contas:** pré-cadastrar e-mail (vinculado apenas quando o Google confirmar o mesmo e-mail verificado), aprovar pendentes, reativar ou desativar contas. Desativar preserva histórico e bloqueia acesso imediatamente; exige transferir antes qualquer comunidade da qual a pessoa seja `owner` e manter ao menos um gestor ativo nos grupos.
- **Permissões:** habilitar/revogar `Gestão editorial` e `Pode criar comunidades` com limite individual de `0` a `20` (reduzir o limite preserva comunidades já criadas e bloqueia novas).
- **Comunidades:** conceder/remover participação, conceder papel `admin` ou transferir a posse (`owner`) para membro aprovado.

## 3. Operação das artes compartilháveis do devocional

- **Funcionamento:** salvar um devocional agenda automaticamente na fila Workpool a geração das 6 variantes PNG (`fontkit` + `resvg` com fonte Lora OFL incorporada). Leitores nunca disparam renderização ao abrir ou compartilhar; recebem o manifesto pronto apenas para a revisão publicada e não retirada do dia corrente em `America/Sao_Paulo`.
- **Preparação sob demanda (sem criar eventos editoriais falsos):**
  ```sh
  node scripts/prepare-devotional-images.mjs          # simulação para hoje
  node scripts/prepare-devotional-images.mjs --apply  # garante geração para hoje (aceita datas YYYY-MM-DD adicionais, até 31)
  ```
- **Retenção, falhas e chave geral:**
  - Gestores editoriais podem acionar **Preparar imagens novamente** (`devotionalImages:retry`) em caso de falha; textos longos demais para o limite de 10 páginas falham explicitamente sem truncar a Palavra/Meditação/Oração.
  - Revisões substituídas ou retiradas têm seus arquivos excluídos imediatamente; arquivos ativos expiram 30 dias após a data editorial e órfãos são varridos diariamente.
  - Configurar `DEVOTIONAL_IMAGES_ENABLED=false` no Convex pausa novas gerações e oculta manifestos na web mantendo a leitura e o compartilhamento em texto intactos.
- **Troca de templates visuais:** editar `packages/backend/convex/rendering/backgrounds.node.ts`, incrementar a versão correspondente em `packages/domain/devotional-images.ts` (ou `IMAGE_LAYOUT_VERSION` se mudar diagramação/fonte), validar com `node scripts/preview-devotional-images.mjs`, publicar backend antes da web e rodar `prepare-devotional-images.mjs --apply`.

## 4. Orçamento de cotas, licenciamento e privacidade

- **Controle de cotas gratuitas:** acompanhar periodicamente nos painéis do Convex e da Cloudflare chamadas de função, armazenamento de banco/arquivos, database I/O e banda de saída (especialmente áudios e downloads de imagens PNG). Nenhum plano pago ou serviço externo pago deve ser ativado automaticamente; ao aproximar-se de limites (50% atenção / 70% contenção / 85% contingência), priorizar sempre a leitura textual (pausando novos áudios ou imagens via configuração se necessário).
- **Licenciamento de conteúdo:**
  - `ALM1911` (`docs/bibles/ALM1911.json`, domínio público declarado e hash fixado) é a edição habilitada no artefato web público.
  - A edição `AA` permanece restrita ao banco SQLite de desenvolvimento local enquanto não houver autorização/registro formal de redistribuição pública. Novas traduções exigem comprovação de licença, arquivo fixado e hash validado antes de inclusão.
  - Fontes `Lora` e `Inter` mantêm suas licenças SIL OFL distribuídas em `apps/web/public/licenses` (conferido automaticamente no build).
  - Todo devocional publicado exige revisão humana identificada (`reviewedBy`) e registro de origem/licença (`credit`, `licenseEvidence`).
- **Privacidade e dados sensíveis (LGPD):**
  - Participação em comunidade cristã pode configurar dado pessoal sensível; o sistema coleta apenas o mínimo estritamente necessário (identificador de autenticação, nome e e-mail).
  - E-mails nunca aparecem em listas comunitárias ou buscas entre membros; marcações de listas exibem apenas agregados; amizades e destinatários de recados são isolados por titular; logs técnicos e auditorias não registram senhas, tokens nem conteúdo privado de recados.
  - Sem analytics de terceiros, rastreadores publicitários ou cache de dados autenticados em service worker. Backups e snapshots operacionais devem permanecer fora do Git e sob acesso restrito do responsável.
