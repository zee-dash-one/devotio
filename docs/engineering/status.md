# Estado real do projeto

## Graphify local — 22/10/2026

Graphify 0.9.94 instalado em `.tools/graphify`, com Python 3.12.10 e integração
Codex no projeto. `npm run graphify:code` extrai AST local incluindo packages/;
`.graphifyignore` exclui credenciais, bancos, corpus, dependências e gerados.
Uma extração e consulta ao contrato CommunityGovernance foram executadas;
clustering com `--no-label` gerou 65 comunidades, relatório e HTML, com 1.335 nós
e 3.794 arestas no mapa consolidado. Artefatos ficam em graphify-out/, ignorados
pelo Git. Nenhum modelo, MCP ou serviço cloud foi configurado. A ferramenta é
opcional e não participa do build/deploy. Procedimento em
[Graphify](graphify.md); evidências na [tarefa 04](../../.todo/04-graphify.md).

## Notificações conectadas e locais — spec 016, 21/10/2026

Implementados na branch da tarefa 03: sino conectado por subscription, contador
99+, lista paginada, destinos bíblicos/mensagens antigas e leitura exclusivamente
pelo botão Lida. Recados de amigos, aceite, remoção forçada e publicações geram
avisos idempotentes; autor não recebe a própria publicação e entradas posteriores
não recebem histórico. Agregados transacionais tornam o contador independente
do tamanho do histórico. Revogação oculta avisos da participação anterior sem
apagar dados nem alterar readAt; reingresso não os revive.

SQLite preserva avisos/readAt legados e migra referências/tipos uma vez; remove
o aviso fixo obsoleto de permissão. SSE continua após commit e Atualizar avisos
fica no local. O servidor confere destinatário do recado e acesso comunitário;
painel não recebe avisos privados nem identifica o responsável na remoção.

Verificação final sem cache: 234 testes passaram (98 domínio, 76 backend, 60 web),
sem skips ou erros não tratados. Incluem lote de 250 membros, entrada posterior
com relógio fixo, isolamento, contador/leitura, remoção pelo painel, migração com
reabertura e navegação real do roteador em jsdom. Os testes existentes com jobs
agendados agora aguardam sua conclusão entre casos. HTTP/SSE passou na execução
autorizada fora do sandbox. Lint, typecheck e build:ready passaram; PWA com 22
recursos, manifest/ícones/licenças válidos, corpus ARC1911 fora do JS/precache e
ausência de fixtures/cache de API. Permanecem avisos de dependências e SQLite
experimental, sem falhas no build.

Publicação depende da revisão dos PRs #6, #7 e #8, nessa ordem. Hil publica backend
antes da web; o backfill de owners da spec 015 continua obrigatório. Não houve
deploy, backfill em dados reais ou merge nesta execução. Google real, aparelhos
físicos e mobile não foram homologados nesta rodada; mobile permanece adiado.

## Criação, posse e pedidos comunitários — spec 015, 21/10/2026

Implementados na branch da tarefa 02: permissão de criação com limite 0–20,
owner, entrada por aprovação, cancelamento/recusa visível, gestão de admins,
saída e transferência. Painel proprietário configura permissão/limite, transfere
posse e bloqueia desativação de owner. Regras são verificadas no Convex e SQLite;
web apresenta controles e status. Migração local preserva vínculos e concessões
de fixture; o painel de credenciais permanece exclusivo do caminho conectado.

220 testes distintos passaram: 96 domínio, 66 backend e 58 web; suíte completa
inicial mais reexecuções dos arquivos alterados. HTTP/SSE passou fora da restrição
de rede do sandbox. Lint, typecheck e build:ready passaram sem cache: PWA com 22
recursos, corpus ARC1911 fora do JS/precache e ausência de fixtures/cache de API.

Rollout pendente: Hil publica backend antes da web e executa a função interna
`communities:backfillOwners` com cursor null; grupos sem gestor ativo são
reportados nos logs e precisam de correção pelo painel. Endpoints antigos são
mantidos; list/detail sem governance=true projetam owner como admin para a web
anterior. PR depende do PR #6; publicação, backfill real, Google e homologação
física não foram executados. Mobile segue adiado. Ver [operação](../operations/user-administration.md).

## Configuração de deploy — correção de 21/10/2026

A integração Git foi reconectada pelo proprietário após a transferência para
`zee-dash-one/devotio`. O build de branch registrado às 04:31 UTC compilou a web,
a PWA e os 31.101 versículos da ARC1911; falhou depois, ao executar o comando de
preview padrão `wrangler preview` sem o bloco `previews`. Os scripts agora
separam build verificado, publicação da web e prévia via `versions upload`.
O [roteiro operacional](../operations/release.md) contém os campos que devem ser
salvos no Cloudflare, além do comando único local `npm run deploy:pilot`.

