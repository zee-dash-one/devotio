# Spec: Seleção bíblica, compartilhamento e notificações

> Extensão aprovada em 21/10/2026: a [spec 016](../016-notificacoes/spec.md)
> define os quatro eventos, produção conectada, contador 99+, acesso revogado e
> paridade local. Substitui o exemplo antigo de aviso fixo de criação; mantém
> leitura exclusivamente por Lida e ausência de push/som/animação.

> Extensão aprovada em 19/10/2026: a [spec 014](../014-amigos-compartilhamento/spec.md)
> adiciona envio privado entre amigos e marcações distintas no leitor. Não altera
> escopos de anotações/orações existentes nem o compartilhamento comunitário.

**ID:** 008-selecao-compartilhamento-notificacoes
**Status:** aprovada pelo usuário em 07/10/2026; em implementação local.
**Versão alvo:** web local; publicação e aplicativo nativo adiados.

## 1. Contexto e problema

Leitores precisam selecionar versículos inteiros e compartilhar a Palavra com
referência e versão. Gestores de comunidade precisam levar essa seleção ao grupo
que administram, acrescentando seus próprios comentários antes da publicação.
Um centro discreto de notificações deve reunir avisos do sistema e novas mensagens
do mural, sem distrações ou aumento de consultas constantes ao servidor.

Complementa as specs [002](../002-comunidade-v1/spec.md),
[003](../003-conteudo-biblico/spec.md), [006](../006-desenvolvimento-local/spec.md)
e [007](../007-cadastro-devocionais/spec.md). Não altera a privacidade das marcações
bíblicas, das orações ou dos comentários pessoais.

## 2. Papéis envolvidos

- **Leitor autenticado:** seleciona e compartilha versículos; vê apenas suas notificações.
- **Gestor de comunidade:** envia uma seleção somente para comunidades que administra.
- **Gestor do sistema:** também pode enviar a seleção ao cadastro de devocionais;
  seu papel global não concede administração de comunidades.
- **Sistema:** produz avisos informativos vinculados aos destinatários apropriados.

## 3. Histórias de usuário

- Como leitor, quero tocar um versículo ou selecionar um intervalo para compartilhar.
- Como gestor de comunidade, quero preparar uma mensagem com a Palavra e meu comentário.
- Como Gestor do sistema, quero usar a seleção para preencher Palavra no cadastro.
- Como participante, quero descobrir novas mensagens do grupo pelo sino.
- Como usuário, quero consultar avisos do Devotio sem alertas agressivos.

## 4. Requisitos funcionais

### Seleção de versículos

1. Tocar/clicar um versículo seleciona seu texto completo. Tocar novamente o único
   versículo selecionado limpa a seleção; tocar outro inicia uma nova seleção simples.
2. Manter pressionado e arrastar define uma âncora e o final de um intervalo
   contíguo. Funciona em ambas as direções e inclui os versos entre as extremidades.
3. O gesto de seleção não deve impedir a rolagem normal por toque; o arraste de
   seleção começa após manter pressionado. Não selecionar partes de palavras.
4. Destacar de forma discreta os versos selecionados e mostrar sua referência.
   Disponibilizar Limpar seleção. Permitir alterar as extremidades sem gerar lacunas.
5. Oferecer equivalente acessível por teclado, incluindo seleção simples e extensão
   de intervalo; no computador, Shift + clique também estende a seleção.
6. Ao mudar de livro/capítulo, limpar a seleção anterior. Seleções não atravessam capítulos.
   Abrir um link para um verso mantém a navegação direta e o foco/realce do destino.
7. Reutilizar a seleção para Enviar para devocional, exclusivo do Gestor do sistema,
   preenchendo Palavra, referência e versão. A revisão 007 acrescenta busca e
   controles de escolha da Palavra às ações Programar/Cancelar/Auxílio.
   Se o trecho exceder o limite de Palavra, orientar a reduzir a seleção; não truncar.
   As ações ficam em menu lateral oculto sem seleção e aberto automaticamente ao
   selecionar: compartilhar, enviar para comunidade (quando autorizado) e criar
   devocional (Gestor do sistema). Ícones com rótulos acessíveis; X fecha e limpa a
   seleção. Lida é exclusiva das notificações, por decisão explícita do usuário;
   não criar marcações de leitura bíblica.
8. Busca por texto automática ao digitar mais de três caracteres, com breve pausa
   para agrupar digitação, resultados com referência e acesso direto ao capítulo.
   Não consultar abaixo desse tamanho nem repetir consultas idênticas já disponíveis.

### Compartilhamento externo

8. Com seleção ativa, oferecer Compartilhar para qualquer leitor autenticado.
9. Incluir os textos completos, em ordem bíblica, referência com livro/capítulo/
   intervalo e nome da versão em uso, inicialmente **Almeida Atualizada (AA)**.
10. Copiar o texto completo com `número - texto` em cada verso. Se a cópia automática
    falhar, oferecer texto selecionável para cópia manual.
11. Compartilhar não publica conteúdo nem limpa a seleção.
    Não incluir dados de conta, comentários privados ou informações das comunidades.

### Envio para comunidade

