# Tasks: Devocional Diário

## Revisão de 26/10/2026 — recentes e favoritos

- [x] Domínio: contrato de sete publicações, limite de três favoritos e mensagem parametrizada.
- [x] Backend Convex: consulta privada, snapshots por usuário/data, limite atômico e recibo de restauração.
- [x] Backend SQLite: seleção de sete publicações, limite e permanência dos favoritos antigos.
- [x] Web: mesma tela em recentes/favoritos, entrada pelo menu do perfil, coração e compartilhamento da seleção.
- [x] Testes de domínio, backend e web, typecheck, lint e build.
- [ ] Publicar backend no piloto antes do merge; verificar navegação e compartilhamento em navegador real.

O histórico abaixo contém itens antigos da janela de oito datas; esta revisão a substitui.

## Revisão web — 08/10/2026

- [x] W8 — Rodapé compacto no fim da tela, favorito sempre visível e desfazer remoção do último snapshot por recibo privado. Passaram 31 testes web, 78 domain e 12 SQLite (incluindo snapshot retirado/antigo, isolamento e consumo único), lint/typecheck do monorepo e build/PWA. Primeira execução web teve timeout no carregamento inicial; repetição completa passou. Homologação visual e mobile nativo pendentes.

- [x] W7 — Diferenciar ícones independentes com superfície/contorno, hover, foco e resposta ao toque; manter alvos de 44 px, estados ARIA e movimento reduzido. Lint/typecheck do monorepo, 29 testes web e build/PWA passaram; conferência física das animações pendente. Sem alteração de negócio, rede ou mobile.

- [x] W6 — Unificar faixa de navegação, modal de recentes com data/texto base e favorito da leitura exibida; preservar seleção e cache; remover introdução e data repetida. Evidência: 29 testes web (26 integrados + 3 Dropdown), lint/typecheck do monorepo e build/PWA passaram. Teste integrado comprova ausência de novas chamadas ao escolher leitura em cache e adicionar/remover favorito. Mobile adiado; conferência visual em dispositivo permanece pendente.

> 04/10/2026: janela recente e favoritos foram implementados no backend SQLite
> de desenvolvimento; evidências nas [tasks 006](../006-desenvolvimento-local/tasks.md).
> Tasks de Convex/mobile abaixo não são concluídas por essa entrega local.

> Revisão de 02/10/2026: arquivos presentes não comprovam o aceite. Tasks mobile permanecem abertas e adiadas conforme [ADR 001](../../docs/adr/001-web-first-free-launch.md). Fechar a entrega exige integração real, permissões verificadas, lint configurado e evidência.  
> **Revisão de 04/10/2026:** T6–T8 e T-W4/T-W5 documentam janela de 7 dias e favoritos (spec §4 itens 11–13); todas abertas.

**Plano relacionado:** ./plan.md

## Backend / Domain (`packages/backend`, `packages/domain`)

- [ ] T1 — Implementar `globalSettings.get` (query).
      Critério de aceite: retorna o único documento da tabela ou `null` se ainda
      não configurado; verifica autenticação e lança erro se ausente.
- [ ] T2 — Implementar `devotionals.getByDate` (query, arg `date: v.string()`).
      Critério de aceite: usa índice `by_date`; retorna `null` se não encontrado;
      valida `YYYY-MM-DD` com zod; **rejeita data fora da janela**
      `[hojeLocal−7, hojeLocal]`; verifica autenticação.
- [x] T3 — Criar util de data local ISO.
      Critério de aceite: função pura com testes de virada de dia / formato
      `YYYY-MM-DD` (evolução da base atual em `packages/domain`).
- [ ] T4 — Hooks de leitura do dia/temas na janela recente.
      Critério de aceite: seleção de data na janela; `{ data, isLoading, isEmpty,
      … }`; recalcula “hoje” e a janela ao voltar ao foreground.
- [x] T5 — Textos fixos de estado vazio e erro de áudio em domain (evoluir paths
      atuais sem duplicar copy nos apps).
- [ ] T6 — Helpers e validators da janela (`isDateInReadingWindow` / lista das
      oito datas) + testes em domain.
      Critério de aceite: inclui hoje e exatamente sete dias atrás; exclui
      hoje−8 e datas futuras relativas a hojeLocal.
- [ ] T7 — Schema `devotionalFavorites` + mutations/queries
      (`listMine`, `add`, `remove`) com snapshot de conteúdo.
      Critério de aceite: só o titular lê/apaga; `add` copia campos do editorial
      e falha fora da janela ou sem publicação; índice por usuário+data; documentar
      em `docs/architecture.md § Modelo de Dados`.
- [ ] T8 — Adaptador de espelho JSON local + regras de reconcile (servidor vence)
      e limpeza no logout/troca de conta.
      Critério de aceite: testes de domain para merge; apps não implementam regra
      de autorização.

## Web (`apps/web`)

- [ ] T-W1 — Tela de leitura consumindo hooks de T4/T6.
      Critério de aceite: sessão antes das queries; loading/vazio/falha distintos;
      seletor apenas das datas da janela (sem busca de histórico antigo).
- [ ] T-W2 — Player de áudio web sem autoplay; oculto se sem `audioUrl`.
- [x] T-W3 — Estado vazio e skeleton (revalidar no layout atual).
- [ ] T-W4 — Favoritar/desfavoritar e lista de cópias pessoais.
      Critério de aceite: após sair da janela, a cópia favoritada permanece
      legível; desfavoritar remove banco + JSON local.
- [ ] T-W5 — Logout/troca de conta limpa o JSON local de favoritos da conta
      anterior.

## Mobile (`apps/mobile`)

- [ ] T-M1 — Tela inicial com janela de 7 dias e mesmos hooks (quando Expo
      existir). Critério: `AppState` recalcula hoje/janela.
- [ ] T-M2 — Player com `expo-audio` e controles de sistema.
- [ ] T-M3 — Validar áudio em background em device físico.
- [ ] T-M4 — Favoritos + JSON local no storage nativo; limpeza na troca de conta.

## Cross-cutting

- [ ] Atualizar `docs/architecture.md` (modelo `devotionalFavorites` + privacidade
      da cópia).
- [ ] Testes domain da janela e favoritos; testes de autorização no backend.
- [ ] Validação manual da virada de dia (janela avança; dia que sai some da
      leitura recente e permanece só se favoritado).
- [ ] Contraste AA dos blocos de tema e sugestão de oração.
- [ ] Confirmar ausência de UI/API de busca além da janela e da lista de favoritos.

## Revalidação do protótipo

T1/T2/T4/T-W1/T-W2 permanecem abertas quanto à integração real. T6–T8 e
T-W4/T-W5 são requisitos novos de 04/10/2026 e começam abertos. Evidências
anteriores de testes de domínio não cobrem janela nem favoritos.
