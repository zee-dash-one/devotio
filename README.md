# Devotio

Um espaço calmo para ler a Palavra, meditar e orar. Um app devocional minimalista, com cuidado editorial e uma comunidade discreta sob supervisão pastoral.

**Estado do código:** web/PWA com Devocional, Bíblia por edição, Comunidades,
gestão de acesso e editorial. A spec 014 acrescenta amigos e recados privados.
As specs [015](specs/015-comunidade-papeis-permissoes/spec.md) e
[016](specs/016-notificacoes/spec.md) acrescentam papéis/pedidos comunitários e
sino conectado; publicação depende da revisão dos PRs e operação do proprietário.
Há adaptadores Google/Convex e um ambiente local com perfis fictícios e SQLite.
[Como usar o ambiente local](docs/engineering/local-development.md) ·
[Validações e pendências de publicação](docs/engineering/status.md).
Código no checkout não comprova atualização de produção; Expo permanece adiado.

## Publicar e verificar (piloto pré-beta)

O site público do piloto é **https://devotio.zee-dash-one.workers.dev** (Worker
Cloudflare `devotio`). O backend em produção hoje é o deployment Convex
**`upbeat-jellyfish-720`** (tipo *development* no projeto `adm-zone:devotio-pilot`).
A web aponta para ele via `apps/web/.env.production` e variáveis de build no
Cloudflare. Detalhes e histórico operacional:
[docs/operations/release.md](docs/operations/release.md).

**Regra crítica:** merge na `main` publica **só a web**. O Convex **não** sobe
automaticamente. Mudança em `packages/backend` exige publicar o backend no piloto
**antes** do merge que leva a web nova ao ar.

### 1. Como a web é publicada

| Etapa | O que acontece |
|---|---|
| Gatilho | Push ou merge na branch **`main`** do repositório `zee-dash-one/devotio` |
| Build | Cloudflare **Workers Builds** executa `npm run build:ready` na raiz (lint, typecheck, build e `verify:web`) |
| Deploy | Em seguida executa `npm run deploy:web:built` (Wrangler publica `apps/web/dist`) |
| Onde acompanhar | Dashboard Cloudflare → **Workers & Pages** → Worker **`devotio`** → **Builds** (ou o check **Workers Builds: devotio** no commit no GitHub) |
| URL pública | https://devotio.zee-dash-one.workers.dev |