12. Enviar para comunidade aparece somente se o leitor administra ao menos um grupo.
    Apresentar somente comunidades administradas com múltipla seleção, inclusive
    confirmação por Enviar quando há somente uma comunidade disponível.
13. Enviar salva rascunhos privados nos grupos escolhidos. O gestor pode depois
    abrir Escrever no mural: trecho, referência, versão e link para o primeiro verso.
    Selecionar ou enviar ao destino não publica a mensagem.
14. O gestor pode acrescentar comentário e confirmar a publicação. O envio deve ter
    autorização no servidor para a comunidade escolhida, inclusive após mudança de papel.
15. Decisão do usuário em 07/10/2026: abrir rascunho no mural, com comentário
    opcional e publicação somente após explícita confirmação.
    O comentário mantém o limite de 1.000 caracteres; o trecho é conteúdo separado,
    sem consumir esse limite e sem substituir a escritura fixada.
16. Depois da publicação, todos os membros autorizados do grupo podem ler o trecho,
    referência, versão, comentário e link. Quem não participa não ganha acesso.
    O texto bíblico publicado é conferido com a cópia local da versão indicada.
17. Descartar retira o rascunho sem publicar. Falha mantém o preenchimento. Evitar
    publicação duplicada por clique repetido; limpar estado do navegador na troca/
    saída da conta, mantendo rascunhos privados persistidos no banco para seu autor.

### Centro de notificações

18. No header das áreas de leitura, mostrar um sino à direita, ao lado do nome/menu
    da conta, com contagem numérica discreta de não lidas. Sem badge quando não houver
    não lidas, sem animação, som, push ou alertas de urgência.
19. Ao abrir o sino, apresentar modal acessível com lista, estado vazio, carregamento
    e erro recuperável. Permitir fechar por botão e Escape, com retorno do foco ao sino.
20. Apresentar mensagens do Sistema e avisos sobre mensagens publicadas nas comunidades
    de que o usuário participa. Conteúdo do rascunho não gera notificação.
21. Modelo de item comunitário: `Nova mensagem para comunidade XYZ.` com **XYZ** em
    negrito. Item do sistema mostra **Devotio** em negrito e o conteúdo do aviso.
    Data à direita, em `dd/MM/aaaa`, no horário de Brasília.
22. Ao ativar um item comunitário, abrir a comunidade e localizar a mensagem alvo,
    mesmo que esteja fora da primeira página do mural. Aviso do sistema com destino
    abre a área pertinente; sem destino, permite ler o próprio aviso no modal.
23. Marcar como lida somente pela ação explícita Lida do item, após validação do acesso.
    Abrir o modal ou navegar pelo item não zera o badge. Leitura é particular de cada conta e
    persiste após recarga, logout/login e reinício do servidor.
24. Proposta: novas mensagens notificam os demais participantes atuais, sem
    notificar o autor sobre sua própria publicação. Não enviar histórico anterior
    como novas notificações a quem acaba de entrar na comunidade.
25. Um aviso inicial do Devotio informa o direito de criar comunidade quando esse
    direito existir. Registrar uma vez por conta, sem repetir a cada login. Não
    anunciar permissões que o usuário não possui.
26. Atualização escolhida sob delegação do usuário: conexão persistente para avisos
    de mudança, sem polling HTTP. Atualizar contador automaticamente e consultar
    somente a página de notificações aberta quando necessário. Consultar ao abrir
    o sino e permitir atualização manual em caso de desconexão. Reconectar sem
    interações obrigatórias; não transferir todo o histórico a cada mudança.

## 5. Requisitos não-funcionais

- Gestos utilizáveis em navegador de celular e computador; alternativa por teclado.
- Persistência local de mensagens e estado de leitura das notificações no servidor.
- Janela de oito devocionais e seis capítulos recentes permanece inalterada; selecionar
  e compartilhar um capítulo já carregado não devem repetir sua consulta.
- Nenhum serviço pago, IA, push ou publicação externa do app nesta etapa.
- Lista de notificações com paginação; não carregar todo o histórico a cada abertura.
- Sem persistência de rascunhos ou notificações comunitárias no armazenamento do
  navegador; não ampliar o cache privado da spec 006. Escritas exigem servidor local.

## 6. Regras de visibilidade/permissão

| Papel | Selecionar / compartilhar externamente | Publicar seleção no grupo | Enviar para devocional | Notificações |
|---|---|---|---|---|
| Leitor sem comunidade | Sim | Não | Não | Seus avisos do sistema |
| Membro | Sim | Não | Não | Seus avisos do sistema e comunidades permitidas |
| Gestor de comunidade | Sim | Apenas onde é admin | Não por esse papel | Seus avisos do sistema e comunidades permitidas |
| Gestor do sistema | Sim | Apenas se também for admin do grupo | Sim | Seus avisos do sistema e comunidades permitidas |
| Não autenticado | Conforme acesso existente à Bíblia | Não | Não | Nenhuma |

