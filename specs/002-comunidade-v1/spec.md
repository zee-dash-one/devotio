# Spec: Comunidade (v1 — funcionalidades base)

> Revisão aprovada em 21/10/2026: a [spec 015](../015-comunidade-papeis-permissoes/spec.md)
> substitui as regras históricas abaixo sobre criação irrestrita, posse, entrada
> imediata e papéis/saída. Os demais requisitos permanecem como referência.

> Revisão de 02/10/2026: aprovação histórica dos requisitos preservada; não significa implementação concluída. A distribuição inicial web e as lacunas estão no [catálogo](../README.md). Novos requisitos de fundação constam da [spec 004](../004-fundacao-lancamento/spec.md), em rascunho.

**ID:** 002-comunidade-v1
**Status:** aprovada
**Versão alvo:** v1 (lançamento)

## 1. Contexto e problema

Usuários de uma mesma igreja/comunidade precisam de um espaço de edificação mútua
sob supervisão pastoral, sem virar uma rede social genérica. O AG (pastor/líder)
precisa de controle direto sobre quem entra e o que é comunicado ao grupo.

## 2. Papéis envolvidos

- **AG (Administrador Geral)**: cria a comunidade, gerencia membros, define a
  escritura da comunidade, publica mensagens no mural, cria listas.
- **Membro**: participa da comunidade, lê o mural e a escritura fixada, marca itens
  das listas ("tica" seu próprio progresso).

Clubes e AC (Administrador de Clube) são v2 — **fora de escopo desta spec**, ver §7.

## 3. Histórias de usuário

- Como AG, eu quero criar uma comunidade, para reunir os membros da minha
  igreja/grupo em um espaço próprio.
- Como AG, eu quero fixar um versículo/tema que guie espiritualmente a comunidade,
  para dar direção comum ao grupo.
- Como AG, eu quero enviar mensagens para todos os membros, para comunicar avisos
  pastorais e convocações de oração.
- Como AG, eu quero adicionar e remover membros, para manter a comunidade composta
  só por quem deve estar nela.
- Como AG, eu quero criar uma lista de itens para a comunidade "ticar" (motivos de
  oração, desafio de leitura), para acompanhar metas coletivas.
- Como membro, eu quero ver a escritura fixada e o mural de mensagens do AG, para
  me manter alinhado espiritualmente com o grupo.
- Como membro, eu quero marcar meu próprio progresso em uma lista compartilhada,
  sem que isso apague ou altere o progresso de outra pessoa.

## 4. Requisitos funcionais

1. **Criação de comunidade.** O sistema deve permitir que um usuário autenticado
   crie uma `community`, tornando-se automaticamente `admin` (AG) dela via
   `communityMembers`.
   - Critério de aceite: nome da comunidade é obrigatório (1–80 caracteres,
     validado via zod); descrição é opcional (até 280 caracteres).
   - Critério de aceite: a criação é transacional — se a inserção em
     `communityMembers` falhar, a `community` criada não deve ficar órfã sem
     nenhum admin (usar uma única mutation cobrindo os dois inserts).
   - Um usuário pode criar e pertencer a múltiplas comunidades sem limite nesta
     spec (limite, se necessário, é decisão de produto futura).

2. **Escritura da comunidade.** O sistema deve permitir que o AG edite o campo
   `scripture` a qualquer momento.
   - Critério de aceite: campo aceita vazio/nulo (comunidade pode não ter
     escritura fixada ainda); limite de 500 caracteres, validado via zod.
   - Critério de aceite: edição é refletida em tempo real para todos os membros
     conectados, sem exigir reload.

3. **Mural — envio de mensagens.** O sistema deve permitir que o AG envie
   mensagens (`communityMessages`) visíveis a todos os membros da comunidade, em
   ordem cronológica ascendente (mais antiga primeiro, como um feed de avisos).
   - Critério de aceite: conteúdo da mensagem é obrigatório, 1–1000 caracteres.
   - Critério de aceite: mensagens são paginadas/carregadas incrementalmente se a
     lista crescer (não carregar histórico completo de uma vez após alguns meses
     de uso) — decisão de paginação registrada no `plan.md`.

4. **Mural — restrição de escrita.** O sistema deve impedir que um membro comum
   (role `member`) envie mensagens no mural.
   - Critério de aceite: a restrição é aplicada na mutation do Convex
     (`communityMessages.send`), não apenas escondendo o formulário na UI — uma
     chamada direta à mutation por um membro deve ser rejeitada com erro de
     permissão.

5. **Gestão de membros.** O sistema deve permitir que o AG adicione um usuário
   como membro e remova qualquer membro, com as seguintes exceções:
   - Não é possível remover o único `admin` da comunidade (deixaria a comunidade
     órfã) — a mutation deve rejeitar essa operação com uma mensagem clara.
   - Um AG pode remover a si mesmo **apenas** se existir outro `admin` na
     comunidade no momento da remoção.
   - Remover um membro não apaga o histórico de mensagens ou ticks desse usuário
     (preservar histórico; apenas revoga acesso futuro).