Backend: a tentativa de `convex deploy` selecionou produção
`acrobatic-mandrill-347` e foi recusada por falta de quatro variáveis de auth.
Após o proprietário confirmar o alvo atual, `convex dev --once --typecheck enable`
publicou com sucesso em `upbeat-jellyfish-720`, criando 11 índices sociais.
Foi preciso reparar os links npm dos workspaces, quebrados pela mudança da pasta
do checkout. Nenhuma configuração secreta foi copiada entre deployments.

A publicação web após o merge desta correção deve ser confirmada no histórico do
Cloudflare. Validação local: `npm run build:ready` passou (lint/typecheck do monorepo,
build web/PWA e verificação de corpus, manifest, ícones, licenças e ausência de
fixtures/cache de API). Os dois scripts web passaram com `--dry-run`, encontrando
os assets de `apps/web/dist` sem enviar versões ou ativar produção. Os scripts
Convex foram conferidos com `--help`; não foi repetido deploy remoto para testar
os aliases. O comando composto `deploy:pilot` não foi executado nesta revisão.
O backend do piloto está atualizado; isso não comprova homologação de todos os
fluxos da spec 014 nem publicação no deployment de produção do Convex.


## Amigos e partilha privada — spec 014, revisão local em 19/10/2026

A [spec 014](../../specs/014-amigos-compartilhamento/spec.md) está implementada
no checkout. O menu da conta abre o Perfil, com código de convite rotativo,
pedidos recebidos/enviados, aceitação, recusa, remoção e filtro de amigos. Também
é possível convidar pela lista de uma comunidade em comum. Não há nova aba na
navegação principal nem exposição pública da lista de amizades.

A seleção bíblica permite enviar um recado a até 20 amigos ativos, com limite
de 1.000 caracteres. O servidor valida amizade/acesso, reconstrói a citação,
registra destinatários e evita duplicação ao repetir o mesmo envio. O autor vê
os destinatários; cada receptor recebe apenas autoria, recado e trecho. Ícones
distintos de envio/recebimento abrem os detalhes junto ao primeiro versículo
selecionado; o Perfil também oferece histórico paginado. Remover a amizade
impede novos envios, mas preserva o histórico privado.

O leitor removeu textos introdutórios, orientações e rodapé decorativo; mantém
filtros, texto, navegação e ações contextuais. Os créditos da edição ficam nas
Configurações. O acesso administrativo permanece em `/gestao-acesso`, com
credenciais próprias e TOTP, sem link nas Configurações ou no Perfil; foi
destacado no [guia de gestão](../operations/user-administration.md).

Convex e SQLite implementam os mesmos contratos do domínio, com cinco tabelas
aditivas. Testes cobrem consentimento, acesso negado, privacidade entre
destinatários, paginação, idempotência, persistência local e atualização entre
sessões. Passaram 205 testes distintos nesta rodada (94 domínio, 57 backend e
54 web, incluindo a reexecução dos testes afetados pelos ajustes finais).
Lint e typecheck passaram no monorepo inteiro; 154 links relativos foram
verificados em 18 documentos alterados, sem destinos ausentes.
`npm run verify:web` passou: build com 2.357 módulos, PWA com 22 recursos,
manifest/ícones/licenças válidos, ausência de fixtures e cache de API. ARC1911
permanece no artefato público com 66 livros, 1.189 capítulos e 31.101 versículos,
fora do bundle JavaScript e do precache.

**Limites:** nenhum deployment foi alterado e não foi executado codegen remoto
nesta rodada. O navegador de revisão não conseguiu abrir o servidor local
(timeout); homologação visual, Google real e aparelhos permanecem pendentes.
Expo continua adiado. O usuário fará revisão, PR e publicação; não executar
commit, push, PR nem deploy. Código local não comprova disponibilidade em produção.

## Editorial e corpus padronizado — spec 013, revisão local em 16/10/2026

O código da [spec 013](../../specs/013-editorial-biblia-publicada/spec.md) está
implementado no checkout. A listagem conectada abre `/editorial/cadastro` para
criar/corrigir, com datas livres atuais/futuras, seleção pela Bíblia e rascunho
preservado na ida/volta. Tradução usa Dropdown (ARC1911 no ambiente conectado),
texto/créditos são somente leitura, reflexão/oração têm 512 caracteres e a
disponibilidade é Brasília 00:00. Motivo é automático na criação e explicado nas
correções/retiradas; fica apenas no histórico administrativo.

O servidor verifica acesso e duplicidade, inclusive datas retiradas, reconstrói
a citação e autoria, preserva o crédito original em correções e mantém legados
longos legíveis. ARC1911 tem cópia SQLite integral por edição, importação
idempotente e geração dos arquivos públicos a partir dessa cópia. Convex usa o
JSON original validado para a mesma citação; não hospeda um banco SQL.