Seleção bíblica não concede autorização de postagem. Notificações, contagem de não
lidas, gravação de leitura e navegação devem ser limitadas ao destinatário autenticado.
Ao perder associação com uma comunidade, o usuário não pode consultar seus avisos
ou abrir mensagens por notificação, mesmo por chamada direta. A seleção nunca envia
anotações ou orações pessoais. Não publicar automaticamente ao escolher o grupo.

## 7. Fora de escopo

- Peregrino e qualquer geração assistida por IA.
- Compartilhar comentários/orações privados ou alterar bibleMarkings.visibility.
- Postagem no mural por membros comuns; novos poderes globais de gestores.
- Avisos promocionais, gamificação, e-mail, push, sons e notificações do navegador.
- Painel completo de criação de campanhas/mensagens do sistema.
- Aplicativo Expo, deployment Convex ou publicação pública.
- Seleções descontínuas ou que atravessem livros/capítulos; edição colaborativa.

## 8. Dados envolvidos

- Seleção: livro, capítulo, primeiro/último verso e versão; textos e referência
  derivados do conteúdo bíblico já disponível.
- Mensagem comunitária: autor, grupo, instante, comentário e trecho bíblico estruturado
  com referência/versão e destino de leitura. Mensagens antigas sem trecho continuam válidas.
- Notificação: destinatário, tipo sistema/comunidade, entidade, texto, instante,
  destino/mensagem alvo e estado de leitura individual.
- Associações comunitárias existentes continuam sendo a fonte de autorização.

O plano deverá registrar extensões do modelo local, índices/paginação e migração
não destrutiva. Se futuramente houver mudança no schema público, documentar e
alterar `packages/backend/schema.ts` conforme as regras do repositório; o plano
desta entrega local não pode declarar tabelas Convex implementadas.

## Revisão autorizada em 07/10/2026 — compartilhar e escolher trechos

### Menu lateral expansível — revisão solicitada em 07/10/2026

Na leitura principal, o menu ocupa toda a altura e encosta na direita, inclusive
no celular. Abre expandido com textos/ícones; modo compacto mostra somente ícones.
Uma seta abaixo de X contrai para a direita e muda para seta à esquerda para
expandir. Arrastar o menu à direita contrai; à esquerda expande. No celular, um
deslizamento horizontal rápido à esquerda na tela também expande o menu compacto.
Rolagem vertical e seleção bíblica mantida pressionada continuam distintas desse
gesto. Arrastar o menu não seleciona textos nem dispara uma ação ao soltar.
X limpa/fecha; contrair preserva seleção/destinos. Ícones mantêm nomes acessíveis
e foco por teclado. Escolher comunidade no modo compacto expande para mostrar
destinos. Respeitar preferência por redução de movimento. Nenhuma nova consulta.

Esta revisão substitui Web Share e rascunho apenas em memória: Compartilhar copia
`número - texto` por verso, seguido por referência e nome da versão. Se não houver
área de transferência, oferece texto copiável. Não há ação Lida no menu bíblico;
as notificações existentes não mudam.

Comunidades permitem múltiplos destinos administrados e botão Enviar com ícone.
Enviar salva rascunhos privados persistentes do autor, sem publicar nem notificar.
Cada envio cria um rascunho independente por destino, preservando os anteriores.
Escrever no mural permite abrir esses rascunhos, comentar, publicar ou descartar.
Repetir uma operação por falha de rede não duplica o rascunho.

Escrever permite buscar/escolher outro trecho na Bíblia. Nesse contexto a seleção
mostra apenas botão flutuante para retornar à comunidade de origem, sem menu
lateral. Pesquisa, capítulo, seleção e comentário permanecem nas idas e voltas.
O fluxo editorial preenche corpo numerado, endereço e versão. Pelo menu principal,
a Bíblia mantém a seleção e o menu lateral normais.

## 9. Perguntas em aberto

Nenhuma decisão bloqueante. Usuário confirmou que Lida se aplica somente às
notificações, por ação no modal; atualização delegada para mínima interação.

## 10. Aprovação e lançamento

- Responsável/data de aprovação: usuário, 07/10/2026, nas respostas sobre rascunho,
  leitura explícita, menu lateral e delegação da atualização para mínima interação.
  Esclarecimento posterior: Lida somente no modal de notificações.
- Aprovação parcial em 07/10/2026: usuário confirmou rascunho no mural com comentário opcional.
- Canal inicial: web de desenvolvimento, usando banco persistente e login mock.
- Mobile: navegador responsivo neste marco; Expo adiado.
- Liberação: aprovar escolhas abertas; plano/tasks; testes de seleção e intervalos,
  payload de compartilhamento, rascunho e publicação, autorização por grupo/conta,
  notificações, paginação, persistência e orçamento de rede; revisão visual/gestos.
- Condições públicas de licença e conteúdo das specs 004/005 permanecem aplicáveis
  ao planejamento de publicação; esta spec não autoriza antecipar esse lançamento.

### Menu no celular — revisao aprovada em 23/10/2026

No celular (ate 640 px), o menu inicia contraido; acima de 640 px, expandido. A escolha inicial ocorre somente na montagem: resize/rotacao nao alteram o estado escolhido. Setas, arraste no menu, swipe rapido na leitura e expansao para destinos/copia manual permanecem. Trocar capitulo remonta o menu.
