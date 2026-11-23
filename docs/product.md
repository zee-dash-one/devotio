# Produto e Regras de Negócio Atuais

Resumo consolidado de todas as funcionalidades e regras de negócio implementadas hoje no Devotio.

## 1. Acesso, contas e papéis globais

- **Autenticação de leitores (`/entrar`):** login via Google OAuth (Better Auth + Convex em produção; perfis simulados apenas no servidor local de desenvolvimento). Destinos internos protegidos são preservados após o login.
- **Controle de acesso:** contas possuem estado `pending`, `approved` ou `disabled`. Quando a aprovação global está ativa (`accessSettings.approvalRequired`), novos cadastros aguardam liberação na tela de espera; contas `disabled` perdem acesso imediatamente por assinatura reativa, preservando dados históricos sem reativação automática em novo login.
- **Painel do proprietário (`/gestao-acesso`):** rota direta não listada nos menus públicos, autenticada com credencial exclusiva de proprietário (login + senha scrypt + código TOTP de 6 dígitos), protegida por rate limit e anti-replay de TOTP, com sessão de 30 minutos apenas em memória. Permite pré-cadastrar por e-mail verificado, aprovar/desativar contas, conceder permissão `editorial`, definir permissão/cota de criação de comunidades e transferir posse comunitária. Não dá acesso a recados privados nem amizades dos usuários.
- **Separação de poderes:** aprovar conta, conceder capacidade `editorial`, permitir criação de comunidades e administrar uma comunidade específica são permissões independentes.
- **Superusuário:** conta aprovada com `superuser`. O menu da conta mostra **Gerenciar usuários** (`/sistema/usuarios`), onde a pessoa aprova ou desativa cadastros e exclui apenas contas sem comunidade, recado ou envio. Contas com histórico são desativadas. A conta cujo nome Google é unicamente Hilderney recebe o papel e a capacidade editorial no próximo acesso. No ambiente local, Ester e Hilderney já nascem superusuários.

## 2. Devocional diário e favoritos (`/devocional`, `/devocional/favoritos`)

- **Composição da leitura:** faixa superior com tema mensal e referência, tema semanal discreto, seletor de data, player de áudio opcional (`preload="none"`, sem autoplay), seções de **Palavra** (com referência clicável que abre o capítulo correspondente na Bíblia), **Meditar** (`reflection`) e **Oração** (`prayerSuggestion`).
- **Disponibilidade:** cada devocional é único por data (`YYYY-MM-DD`), liberado à meia-noite de `America/Sao_Paulo` (`publishedAt`) e ocultado imediatamente se retirado (`withdrawn`).
- **Publicações recentes:** a navegação principal exibe as **7 publicações liberadas mais recentes** (incluindo hoje quando disponível e ignorando lacunas ou retiradas).
- **Favoritos privados:** acessíveis pelo menu da conta (`/devocional/favoritos`) e pelo marcador na barra do devocional. Cada usuário pode manter até **3 favoritos simultâneos** (`MAX_FAVORITE_DEVOTIONALS = 3`), gravados como **snapshot privado** do conteúdo no momento em que foram salvos — permanecendo legíveis mesmo após edição ou retirada editorial posterior. Ao remover um favorito, um recibo de uso único permite desfazer a remoção imediatamente.
- **Compartilhamento do devocional:**
  - **Texto:** compartilha ou copia o conteúdo formatado da leitura selecionada com link público do app.
  - **Imagem (PNG):** para o devocional publicado do dia, oferece **3 formatos** (`1080×1920` vertical 9:16, `1080×1350` retrato 4:5 e `1080×1080` quadrado 1:1) × **2 paletas** (`Papel claro` e `Verde escuro`). Meditar e Oração entram inteiros, sem corte, em até 10 páginas por formato. Texto que não cabe é recusado na edição e na geração. As imagens são geradas uma única vez por revisão no servidor e baixadas sob demanda apenas na variante escolhida, com Web Share de arquivos, cópia de uma página PNG para a área de transferência e download direto.

## 3. Editorial (`/editorial`, `/editorial/cadastro`)

- **Acesso:** restrito a contas aprovadas com capacidade `editorial` verificada no servidor (entrada pelo menu da conta → **Gestão de devocionais**).
- **Criação e correção:** criação permitida apenas em datas livres (hoje ou futuras no calendário de Brasília). A **Palavra**, referência e tradução são somente leitura e reconstruídas no servidor a partir da seleção bíblica canônica (`alm1911` no ambiente conectado; `aa` ou `alm1911` no local). **Meditar** e **Oração** aceitam até **512 caracteres** cada, e a combinação com a referência precisa caber na arte de compartilhamento (até 10 páginas, sem corte). Textos legados maiores permanecem legíveis até serem editados.
- **Auditoria e retirada:** criação atribui crédito à sessão autora; correções preservam o crédito original e exigem motivo administrativo registrado em `editorialEvents`. A retirada é lógica (`withdrawn = true`), exige confirmação e motivo, invalida imagens publicadas, preserva a reserva da data e não apaga snapshots favoritos dos leitores.

## 4. Bíblia (`/biblia`)

- **Edições sem API externa em leitura:**
  - **Almeida 1911 (`alm1911`):** 66 livros, 1.189 capítulos e 31.101 versículos, disponível nos modos local e publicado por pacotes estáticos gerados no build.
  - **Almeida Atualizada (`aa`):** 66 livros, 1.189 capítulos e 31.104 versículos, disponível no SQLite de desenvolvimento local.
- **Modos de leitura e navegação:**
  - **Paginado:** um capítulo por vez, com botões anterior/próximo e gesto horizontal longo (arraste à esquerda volta um capítulo; à direita avança).
  - **Contínuo:** rolagem vertical com janela renderizada de até 3 capítulos (anterior, atual e próximo) e preservação de âncora visual sem saltos.
