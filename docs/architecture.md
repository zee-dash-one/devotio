# Arquitetura

**Atualização: 03/10/2026.** Base web implementada; deployment e OAuth reais pendentes. Ver [status](engineering/status.md) e [ADR 001](adr/001-web-first-free-launch.md).

**Extensão local de 04/10/2026:** [ADR 003](adr/003-local-sqlite-mock.md) e
[spec 006](../specs/006-desenvolvimento-local/spec.md) adicionam backend SQLite
apenas em desenvolvimento. Web → domain/local → HTTP local → backend/local → SQLite.
As fronteiras de regras e autorização continuam no backend/domain. A descrição
Convex abaixo continua sendo o caminho de produção, ainda não homologado.

## Fronteiras

Pages (destino) entrega apps/web, uma SPA/PWA. A apresentação consome domain/react e domain/convex. Convex executa identidade, autorização e transações. domain/core reúne contratos, Zod e regras puras; ui-kit fornece tokens. Expo permanece reservado.

Domain não importa DOM/React Native. Backend importa apenas domain/core. server.ts usa builders oficiais tipados com DataModel derivado do schema; não é arquivo gerado nem stub. Referências do client ficam em domain/convex e são exercitadas pelos testes contra as funções reais no convex-test.

## Fluxos

Na web, a raiz apresenta páginas públicas e estados de carregamento/offline. Um
layout de leitura sem caminho agrupa as rotas de produto e seu RepositoryProvider.
O redirecionamento de acesso usa o destino do match apresentado, com efeito estável;
uma página pública pode concluir sua navegação sem depender da localização anterior.
Devocional, Bíblia e Comunidades compartilham o shell e o player nesse layout.

Leitura resolve sessão, calcula data local e consulta by_date. Conteúdo só aparece se não retirado e publishedAt atingido. Data é reavaliada periodicamente e ao retornar ao primeiro plano. O scheduler invalida subscriptions no instante da liberação.

Auth usa Better Auth/Google no Convex, plugins crossDomain e provider oficial. Segredos ficam no servidor. Editorial usa funções internas com reviewedBy humano, licença, motivo e auditoria. Liderança de comunidade não equivale a editor global.

Toda consulta/operação comunitária verifica associação. Mural usa páginas de 50 por cursor. Ticks expressam estado desejado, derivam usuário da sessão e têm contagem apenas de membros atuais. Criar/entrar em grupo verifica unicidade transacional.

## Permissões

| Recurso | Leitura | Escrita |
|---|---|---|
| Devocional/temas | Autenticado, conteúdo liberado | Operação editorial interna |
| Grupo/mural/listas/membros | Associado ao grupo | Liderança do próprio grupo |
| Tick | Próprio estado e agregado | Próprio usuário |
| Convite | Nome para autenticado com código | Entrada transacional |

Membros não recebem emails ou autores dos ticks. Contagens pequenas podem permitir inferências. IDs relacionados são conferidos dentro do grupo. O último administrador não pode ser removido. Não existe bypass de auth no backend.

## Modelo de Dados

### Gestão de acesso ao piloto (spec 011 — 09/10/2026)

O backend conectado acrescenta aprovação global antes de qualquer leitura/escrita
de conteúdo. A identidade autenticada permanece separada da autorização. Contas
legadas sem situação são aprovadas; bootstrap preenche metadados e vincula o
`tokenIdentifier` canônico, preservando `authId` para compatibilidade. Contas novas
ficam pendentes. Pré-cadastros só são vinculados ao e-mail verificado correspondente.

| Tabela / alteração | Responsabilidade | Índices novos |
|---|---|---|
| users | authId opcional, tokenIdentifier, normalizedEmail/normalizedName, status opcional pending/approved/disabled e editorial opcional | by_tokenIdentifier, by_email, by_normalizedEmail, by_normalizedName, by_status_and_normalizedEmail, by_status_and_normalizedName |
| adminSessions | Hash do token opaco, versão das credenciais e expiração de 30 minutos | by_tokenHash |
| adminSecurity | Último contador TOTP usado pelo proprietário, por versão das credenciais | by_key |
| accessSettings | Singleton main: aprovação obrigatória para novos cadastros | by_key |
| userAdminEvents | Autor, alvo, ação e instante das mudanças de conta/permissão | by_target |