O Cloudflare instala dependências antes do build; não é necessário `npm ci` no
campo de build do painel. Campos salvos no painel estão documentados em
[release.md § Cloudflare](docs/operations/release.md#configuração-do-cloudflare-workers-builds).

### 2. Ordem quando o PR mexe em `packages/backend`

Fluxo esperado (pré-beta): branch → PR → **deploy do backend no piloto** (Hil ou
operador autorizado) → revisão → **merge na `main` pelo Hil** (dispara só a web).

1. Atualize o checkout e instale dependências (após `git pull`):

**Bash (Linux/macOS/Git Bash):**

```sh
git switch main
git pull --ff-only origin main
git switch sua-branch
npm ci
npm run lint
npm run typecheck
npm run test
npm run build:ready
```

**Windows PowerShell 5.1** (um comando por linha; encadeie com `;` se precisar):

```powershell
git switch main
git pull --ff-only origin main
git switch sua-branch
npm ci
npm run lint
npm run typecheck
npm run test
npm run build:ready
```

2. Confirme o alvo Convex **antes** de publicar:
   - O script `npm run deploy:backend` na **raiz** do monorepo roda
     `convex dev --once --typecheck enable` e usa o projeto definido em
     **`convex.json`** (raiz), com funções em `packages/backend/`.
   - O CLI lê variáveis de **`.env.local` na raiz do repositório** (mesmo nível
     que `convex.json`). Exemplo: `CONVEX_DEPLOYMENT=dev:upbeat-jellyfish-720`.
   - Um **`packages/backend/.env.local`** pode existir para `convex dev` iniciado
     no workspace backend; **não** assuma que ele vale para `npm run deploy:backend`
     na raiz. Para forçar o alvo, use
     `npm run deploy:backend -- --env-file caminho/do/seletor.env` (arquivo
     temporário, só com o deployment, fora do Git).
   - **Não** use `npm run deploy:backend:prod` nem `npx convex deploy` para o
     piloto ao vivo: isso aponta para outro deployment (`acrobatic-mandrill-347`)
     sem as variáveis de auth do piloto.

3. Autentique o Convex se necessário (`npx convex login`). Publique:

```sh
npm run deploy:backend
```

No PowerShell, o mesmo comando. Confira na saída do CLI que o deployment é
**`upbeat-jellyfish-720`**.

4. Só depois disso o Hil faz merge do PR na `main` (publicação automática da web).

Mudanças de schema devem ser **compatíveis com a web antiga** até o merge, porque
o backend sobe primeiro. Publicação manual completa (backend + web no mesmo
comando, fora do Git): `npm run deploy:pilot` — use apenas quando a intenção for
publicar ambos de uma vez.

### 3. Verificar que a web foi publicada

1. No Cloudflare ou no GitHub, confirme build **verde** para o SHA do merge na `main`.
2. Abra https://devotio.zee-dash-one.workers.dev (sessão anônima ou após logout).
3. O repositório **não** expõe commit/versão dentro do app; use o SHA do merge na
   `main` e o build do Workers Builds correspondente a esse commit.
4. Faça **hard refresh** (ou teste em janela anônima) para evitar shell PWA antigo
   do service worker.

### 4. Verificar que o backend do piloto foi publicado

Com credenciais Convex no operador:

```sh
npx convex function-spec --deployment upbeat-jellyfish-720
```

No dashboard: projeto **devotio-pilot** → deployment **upbeat-jellyfish-720** →
**Functions** — confira queries/mutations novas do PR.

**Checagem rápida sem login** (HTTP público do Convex): erro de **autenticação**
indica que a função **existe**; **`Could not find public function`** indica que
**não** foi publicada (ou o nome está errado). Exemplo com função que exige sessão:

```sh
curl -sS -X POST 'https://upbeat-jellyfish-720.convex.cloud/api/query' \
  -H 'Content-Type: application/json' \
  -d '{"path":"communities:list","args":{},"format":"json"}'
```

Resposta com mensagem do tipo *Entre na sua conta* → função presente. Para
`reading:get`, o mesmo padrão: *função não encontrada* após merge só na web
quebra o devocional para usuários logados até o backend ser republicado.

### 5. Consultar o banco com segurança

Dados do piloto são **reais** (usuários e conteúdo editorial). Somente leitura
autorizada pelo Hil:

- Dashboard Convex → deployment **upbeat-jellyfish-720** → **Data**
- CLI (somente leitura de inspeção):

```sh
npx convex data --deployment upbeat-jellyfish-720
npx convex data nomeDaTabela --deployment upbeat-jellyfish-720 --limit 10
```

Não exportar dumps para o Git, não commitar `.env*` nem capturas com PII. Não
alterar registros pelo dashboard sem procedimento operacional.

### 6. Problemas comuns e recuperação

| Sintoma | Causa provável | Recuperação |
|---|---|---|
| App carrega, mas telas Convex falham; console *Could not find public function* | Web nova, backend antigo (merge sem `deploy:backend`) | Na `main` ou na branch do PR: `npm run deploy:backend` no piloto; validar `function-spec` e smoke na URL |
| Auth ou comunidade quebram após deploy errado | Publicou em `deploy:backend:prod` / deployment errado | Republicar com `deploy:backend` e `CONVEX_DEPLOYMENT=dev:upbeat-jellyfish-720` |
| Web parece antiga após merge verde | Cache PWA / aba antiga | Hard refresh, janela anônima ou limpar dados do site |
| Imagens do devocional após release de backend | Passo editorial opcional | [docs/operations/devotional-images.md](docs/operations/devotional-images.md) |

Incidente de referência (27/10/2026): merge na `main` publicou a web; o piloto
ficou sem funções como `reading:get` até republicar o backend no deployment correto.

### Comandos úteis (raiz)

| Comando | Efeito |
|---|---|
| `npm run build:ready` | Valida e gera artefato web; **não** publica |
| `npm run deploy:backend` | Publica funções/schema no deployment configurado (`dev:upbeat-jellyfish-720`) |
| `npm run deploy:backend:prod` | Outro deployment Convex — **não** é o piloto ao vivo |
| `npm run deploy:web:built` | Publica `apps/web/dist` (o que o Workers Builds usa após o build) |
| `npm run deploy:pilot` | `build:ready` + backend + web em sequência (manual) |

## Smoke test

Roteiro para um **bot no navegador** executar **somente quando o Hil pedir**, após
uma publicação (web e, se aplicável, backend). Objetivo: leitura e navegação
**sem criar nem apagar dados de produção**. Passos que alteram só dados da conta
de teste (favorito, tick de lista, sair) estão marcados explicitamente.

**URL:** https://devotio.zee-dash-one.workers.dev  
**Conta de teste:** *(a definir — e-mail/nome apenas; a senha fica no Vault, nunca no repositório)*

1. **Pré-checagem do backend (operador humano ou CLI, antes do bot).** Siga
   [Publicar e verificar § 4](#4-verificar-que-o-backend-do-piloto-foi-publicado):
   `function-spec` no deployment `upbeat-jellyfish-720` e/ou checagem HTTP sem
   login. **Resultado esperado:** funções do release presentes; respostas de auth
   em queries protegidas, não *Could not find public function* para contratos
   novos (ex.: `reading:get` após mudanças no devocional).

2. **Abrir o site.** Navegue para a URL acima (janela limpa ou anônima; hard
   refresh se necessário). **Resultado esperado:** título da aba contém
   `Devotio`; sem tela *Estamos preparando este espaço*; sem banner offline
   *Um instante de pausa* com internet ativa.

3. **Login.** Se redirecionar para `/entrar`, clique em **Continuar com Google**
   e conclua o fluxo com a conta de teste. **Resultado esperado:** redirecionamento
   para `/devocional` (ou destino salvo); menu da conta mostra o primeiro nome do
   usuário; não permanece em *Aguardando aprovação* nem *O acesso não foi
   concluído*.

4. **Console (sanidade do backend).** Com a sessão aberta, abra as ferramentas de
   desenvolvedor e observe erros de rede/Convex durante os passos seguintes.
   **Resultado esperado:** nenhuma mensagem *Could not find public function*;
   falhas de auth isoladas em rotas sem sessão são aceitáveis antes do login.

5. **Aba Devocional.** No cabeçalho ou na barra inferior, acione o link
   **Devocional** (`/devocional`). **Resultado esperado:** carrega o devocional
   do dia (referência bíblica, texto de leitura/reflexão visíveis); botão de data
   no formato **Devocional** *dd/mm* (ou equivalente) sem erro persistente na
   página; título da aba `Devocional · Devotio`.

6. **Devocionais recentes (somente leitura).** Clique em **Abrir devocionais
   recentes**, escolha outra data na lista se houver, feche o modal (**Fechar**).
   **Resultado esperado:** modal **Devocionais recentes** abre; troca de data
   atualiza o conteúdo; fechar volta ao devocional selecionado sem erro.

7. **Favoritos (somente leitura).** Clique no botão **Favoritos** na barra do
   devocional ou, no menu da conta (**Abrir menu da conta**), em **Favoritos**
   (`/devocional/favoritos`). **Resultado esperado:** título **Devocionais
   Favoritos** ou lista vazia amigável; nenhum erro de carregamento. *Não* use o
   botão de favoritar/desfavoritar neste roteiro (gravação na conta de teste).

8. **Leitura bíblica.** Acione **Bíblia** (`/biblia`, capítulo inicial conforme
   o app). **Resultado esperado:** versículos do capítulo visíveis; navegação
   **Anterior** / **Próximo** altera o capítulo e a URL (`book`, `chapter`) sem
   erro. *Somente leitura:* não selecione versículos, não copie para comunidade e
   não marque itens de lista comunitária neste passo.

9. **Comunidade — lista e mural.** Clique **Comunidade** (`/comunidade`).
   **Resultado esperado:** seção **Suas comunidades** com pelo menos um card (conta
   de teste deve pertencer a uma comunidade). Abra uma comunidade. **Resultado
   esperado:** aba **Mural** ativa com mensagens ou estado vazio coerente; nome da
   comunidade visível.

10. **Comunidade — membros.** Na mesma comunidade, clique **Membros**
    (`/comunidade/…/membros`). **Resultado esperado:** lista de participantes com
    nomes/iniciais; sem erro *função não encontrada*; sem tela em branco
    permanente.

11. **Notificações (somente leitura).** Clique no botão **Notificações** (sino).
    **Resultado esperado:** diálogo **Notificações** abre; lista de avisos ou
    estado vazio. Feche o diálogo. *Não* marque avisos como lidos neste roteiro
    (gravação).

12. **Compartilhar devocional (somente UI).** Em `/devocional`, abra **Compartilhar
    devocional** e feche o modal sem enviar. **Resultado esperado:** modal
    **Compartilhar devocional** abre; fechar restaura a leitura sem erro.

13. **Menu da conta.** **Abrir menu da conta** → **Ajuda e instalação**
    (`/ajuda`) e volte; opcionalmente abra **Configurações** e feche com
    **Fechar** sem alterar preferências. **Resultado esperado:** páginas carregam;
    nenhuma alteração obrigatória de dados.

14. **Sair.** No menu da conta, **Sair** (produção) ou **Sair / trocar perfil**
    (ambiente local). **Resultado esperado:** sessão encerrada; retorno a `/entrar`
    ou tela de boas-vindas; novo login possível com a conta de teste.

**Opcional (conta de teste, gravação permitida):** marcar/desmarcar **favorito** do
devocional do dia; marcar um item em **Listas** na comunidade — apenas se o Hil
pedir validação de escrita; reverta quando possível.

## Comece aqui

**Aprovação e gestão de usuários:** acesse `/gestao-acesso` no domínio do app,
com login do proprietário, senha e autenticador. O painel não fica nas
Configurações nem no Perfil. [Guia de acesso e operação](docs/operations/user-administration.md).

**Amigos e recados bíblicos:** menu da conta → Meu perfil e amigos.
[Guia da funcionalidade](docs/product/friends-and-sharing.md) ·
[Spec 014](specs/014-amigos-compartilhamento/spec.md). Código local não comprova deploy.

| Quero entender… | Documento |
|---|---|
| O produto e o primeiro lançamento | [Visão e MVP](docs/product/vision.md) |
| Como o app deve parecer e se comportar | [Direção de UI/UX](docs/design/experience.md) |
| As tecnologias escolhidas | [Stack](docs/engineering/stack.md) |
| Como publicar com orçamento de infraestrutura zero | [Custos e limites](docs/operations/free-launch.md) |
| O que existe e o que falta | [Estado real do projeto](docs/engineering/status.md) |
| A sequência de entrega | [Roadmap e decisões](docs/product/roadmap.md) |
| Toda a documentação | [Índice](docs/README.md) |

## Tech stack

Inventário conferido em **03/10/2026** nos manifests, configurações e [package-lock.json](package-lock.json). As versões abaixo são as resolvidas no lockfile; os manifests definem as faixas aceitas. Dependências transitivas completas ficam no lockfile.

### Base e monorepo

| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 24.19.0 | Runtime de desenvolvimento e ferramentas; fixado em [.node-version](.node-version) |
| npm + npm workspaces | 11.6.2 | Instalação, scripts e gerenciamento dos pacotes do monorepo |
| Turborepo (`turbo`) | 2.10.12 | Orquestração, dependências entre tarefas e cache de builds/checks |
| TypeScript | 5.9.3 | Tipagem estrita na web, domínio, backend e tokens |
| JavaScript ES Modules | — | Módulos dos workspaces e scripts de infraestrutura |

### Aplicação web e interface

| Tecnologia | Versão | Uso |
|---|---|---|
| React + React DOM | 19.3.0 | Componentes, estado e renderização da SPA |
| Vite | 6.4.3 | Servidor de desenvolvimento e build estático, com alvo ES2022 |
| `@vitejs/plugin-react` | 4.7.0 | Integração React com Vite e atualização durante desenvolvimento |
| TanStack Router (`@tanstack/react-router`) | 1.170.35 | Rotas, parâmetros, navegação e retorno ao destino após login |
| Tailwind CSS | 3.4.19 | Estilos utilitários e integração dos tokens de design |
| CSS + HTML semântico | — | Layout responsivo, estilos de leitura, formulários e diálogos nativos |
| PostCSS + Autoprefixer | 8.5.28 / 10.5.6 | Processamento de CSS e prefixos de compatibilidade |
| Lucide React | 1.45.0 | Ícones da interface |
| Fontsource Inter + Lora | 5.3.0 / 5.3.0 | Fontes locais para interface e leitura; licenças OFL em [public/licenses](apps/web/public/licenses) |
| `HTMLAudioElement` | API nativa | Áudio opcional, sem autoplay, com `preload="none"` |

### Backend, autenticação e dados

| Tecnologia | Versão | Uso / estado |
|---|---|---|
| Convex | 1.46.0 | Banco, funções e auth; backend do piloto atualizado em `upbeat-jellyfish-720` em 21/10/2026; produção Convex separada |
| `convex/react` | Incluído no Convex | Client React e subscriptions consumidos pelos adaptadores de domínio |
| Better Auth | 1.6.33 | Sessões e autenticação; faixa do manifest `~1.6.15` |
| `@convex-dev/better-auth` | 0.12.5 | Componente de auth no Convex, adapter, provider React e integração entre domínios |
| Google OAuth | Serviço externo | Único provedor de login configurado no código; credenciais e homologação pendentes |
| Zod | 3.25.76 | Validação compartilhada de formulários, entradas, ambiente e destinos de login |
| SQLite + `node:sqlite` | Incluídos no Node 24 | Banco local persistente, transações, constraints e busca FTS5; exclusivo de desenvolvimento |
| HTTP + cookie HttpOnly/SameSite | APIs Node/navegador | Sessão mock revogável e autorização no servidor local, com checagem de origem e conta |
| localStorage + cache do domínio | API nativa / implementação interna | Cache editorial de oito datas para uso local; seletor com sete publicações recentes, catálogo AA, seis capítulos LRU e favoritos por conta; sem polling HTTP |
| ABíbliaDigital — AA | Corpus fixado por commit/hash | 66 livros e 31.104 versículos importados do provedor para SQLite; sem API externa na leitura |

Os pacotes internos são `backend`, `domain` e `ui-kit`. O backend concentra identidade, autorização e transações. O domínio expõe `domain/core` (contratos, regras e validadores), `domain/react` (hooks), `domain/convex` (integração real) e `domain/local` (adaptador HTTP do modo local). `domain/preview` é a prévia antiga em memória, não usada na entrada atual. O `ui-kit` compartilha tokens de cor, espaçamento e tipografia.

### PWA e distribuição

| Tecnologia | Versão | Uso / estado |
|---|---|---|
| `vite-plugin-pwa` | 1.3.0 | Geração de manifest, registro do service worker e atualização opcional |
| Workbox (`workbox-build` / `workbox-window`) | 7.4.1 | Infraestrutura utilizada pelo plugin para precache do shell e comunicação com o service worker |
| Web App Manifest + Service Worker | APIs web | Instalação opcional e shell offline; conteúdo autenticado exige internet |
| Cloudflare Workers | Web/PWA e Workers Builds | Integração Git na `main` publica a web após merge; ver [Publicar e verificar](#publicar-e-verificar-piloto-pré-beta) |
| Convex | Backend do piloto | Deployment de desenvolvimento configurado e atualizado; acompanhamento de cotas e migração para produção são operações separadas |

O service worker não registra cache de APIs autenticadas, comunidade, sessão ou áudio. A operação gratuita depende dos [limites e condições do piloto](docs/operations/free-launch.md).

No modo local, o cache de leitura é separado do service worker e persiste após
recarregar. Sessão mock dura 30 dias; logout/troca/expiração limpam o cache pessoal.
Comunidades atualizam ao entrar, após ações e em **Menu da conta → Atualizar
conteúdo**. O mesmo botão busca correções editoriais. Detalhes e orçamento de
chamadas no [guia local](docs/engineering/local-development.md).

### Testes e qualidade

| Tecnologia | Versão | Uso |
|---|---|---|
| Vitest | 3.2.7 | Testes de regras, validações, sessão, data e backend |
| React Testing Library (`@testing-library/react`) | 16.3.3 | Testes de hooks e transições de sessão |
| jsdom | 29.1.1 | Ambiente DOM simulado para testes React |
| `convex-test` | 0.0.41 | Testes locais de autorização, isolamento, transações, paginação e agendamento |
| ESLint + `@eslint/js` | 9.39.5 | Análise estática dos workspaces e scripts |
| `typescript-eslint` + `globals` | 8.71.0 / 16.5.0 | Regras TypeScript e definição dos ambientes browser/Node no lint |
| TypeScript CLI (`tsc`) | 5.9.3 | Verificação de tipos e compilação dos pacotes compartilhados |
| Script Node de verificação do build | Interno | Inspeção de manifest, ícones, licenças, cache e ausência de fixtures via `npm run verify:web` |

Os manifests também incluem os tipos de Node/React/React DOM (`@types/*`). `@edge-runtime/vm` 5.0.0 está declarado como dependência de desenvolvimento do backend, mas não é selecionado como ambiente dos testes atuais nem comprova execução do backend no edge.

### Plataforma futura

**Expo, Expo Router, NativeWind e expo-audio** estão previstos para a etapa nativa. Não integram a aplicação executável atual: `apps/mobile` ainda não possui workspace. A v1 em desenvolvimento é a web/PWA. Detalhes das escolhas e fronteiras estão na [stack](docs/engineering/stack.md) e na [arquitetura](docs/architecture.md).

## Desenvolvimento

Leia [AGENTS.md](AGENTS.md) e a [constituição](docs/constitution.md) antes de alterar código. Funcionalidades seguem **spec → aprovação → plano → tasks → código**; consulte o [catálogo](specs/README.md).

Na raiz, com Node.js 24.19.0 e npm 11.6.2 disponíveis:

```sh
npm ci
npm run setup:local
npm run dev
```

Abra `http://127.0.0.1:3000` e escolha Daniel (AG), Marina (membro), Lucas (sem grupo) ou Ester (editorial). Sem as duas URLs Convex, o desenvolvimento usa SQLite em `.data/devotio.sqlite`. Alterações persistem após reiniciar; os devocionais iniciais são ilustrativos. AA é importada da fonte oficial. Nesta máquina a preparação já foi feita. Veja [perfis, dados e testes](docs/engineering/local-development.md).

| Comando na raiz | Finalidade |
|---|---|
| `npm run dev` | Web e backend SQLite local, quando Convex não está configurado |
| `npm run setup:local` | Baixar AA e catálogo oficiais para importação local |
| `npm run verify:local` | Verificar o servidor local em execução e seus controles de acesso |
| `npm run dev --workspace=backend` | Iniciar Convex em terminal separado, após configurar o projeto |
| `npm run lint` | Executar ESLint nos workspaces e scripts |
| `npm run typecheck` | Conferir os tipos do monorepo |
| `npm run test` | Executar testes de domínio e backend |
| `npm run build` | Gerar pacotes compartilhados e aplicação web estática |
| `npm run verify:web` | Gerar o build e inspecionar os artefatos da PWA |
| `npm run preview --workspace=web` | Servir localmente o build de produção |

## Estrutura

```text
docs/             produto, design, engenharia, operação e decisões
specs/            requisitos e acompanhamento por funcionalidade
packages/backend/ Convex: dados, autorização e operações
packages/domain/  regras, validações, tipos e hooks sem UI
packages/ui-kit/  tokens de design compartilhados
apps/web/         React + Vite + TanStack Router + PWA
apps/mobile/      reservado para Expo; ainda sem app executável
```

A reconstrução de 03/10/2026 entrega a base web, backend, testes e documentação.
O piloto público roda no Worker `devotio` e no Convex `upbeat-jellyfish-720`; veja
[Publicar e verificar](#publicar-e-verificar-piloto-pré-beta) e
[estado do projeto](docs/engineering/status.md).

## Para agentes

Graphify está disponível como ferramenta local: `npm run graphify:code` gera o
mapa AST e `npm run graphify -- query "<pergunta>"` consulta relações. Veja
[instalação, skill Codex e limites](docs/engineering/graphify.md).

Agentes (Cursor, Codex, Claude etc.) começam por [AGENTS.md](AGENTS.md). Desde
21/10/2026 o projeto está em pré-beta: toda mudança vai numa branch nova, com
commits por escopo e PR para a `main`; nada é commitado direto na `main`.

| Arquivo | Para que serve | Quando ler |
|---|---|---|
| `README.md` | visão geral, stack e como rodar | primeiro contato |
| [AGENTS.md](AGENTS.md) | regras para agentes, fluxo Git e ordem de leitura | antes de qualquer tarefa |
| [.todo/README.md](.todo/README.md) | tarefas abertas (links) e decisões pendentes | antes de executar |
| [.docs/README.md](.docs/README.md) | índice da especificação viva | antes de decidir algo |
| [.docs/regras.md](.docs/regras.md) | regras do projeto | sempre |
| [.docs/arquitetura.md](.docs/arquitetura.md) | arquitetura, deploy e armadilhas do repo | ao mexer em estrutura |
| [.docs/design.md](.docs/design.md) | padrões de código, testes e UI | ao escrever código/UI |

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.

### Compartilhamento do devocional em imagens

Implementado com geração no servidor, três tamanhos, duas artes básicas substituíveis e download/compartilhamento dos arquivos prontos. A atualização requer backend antes da web: [operação e publicação](docs/operations/devotional-images.md).

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 27/10/2026. Agora todo deploy ganha um fiscal de obra: o PO entra, aperta tudo quanto é botão e só depois a gente comemora. Bug que tentar passar escondido vai ter que mostrar a carteirinha.