- **Busca:** acionada após 4 caracteres (debounce de 350 ms), normalizando acentos e retornando resultados paginados que abrem o capítulo no versículo correspondente.
- **Seleção e ações em versículos:** versículos podem ser alternados individualmente ou por intervalo (toque, Shift + clique, teclado ou long-press + arraste dentro do capítulo). A seleção abre um menu lateral retrátil (inicia contraído em telas até 640 px) com ações de copiar, compartilhar texto numerado, enviar recado para amigos, guardar rascunho para comunidades administradas ou iniciar cadastro de devocional (para editores). Quando aberta a partir do editor devocional ou compositor comunitário (`pick`), exibe apenas o botão flutuante de retorno com o trecho escolhido, preservando os rascunhos em memória.

## 5. Comunidades (`/comunidade`)

- **Criação e cota:** criar comunidade exige `communityCreationAllowed = true` e posse atual abaixo de `communityCreationLimit` (0 a 20, configurados em `/gestao-acesso`). Quem cria torna-se `owner`.
- **Papéis e governança (`owner`, `admin`, `member`):**
  - `owner` é único por comunidade; apenas ele remove/rebaixa `admin` ou transfere a posse para outro membro aprovado (tornando-se `admin` na mesma transação). O `owner` não pode sair nem ter a conta desativada antes de transferir suas comunidades. Nenhuma comunidade fica sem gestor ativo.
  - `owner` e `admin` aprovam/recusam pedidos de entrada, promovem membros a `admin`, removem membros comuns, definem a escritura fixada, publicam no mural e gerenciam listas.
  - `member` lê mural, escritura, membros (apenas nome e papel, nunca e-mail) e marca seus próprios itens nas listas.
- **Entrada por aprovação:** informar o código de convite exibe apenas o nome da comunidade para confirmação e cria um pedido `pending` em `communityJoinRequests` (cancelável pelo solicitante). O acesso ao conteúdo só é liberado após aprovação de `owner`/`admin`.
- **Mural e rascunhos bíblicos:** mensagens paginadas de 50 em 50 por cursor, sem edição de mensagens publicadas. Gestores podem enviar trechos bíblicos para múltiplas comunidades administradas como rascunhos privados (até 100 ativos por autor/comunidade no modo local, ou publicação direta com comentário) com idempotência por `requestId`.
- **Listas (`checklists`):** itens ordenados com marcação individual idempotente (`checklistTicks`). O leitor vê seu próprio estado marcado e apenas a contagem agregada de membros ativos atuais (sem identificar quem marcou).

## 6. Amigos e partilha privada (`/perfil`)

- **Vínculos consentidos:** cada usuário possui um código de amizade rotacionável de 12 caracteres (rotacionar invalida o código anterior sem afetar convites ou amizades existentes). Também é possível enviar convite a partir da lista de membros de uma comunidade em comum. Convites exigem aceite explícito; limite de **200 vínculos** (amizades + pendentes) por conta. Não há busca global de pessoas nem lista pública de amigos.
- **Recados bíblicos privados:** a partir de uma seleção na Bíblia, o usuário envia o trecho canônico com recado de até **1.000 caracteres** para até **20 amigos ativos** por envio (idempotente por `requestId`).
- **Privacidade entre destinatários:** o remetente vê para quem enviou; cada destinatário vê apenas remetente, trecho e recado — a lista dos demais destinatários nunca é enviada ao cliente do receptor. Desfazer amizade bloqueia novos envios, mas preserva os snapshots já entregues.
- **Marcações na leitura:** ícones discretos junto ao primeiro versículo do trecho indicam envios (seta) e recebimentos (envelope) na edição correspondente, abrindo modal paginado de detalhes; `/perfil` reúne o histórico completo de enviados e recebidos.

## 7. Notificações

- **Eventos cobertos (4 tipos):** recado bíblico de amigo, aprovação de entrada em comunidade, remoção forçada de comunidade e nova publicação no mural comunitário.
- **Comportamento:** sino discreto no cabeçalho com contador agregado (`99+` acima de 99), sem push externo, som ou animação intrusiva. Abrir o menu ou navegar ao destino **não** marca como lida — apenas o clique explícito em **Lida** grava `readAt`.
- **Regras de audiência e revogação:** o autor nunca recebe notificação da própria postagem; novos integrantes não recebem notificações de mensagens anteriores à sua sequência de entrada (`joinSequence`); sair ou ser removido subtrai imediatamente as não lidas daquela participação e oculta (`hidden = true`) avisos de postagens antigas sem apagá-los nem revivê-los em eventual reingresso.

## 8. Configurações de leitura e aparência

- Acessíveis em **Menu da conta → Configurações** (modal com aplicação imediata, sem botão de salvar e zero chamadas de conteúdo ao servidor):
  - **Tema:** `Dia`, `Noite`, `Papiro`, `Contraste` e `Pelo horário` (usa `Dia` das 06h às 18h e `Noite` das 18h às 06h pelo relógio local do dispositivo).
  - **Tamanho da fonte:** 8 passos discretos (`14`, `16`, `18`, `20`, `22`, `24`, `28` e `32 px`), escalando leitura e interface de forma proporcional e preservando o versículo visível como âncora.
  - **Modo de leitura:** `Paginado` ou `Contínuo`.
  - **Versão da Bíblia:** escolha entre as edições habilitadas no ambiente.
- Preferências persistem no dispositivo isoladas por conta/perfil: são limpas visualmente no logout e restauradas ao reentrar com o mesmo perfil naquele aparelho.