**Evidências automatizadas:** 189 testes passaram (90 domínio, 48 backend e
51 web). Incluem ida/volta do formulário, campos derivados, textos legados,
recusa de acesso, datas ocupadas/passadas, autoria no servidor, calendário
mensal local e reimportação SQL.
Typecheck e lint do monorepo passaram. Build de produção da web passou (2.352
módulos; PWA com 22 recursos) e `verify-web-build` confirmou catálogo, ícones,
licenças, ausência de fixtures e corpus fora do JS/precache. Codegen do Convex
concluiu em `--dry-run --typecheck enable` no deployment dev; nenhum deploy foi
executado. A primeira tentativa dentro do sandbox falhou na rede/telemetria do CLI.

**Diferenças e pendências:** o modo local mantém a etapa de programação e oferece
AA e ARC1911. Sua consulta mensal de datas livres usa o SQLite local; o cadastro
conectado consulta o Convex e oferece inicialmente ARC1911. Ambos mostram tradução
em seletor, fonte/crédito somente leitura, motivo de correção e validação
compartilhada de limites/datas. Expo permanece adiado.
Homologação autenticada/visual/física e publicação desta versão estão pendentes.
Nesta rodada, o usuário fará a revisão e abrirá o PR; não executar commit, push,
PR nem deploy. A presença do código no checkout não comprova atualização de produção.

## Menu bíblico publicado — correção de 09/10/2026

O usuário confirmou leitura pela rota `/biblia`, mas ausência da entrada nos menus.
A condição dos menus ainda exigia `repository.reading` (capacidade privada local)
e passou a reconhecer também `repository.bible` (corpus público). Três testes de
Bíblia publicada passaram, incluindo navegação desde Devocional e presença dos
links desktop/celular. Lint/typecheck do monorepo e build web passaram.

Na rodada anterior, Workers Builds de `a5d52d2` terminou com sucesso e HTTP público
confirmou catálogo JSON, João 1 com 51 versículos e assets atuais. Isso comprovou
o corpus e o leitor, mas não o menu autenticado; a hipótese de cache não explicou
essa regressão. Homologação autenticada no aparelho permanece separada dos testes.

Na ocasião desta correção de menu, o editorial conectado ainda não tinha seleção
integrada. Esse registro histórico foi superado pela implementação da spec 013,
descrita acima; não representa o estado atual do checkout.

## Bíblia e gestão integradas — correção do build de 09/10/2026

O merge `46f3bb0` em `main` retirou as exportações de Bíblia do ponto de entrada
`domain/core`, causando a falha de Rollup informada pelo usuário em produção.
Também retirou a composição de `Repository.bible` no app conectado. Ambas foram
restauradas preservando o painel administrativo, o editorial e a aprovação de
contas. A [spec 012](../../specs/012-versoes-biblia/spec.md) volta ao catálogo.

ALM1911 pode ser escolhida nas Configurações; catálogo, capítulos e busca usam
arquivos estáticos gerados do JSON fornecido. A edição tem 66 livros, 1.189
capítulos e 31.101 versículos. Corpus separado do bundle JS e do precache PWA.

**Evidências desta correção:** 135 testes passaram (88 domain e 47 web), incluindo
quatro testes da composição conectada com acesso aprovado, pendente, desativado
e sem autenticação. Lint/typecheck do monorepo, build de produção do workspace
web e verificação do artefato passaram. Não houve alteração de funções/schema
Convex nem nova implantação do backend. Publicação do Worker e homologação
visual/física devem ser confirmadas separadamente.

## Gestão de usuários e aprovação — branch de 09/10/2026

[Spec 011](../../specs/011-gestao-usuarios-aprovacao/spec.md) aprovada e implementada
na branch `codex/gestao-usuarios-aprovacao`, sem publicação. `/gestao-acesso` tem
entrada administrativa com senha/TOTP, sessão de 30 minutos, limite de tentativas,
proteção contra replay, listagem paginada, busca, pré-cadastro, edição, aprovação,
desativação e concessão de editorial/admin por comunidade. Não aparece nos menus.

Google mantém novas contas pendentes; bootstrap vincula somente pré-cadastro com
e-mail verificado. Contas antigas são preservadas pelo registro legado ou marco
de ativação, com backfill/importação em lotes preparados. Todas as operações
públicas de conteúdo exigem aprovação no servidor. Revogação retira conteúdo da
interface por assinatura reativa. Desativação conserva dados e não se desfaz por
novo login; último administrador ativo protegido. Editorial conectado inclui
cadastro manual/correção/retirada; corpus SQLite permanece no modo local.