O superusuário é uma identidade operacional configurada no servidor, separada dos
participantes; o CRUD não pode removê-la nem promover participantes a superusuário.
Login é uma action com scrypt/TOTP do Better Auth e rate-limiter oficial em componente
isolado, consumido antes da autenticação em transação independente. A emissão
transacional consome o contador TOTP, impedindo replay. O token aleatório só fica
em memória no navegador; o banco guarda seu SHA-256. Cada operação administrativa
valida expiração/versão das credenciais; logout e limpeza agendada removem sessões.

Desativação preserva usuário e vínculos, revoga acesso às operações do produto e
não concede entrada na próxima autenticação. Mudanças reativas da situação retiram
as telas protegidas. O último administrador ativo de uma comunidade é protegido;
ticks de contas desativadas deixam de contar como membros ativos. Administração
comunitária continua por associação; editorial exige capacidade própria no servidor.
O painel só mostra metadados cadastrais e nomes/papéis de comunidades, sem acesso
a comentários, progresso ou outras informações privadas.

`users:backfill` normaliza registros legados em lotes. `users:importAuthUsers`
inclui contas existentes apenas no Better Auth sem duplicar pré-cadastros; o marco
ISO `PILOT_EXISTING_USERS_BEFORE` distingue antigos de novos. Executar a preparação
do [roteiro operacional](operations/user-administration.md) no rollout.

O schema abaixo descreve a base anterior; esta extensão não migra o SQLite local.

[Schema v1](../packages/backend/schema.ts):

| Tabela | Responsabilidade | Índices |
|---|---|---|
| users | authId, name, email | by_authId |
| devotionals | date, reference, translation, scripture, reflection, prayerSuggestion, credit, licenseEvidence, reviewedBy, publishedAt, selection opcional, audioUrl opcional, withdrawn, updatedAt | by_date |
| editorialEvents | devotionalId, actor, reason, action, at | by_devotional |
| globalSettings | Singleton main com temas e referências | by_key |
| communities | Nome, descrição, escritura, convite, criação | by_invite |
| communityMembers | Usuário, grupo, papel admin/member | by_user, by_community, by_pair |
| communityMessages | Grupo, autor, conteúdo, instante | by_community_time |
| checklists | Grupo e nome | by_community |
| checklistItems | Lista, texto, ordem | by_checklist |
| checklistTicks | Item e usuário | by_item, by_pair |

Índice não impõe unicidade sozinho: as operações consultam e alteram na mesma transação. Auth mantém tabelas no componente Better Auth. editorialEvents foi introduzida pela spec 004 para rastreabilidade, sem telemetria de leitores.

Revisão 013 (09/10/2026): `devotionals.selection` conserva versão, livro,
capítulo e intervalo de versículos. É opcional para ler publicações anteriores.
`editorialAccess` autoriza consulta por data, calendário e gravação; datas retiradas
continuam ocupadas. A mutation reconstrói referência/tradução/texto da fonte
ARC1911 confiável, atribui crédito ao usuário e define Brasília 00:00. Correções
mantêm o crédito original e registram revisor/motivo em `editorialEvents`.
Reflexão e oração novas/corrigidas têm limite de 512; leitura legada não trunca.

Bíblia completa, clubes, orações privadas e marcações futuras não integram o schema reconstruído. A mudança foi local; não migrar deployment existente sem plano próprio.

### Modelo SQLite do desenvolvimento (spec 006)

Revisão 008 (07/10/2026): schema local versão 3. Migração mantém mensagens anteriores
e adiciona `messages.quote` JSON opcional: seleção AA, snapshot do texto canônico,
referência e nome da versão. `sendQuote` recebe identificadores, comentário separado
e requestId UUID; confere administração e corpus no servidor. Repetir exatamente o
mesmo envio não duplica postagem/avisos; reutilizar a chave com outro conteúdo falha.

