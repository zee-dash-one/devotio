# Spec: Notificações de amigos e comunidades

**ID:** 016-notificacoes
**Status:** aprovada; implementada na branch, publicação/homologação pendentes
**Versão alvo:** v1 web/PWA

## 1. Contexto e problema

O sino precisa mostrar na versão publicada os avisos pessoais de recados e
comunidades, permitindo abrir o conteúdo correspondente sem expor dados privados.

## 2. Papéis envolvidos

Conta aprovada vê e marca seus próprios avisos. Participantes recebem publicações
da comunidade; owner/admin produzem essas publicações e decidem entradas/remoções.
O painel proprietário também pode remover participação. Nenhum papel lê avisos alheios.

## 3. Histórias de usuário

- Como leitor, quero saber quando recebo um recado e abrir o trecho correto.
- Como participante, quero acompanhar aceite, remoção e publicações do meu grupo.
- Como leitor, quero marcar cada aviso como lido conscientemente.

## 4. Requisitos funcionais

1. Exibir sino, contador e lista paginada, atualizados automaticamente na versão
   conectada. O contador apresenta 99+ ao alcançar cem avisos não lidos.
2. Produzir quatro tipos: recado recebido de amigo, entrada aprovada, remoção
   forçada da comunidade e publicação no mural. Não avisar o próprio autor.
3. Recado mostra remetente e referência, sem copiar o conteúdo privado para o aviso;
   abre a Bíblia na edição/livro/capítulo/primeiro versículo do trecho recebido.
   Desfazer amizade preserva o aviso e o histórico entregue.
4. Publicação avisa participantes atuais e ativos, exceto autor; abre a mensagem
   específica, inclusive antiga. Quem entrou depois não recebe histórico como novidade.
5. Aprovação abre a comunidade. Remoção avisa sem identificar o responsável e
   leva à lista de comunidades. Saída voluntária não gera aviso de remoção.
6. Apenas o botão Lida marca o item. Abrir o sino ou navegar não altera leitura.
   Repetir produção ou leitura é idempotente.
7. Publicações sem acesso desaparecem da lista e do contador; reingresso não
   transforma histórico removido em novidade. Outros avisos preservam metadados;
   destinos indisponíveis ficam sem link. Recados validam o destinatário.
8. Uma notificação por publicação, sem agrupamento. Não gerar avisos adicionais
   de amizade, pedido pendente/recusa, promoção ou permissão de criação. Retirar
   o aviso fixo antigo sobre direito de criar comunidade.
9. Sem exclusão por prazo ou ação manual nesta etapa. Preservar estado de leitura
   e dados legados durante migração; ocultar acesso revogado não equivale a ler.
10. Convex atualiza por subscription, sem polling. Atualizar avisos manualmente
    permanece apenas no ambiente local. Os dois ambientes têm as mesmas regras.

## 5. Requisitos não-funcionais

Processar publicações em lotes para algumas centenas de membros; a audiência
precisa respeitar entradas/saídas durante o processamento. Não persistir avisos
privados no navegador ou no cache do service worker. Sino discreto e acessível.

## 6. Visibilidade e permissão

| Papel | Pode ver | Pode criar | Pode alterar |
|---|---|---|---|
| Conta aprovada | Seus avisos e destinos autorizados | Eventos a partir de ações permitidas | Apenas leitura dos próprios avisos |
| Owner/admin | Mesma visibilidade pessoal | Publicações, aceite e remoção locais | Mesmas regras pessoais |
| Proprietário do sistema | Metadados do painel, sem avisos privados | Remoção administrativa | Não marca avisos alheios |
| Conta pendente/desativada | Nenhum aviso | Nenhum evento do produto | Nenhuma leitura |

## 7. Fora de escopo

Web Push, e-mail, som, animação, app nativo, agrupamento, limpeza automática,
exclusão manual e novos tipos além dos quatro aprovados.

## 8. Dados envolvidos

Avisos pessoais com tipo, remetente/nome comunitário no instante do evento,
destino, origem idempotente e data de leitura. Referenciar recado/mensagem sem
copiar conteúdo privado. Metadados de participação permitem excluir novos membros
da audiência antiga e ocultar avisos de participação revogada.

## 9. Perguntas em aberto

Nenhuma decisão pendente neste escopo. O plano técnico e checklist estão na
[tarefa 03 concluída](../../.todo/.done/03-notificacoes.md).

## 10. Aprovação e lançamento

Hil aprovou respondendo "Adotar essas decisões na tarefa 03" em 21/10/2026.
Estende a spec 008 com produção conectada e os eventos da spec 015. Depende dos
PRs #6 e #7. Hil publica backend antes de integrar a web. Mobile segue adiado;
homologação física e Google real são posteriores aos testes locais.