**Evidências:** 163 testes passaram (83 domain, 39 backend, 41 web), sem skips.
Lint e typecheck passaram no monorepo inteiro.
Build/PWA e `verify:web` passaram, com 22 recursos estáticos e sem cache de API.
Tipos/módulos Convex analisados por codegen, sem finalizar deploy. A primeira
rodada teve bloqueio de loopback pelo sandbox e timeouts sob carga; a rodada
completa autorizada com dois workers por suíte e workspaces em sequência passou.

**Pendências operacionais:** configurar credenciais privadas e marco de usuários
existentes, publicar backend/web, executar backfill/importação e homologar Google
e autenticador reais. Revisão visual física e Expo não realizados. O
[roteiro](../operations/user-administration.md) descreve setup e recuperação.
O script de credenciais não foi executado pelo agente; nenhum segredo foi gerado
ou gravado para o proprietário e nenhuma conta real foi alterada.

Auditoria npm online indicou 11 entradas em dependências de desenvolvimento
preexistentes (3 moderadas, 6 altas, 2 críticas; Vitest/Tinypool e cadeia de
Tailwind entre elas). Os pacotes afetados mantêm as versões anteriores à branch;
atualização dessas ferramentas não foi incluída neste CRUD. Nenhuma conclusão
de ausência de vulnerabilidades foi baseada no audit offline.

## Cabeçalho desktop na rolagem — revisão de 08/10/2026

Casca comum mantém cabeçalho fixo acima de 900 px: completo no topo e compacto
após 64 px de rolagem, expandindo ao retornar até 16 px. Marca devotio, ícones
de Devocional/Bíblia/Comunidade com nomes acessíveis, sino menor e perfil
clicável reutilizam os controles existentes. Faixa mensal presente no
devocional fica mais estreita e mantém o conteúdo. Altura completa reservada
para estabilizar a leitura; medição ignora a transição de 180 ms e é retomada
após assentamento visual. Scroll passivo agrupado com requestAnimationFrame,
ResizeObserver e listeners removidos ao desmontar; sem consultas de rede.
Movimento reduzido desativa transições. Mobile e editor independente mantêm
seus layouts; homologação visual/física permanece pendente.

Verificação: 34 testes web passaram, lint/typecheck do monorepo e build/PWA
passaram. Integração confirma altura reservada, compacto/retorno ao topo,
sino acionável e ausência de consultas por rolagem. Aviso de bundle >500 kB
já existente permanece.

## Selects em modal de opções — revisão de 08/10/2026

Os seis campos compartilhados (tema, modo de leitura, livro, capítulo,
data favorita e rascunho comunitário) agora abrem o mesmo Modal/dialog usado
pelos devocionais recentes. Título do campo, lista rolável, grupos e check da
opção atual seguem os temas. Escolher aplica e fecha; X, Escape e backdrop
cancelam a escolha, devolvendo foco ao campo. Teclado mantém setas, Home/End,
digitação e Enter/Espaço; Tab permanece no dialog nativo.

Modal filho em Configurações usa portal no body e títulos com IDs únicos;
fechá-lo preserva o modal pai. Removidos painel ancorado, Popover API e
listeners de posicionamento/scroll. Sem nova dependência, consulta ou regra
de negócio. Homologação visual física permanece pendente.

Verificação: 33 testes web passaram sem skips (28 integração + 5 componente),
lint/typecheck do monorepo e build/PWA passaram. Sem tags select, Popover API
ou painel ancorado remanescente na web. Domain/backend não foram alterados
nesta revisão. Mantido o aviso existente de bundle acima de 500 kB.

## Menu da conta e favoritos vazios — revisão de 08/10/2026

Menu da conta fecha em pointerdown/clique externo, Escape e botões/links
internos sem cancelar a ação. Casca web ocupa ao menos a viewport; conteúdo
expande para deixar o rodapé compacto no fim, reservando a navegação móvel
e safe area sem sobreposição.

Marcador de favorito sempre visível; desabilitado sem leitura nem remoção
para desfazer. Remover o último favorito na aba Favoritos permite restaurar
a mesma cópia ao tocar novamente, até sair dessa tela. Backend retém um único
snapshot removido por perfil em memória com recibo opaco de uso único;
restauração preserva conteúdo e data originais inclusive fora da janela ou
após retirada editorial, rejeitando recibos de outros perfis. Logout/reinício
do servidor encerra os recibos. Nenhum conteúdo do client é aceito para
restaurar, nenhuma tabela nova e apenas favoritos são reconsultados ao salvar.
Homologação visual em aparelho e mobile nativo permanecem pendentes.

Verificação desta revisão: 31 testes web, 78 domain e 12 SQLite passaram,
além de lint/typecheck do monorepo e build/PWA. Houve timeout inicial em
um teste web; repetição completa passou sem skips. Teste do menu repetido
após incluir clique externo. Mantido aviso existente de bundle >500 kB.