Nova tabela local `notifications`: seq/id, userId, type, entity, text, communityId,
messageId, createdAt, readAt e sourceKey único. Índice userId/seq serve paginação
de 30 itens. Mensagem e avisos aos demais participantes atuais são transacionais;
autor não recebe o próprio aviso. Sistema registra uma saudação informativa por
conta, sem repetir no login. Metadados mantêm revisão do resumo por destinatário.
Leitura explícita, consultas e resumo conferem destinatário/associação. Saída do
grupo remove seus avisos da lista/contador. Consulta dedicada abre mensagens antigas
sem percorrer o mural. Nenhuma nova tabela ou alteração no schema público Convex.

HTTP local `/__local/events` usa SSE com cookie e perfil esperado: um stream por
sessão, resumo de não lidas/revisão, heartbeat de transporte sem SQL e reconexão
automática (10 segundos). Logout/expiração encerra stream; frontend fecha ao trocar
conta/desmontar. Eventos chegam após commit. Adaptador aplica contador diretamente,
sem HTTP adicional; só invalida páginas de avisos com observadores. Revisões iguais
evitam repetir invalidação quando mutation e SSE confirmam a mesma mudança.
Mensagens do mural em outro cliente continuam podendo ser abertas/atualizadas
manualmente; SSE não sincroniza todas as áreas nem amplia caches privados.

Seleções contíguas e payload externo numerado (`n - texto`, referência, versão)
vêm de domain; Compartilhar usa clipboard ou cópia manual. A tabela local
`quoteDrafts` guarda id, userId, communityId, requestId, quote, comment, createdAt e
state (draft/published/discarded). Índice autor/destino/data e chave única
autor/destino/requestId garantem privacidade e retry sem duplicação. Envio em lote
é atômico e exige administrar todos os destinos. Até 100 rascunhos ativos por
autor/comunidade; os anteriores não são sobrescritos. Escrever consulta somente os
rascunhos próprios, pode alterar trecho/comentário, publicar ou descartar. Publicar
retira da lista e grava mensagem/avisos na mesma transação; tombstones conservam
a chave de envio para impedir recriação por retry após publicação/descarte.

O estado de formulários e seleção contextual fica em memória por conta durante
navegação, sem HTTP por tecla; logout/troca limpa. `pick` validado na rota distingue
seleção para cadastro/comunidade de leitura principal. Botão flutuante retorna
ao destino com corpo, referência e versão; gestos ficam no web. Busca FTS por termos/prefixos
normalizados começa após quatro caracteres/debounce 350 ms; até 20 resultados de
consultas recentes ficam em memória por sessão. Não há polling ou novos dados
privados persistidos no navegador; caches de leitura anteriores são preservados.

Revisão 007 (07/10/2026): a capacidade local `users.data.editorial` representa
Gestor do sistema, independente de `members.role`. Ester recebeu novo rótulo,
sem remover sessões, dados ou associações existentes. O servidor consulta essa
capacidade no banco em cada operação editorial, sem confiar no papel do client.
Nenhuma nova tabela ou alteração de schema Convex nesta entrega local.

`schedule(create)` insere somente em data livre e `schedule(update)` altera
somente um registro existente. A transação reserva a data e impede substituição
silenciosa; `publish` legado agora apenas corrige existentes. O servidor calcula
`publishedAt` à meia-noite em America/Sao_Paulo e registra autoria/revisão a partir
da sessão. Retirada lógica mantém audit, reserva da data e favoritos snapshots.
O calendário padrão local também usa Brasília, evitando guardar como ausente um
devocional antes da meia-noite do seu agendamento. Sem cron, IA ou polling: as
leituras autorizadas verificam disponibilidade pelo instante programado.

Palavra não é editável. `schedule(create)` exige seleção bíblica; o servidor deriva
corpo numerado, endereço e versão do corpus AA. Edição preserva a Palavra de
registros legados até escolher outro trecho. Formulário em memória preserva os
campos e os versos nas idas e voltas, descartando ao cancelar/salvar/trocar conta.
Não há autosave editorial nem envio para IA. Rascunhos comunitários persistem no
SQLite, não no cache do navegador. Escritas invalidam apenas o destino observado;
programação invalida somente sua data e a listagem editorial.

O schema está em `packages/backend/local/database.local.ts`, versão 3 após a revisão 008. Não são tabelas
adicionadas ao deployment Convex; seu schema permanece inalterado nesta entrega.