6. **Criação de checklist.** O sistema deve permitir que o AG crie uma
   `checklist` vinculada à comunidade (`communityId` preenchido, `clubId`
   ausente) com um conjunto inicial de itens (`checklistItems`).
   - Critério de aceite: checklist precisa de ao menos 1 item na criação; itens
     têm `order` sequencial definido no momento da criação.
   - Fora de escopo desta versão: reordenar ou editar itens após a criação
     (tratar como "criar nova checklist" se precisar mudar — ver §7).

7. **Marcar progresso (tick).** O sistema deve permitir que qualquer membro
   (incluindo o AG) marque/desmarque um item para si mesmo.
   - Critério de aceite: a operação é idempotente por usuário — marcar duas vezes
     seguidas não cria dois registros; desmarcar remove ou zera o tick existente.
   - Critério de aceite: um usuário só pode alterar o próprio tick — a mutation
     usa o `userId` da sessão autenticada, nunca um `userId` recebido como
     parâmetro do client.

8. **Contagem agregada.** O sistema deve exibir, para cada item de checklist,
   quantos membros já marcaram, sem expor nominalmente quem marcou (ver §6 —
   privacidade de progresso individual).
   - Critério de aceite: a contagem é sobre o total de membros da comunidade no
     momento da consulta (não um número fixo definido na criação da checklist),
     refletindo entradas/saídas de membros.

## 5. Requisitos não-funcionais

- **Multi-comunidade.** Um usuário pode pertencer a mais de uma comunidade (o
  schema já suporta via `communityMembers` indexado por `userId`); a UI deve
  deixar claro em qual comunidade o usuário está operando a qualquer momento
  (sem ambiguidade de contexto ao alternar entre elas).
- **Reatividade.** Ações de gestão (adicionar/remover membro, editar escritura,
  criar lista, enviar mensagem, marcar tick) devem ser refletidas para todos os
  membros conectados via reatividade nativa do Convex, sem necessidade de "puxar
  para atualizar".
- **Consistência de permissão client/servidor.** Toda ação restrita ao AG deve
  ter a checagem replicada na UI (esconder o botão/formulário para quem não é AG)
  **e** na mutation (rejeitar a chamada). A UI nunca é a única barreira — ver
  constituição e `AGENTS.md §4`.
- **Escala razoável para v1.** O modelo de dados e as queries devem se comportar
  bem para comunidades de até algumas centenas de membros (cenário de uma
  igreja/grupo local); não é necessário otimizar para milhares de membros nesta
  versão, mas a decisão de paginação do mural (§4 item 3) deve evitar degradação
  óbvia mesmo nesse cenário menor.
- **Auditabilidade mínima.** Toda mutation de gestão (adicionar/remover membro,
  editar escritura) já possui `createdAt`/`joinedAt` no schema — não é necessário
  log adicional nesta versão, mas o `plan.md` deve confirmar que nenhum desses
  campos fica `undefined` por descuido de implementação.

## 6. Regras de visibilidade/permissão

| Papel | Pode ver | Pode criar | Pode editar/remover |
|---|---|---|---|
| AG | Escritura, mural, membros, listas, contagem agregada de ticks | Comunidade, mensagens, listas/itens | Escritura, membros (adicionar/remover), mensagens próprias |
| Membro | Escritura, mural, lista de membros (nomes), listas/itens, contagem agregada de ticks | Seu próprio tick em cada item | Seu próprio tick (marcar/desmarcar) |

Decisão explícita de privacidade: **quem marcou o quê em uma checklist não é
exposto nominalmente a outros membros** — apenas a contagem agregada. Isso evita
constranger alguém que não orou ou não leu o capítulo daquela semana (alinhado à
constituição §V).

## 7. Fora de escopo

- Clubes/subgrupos e AC (v2 — spec própria quando priorizada).
- Edição/remoção de mensagens do mural após o envio.
- Notificação push quando o AG publica no mural (futuro; ver `docs/architecture.md §7`).
- Transferência de papel de AG para outro usuário (v1 assume que o criador
  permanece AG; mecanismo de sucessão fica para depois se necessário).

## 8. Dados envolvidos

- `communities`, `communityMembers` — leitura/escrita.
- `communityMessages` — leitura/escrita (escrita só por AG).
- `checklists`, `checklistItems`, `checklistTicks` — leitura/escrita, com
  `communityId` preenchido e `clubId` sempre vazio nesta spec.

## 9. Perguntas em aberto

- Como um AG "adiciona um usuário existente"? Precisa de busca por e-mail/nome, ou
  o fluxo v1 é só por convite (link/código)? Recomendação: convite por código simples
  para v1 (menor superfície de busca de usuários por terceiros), busca fica para v2 —
  confirmar com o dono do produto antes do `plan.md`.

## 10. Divergências identificadas na revisão de 02/10/2026

A matriz §6 cita edição/remoção de mensagens próprias, enquanto §7 exclui essas
ações. Resolver com produto antes de implementar; recomendação do piloto: manter
fora de escopo. O convite por código de §9 é recomendação técnica, sem aprovação
humana registrada. Preservação de ticks após remoção (§4) não define política de
exclusão de conta/retenção; ver [privacidade](../../docs/operations/content-privacy.md).