## Navegação do devocional — revisão de 08/10/2026

Faixa superior com `Devocional dd/MM/aaaa`, seta independente para modal dos
oito dias recentes (data, referência e prévia do texto base), `Favoritos` e
marcador com/sem check para salvar ou remover a leitura exibida. Mantido o
seletor e as cópias pessoais da tela de favoritos; alternar telas preserva a
data recente. Removidos introdução ornamental, data duplicada e atalho
Começar a leitura acima de Palavra. Temas e escala de fonte preservados.

Sem alterações em domain/backend ou armazenamento. Teste integrado confirma
que abrir o modal e escolher uma leitura em cache não acrescenta chamadas
ao servidor. 29 testes web passaram (26 integração + 3 Dropdown), lint e
typecheck do monorepo e build/PWA passaram. Mantido aviso existente de bundle
acima de 500 kB; conferência visual em dispositivo e mobile pendentes.
Ver [spec 001](../../specs/001-devocional-diario/spec.md).

Os ícones da faixa agora têm superfície e contorno próprios, alvos de toque
de 44 px, transições de 160 ms no hover (somente ponteiro preciso), feedback
de pressão no toque e foco visível por teclado. Seta indica modal aberto;
favorito mantém destaque quando salvo. Cores seguem os tokens dos temas;
movimento reduzido desativa transições e transformações. Implementação em
CSS, sem listeners, timers ou chamadas de rede adicionais. Conferência
visual das interações em dispositivo físico permanece pendente.

## Dropdowns dos temas — revisão de 08/10/2026

Os seis selects da web foram substituídos por um componente Dropdown: tema,
modo de leitura, livro, capítulo, data do devocional e rascunho comunitário.
Trigger e painel usam tokens dos temas, opção selecionada com check, grupos dos
testamentos, rolagem interna e posicionamento na viewport. Painel em portal,
com Popover API quando disponível para aparecer sobre modais; fallback sem a API.
Teclado: setas, Home/End, digitação por prefixo, Enter/Espaço, Escape e Tab;
clique externo fecha sem alterar valor. Opções/campos desabilitados preservados.
Sem nova dependência, regra de negócio ou consulta de rede. A revisão visual em
aparelho físico permanece pendente, como na spec 009.

Verificação: 28 testes web passaram sem skips (25 integração + 3 componente),
lint, typecheck e build/PWA passaram. Nenhum select nativo permanece na web; domain/backend
não foram alterados nesta revisão. Mantém o aviso existente de bundle >500 kB.

## Configurações de leitura — implementação de 08/10/2026

[Spec 009](../../specs/009-configuracoes-leitura/spec.md) aprovada pelo usuário em
08/10/2026 e implementada na web local. Menu do perfil → Configurações abre modal
com Dia/Noite/Papiro/Contraste/Pelo horário, escala de oito tamanhos (14–32 px) e
modo Paginado/Contínuo. Aplicação imediata, preferências isoladas por perfil/aparelho
e persistência agrupada, inclusive ao fechar/sair. Relógio local usa um timer para
a próxima transição 06h/18h e reavalia ao retornar; sem consultas de rede.

Os dois modos preparam atual/anterior/próximo após priorizar o atual. Domain fixa
a janela no cache de seis, preserva histórico de visitas separado das antecipações
e deduplica requisições. Contínuo renderiza só três capítulos com âncora/compensação;
Paginado aceita gesto horizontal grande (esquerda anterior/direita próximo).
Seleção e menu têm prioridade; rolagem vertical/arraste curto não paginam. Fluxos
contextuais de devocional/comunidade permanecem preservados. Tokens dos temas em
ui-kit e escala relativa incluem menus, modal e editor.

Sem migração de banco, novas traduções ou dependências externas. O
[plano do corpus](bible-corpus-plan.md) continua proposta separada; AA permanece
no SQLite da aplicação. Pacote integral offline e implementação nativa não foram
entregues. Homologação visual de temas/fonte e gestos físicos permanece pendente.

**Verificação de 08/10:** 131 testes passaram sem skips (77 domain + 30 backend +
24 web), incluindo HTTP/SSE. Integração comprova troca imediata sem consultas
extras, preferências restauradas/isoladas no logout, navegação por gesto e janela
contínua limitada com reutilização ao retornar. Build/PWA verificado sem fixtures
ou cache de API; mantém 19 recursos estáticos e aviso de bundle acima de 500 kB.
Lint e typecheck passaram no monorepo; links locais e diff verificados.

## Seleção, compartilhamento e notificações — verificação de 07/10/2026