| Tabelas locais | Responsabilidade / unicidade |
|---|---|
| users, sessions | Perfis fictícios; token opaco, expiração, revogação |
| communities, members | Grupos; código único; associação única grupo/usuário |
| messages | Mural; cursor por sequência, índice grupo/seq |
| quoteDrafts | Rascunhos privados autor/destino, seleção canônica; chave idempotente e estado final |
| notifications | Avisos por destinatário, leitura explícita; sourceKey único e índice usuário/seq |
| checklists, items, ticks | Listas e ordem; tick único item/usuário |
| devotionals, audit | Publicação única por data, revisão/retirada e trilha editorial |
| favorites | Snapshot JSON privado único usuário/data, sem dependência de retenção do original |
| bibleBooks, bibleVerses, bibleSearch | AA; chave natural livro/capítulo/versículo; FTS5; importação atômica |
| metadata | Versão do seed, fonte, commit, hash e instante da importação |

Transações SQLite e validações Zod protegem todas as escritas. Sessão/associação
são verificadas no servidor; dados não são confiados ao papel enviado pelo client.
O header de conta esperada impede respostas de outra conta após troca de cookie
em outra aba. Banco e arquivos de origem não são servidos pelo Vite nem incluídos
no Git/build. FTS5 retorna até 40 resultados por página; mural até 50.
Módulos locais usam o sufixo `.local.ts`, excluído dos entry points pelo CLI Convex
instalado (arquivos com múltiplos pontos); nenhum módulo Convex os importa.

### Corpus SQLite por edição (spec 013)

`ScriptureStore` mantém `.data/bibles/corpus.sqlite`, separado das contas e fora
do Git. Importa integralmente `docs/bibles/ALM1911.json` com hash aprovado e
transação idempotente: 66 livros, 1.189 capítulos e 31.101 versículos.

| Tabela | Chave e conteúdo |
|---|---|
| editions | version; revisão SHA-256, origem e contagem |
| books | version/abbrev; nome, testamento, ordem e capítulos |
| verses | version/abbrev/chapter/number; texto canônico |

O adaptador local consulta esse banco; o build gera capítulos, catálogo e busca
estáticos por ele para o adaptador web publicado. Convex usa o JSON original
validado pelo mesmo contrato para reconstruir citações, sem fetch externo nem
SQLite na mutation. Não há nova tabela bíblica no Convex. A AA existente permanece
no banco local anterior; migrá-la ao corpus por edição é trabalho separado.

## Cache e plataformas

PWA precacheia shell/fontes, sem runtime cache de Convex, sessão, áudio ou dados pessoais. Conteúdo autenticado exige rede. Player HTML5 permanece no shell durante navegação, sem autoplay.

No modo local 006 (revisão autorizada em 05/10/2026), `domain/local` mantém cache
validado/versionado por usuário: janela de oito devocionais, snapshots favoritos,
catálogo AA e LRU dos seis capítulos mais recentemente acessados. O adaptador web
persiste via localStorage, separado do service worker. Lote `devotionals` recebe
até oito datas validadas com Zod e autorizadas pela janela calculada no servidor.
Na troca de dia, somente datas ausentes são transferidas; datas antigas são
removidas. Assinaturas simultâneas compartilham resultados e requisições em voo.

Não há polling HTTP. Mutações invalidam a área afetada; comunidades ficam apenas
em memória enquanto observadas e são consultadas novamente ao entrar. Atualização
manual busca a janela inteira e leituras dinâmicas abertas; Bíblia fixa reutiliza
cache. Correções editoriais em outro dispositivo exigem atualização manual.
Cookie opaco dura 30 dias, com expiração/revogação no SQLite e validação uma vez
ao abrir. Eventos de storage propagam logout/troca entre abas; timer lê somente
o relógio local. Requisições reais continuam validando identidade no servidor.

Cache sobrevive a desmontagem/recarga e é limpo no logout/troca/expiração. Leitura
offline só em sessão já aberta; reabrir exige validá-la no servidor. Sem escrita
offline e sem áudio baixado. Falha de armazenamento usa memória e mostra aviso.
Não houve alteração de tabelas nesta revisão de cache.

Expo reutilizará regras/contratos/tokens com apresentação própria. OAuth, áudio, instalação e atualização precisam de testes físicos antes do piloto. Listas e membros ainda carregam o grupo inteiro: manter o piloto pequeno.
