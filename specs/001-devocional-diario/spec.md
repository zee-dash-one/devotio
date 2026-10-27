# Spec: Devocional Diário

> **Revisão aprovada pelo pedido de 26/10/2026:** o seletor recente mostra os **sete devocionais publicados mais recentes**, incluindo hoje se publicado, mesmo quando há datas sem publicação. Hoje é o padrão; sem publicação hoje, o mais recente assume. Favoritos privados mantêm a cópia pessoal existente, agora com limite inicial de três por conta, configurado em um único ponto e aplicado pelo servidor. O menu do perfil abre a mesma tela em modo Favoritos; a navegação principal abre Recentes. As regras anteriores da janela de oito datas ficam substituídas por esta revisão. Compartilhamento sempre usa a leitura selecionada. Implementação e evidências: [tarefa 12](../../.todo/.done/12-recent-devotionals-favorites.md).

> Revisão de 02/10/2026: aprovação histórica dos requisitos preservada; não significa implementação concluída. A distribuição inicial web e as lacunas estão no [catálogo](../README.md). Novos requisitos de fundação constam da [spec 004](../004-fundacao-lancamento/spec.md).  
> **Histórico de 04/10/2026:** a janela original continha hoje e os sete dias anteriores; a revisão de 26/10/2026 substitui essa regra. A cópia pessoal de favoritos permanece.

**ID:** 001-devocional-diario
**Status:** aprovada (requisitos 11–13 aguardam plano/tasks e implementação)
**Versão alvo:** v1 (lançamento)

## 1. Contexto e problema

O usuário abre o app e precisa, em um único olhar, encontrar o texto e a reflexão
do dia sem navegar por menus. Esta é a tela principal do app e define a primeira
impressão de "sobriedade" que o produto se propõe a ter.

## 2. Papéis envolvidos

- **AG / equipe editorial**: publica o devocional do dia (via painel administrativo
  ou script — fora de escopo desta spec, ver §7).
- **Membro / usuário sem comunidade**: apenas consome. Sem diferenciação entre eles
  nesta feature — o devocional diário é o mesmo para todo usuário autenticado.

## 3. Histórias de usuário

- Como usuário, eu quero ver o versículo do mês fixo no topo, para meditar nele ao
  longo de todo o mês.
- Como usuário, eu quero ver o devocional do dia (texto + reflexão) sem precisar
  navegar, para manter a leitura como primeira ação ao abrir o app.
- Como usuário, eu quero ouvir o áudio do devocional, para poder consumir enquanto
  faço outra atividade.
- Como usuário, eu quero uma sugestão de oração curta ligada ao tema do dia, para
  direcionar minha oração pessoal.
- Como usuário, eu quero reler os sete devocionais publicados mais recentes, mesmo
  quando houve dias sem publicação.
- Como usuário, eu quero favoritar o devocional de um dia e guardar uma cópia na
  minha conta, para conservar o texto mesmo depois que ele sair dos recentes.

## 4. Requisitos funcionais

### Revisão visual autorizada — 08/10/2026

- A faixa superior reúne `Devocional dd/MM/aaaa`, seta independente para abrir os recentes, `Favoritos` e ação de favoritar a leitura exibida (marcador sem check/com check).
- A seta abre um modal com os sete devocionais publicados mais recentes: data, referência e prévia do texto base. Escolher um item fecha o modal e abre a leitura sem nova consulta de dados já carregados.
- Alternar entre Devocional e Favoritos preserva a data recente selecionada. Favoritos mantém suas cópias pessoais e seleção.
- Remover introdução ornamental, data duplicada e Começar a leitura acima de Palavra; preservar conteúdo, temas e escala de fonte.
- Revisão para web local; mobile adiado.
- Revisão autorizada: página ocupa ao menos a altura disponível; rodapé compacto no fim do conteúdo/tela, sem sobrepor leitura ou navegação móvel. Ícone de favorito sempre visível, desabilitado se não houver leitura nem remoção para desfazer. Ao remover o último favorito, novo clique restaura a mesma cópia pessoal (inclusive fora da janela recente), enquanto permanecer nessa tela. Sair da tela cancela essa oportunidade; perfil e conteúdo continuam privados.
- Ícones da faixa têm superfície e contorno próprios, feedback discreto em hover/foco/toque e estado visível de modal aberto/favorito. Alvos de toque de pelo menos 44 px; respeitar preferência por movimento reduzido. Ações de texto e ícones permanecem independentes.