[Spec 008](../../specs/008-selecao-compartilhamento-notificacoes/spec.md) implementada
no modo web local. Seleção simples e intervalo contíguo por clique/Shift/teclado,
arraste e long-press; destaque e menu lateral com X/Limpar. O painel ocupa toda a
altura à direita e alterna entre texto/ícones e faixa compacta por seta ou swipe.
Swipe no painel não seleciona versos nem aciona botões ao soltar; swipe rápido à
esquerda na leitura móvel expande a faixa compacta. Compartilhar inclui
versos numerados, referência e Almeida Atualizada (AA), por clipboard/cópia manual.
Administrador marca múltiplos grupos e Enviar salva rascunhos privados persistentes;
Escrever permite escolher um deles, comentar, guardar, publicar ou descartar.
Gestor do sistema inicia cadastro com Palavra somente leitura e metadados separados.
Busca e botão flutuante navegam à Bíblia/retornam, preservando os dois formulários,
capítulo e seleção, sem menu lateral contextual. Menu principal mantém leitura normal.

SQLite versão 3 mantém quote opcional às mensagens antigas, avisos por destinatário
e acrescenta quoteDrafts por autor/destino. Lote atômico, consulta/escrita/publicação
autorizadas e tombstone de idempotência impedem duplicação/recriação por retry.
Criação editorial exige seleção; servidor reconstrói corpo, referência e versão,
preservando Palavra dos registros legados até nova seleção. Todas as alterações são
com migração não destrutiva. Servidor confere intervalo no corpus AA, administração
e idempotência; mensagem/avisos são transacionais. Autor não recebe o próprio aviso,
novos membros não recebem histórico como novidade e removidos perdem acesso.

Sino junto à conta abre modal paginado, com entidade em negrito/data à direita.
Lida é ação explícita por aviso; abrir modal/destino não marca leitura. Resumo muda
por SSE autenticado, sem polling ou nova consulta para atualizar contador. Apenas
a página de avisos observada é invalidada. Stream fecha no logout/troca/expiração;
reconexão automática e atualização manual em caso de falha. Nenhuma marcação de
leitura bíblica foi criada, conforme esclarecimento do usuário.

Busca automática após quatro caracteres/debounce 350 ms, FTS por termos/prefixos e
até 20 consultas recentes reutilizadas em memória por sessão. Não amplia caches
persistentes dos oito devocionais/seis capítulos nem guarda rascunhos/notificações
comunitárias no navegador. Mural em outra sessão não recebeu sincronização global;
notificação abre mensagem alvo por consulta própria quando necessário.

**Checks da revisão atual:** 121 testes passaram, sem skips (71 domain + 30 backend + 20 web).
Os 20 testes web foram executados nesta revisão do menu; domain/backend foram
reutilizados do cache verificado, pois não houve alteração nessas áreas. Novos
testes cobrem seta, preservação de destinos, swipe e supressão de clique após arraste.
HTTP/SSE real passou na execução autorizada fora da restrição de loopback do sandbox.
Lint/typecheck e `verify:web` passaram; build/PWA sem fixtures/cache de API, com
aviso já existente de bundle acima de 500 kB.
Web verificada em React StrictMode/jsdom, incluindo arraste simulado. Inspeção visual,
long-press/rolagem físicos e comportamento da área de transferência seguem pendentes.
Sem serviços externos novos, IA, push, deployment público ou Expo.

## CRUD de devocionais — verificação de 07/10/2026

[Spec 007](../../specs/007-cadastro-devocionais/spec.md) implementada no modo web
local: Ester é identificada como Gestor do sistema, com capacidade independente
dos papéis comunitários. Menu da conta → Gestão de devocionais abre a listagem;
cadastro/edição ficam em tela branca separada, com tipografia uniforme. A revisão
atual acrescenta controles de busca/retorno à Bíblia, incluindo os ícones pedidos,
às ações Programar/Cancelar/Auxílio. Palavra e metadados bíblicos são somente leitura.

- Criação somente em datas livres (hoje/futuras); conflito não altera conteúdo.
- Edição somente de registro existente, com data fixa; retirada lógica confirmada
  preserva favoritos, histórico e reserva da data. Edição pode restaurar retirados.
- Servidor confere papel no banco e registra autoria/revisão da sessão, auditoria
  e instante de disponibilização à meia-noite de Brasília.
- Seleção bíblica preenche Palavra/referência; Cancelar descarta e retorna ao
  capítulo de origem. Rascunho somente em memória e isolado por conta.
- Auxílio somente mostra a mensagem sobre Peregrino; nenhuma integração de IA.
- Calendário/cache local passam a usar Brasília por padrão. Sem polling HTTP;
  escritas invalidam apenas a data afetada e a listagem editorial.

