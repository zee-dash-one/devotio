# Publicação e operação do piloto

## Scripts de build e publicação — correção de 21/10/2026

Execute os comandos abaixo na raiz do monorepo. Instale as dependências com
`npm ci` usando Node 24.19.0 e npm 11.6.2.

| Comando | Efeito |
|---|---|
| `npm run build:ready` | Lint, typecheck, build e verificação do artefato web/PWA; não publica serviços |
| `npm run deploy:backend` | `convex dev --once --typecheck enable`; atualiza o deployment de desenvolvimento configurado e encerra |
| `npm run deploy:backend:prod` | `convex deploy --typecheck enable`; publica no deployment de produção selecionado pelo CLI |
| `npm run deploy:web:built` | Publica o artefato já gerado em `apps/web/dist`, sem recompilar |
| `npm run deploy:web:preview` | Envia uma versão com URL de preview, sem promover a web à produção; exige build prévio |
| `npm run deploy:web` | Valida/gera o artefato e publica a web |
| `npm run deploy:pilot` | Valida/gera o artefato, atualiza o backend de desenvolvimento configurado e publica a web; interrompe no primeiro erro |

### Configuração do Cloudflare Workers Builds

Em **Workers & Pages → devotio → Settings → Builds**, use:

| Campo | Valor |
|---|---|
| Git repository | `zee-dash-one/devotio` |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm run build:ready` |
| Deploy command | `npm run deploy:web:built` |
| Preview command (branches) | `npm run deploy:web:preview` |
| Build watch paths / Include | `*` |

O Cloudflare instala as dependências antes do build; não é necessário repetir
`npm ci` no campo Build command. Os scripts de publicação delegam ao workspace
`web`, executando o Wrangler em `apps/web`, onde estão `wrangler.toml` e `dist`.
Alterar package.json não atualiza esses campos do painel: salve os três comandos
na integração. Preview não deve usar o script de publicação de produção.

O build que falhou em 21/10 gerou o artefato e a Bíblia integralmente, mas o
comando padrão de preview `npx wrangler preview` exigiu um bloco `previews`
ausente no projeto. O check pertencia à branch do PR, não à `main`. Para a
prévia por versão usada aqui, o script executa `wrangler versions upload`;
`preview_urls = true` já está em `apps/web/wrangler.toml`. Uma URL de versão
usa os recursos configurados para o Worker: não cria isolamento do banco Convex.

Referências oficiais: [configuração de Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
e [repetir checks pelo GitHub](https://developers.cloudflare.com/changelog/post/2025-03-17-rerun-build/).
Para repetir, abra o check **Workers Builds: devotio** no PR/commit e use a ação
de reexecução; alternativamente, use o histórico de builds do Cloudflare.

### Backend usado pelo piloto e publicação em um comando

O deployment em uso confirmado pelo proprietário é `upbeat-jellyfish-720`.
Embora a web seja publicada, esse deployment é de **desenvolvimento** no Convex.
Foi atualizado com sucesso em 21/10/2026, com funções e 11 índices sociais novos.
A configuração local seleciona `CONVEX_DEPLOYMENT=dev:upbeat-jellyfish-720`.

`npx convex deploy` selecionou outro alvo: `acrobatic-mandrill-347`, produção do
projeto. Essa tentativa foi recusada porque SITE_URL, GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET e BETTER_AUTH_SECRET estavam ausentes nesse deployment.
As configurações de um deployment não são transferidas automaticamente ao outro.
Use `deploy:backend` para o alvo atual; `deploy:backend:prod` fica disponível
para a migração futura, após preparar as variáveis do alvo e os endereços da web.

Para publicar o piloto localmente em um comando, primeiro autentique o Convex e
execute `npx wrangler login`. Configure `.env.local` com o deployment acima e
`apps/web/.env.local` com o par abaixo, sem versionar esses arquivos:

```dotenv
VITE_CONVEX_URL=https://upbeat-jellyfish-720.convex.cloud
VITE_CONVEX_SITE_URL=https://upbeat-jellyfish-720.convex.site
```

Então execute `npm run deploy:pilot`. O comando altera backend e web remotos;
execute-o somente quando a intenção for publicar. Credenciais Google/admin e
BETTER_AUTH_SECRET permanecem nas variáveis privadas do deployment Convex.

No Cloudflare, configure esse mesmo par VITE nas variáveis de build. O build
normal de um PR/merge não executa `deploy:backend` nem `deploy:pilot`, e não
precisa de token Convex. Quando houver alteração no backend, publique-o antes
do merge que colocará a interface dependente dele no ar. O merge na `main`
dispara a publicação da web pela integração Git; confira o SHA no histórico.

Se mover o checkout de pasta e o bundler não resolver `domain/core`, confira os
links de npm workspaces em `node_modules`; eles podem apontar à pasta anterior.
Recrie a instalação com `npm ci` na pasta atual. Não marque o pacote como externo
nem altere os imports para ocultar um link quebrado.

## Comunidade sem dados — diagnóstico de 22/10/2026

A web da main (`08cafd1`) já usa as specs 015/016, mas uma leitura remota do
deployment `upbeat-jellyfish-720` confirmou contratos anteriores a elas:
`communities:list` aceita `{}`, `communities:detail` aceita apenas `id` e `cursor`,
e faltam as funções `communityGovernance:creation`,
`communityGovernance:myJoinRequests` e `notifications:summary`. Os logs registram
`ArgumentValidationError` para o campo `governance` e funções não encontradas.
Isso impede o carregamento da comunidade e também afeta o sino.

O código compatível já está na main. A recuperação é operacional: publicar o
backend correspondente no deployment do piloto. O registro e o estado da
recuperação ficam na [tarefa 05](../../.todo/.done/05-community-data-loading.md).
Este diagnóstico não comprova recuperação nem autoriza publicação pelo agente.

**Atualização de 23/10/2026:** após solicitação explícita do Hil para atualizar
os dois bancos, o backend foi publicado com sucesso em `upbeat-jellyfish-720`
com typecheck habilitado. A migração `communities:backfillOwners` concluiu para
as duas comunidades; quatro usuários e oito participações foram preservados,
sem owners ausentes ou inconsistentes. Os cinco contratos envolvidos foram
conferidos remotamente: queries presentes e `governance` opcional em list/detail.
O SQLite já tinha as migrações aplicadas e passou na verificação de integridade
e no `verify:local`. Confirmação da tela com sessão real em produção ainda
pendente; veja o registro da tarefa acima. O roteiro abaixo serve para futuras
publicações e não exige repetir essa migração já concluída.

### Recuperação pelo Hil

1. Validar o checkout da main atualizada com `npm run build:ready` e os testes.
2. Confirmar que o alvo configurado é **dev:upbeat-jellyfish-720**, que atende
   a web publicada. Não usar `deploy:backend:prod`, que seleciona outro ambiente.
3. Executar na raiz `npm run deploy:backend` e aguardar sucesso. O comando
   publica funções, schema e índices das specs 015/016; não é somente um build.
4. Consultar os contratos publicados com o comando somente de leitura abaixo.
   `communities:list` e `communities:detail` devem aceitar `governance` opcional;
   as três funções citadas acima devem existir como queries públicas.
5. Completar a migração de posse das comunidades antigas conforme
   [gestão de usuários](user-administration.md#criação-e-posse-de-comunidades--spec-015):
   `communities:backfillOwners` com `{"cursor":null}` atribui o admin ativo mais
   antigo como owner. É uma alteração de dados separada, reservada ao Hil;
   conferir os logs de grupos pendentes. Notificações não exigem backfill.
6. Com uma conta aprovada que já participa de uma comunidade, recarregar a web,
   conferir a listagem e abrir Mural, Listas e Membros. Conferir também o sino.
   Observar logs novos: as falhas de contrato não devem reaparecer. Não criar,
   remover membros ou publicar recados apenas para diagnosticar o carregamento.

```powershell
npx convex function-spec --deployment upbeat-jellyfish-720
npx convex logs --deployment upbeat-jellyfish-720 --history 80
```

Execute cada comando separadamente. `logs` continua acompanhando eventos até
Ctrl+C; `--history 80` limita o histórico inicial por quantidade, não por tempo.
O dashboard do alvo é
[Logs do piloto](https://dashboard.convex.dev/t/adm-zone/devotio-pilot/upbeat-jellyfish-720/logs).

### Prevenir repetição

Antes de integrar uma web que dependa de novas funções/argumentos, conferir os
contratos no deployment atendido pela web após a publicação do backend. Build
e testes locais não comprovam atualização remota. O check do Cloudflare publica
apenas a web; o checklist do PR precisa registrar separadamente a publicação do
backend e sua verificação. Não retirar argumentos novos nem ocultar erros no
cliente para encobrir um backend desatualizado.

## Validar o build automático pelo merge de um PR (21/10/2026)

Para testar a integração de publicação, mantenha a alteração em uma branch e
abra um PR com destino à `main`. O envio da branch prepara a revisão; o merge
será feito pelo responsável pelo projeto no GitHub.

1. Confirme que o PR apresenta diferenças em relação à `main` e revise os arquivos.
2. Antes do merge, confirme no provedor de build que a branch de produção é `main`
   e confira se há filtros que ignoram alterações somente de documentação.
3. Faça o merge pelo GitHub e registre o SHA resultante na `main`.
4. No histórico do provedor, confirme que um novo build iniciou para esse SHA;
   acompanhe instalação, build e resultado da publicação.
5. Confira a versão servida e uma rota direta após o sucesso. Se não houver build,
   verifique a conexão com o repositório, a branch configurada e os filtros de build.

Após transferir o repositório entre contas ou organizações, confira em
**Settings → Builds → Git repository** se a conexão aponta para o proprietário
atual (`zee-dash-one/devotio`). Se necessário, reconecte e autorize o aplicativo
Cloudflare nessa organização. Valide a reconexão com um novo PR e confira o SHA
do merge no histórico de builds; executar um build manual não testa esse gatilho.

Uma branch idêntica à `main` não permite testar esse fluxo por PR. Este roteiro
não comprova que a automação está configurada: a confirmação exige o registro do
build após o merge. Publicar a web também não comprova atualização do Convex;
verifique o backend separadamente quando a entrega alterar suas funções ou schema.

## Preparação da spec 014 (19/10/2026)

Registro de 19/10: não houve publicação naquela implementação. Em 21/10, o backend
foi atualizado em `upbeat-jellyfish-720`, conforme o registro acima. Para novas
entregas, após revisão do usuário, publicar
backend compatível antes da web: `social` introduz funções públicas autenticadas
e cinco tabelas aditivas (`friendCodes`, `friendships`, `scriptureShares`,
`shareViews`, `shareMarkers`). Não há backfill: relações começam vazias.
Não executar deploy automaticamente. Ao voltar à web anterior, conservar as
tabelas e dados sociais; não removê-los em rollback de schema.

Homologar com três contas aprovadas e uma pendente/desativada: convite/aceite,
comunidade em comum, envio para dois destinatários, recebimento sem lista alheia,
remoção, retry, paginação e marcações na edição correta. Verificar telas pequenas,
zoom, teclado, foco do modal e atualização PWA. Conferir que web e Convex apontam
para o mesmo deployment e que fixtures não entraram no build.
[Guia de uso](../product/friends-and-sharing.md) e [acesso administrativo](user-administration.md).

**Situação em 21/10:** backend do piloto atualizado; publicação web pelo fluxo corrigido ainda precisa ser validada após o merge. Os portões de lançamento abaixo permanecem um roteiro de preparação e não comprovam homologação.

## 1. Portões de lançamento

| Portão | Evidência necessária | Estado |
|---|---|---|
| Produto | Decisões da spec 004, público e provedor de acesso aprovados | Pendente |
| Conteúdo | Tradução autorizada, responsáveis e material revisado | Pendente |
| Backend | Configuração Convex oficial, geração real e auth integrada | Pendente |
| Permissões | Chamadas diretas negadas para anônimo/não membro/membro sem papel | Pendente |
| Dados | Sem demos, duplicações ou vazamento de rascunhos | Pendente |
| UI/UX | Dois fluxos completos; erros/vazio/rede/zoom/teclado verificados | Pendente |
| PWA | Instalar, atualizar e ficar offline sem expor dados privados | Pendente |
| Qualidade | Lint real, typecheck, testes e build em ambiente reproduzível | Pendente |
| Operação | Plano Free confirmado, quotas, backup/restauração e rollback ensaiados | Pendente |
| Privacidade | Aviso público, contato, retenção e pedidos de exclusão definidos | Pendente |

## 2. Ambientes e configuração

Desenvolvimento local → homologação com dados fictícios → produção com conteúdo aprovado. Não compartilhar contas, convites ou registros pessoais entre ambientes. Homologação não conecta ao banco de produção.

| Configuração planejada | Onde | É segredo? |
|---|---|---|
| VITE_CONVEX_URL | Build web do ambiente | Não; endpoint público |
| VITE_CONVEX_SITE_URL / VITE_SITE_URL | Build web para integração auth | Não; URLs públicas |
| CONVEX_DEPLOYMENT | Ferramentas locais | Identificador; não publicar configuração interna sem necessidade |
| BETTER_AUTH_SECRET | Ambiente Convex | Sim |
| Credenciais OAuth do provedor | Ambiente Convex | Segredo do provedor nunca no client |
| SITE_URL / trustedOrigins | Auth backend | Não, mas devem ter lista restrita por ambiente |
| Credencial de deploy Convex | Segredo da automação/operador | Sim |
| DEV_BYPASS_AUTH | Somente experimentação isolada | Proibido em produção; validar ausência |

Nomes definitivos de OAuth e arquivos de configuração serão estabelecidos na implementação. Tudo com prefixo `VITE_` é exposto no build. Não colocar token de deploy, chave de admin ou segredo OAuth ali.

## 3. Sequência de publicação planejada

1. Fechar os portões acima e registrar responsável pela liberação.
2. Confirmar configuração das funções Convex no diretório real `packages/backend`, dependências compatíveis e código gerado oficial.
3. Executar os checks do [guia de desenvolvimento](../engineering/development.md) em homologação.
4. Publicar backend compatível com a interface anterior. Configurar auth/origens/callbacks e verificar usuário sem privilégio.
5. Configurar Workers Builds com os scripts da seção acima, raiz `/` e branch `main`. Fixar Node/npm e fornecer somente variáveis públicas ao build.
6. Validar link direto/refresh das rotas da SPA, fallback, HTTPS, manifest e service worker antes de enviar o link a convidados.
7. Testar login/logout e retorno OAuth no subdomínio final, em Safari iOS e Chrome Android. Não depender de localhost autorizado.
8. Publicar conteúdo revisado pelo processo interno validado; conferir data, crédito e autoria.
9. Fazer um teste completo com AG, membro e usuário de outro grupo; abrir piloto limitado.
10. Acompanhar custos e erros diariamente na primeira semana. Expandir somente com evidência.

Os scripts de build/publicação, o manifest e a integração auth estão implementados. A automação Git depende dos campos salvos no Cloudflare; os portões e a homologação continuam exigindo evidências próprias.

## 4. Validação mínima

- Login cancelado/expirado; logout e troca de conta sem resíduo de comunidade.
- Sem devocional hoje, áudio ausente, URL de áudio com falha e rede indisponível.
- Virada de data, retomada após suspensão e fuso diferente.
- Convite inválido, repetido e tentativa de enumeração; não vazar membros por código.
- AG A não administra grupo B; membro não escreve no mural; usuário removido perde acesso.
- Tick só do titular, atualização repetida/concomitante sem duplicação e agregado sem nomes.
- Datas duplicadas, singleton duplicado e acesso antecipado a conteúdo futuro.
- PWA desatualizada versus backend novo; teclado, leitor de tela, zoom e barra fixa.

Testes de regras em domain não substituem testes de autorização nas funções reais.

## 5. Recuperação

Antes de migrar dados, exportar snapshot usando ferramenta oficial compatível com o plano e verificar restauração em ambiente separado. Registrar data, versão do schema e responsável. Armazenar cópias fora do Git com acesso restrito; prazo de retenção depende da decisão de privacidade.

Para regressão de frontend, voltar ao deployment estático anterior e invalidar/versionar o cache da PWA. Não presumir que rollback do frontend reverte banco ou backend. Preferir migrações aditivas; ensaiar retorno de código e compatibilidade dos dados.

Se houver exposição indevida, interromper o acesso afetado, preservar evidências técnicas sem ampliar cópias de dados pessoais e acionar o responsável definido na política. Se a falha for cota, reduzir consumo e comunicar indisponibilidade; não habilitar faturamento automaticamente.

## 6. Rotina e responsáveis

| Frequência | Ação | Papel |
|---|---|---|
| Antes de cada publicação editorial | Revisão, licença, data e visualização | Editorial |
| Diário na primeira semana | Uso, falhas de auth, conteúdo disponível | Operação |
| Semanal depois | Cotas, feedback de leitura e reserva editorial | Operação + produto |
| Antes de cada release | Checks, snapshot quando aplicável, teste e rollback | Engenharia |
| Ao mudar serviço/preço/licença | Rever custos, termos e ADR | Responsável do projeto |

Uma pessoa pode acumular papéis; nomes e contato devem ser registrados antes do piloto.

Em 23/10/2026, Hil confirmou o carregamento da Comunidade em produção após a publicação do backend e o backfill de owners. Incidente 05 encerrado.

### Entrega de seleção e compartilhamento — 24/10/2026

Tarefas 05–09 executadas em branch conjunta por autorização explícita do Hil, com um commit por tarefa e merge autorizado. Publicar `npm run deploy:backend` no piloto `upbeat-jellyfish-720` antes de integrar a web: a mudança adiciona `verses` opcional ao contrato bíblico, sem migrar ou apagar registros. `first`/`last` antigos continuam válidos. O novo compartilhamento completo usa `VITE_PUBLIC_APP_URL` (pública), com padrão `https://devotio.zee-dash-one.workers.dev`; nenhuma configuração adicional é necessária no Cloudflare para manter essa URL.

Em 24/10/2026, `npm run build:ready` e 253 testes passaram. Backend publicado no piloto `upbeat-jellyfish-720` antes do merge; `function-spec` confirmou os contratos opcionais de seleção e a governança existente. Entrega: [PR #12](https://github.com/zee-dash-one/devotio/pull/12). Sem migração de registros ou nova variável obrigatória no Cloudflare.
