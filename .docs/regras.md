# Regras do projeto

## Fluxo de mudanças (pré-beta, desde 21/10/2026)

Decisão do Hil em 21/10/2026: o Devotio está em testes pré-beta. Toda mudança
precisa de (a) branch nova a partir da `main` atualizada, (b) commits separados
por escopo e (c) PR aberto no fim. Nada vai direto na `main`; o merge é do Hil.
O passo a passo com comandos PowerShell está em
[AGENTS.md § Fluxo de mudanças](../AGENTS.md#fluxo-de-mudanças--pré-beta-obrigatório-desde-21102026).

Motivo: a `main` publica a web em produção automaticamente (Cloudflare Workers
Builds). Backend Convex é publicado à parte e **antes** do merge.

## Regras de negócio vigentes (resumo; fonte: specs e docs)

- Conteúdo, mensagens e textos ao usuário em português; código em inglês.
- Reverência acima de engajamento: sem streaks, ranking, gamificação ou alertas
  agressivos ([constituição](../docs/constitution.md)).
- Permissão só vale no servidor (funções Convex em `packages/backend`, regras em
  `packages/domain`); a UI apenas esconde o que o usuário não pode usar.
- Acesso ao app: login Google + aprovação no piloto (status `pending`,
  `approved`, `disabled`) — [spec 011](../specs/011-gestao-usuarios-aprovacao/spec.md).
- Gestão de usuários: rota não listada `/gestao-acesso`, uma única credencial de
  proprietário (login + senha + TOTP em variáveis do Convex), sessão de 30 min.
  Administrador de comunidade não é superusuário.
- Comunidade ([spec 015](../specs/015-comunidade-papeis-permissoes/spec.md), aprovada
  em 21/10): criar exige permissão/limite; criador vira owner; código gera pedido
  para owner/admin aprovarem. Só owner/admin publicam, fixam escritura e criam
  listas. Admin promove membro; só owner remove/rebaixa admin. Owner transfere
  antes de sair/desativar. Nenhuma comunidade pode perder o último gestor ativo.
  Implementação e rollout: [.todo/02](../.todo/.done/02-comunidades-permissoes-papeis.md).
- Amigos e recados ([spec 014](../specs/014-amigos-compartilhamento/spec.md)):
  amizade consentida, até 20 destinatários por recado, recado de até 1.000
  caracteres, privado entre remetente e destinatários.
- Notificações ([spec 016](../specs/016-notificacoes/spec.md)):
  recado de amigo, entrada aprovada, remoção forçada e publicação comunitária;
  sino discreto, sem push/som/animação; apenas Lida marca leitura. Convex usa
  subscriptions e SQLite, SSE. Sem avisar autor ou novos membros sobre histórico;
  acesso revogado oculta publicações sem marcá-las lidas. Rollout com o Hil;
  evidências em [.todo/03](../.todo/.done/03-notificacoes.md).

## Segurança

- Nunca versionar `.env*`, `.env.admin.local`, `client_secret_*` nem chaves.
- Não imprimir valores de variáveis de ambiente em logs, PRs ou tarefas.
- Não executar `npm run deploy:*`, `npx convex deploy` ou `wrangler deploy`:
  publicar é decisão do Hil.

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.