**Checks do marco inicial (substituídos pela revisão de 119 testes acima):**
`npm run test` passou com **96 testes**, sem skips (64 domain, 22 backend,
10 web). A suíte HTTP exigiu execução autorizada fora do sandbox após EACCES na
conexão loopback. `npm run lint`, `npm run typecheck` e `npm run verify:web` passaram.
Build/PWA sem fixtures ou cache de API; permanece aviso de bundle acima de 500 kB.

Testes web usam React StrictMode/jsdom, não navegador físico. Revisão visual física,
Expo e backend público continuam pendentes; nenhum serviço foi publicado. A listagem
editorial mantém o limite existente de 100 registros. Não há biblioteca/autosave de
rascunhos. Fonte/licença permanece registrada para desenvolvimento, sem comprovar
permissão de distribuição pública.

## Correção da entrada travada — verificação de 06/10/2026

Reproduzido travamento ao abrir `/` como visitante: a rota raiz decidia acesso
pela localização ainda em transição e redirecionava repetidamente, impedindo a
tela pública de concluir sua apresentação. API de sessão respondeu normalmente.

Rotas públicas agora renderizam sob a raiz; Devocional, Bíblia, Comunidades e
Editorial compartilham um layout de leitura separado. Redirecionamentos usam
efeito com destino estável e preservam a rota protegida apresentada. Cada montagem
da aplicação mantém sua instância do roteador, reutilizando o histórico do navegador.

**Checks:** 85 testes passaram (60 domain + 19 backend + 6 web), sem skips.
Os novos testes integrados usam React StrictMode, jsdom e HTTP simulado: visitante
na raiz, sessão existente, login/logout, falha de conexão, retorno à rota pedida
e navegação entre as três áreas. Lint/typecheck e `verify:web` passaram. O teste
HTTP real da suíte precisou executar fora da restrição de rede do sandbox após
`EACCES` ao conectar a loopback; passou na execução autorizada.

Não houve nova inspeção visual no Chrome. Esta rodada comprova o fluxo integrado
em DOM simulado e a compilação, preservando a pendência de revisão visual física.

## Cache local e tráfego — verificação de 05/10/2026

Revisão da spec 006 implementada a pedido do usuário. Removidos polling de sessão
a cada 3 segundos, polling de cada leitura a cada 5 segundos e invalidação global
após qualquer mutation. O modo Convex/publicação continua fora desta entrega.

- Devocionais: um lote inicial de oito datas, cache persistente por conta e carga
  somente das datas ausentes ao mudar o dia. Recarregar reutiliza os textos.
- Bíblia: catálogo persistente e seis capítulos LRU, carregados sob demanda.
- Sessão: token opaco HttpOnly por 30 dias, bootstrap deduplicado, expiração por
  relógio local e eventos de storage para logout/troca entre abas. Sem polling.
- Favoritos e comunidades: invalidação direcionada após escrita. Comunidades
  atualizam ao entrar e manualmente, sem persistir dados de grupo no navegador.
- Menu da conta: atualização manual de conteúdo e correções editoriais. Cache
  permanece legível se uma tentativa de atualização falhar por falta de rede.

**Evidências:** 79 testes passaram (60 domain + 19 backend), sem skips. Os 18
testes do adaptador cobrem orçamento de rede, 10 minutos simulados sem consultas,
recarga, diferença diária, ausência de vários dias, LRU, deduplicação, invalidação,
expiração, armazenamento cheio e respostas em voo durante logout/virada do dia.
Lint/typecheck do monorepo, build/PWA, `verify:web` e `verify:local` passaram.
Verificação HTTP inclui o lote real de oito datas e cookie de 30 dias.

**Limites:** as medições de chamadas são testes automatizados do adaptador, não
uma captura do DevTools. Revisão visual continua pendente pelo bloqueio anterior
da ferramenta. Correções em outras sessões exigem atualização manual; não há
sincronização comunitária em tempo real. Reabrir exige validação da sessão no
servidor. Cache bíblico corresponde ao corpus AA fixado; futuras atualizações do
corpus precisam versionar/inutilizar esse cache. O aviso de chunk JS acima de
500 kB permanece (533,35 kB minificado nesta rodada).

## Produto local — verificação de 04/10/2026

Implementado conforme [spec 006](../../specs/006-desenvolvimento-local/spec.md).
Use o [guia local](local-development.md) para executar e testar os perfis.