1. **Tema do mês.** O sistema deve exibir `globalSettings.monthlyVerse` fixo no
   topo da tela, para todo usuário autenticado.
   - Critério de aceite: o bloco permanece visível ao rolar a tela durante a
     rolagem do devocional (ex: sticky header), pois a spec de
     produto exige meditação "contínua" ao longo do mês.
   - Se `globalSettings` ainda não tiver sido configurado (documento inexistente),
     o bloco não deve renderizar (nem placeholder vazio) — tratar como ausência
     silenciosa, não como erro.

2. **Tema da semana.** O sistema deve exibir `globalSettings.weeklyVerse` logo
   abaixo do tema do mês, visualmente hierarquizado como secundário (menor
   destaque que o tema do mês, maior destaque que o corpo do devocional).

3. **Busca do devocional do dia (e janela recente).** O sistema deve buscar o
   documento de `devotionals` cujo `date` seja igual à data local selecionada,
   no formato `YYYY-MM-DD`, via índice `by_date`. A data padrão ao abrir o app é
   a data local de hoje.
   - Critério de aceite: a busca nunca varre a tabela inteira — sempre via índice.
   - Critério de aceite: a data local de “hoje” é recalculada sempre que o app
     volta ao primeiro plano (foreground), não apenas no primeiro carregamento —
     cobre o caso de o usuário deixar o app aberto passando da meia-noite.
   - A seleção de outras datas na janela recente segue o item 11.

