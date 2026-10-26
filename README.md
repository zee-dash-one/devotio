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

## Build e publicação

Na raiz, `npm run build:ready` verifica e gera o artefato para publicação.
`npm run deploy:backend` atualiza o Convex de desenvolvimento configurado
(atualmente `upbeat-jellyfish-720`). Com credenciais e ambiente preparados,
`npm run deploy:pilot` valida, atualiza esse backend e publica a web em sequência.
[Comandos, configuração do Cloudflare e correção do deploy](docs/operations/release.md).

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
| localStorage + cache do domínio | API nativa / implementação interna | Oito devocionais com carga diária incremental; catálogo AA, seis capítulos LRU e favoritos por conta; sem polling HTTP |
| ABíbliaDigital — AA | Corpus fixado por commit/hash | 66 livros e 31.104 versículos importados do provedor para SQLite; sem API externa na leitura |

Os pacotes internos são `backend`, `domain` e `ui-kit`. O backend concentra identidade, autorização e transações. O domínio expõe `domain/core` (contratos, regras e validadores), `domain/react` (hooks), `domain/convex` (integração real) e `domain/local` (adaptador HTTP do modo local). `domain/preview` é a prévia antiga em memória, não usada na entrada atual. O `ui-kit` compartilha tokens de cor, espaçamento e tipografia.

### PWA e distribuição

| Tecnologia | Versão | Uso / estado |
|---|---|---|
| `vite-plugin-pwa` | 1.3.0 | Geração de manifest, registro do service worker e atualização opcional |
| Workbox (`workbox-build` / `workbox-window`) | 7.4.1 | Infraestrutura utilizada pelo plugin para precache do shell e comunicação com o service worker |
| Web App Manifest + Service Worker | APIs web | Instalação opcional e shell offline; conteúdo autenticado exige internet |
| Cloudflare Workers | Web/PWA e Workers Builds | Integração Git para `main` e previews de branches; scripts corrigidos em 21/10/2026, publicação após merge a validar |
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

A reconstrução de 03/10/2026 entrega a base web e backend, testes e documentação. Nenhum deployment externo foi realizado; veja o estado real antes de iniciar o piloto.

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