| Área | Evidência atual |
|---|---|
| Identidade | Quatro perfis fictícios, cookie HttpOnly, expiração/logout e vínculo de conta nas requisições |
| Persistência | SQLite em `.data/devotio.sqlite`; teste fecha/reabre banco e confirma favoritos/retirada preservados |
| Devocional | Oito datas calculadas no servidor por fuso validado; favoritos privados e snapshots imutáveis |
| Espelho local | JSON no navegador, limpeza de sessão e rejeição de respostas em voo após logout testadas |
| Bíblia AA | 66 livros, 1.189 capítulos, 31.104 versículos; importação idempotente e rollback integral testados |
| Busca | FTS5, acentos normalizados e páginas de 40 resultados; dez referências comparadas com API oficial |
| Comunidades | Permissões por grupo, convites, mural por cursor, listas/ticks e proteção do último admin |
| Editorial local | Perfil separado publica/corrige/retira; auditoria no banco e sem atualizar favoritos existentes |
| Web | Três abas, perfis, favoritos, Bíblia e editorial compilados; revisão visual desta rodada pendente |

**Checks:** 63 testes passaram (45 domain + 18 backend), incluindo os dois testes
do corpus AA real, sem skips nesta máquina. Typecheck/lint do monorepo e build/PWA
passaram. `verify:web` confirmou ausência de fixtures, endpoints e adaptador mock
nos assets públicos. `verify:local` confirmou login, leitura, busca, permissões e
resposta 403 para tentativa de servir o arquivo SQLite pelo Vite.

**Limites:** a ferramenta de navegador rejeitou o controle da página local por
política de URL/protocolo; não houve inspeção visual nova em desktop/celular.
Build avisa sobre um chunk JS acima de 500 kB e comentários de dependência
ignorados pelo Rollup; não são erros de compilação. Google real, migração destas
novas capacidades para Convex, publicação e mobile continuam pendentes.

## Evidências anteriores — base Convex e prévia efêmera

**Verificação local: 03/10/2026.** Nova base web implementada a partir da spec 004. Nenhuma implantação externa, migração de banco ou publicação editorial foi realizada.

| Área | Implementado | Limite de verificação |
|---|---|---|
| Web | React/Vite, rotas reais, leitura, mural, listas, membros, conta e ajuda | Navegador local; Expo adiado |
| Design | Papel e tinta, Lora/Inter locais, leitura estreita, navegação responsiva | Conferido em 390px e 1440px; auditoria AA completa pendente |
| Domain | Contratos, Zod, regras, hooks e adaptadores separados | Prévia efêmera só em DEV |
| Backend | Builders oficiais, schema tipado, identidade e autorização por grupo | Testado com convex-test; deployment não configurado |
| Auth | Better Auth/Google, CORS e provider | OAuth real depende das credenciais e origens |
| Editorial | Revisão/licença obrigatórias, upsert por data, auditoria e retirada | Conteúdo humano autorizado ainda necessário |
| Agendamento | publishedAt como barreira e scheduler para atualizar subscriptions | Relógio controlado nos testes |
| Comunidade | Convites transacionais, mural por cursor e ticks idempotentes | Contagens excluem removidos; sem edição/exclusão de mural |
| PWA | Manifest, ícones, precache estático e atualização opcional | Instalação, atualização e offline em aparelhos reais pendentes |

## Evidências

- Lint e typecheck passaram nos quatro workspaces.
- 45 testes passaram: 38 de domínio (regras, acesso, ambiente, sessão e data) e 7 de backend (autorização, isolamento, ticks, paginação e publicação).
- Build web/PWA passou. O caminho conectado também compilou com URLs de verificação, sem acessar esses serviços.
- Navegador: rotas, criação de comunidade, mural local e marcação pessoal verificados. Nenhum erro de console observado nesses fluxos.
- A prévia não persiste alterações após recarga. Nenhuma mensagem foi enviada a pessoas reais.
- Continuação: login preserva destino interno validado; erros OAuth e logout têm recuperação. Configuração parcial não ativa fixtures. Offline aparece antes da espera pela sessão.
- npm run verify:web verifica manifest, dimensões dos ícones, licenças, ausência de fixtures e registros de cache do service worker gerado. É inspeção automatizada do artefato; não substitui instalação física.
- Nesta continuação, a ferramenta bloqueou o controle do navegador por política de URL/protocolo. Os checks de 390px/1440px acima pertencem à rodada anterior; o novo fluxo OAuth ainda requer homologação.

## Antes do piloto

1. Configurar Convex e Google OAuth; verificar sessão, login/logout, revogação e origens.
2. Aprovar edição bíblica, textos, áudio, política definitiva e responsáveis.
3. Testar instalação/atualização/offline em Android/iOS, áudio real, múltiplas sessões e restauração.
4. Acompanhar cotas gratuitas; listas e membros ainda carregam o grupo inteiro, adequado apenas ao piloto pequeno.
5. Completar o [checklist de release](../operations/release.md).

Código anterior preservado no Git e em .legacy local ignorado. Nenhum banco externo foi alterado. Veja as [tasks](../../specs/004-fundacao-lancamento/tasks.md).
