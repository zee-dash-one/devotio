# 06 — Seleção de versículos um a um na leitura bíblica

**Status:** implementação concluída em 2026-10-24; entrega pelo [PR #12](https://github.com/zee-dash-one/devotio/pull/12).
**Ordem aplicada:** 08 → 09 → 06 → 07, na mesma branch autorizada pelo Hil.
**Branch sugerida:** `feat/verse-multi-select`.
**Usada por:** [07 — Compartilhar no devocional aberto](./07-devocional-compartilhar.md),
que reaproveita a lógica e o componente de seleção criados aqui.

## Contexto

O Hil está fazendo testes de usabilidade no site e pediu outra forma de escolher
versículos no leitor da Bíblia (`/biblia`).

Como está hoje (relato do Hil):

- Segurar um versículo seleciona o versículo inteiro e mostra o destaque no canto
  (fundo `--prayer` + barra dourada à esquerda). **Isso está bom.**
- Clicar e arrastar no celular faz a página recarregar (pull-to-refresh).
- Na web, arrastar seleciona o texto do HTML e permite dar Ctrl+C.
- Shift+clique seleciona um intervalo (ex.: do 1 ao 9).
- Não dá para selecionar versículos separados (ex.: 1, 2, 5 e 6).

## Leia antes

[AGENTS.md](../../AGENTS.md) (seção "Fluxo de mudanças — pré-beta"),
[.todo/README.md](../README.md), [.docs/design.md](../../.docs/design.md),
[apps/web/AGENTS.md](../../apps/web/AGENTS.md),
[specs/008](../../specs/008-selecao-compartilhamento-notificacoes/spec.md) (regras atuais
de seleção) e [specs/014](../../specs/014-amigos-compartilhamento/spec.md) (enviar para amigos).

## O que existe hoje (levantado no código em 23/10/2026, só leitura)

**Leitor — `apps/web/src/pages/bible.tsx` (`BibleReader`)**

- Estado: `storedSelection` / `setSelected` do tipo `BibleSelection`
  (`{ book, chapter, first, last, version }`). `select(first, last, data)` monta a
  seleção com `selectionRange()`; `anchor` (ref) guarda o versículo-âncora.
- Segurar: `onPointerDown` no `<p data-verse role="checkbox">` liga um timer de
  **350 ms** que marca o versículo (`gesture.current.active = true`) e suprime o clique.
- Arrastar: `onPointerMove` no `<article className="bible-verses">` estende o
  intervalo de `anchor` até o versículo sob o dedo/mouse (`elementFromPoint`).
  No mouse, arrastar > 6 px já ativa o gesto; no toque, mover > 10 px antes do
  timer cancela o gesto (vira rolagem).
- Seleção nativa: um listener de `selectionchange` converte a seleção de texto do
  navegador em `first`/`last` (é por isso que arrastar na web seleciona texto e o
  Ctrl+C funciona).
- Clique simples: marca só aquele versículo (substitui a seleção anterior); clicar
  de novo no mesmo versículo sozinho limpa. **Shift+clique** chama
  `select(anchor.current, verse.number)` (intervalo).
- Teclado: Espaço/Enter marca o versículo focado; **Shift+↑/↓** estende o
  intervalo; Esc limpa.
- `touchmove` com `preventDefault()` só enquanto o gesto está ativo; fora disso o
  navegador rola e, no topo da página, dispara o pull-to-refresh.
- Destaque: classe `selected-verse` e `aria-checked` calculados por
  `verse.number >= quote.first && verse.number <= quote.last`.
- Troca de livro, de versão, busca e `open()` (troca de capítulo pelos controles)
  zeram a seleção.
- Gestos de página: `apps/web/src/bible-page-gestures.ts` (swipe horizontal no
  modo paginado troca de capítulo; chama `cancelGesture`).

**Menu e fluxos que usam a seleção**

- `apps/web/src/pages/selection-menu.tsx` (`SelectionMenu`): Compartilhar (copia
  `quoteText(quote)` via `navigator.clipboard`, com textarea de cópia manual),
  Enviar para comunidade (`repo.sharing.saveDrafts`), Enviar para amigos
  (`ShareToFriends` em `apps/web/src/social.tsx`), Criar devocional
  (`editorialDraft` + `setPicker`) e **Limpar seleção** (botão já existe, além do X).
- Modo picker (`/biblia?pick=devotional|community`): `returnToWriting()` em
  `bible.tsx` aplica a citação no cadastro (`applyEditorialQuote`) ou no rascunho
  da comunidade (`updateDraft`/`saveDrafts`).
- Estilos: `apps/web/src/styles/bible.css` (`.bible-verses .selected-verse`,
  `.selection-menu` com `user-select: none`). `.bible-verses` já tem
  `touch-action: pan-y` (linha 316); **não há** `user-select` nem
  `overscroll-behavior` no leitor (`.reading-window`/`.bible-verses`).

**Domínio e backend — a seleção é sempre um intervalo contínuo**

- `packages/domain/validators/sharing.ts`: `bibleSelectionSchema` tem só
  `first`/`last` e recusa `first > last` ("Selecione um intervalo contínuo de versículos.").
- `packages/domain/sharing.ts`: `bibleQuote()` filtra `first..last` e monta a
  referência `Livro C:first–last`; `bibleQuotePath()` usa só `first`;
  `selectionRange()` é min/max.
- `packages/backend/scriptureValidators.ts` (`scriptureSelectionValidator`) e
  `packages/backend/socialValidators.ts` (`quoteValidator`) gravam `first`/`last`
  em `scriptureShares`, rascunhos/mensagens de comunidade (`communityValidators.ts`),
  `devotionals.selection`, `editorial*.ts` e `social.ts`.
  `packages/backend/scriptures.ts` (`editorialScripture`) refaz o texto no servidor
  a partir de `first..last`. `shareMarkers`/`shareViews` guardam só `first`.
- `specs/008` lista **"Seleções descontínuas"** como fora do escopo e descreve
  arrastar e Shift+clique como formas de seleção. Precisa ser atualizada.
- Testes que dependem do comportamento atual: `apps/web/src/local-app.test.tsx`
  (Shift+clique nas linhas ~429, ~446 e ~473; `selectionchange` na ~595).

**Conclusão:** marcar 1, 2, 5 e 6 é só web na parte de gesto/estado, mas
compartilhar, enviar para comunidade/amigos e criar devocional **assumem intervalo
contínuo** até o backend. Por isso a D7 muda o backend (campo novo opcional).

## Decisões (2026-10-23)

D7 decidida pelo Hil; D1–D6 e o significado de "intervalo" escolhidos pela
Malfoyd com delegação do Hil.

- **D1 — Decidido:** clicar/tocar num versículo marcado desmarca só ele; os outros continuam.
- **D2 — Decidido:** segurar continua existindo e faz o mesmo que o toque (alterna
  o versículo). O toque basta; não há mais timer que "ativa" arraste.
- **D3 — Decidido:** limpar seleção pelo botão que já existe no menu
  ("Limpar seleção" e o X do `SelectionMenu`); ele limpa todos os marcados.
- **D4 — Decidido:** trocar de capítulo (controles, swipe, modo contínuo ou link)
  zera a seleção.
- **D5 — Decidido:** a referência agrupa versículos seguidos e separa os grupos com
  vírgula, ex.: `Jo 3:1-2, 5-6` (seguir o nome/abreviação de livro já usado por
  `bibleQuote()`; hoje ele usa o nome do livro e "–"). No texto, cada versículo
  continua `N - texto`.
- **D6 — Decidido:** Ctrl+C nativo bloqueado no leitor (não há texto solto
  selecionável). A ação **Copiar** do menu copia os versículos marcados com a referência.
- **D7 — Decidido (Hil):** mudar o backend com um **campo novo opcional** com a
  lista de versículos (ex.: `verses?: number[]`, ordenada e sem repetição). O
  formato antigo (`first`/`last`) continua sendo lido: registros sem `verses`
  valem como `first..last`. `first`/`last` continuam gravados (menor/maior),
  para a web antiga e os dados existentes não quebrarem.
- **Intervalo — Decidido:** "intervalo" é clicar um por um nos versículos
  seguidos. Shift+clique e Shift+↑/↓ não selecionam intervalo.
- **Compartilhar — Decidido:** usar a Web Share API (`navigator.share`) quando
  existir; senão copiar para a área de transferência e mostrar o aviso "copiado"
  (manter a textarea de cópia manual como último recurso).

## Comportamento a implementar

1. Cada clique, toque ou toque longo num versículo alterna a seleção do versículo
   inteiro e **acumula**: 1, 2, 5 e 6 ficam os quatro marcados; clicar de novo
   no 5 desmarca só o 5.
2. Clicar e arrastar não faz nada: não seleciona e não dispara pull-to-refresh no
   celular (`overscroll-behavior-y: contain` no container do leitor/`body`
   enquanto em `/biblia`; remover a extensão por arraste do `onPointerMove`).
   A rolagem vertical normal continua, e o arrasto horizontal de capítulo do modo
   Paginado (08) também: manter `touch-action: pan-y`, nunca `none`.
3. Seleção de texto nativa desativada na web e no mobile dentro do leitor:
   `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;`
   em `.bible-verses`; remover o listener de `selectionchange`; bloquear o
   `copy` nativo no leitor. Campo de busca e textarea de cópia manual continuam
   selecionáveis.
4. Shift+clique é um clique comum; Shift+↑/↓ sai. Teclado: Espaço/Enter alternam
   o versículo focado; Esc limpa.
5. Trocar de capítulo zera a seleção.
6. Menu (`SelectionMenu`): **Compartilhar** usa `navigator.share({ text })` e cai
   para cópia + "copiado"; **Copiar** copia `quoteText()` (versículos marcados +
   referência agrupada + versão). Enviar para comunidade, Enviar para amigos,
   Criar devocional e o picker (`returnToWriting`) funcionam com seleção contínua
   e não contígua.
7. Backend e domínio aceitam o campo novo `verses` e continuam lendo o formato
   antigo; `editorialScripture()` refaz o texto a partir de `verses` quando houver.
8. **Reaproveitável pela tarefa 07:** lógica de seleção num hook/componente
   próprio (ex.: `apps/web/src/verse-selection.ts` com `useVerseSelection()`) e
   funções puras em `packages/domain/sharing.ts` (ex.: `toggleVerse`,
   `verseGroups`, `selectionVerses`, `formatReference`), sem depender do `BibleReader`.

Fora do escopo: leitura da Palavra dentro do devocional (tarefa 07), seleção entre
capítulos/livros, app mobile.

## Plano e checklist

- [x] **Spec 009** — em [`specs/009-configuracoes-leitura/spec.md`](../../specs/009-configuracoes-leitura/spec.md)
      linha 76, trocar "Long-press e arraste deliberado preservam seleção contígua"
      pela regra nova (toque/segurar alternam; seleção não contígua; swipe de capítulo
      continua suspenso com seleção ativa).
- [x] **Spec 008** — atualizar
      [`specs/008-selecao-compartilhamento-notificacoes/spec.md`](../../specs/008-selecao-compartilhamento-notificacoes/spec.md)
      (no PR desta tarefa, commit `docs(specs)`), registrando:
  - seleção descontínua permitida (tirar "Seleções descontínuas" do fora do escopo);
  - toque e segurar alternam o versículo e acumulam;
  - arrastar e Shift+clique (e Shift+↑/↓) não selecionam;
  - sem seleção de texto nativa nem Ctrl+C nativo no leitor;
  - trocar de capítulo zera a seleção;
  - referência agrupada (`Jo 3:1-2, 5-6`);
  - Copiar do menu copia os versículos marcados com a referência;
  - Compartilhar com Web Share API e fallback para cópia + "copiado";
  - campo novo opcional com a lista de versículos e leitura do formato antigo
    `first`/`last`.
- [x] Domínio (`packages/domain`), testes antes: `verses` opcional em
      `bibleSelectionSchema` (`validators/sharing.ts`) validando lista ordenada,
      sem repetição e dentro de `first..last`; `toggleVerse`, `verseGroups`,
      `selectionVerses` (antigo → `first..last`); `bibleQuote()` com texto e
      referência agrupada; `bibleQuotePath()` coerente com a 07.
- [x] Backend (`packages/backend`): `verses: v.optional(v.array(v.number()))` em
      `scriptureSelectionValidator` (propaga para `quoteValidator`, `schema.ts`,
      `editorial*.ts`, `social.ts`, `communityValidators.ts`); `editorialScripture()`
      usando a lista. Sem migração: dados antigos continuam válidos. Testes do backend.
- [x] Web: hook/componente reaproveitável; trocar clique/segurar/arraste/
      Shift+clique/`selectionchange` em `bible.tsx`; destaque e `aria-checked`
      pela lista de versículos.
- [x] Web: CSS anti-seleção e anti-pull-to-refresh; bloqueio do `copy` nativo.
- [x] Web: `SelectionMenu` com Compartilhar (Web Share + fallback) e Copiar;
      `ShareToFriends` e `returnToWriting` com seleção não contígua.
- [x] Atualizar `apps/web/src/local-app.test.tsx` (Shift+clique ~429/446/473 e
      `selectionchange` ~595) e adicionar testes de toggle acumulado, referência
      agrupada e fallback de compartilhar.
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build:ready`.
- [x] Um commit por tarefa, push, PR com o checklist de backend; registrar comandos e URL do PR aqui.

## Fluxo aplicado nesta entrega

Hil autorizou explicitamente uma branch conjunta criada da `main` atualizada, um commit por tarefa, PR e merge pelo agente. Essa autorização substitui o plano inicial de branches separadas e merge manual. O backend do piloto deve estar publicado antes do merge da web.

## Critérios de aceite

As marcações abaixo registram implementação e cobertura automatizada. Homologação em aparelhos físicos Android/iOS permanece pendente; não foi declarada como realizada.

- [x] Celular e desktop: tocar/clicar em 1, 2, 5 e 6 deixa os quatro marcados
      (destaque e `aria-checked="true"`); clicar de novo no 5 desmarca só ele.
- [x] Segurar um versículo alterna igual ao toque, sem abrir lupa/menu nativo.
- [x] Celular: puxar para baixo no topo da leitura **não** recarrega; arrastar sobre
      os versículos não marca nada; a rolagem funciona.
- [x] Desktop: clicar e arrastar com o mouse não seleciona texto nem versículos;
      Ctrl+C no leitor não copia nada.
- [x] Shift+clique marca só o versículo clicado; Shift+↑/↓ não estende intervalo.
- [x] Trocar de capítulo zera a seleção.
- [x] Copiar com 1, 2, 5 e 6 coloca na área de transferência os quatro versículos e
      a referência `… 3:1-2, 5-6` com a versão.
- [x] Compartilhar abre o compartilhamento nativo onde existe `navigator.share`;
      sem ele, copia e mostra "copiado".
- [x] Enviar para amigos, Enviar para comunidade, Criar devocional e o picker do
      cadastro/comunidade funcionam com seleção contínua e não contígua.
- [x] Dados antigos (só `first`/`last`) continuam abrindo, mostrando o trecho certo
      e sendo compartilhados sem erro; web antiga continua funcionando com o
      backend novo.
- [x] Teclado: Tab/Espaço/Enter alternam; Esc limpa.
- [x] `specs/008` atualizada com todos os itens do checklist.
- [x] Lint, typecheck, testes e `build:ready` passam.

## Teste manual

1. `npm run dev --workspace=web` (modo local com SQLite) e abrir `/biblia?book=jo&chapter=3`.
2. Desktop: clicar 1, 2, 5, 6 → quatro marcados; menu mostra `… 3:1-2, 5-6`.
   Clicar no 5 → só ele sai.
3. Desktop: arrastar o mouse sobre 7–10 → nada marcado, nenhum texto selecionado;
   Ctrl+C → nada copiado. Shift+clique no 9 → só o 9 entra.
4. Copiar → colar num editor: versículos marcados + referência agrupada + versão.
5. Compartilhar no desktop sem Web Share (ex.: Firefox) → aviso "copiado"; colar e conferir.
6. Enviar para amigos e Enviar para comunidade com 1, 2, 5, 6 → conferir o recebido.
7. Criar devocional → o cadastro recebe o trecho e a referência agrupada.
8. Trocar de capítulo → seleção zerada.
9. Celular (Chrome Android e Safari iOS): repetir 2–8 com toque e toque longo;
   Compartilhar abre a folha nativa; no topo, puxar para baixo → sem recarregar.
10. Abrir um compartilhamento/rascunho antigo (só `first`/`last`) → abre e
    compartilha sem erro.

## Impacto / conflitos com outras tarefas

Revisão de 23/10/2026 contra o código real. Ordem: 08 → 09 → **06** → 07.

- **Arrasto horizontal de capítulo (08) não pode ser bloqueado.** Quando a 06 diz
  "arrastar não faz nada", vale para **seleção** de versículos, não para o gesto de
  página. `.bible-verses` já tem `touch-action: pan-y` (`styles/bible.css` linha
  316); **não** trocar por `touch-action: none` nem chamar `preventDefault()` em
  `pointermove`/`touchmove` fora do gesto de capítulo. Pull-to-refresh se resolve só
  no eixo vertical com `overscroll-behavior-y: contain` (no `html`/`body` enquanto
  em `/biblia` ou no container de rolagem). O `touchmove` com `preventDefault`
  de `bible.tsx` (~341–345) existe para o arraste de seleção e deve sair junto com ele.
- **Toque × início de arrasto.** O toggle só acontece se o ponteiro se moveu pouco
  entre `pointerdown` e `pointerup`/`click`: reaproveitar o limiar existente
  (toque: 10 px, `bible.tsx` ~637; o gesto de capítulo começa em 12 px,
  `bible-page-gestures.ts` linha 19). Movimento acima do limiar cancela o toggle e o
  "segurar" de 350 ms (`bible.tsx` ~716). O clique depois de um arrasto de capítulo
  já é suprimido por 400 ms (`bible-page-gestures.ts` linhas 27/32); manter, para o
  arrasto não marcar versículo. O "segurar" (350 ms) e a janela de 350 ms para virar
  arrasto (`bible-page-gestures.ts` linha 18) têm o mesmo valor: segurar parado
  alterna; segurar e depois arrastar não deve alternar nem trocar capítulo.
- **Mouse:** hoje arrastar com o mouse > 6 px ativa a seleção por intervalo
  (`bible.tsx` ~642–652) e também pode iniciar o gesto de capítulo. A 06 remove a
  seleção por arraste; o arrasto do mouse no modo Paginado fica só para o capítulo (08).
- **Seleção nativa desligada** (`user-select: none`, `-webkit-touch-callout: none`)
  não afeta os eventos de ponteiro; conferir que o arrasto de capítulo continua no
  iOS e no Android depois do CSS.
- **Trocar de capítulo zera a seleção (D4).** Hoje o swipe de capítulo fica
  **desligado com seleção ativa** (`bible.tsx` linha 413, `!selected`; regra da
  `specs/009` linha 76). Manter essa suspensão: com versículos marcados, trocar de
  capítulo é pelos botões Anterior/Próximo (que já zeram), e um swipe não apaga uma
  seleção de vários versículos sem querer. Isso também evita o conflito com o
  deslizar para a esquerda que expande o menu contraído (ver a 09).
- **`specs/009` também precisa mudar:** a linha 76 diz "Long-press e arraste
  deliberado preservam seleção contígua da spec 008". Atualizar junto com a 008
  (ver checklist).
- **Abrir pelo título (07, parâmetro `verses`):** a função pura de seleção e o
  parser da lista criados aqui devem aceitar uma lista inicial vinda da URL. No
  modo Paginado não há páginas dentro do capítulo (a tela mostra o capítulo
  inteiro), então "ir para a página do primeiro versículo" é abrir o capítulo e
  rolar até `verse-${chapter}-${first}`, como o efeito de `bible.tsx` ~391–398 já faz.
- **Conflito de merge:** 06, 08 e 09 mexem em `apps/web/src/pages/bible.tsx`,
  `apps/web/src/local-app.test.tsx` e/ou `selection-menu.tsx`. Começar a 06 só
  depois do merge da 08 e da 09, a partir da `main` atualizada.

## Resultado

Ver o resultado da implementação e o registro final de entrega abaixo.

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 23/10/2026. Hil, agora o Devotio aprendeu a escolher versículo como quem colhe fruta no pé: um por um, sem arrancar o galho inteiro.

## Resultado da implementacao — 2026-10-23

Selecao individual reutilizavel, referencia agrupada, Web Share/Copiar/fallback manual e bloqueio de selecao nativa. Campo verses opcional propagado por scriptureSelectionValidator, quoteValidator e contratos editoriais/comunitarios/sociais. editorialScripture ja usa bibleQuote, agora respeitando a lista; SQLite persiste JSON sem migracao.

Comandos: teste de sharing.test.ts antes falhou por descarte de verses; depois cinco casos passaram. Typecheck inicialmente identificou refinamento Zod aninhado incompatível com innerType().pick; corrigido e monorepo passou. npm run lint passou. Testes web ajustaram expectativas antigas de arraste e passam: 37 casos de local-app.test.tsx e share-text.test.tsx. Teste Convex ajustado ao contrato plano de social:send e timeout de 15 s para carga inicial do corpus canonico (o restante permanece com limite existente). Testes de persistencia cobrem SQLite e Convex, texto canonico e listas invalidas. Build completo e publicacao backend antes do merge registrados no PR conjunto. Aparelhos fisicos nao homologados pelo agente.

## Registro final da entrega conjunta — 24/10/2026

PR: https://github.com/zee-dash-one/devotio/pull/12

- Branch: `feat/verse-selection-and-devotional-sharing`, criada da `main` atualizada (90d53fc). Um commit por tarefa, ordem 05 → 08 → 09 → 06 → 07, autorizada pelo Hil.
- `npm run test --workspace=domain -- --maxWorkers=1 --testTimeout=15000`: 103 testes passaram.
- `npm run test --workspace=backend -- --maxWorkers=1 --testTimeout=15000`: 78 testes passaram.
- `npm run test --workspace=web -- --maxWorkers=1 --testTimeout=15000`: 72 testes passaram. A primeira execução apontou uma expectativa antiga sem `verses`; corrigida e suíte inteira repetida com sucesso.
- O limite padrão de 5 s falhou no teste existente de importação canônica; repetição sequencial com 15 s passou.
- `npm run test --workspace=web -- src/local-app.test.tsx --maxWorkers=1 --testTimeout=15000 -t 'devocional seleciona Palavra'`: os dois modos passaram novamente após o ajuste final do link.
- `npm run verify:local`: passou com login mockado e SQLite.
- `npm run build:ready`: passou (lint, typecheck, build e verificação de manifest, ícones, licenças, 22 recursos públicos e ausência de fixtures/API em cache).
- `npm run deploy:backend -- --env-file <seletor temporário do piloto>`: sucesso. Alvo confirmado `adm-zone:devotio-pilot`, deployment development `upbeat-jellyfish-720` que atende o piloto publicado. Seletor contém somente o nome público do deployment.
- `convex function-spec --deployment upbeat-jellyfish-720`: contratos remotos confirmados; `social:send`, `editorial:publish` e `editorialAccess:save` aceitam `verses`; `communities:list/detail` continuam aceitando `governance`. Nenhuma migração de dados foi necessária.
- `git push -u origin feat/verse-selection-and-devotional-sharing` e `gh pr create --draft`: sucesso, PR #12 aberto. O commit final registra esta documentação antes de tornar o PR pronto e executar o merge autorizado; o merge dispara o Workers Build.
- Android/iOS físicos e suas folhas nativas de compartilhamento não foram homologados. Implementação responsiva, APIs e fallbacks têm cobertura automatizada.