4. **Estado vazio (sem publicação).** Se não existir devocional para a data atual,
   o sistema deve exibir um estado vazio sóbrio, com uma frase fixa definida em
   `packages/domain` (ex.: "O devocional de hoje ainda não foi publicado.
   Volte em breve."), nunca um erro técnico, stack trace ou tela em branco.
   - Este estado é visualmente distinto do estado de carregamento (§ item 8) —
     um usuário não pode confundir "ainda carregando" com "não publicado hoje".

5. **Devocional (texto bíblico).** O sistema deve exibir `devotionals.scripture`
   como texto corrido, sem truncamento, "leia mais" ou paginação — o conteúdo é
   curto (3–5 versículos) por definição de produto (constituição §I).

6. **Reflexão.** O sistema deve exibir `devotionals.reflection` na íntegra,
   imediatamente após o texto bíblico, sem exigir interação adicional do usuário
   para revelar o conteúdo.

7. **Áudio.** O sistema deve permitir tocar `devotionals.audioUrl` quando o campo
   estiver presente.
   - Critério de aceite: se `audioUrl` for `undefined`, o player não é renderizado
     — nunca um player desabilitado ou com erro de carregamento visível.
   - Critério de aceite: falha de rede ao carregar o áudio (URL presente mas
     inacessível) exibe um estado de erro discreto no player (ex: ícone +
     "não foi possível carregar o áudio"), sem quebrar o restante da tela.
   - O player não inicia reprodução automaticamente ao abrir a tela (sem
     autoplay) — respeita o contexto de uso do usuário.

8. **Estado de carregamento.** Enquanto a query de `devotionals`/`globalSettings`
   está em voo, o sistema deve exibir um estado de carregamento que não desloque
   o layout quando o conteúdo chegar (evitar "layout shift" abrupto).

9. **Sugestão de oração.** O sistema deve exibir `devotionals.prayerSuggestion`
   como um bloco visualmente distinto (cor de fundo ou borda diferenciada) do
   texto bíblico e da reflexão, sinalizando que é uma instrução de ação, não
   texto de leitura.

10. **Usuário não autenticado.** Se o usuário não estiver autenticado, o sistema
    não deve tentar buscar `devotionals`/`globalSettings` — redireciona para o
    fluxo de autenticação antes de montar esta tela (comportamento herdado do
    roteamento protegido do app, não implementado dentro desta feature).

11. **Sete devocionais publicados mais recentes.** A lista autenticada contém no
    máximo sete publicações disponíveis, em ordem decrescente de data, até hoje.
    Dias sem publicação e publicações retiradas/programadas não ocupam vaga.
    Hoje é selecionado quando publicado; caso contrário, o primeiro disponível.
    Não há calendário aberto, busca arbitrária nem lista infinita. A virada do dia
    atualiza a seleção e a lista; cópias antigas permanecem nos favoritos.

12. **Favoritar com cópia pessoal.** O usuário autenticado deve poder favoritar o
    devocional **disponível nos recentes** (item 11) e manter uma **cópia** do conteúdo vinculada à
    sua conta — não apenas um ponteiro para o registro editorial global.
    - A cópia deve persistir em **dois lugares**: (a) armazenamento local em JSON
      no dispositivo; (b) banco de dados vinculado à conta autenticada.
    - Campos mínimos da cópia: data de origem (`YYYY-MM-DD`), texto bíblico,
      reflexão, sugestão de oração, referência/crédito quando existirem no
      original, e `audioUrl` se houver no momento do favorito. Metadados mínimos:
      quando foi favoritado.
    - Critério de aceite: após favoritar, a cópia permanece acessível ao titular
      mesmo que o dia saia dos recentes ou que o registro editorial
      global seja corrigido/retirado depois — a cópia não é atualizada
      automaticamente com edições posteriores (é snapshot no ato do favorito).
    - Critério de aceite: desfavoritar remove a cópia do banco da conta e do JSON
      local da sessão/dispositivo corrente, sem apagar o devocional editorial
      global.
    - Critério de aceite: favoritos de um usuário nunca aparecem para outro
      usuário; o client não é a barreira de segurança — o servidor só devolve
      cópias do titular autenticado.
    - Limite inicial de três cópias por conta, configurado no domínio e aplicado
      na gravação do servidor; duplicatas são idempotentes, a remoção continua
      disponível no limite e não existe substituição automática.

13. **Sem busca de histórico antigo.** Não há busca, filtro ou navegação para
    devocionais além dos sete itens do item 11, exceto o acesso às **cópias
    favoritadas** do próprio usuário (item 12). Favoritos não são um arquivo
    público nem um catálogo editorial.

## 5. Requisitos não-funcionais

- **Resiliência de rede.** A tela deve ser utilizável com conexão lenta: o texto
  (scripture, reflection, prayerSuggestion) deve renderizar antes do áudio
  carregar — áudio é progressivamente aprimorado, nunca bloqueante para o texto.
- **Minimalismo visual.** Sem carrossel, sem paginação horizontal, sem elementos
  que sugiram "mais conteúdo para deslizar" (constituição §I). Um único scroll
  vertical contínuo.
- **Áudio em background (mobile).** O áudio deve continuar tocando com o app em
  segundo plano e aparecer nos controles de mídia do sistema
  (lockscreen/central de controle), incluindo capa/título mínimos (ex: "Devocional
  de [data]").
- **Performance percebida.** Tempo entre abrir a tela e o texto do devocional
  estar visível deve ser dominado pela latência da query do Convex, não por
  processamento no client — nenhuma transformação pesada de dados deve rodar no
  componente de UI.
- **Acessibilidade.** Contraste mínimo AA para todo texto sobre os blocos de tema
  do mês/semana e sugestão de oração (frequentemente coloridos); tamanho de fonte
  do corpo não deve ser fixado abaixo do padrão de acessibilidade do sistema
  operacional (respeitar escala de fonte do dispositivo).
- **Idempotência de leitura.** Reabrir a tela ou trocar de aba e voltar não deve
  reiniciar o áudio já em reprodução (o player mantém estado de reprodução
  independente de remontagem de tela, quando tecnicamente viável na plataforma).
- **Favorito resiliente.** A cópia no banco da conta é a fonte de verdade entre
  dispositivos; o JSON local é espelho no aparelho (leitura offline da cópia
  favoritada quando a rede falhar, sem permitir novas escritas de favorito
  offline que driblem o servidor). Conflito: prevalece a cópia do servidor ao
  reconciliar.
- **Privacidade da cópia.** Favoritos são dados pessoais do titular; não entram
  em feeds de comunidade nem em agregados nominais.

## 6. Regras de visibilidade/permissão

| Papel | Pode ver | Pode criar | Pode editar/remover |
|---|---|---|---|
| AG / editorial | Devocional do dia, janela recente editorial e histórico de publicação (processo fora desta spec) | Devocional editorial (fora desta spec) | Sim (editorial) |
| AC | Devocional na janela recente; próprias cópias favoritadas | Favorito (cópia pessoal) | Próprios favoritos |
| Membro | Devocional na janela recente; próprias cópias favoritadas | Favorito (cópia pessoal) | Próprios favoritos |

Não há visibilidade diferenciada por comunidade/clube nesta feature — o
devocional da janela recente é global para todos os usuários autenticados do
app. Favoritos são estritamente por conta.

## 7. Fora de escopo

- Painel/fluxo de publicação do devocional pelo AG (assumir, para v1, publicação
  via processo interno da spec 004 / Convex — painel editorial completo fica para
  depois se necessário).
- Busca, calendário aberto ou histórico navegável além da janela de sete dias
  atrás (item 11). Retenção longa do usuário ocorre só via favoritos (item 12).
- Sincronização de áudio baixado no favorito (apenas a URL na cópia, se existir);
  download offline de áudio não é requisito desta revisão.
- Notificação push lembrando de ler o devocional (v2, ver risco de notificações em
  `docs/architecture.md §7`).
- Compartilhamento público de favoritos ou coleções pastorais.

## 8. Dados envolvidos

- `globalSettings` (singleton) — leitura.
- `devotionals`, índice `by_date` — leitura na janela recente.
- **Nova tabela** (nome no plano técnico) para cópias favoritadas por `userId`,
  com snapshot dos campos de conteúdo e índices por usuário / (usuário + data de
  origem). Detalhe de schema, índices e sincronização com JSON local ficam no
  `plan.md` e em `docs/architecture.md § Modelo de Dados` na implementação.
- Armazenamento local JSON no dispositivo — espelho das cópias do titular;
  nunca substitui a autorização no servidor.

## 9. Perguntas em aberto

- O piloto usa a data editorial de Brasília, coerente com a liberação de publicações;
  chamadas diretas não expõem publicações futuras.
- O limite inicial de favoritos é três, com configuração central em
  `MAX_FAVORITE_DEVOTIONALS`.
- Se o favorito for feito a partir de uma data da janela e o áudio for opcional:
  confirmar se a ausência de `audioUrl` no snapshot é aceitável (sim, alinhado ao
  item 7).

## Compartilhamento no devocional aberto — aprovado em 23/10/2026

Implementação das decisões da tarefa 07:

- Palavra com seleção estruturada permite alternar versículos por toque, clique, teclado e toque longo; grupos separados, sem arraste/Shift para intervalos. Reutiliza a seleção da spec 008 e seu menu, contraído até 640 px.
- A referência abre o capítulo e a versão com todos os versos da passagem marcados e rola até o primeiro, nos dois modos. Links aceitam verses ordenado; sem ele, verse mantém seu comportamento.
- Sem selection, referência é texto e Palavra é somente leitura. O snapshot numerado da publicação fornece os versos; nunca inferir seleção de referência legada.
- Palavra oferece Compartilhar, Copiar e Enviar para amigos. Meditar e Oração abrem o mesmo menu só ao segurar (ou teclado), cancelando ao mover; nessas variantes só compartilhar/copiar, com referência bíblica no fim.
- Ícone no topo compartilha texto simples: Devocional de DD/MM/AAAA usando a data do documento; PALAVRA (referência, versão, texto), MEDITAR, ORAÇÃO e Devotio com URL pública. Não há campo de título novo.
- Web Share quando disponível; fallback para clipboard com aviso e textarea manual em falha. Cancelar o compartilhamento nativo não copia.
- URL pública configurável por VITE_PUBLIC_APP_URL, padrão https://devotio.zee-dash-one.workers.dev. Não usar a origem local do navegador como URL compartilhada.
- Seleção nativa e pull-to-refresh desativados na superfície de leitura, preservando rolagem vertical. Cadastro editorial e tema semanal inalterados; Expo continua adiado.

## Revisão aprovada — 25/10/2026, tarefas 10 e 11

Hil autorizou implementar o plano revisado em uma branch conjunta. A referência estruturada abre os versículos exatos; legado sem seleção permanece texto, sem inferir passagens nem ampliar para vários capítulos.

O servidor gera uma vez por revisão as artes do devocional publicado do dia: data, referência, Meditar e Oração, sem corpo bíblico. Três tamanhos (1080×1920, 1080×1350 e 1080×1080), duas paletas básicas e PNG. A arte inicial é simples e substituível por configuração versionada; refinamento visual fica para depois. Texto integral, fonte legível e páginas numeradas (máximo dez por variante). Retenção de 30 dias, limpeza de revisões substituídas. Compartilhar usa arquivos preparados, com download por página e cancelamento sem ação automática. Favoritos pessoais não recebem uma imagem divergente por coincidência de data. SQLite usa o mesmo renderizador no servidor. App nativo continua adiado.
