# 07 — Seleção e compartilhamento no devocional aberto

**Status:** implementação concluída em 2026-10-24; entrega pelo [PR #12](https://github.com/zee-dash-one/devotio/pull/12).
**Ordem aplicada:** 08 → 09 → 06 → 07, na mesma branch autorizada pelo Hil.
**Depende de:** [06 — Seleção de versículos um a um](./06-selecao-versiculos.md)
(hook/componente de seleção, campo opcional `verses` e Web Share com fallback).
**Branch sugerida:** `feat/devotional-share` (criada da `main` depois do merge da 06).

## Contexto

O Hil está fazendo testes de usabilidade e quer que a tela do devocional aberto
(Palavra, Meditar, Oração) permita marcar versículos, abrir o trecho na Bíblia e
compartilhar partes ou o devocional inteiro.

## Leia antes

[AGENTS.md](../../AGENTS.md) (seção "Fluxo de mudanças — pré-beta"),
[.todo/README.md](../README.md), [.docs/design.md](../../.docs/design.md),
[apps/web/AGENTS.md](../../apps/web/AGENTS.md), a tarefa [06](./06-selecao-versiculos.md),
[specs/001](../../specs/001-devocional-diario/spec.md),
[specs/008](../../specs/008-selecao-compartilhamento-notificacoes/spec.md) e
[specs/014](../../specs/014-amigos-compartilhamento/spec.md).

## O que existe hoje (levantado no código em 23/10/2026, só leitura)

- Rotas `/` e `/devocional` (`apps/web/src/router.tsx`) renderizam `ReadingPage`
  (`apps/web/src/pages/reading.tsx`), que mostra `DevotionalPage`
  (`apps/web/src/pages/devotional.tsx`). Dados via `useReader()` (`apps/web/src/context`).
- `DevotionalPage` é só exibição, sem nenhum handler de clique, toque ou cópia:
  - **Palavra:** `<h2 className="scripture-reference">{reference}</h2>` (texto
    simples, não é link), `translation`, e `scripture.split("\n")` em `<p>` com o
    marcador `✦`. Os versículos **não são estruturados**: cada linha é o texto
    gravado pelo editorial (formato de `bibleQuote()`: `26 - texto`).
  - **Meditar:** `reflection.split("\n")` em `.reflection-text`.
  - **Oração:** `prayerSuggestion` em `.prayer-card`; depois `credit`.
  - Tema semanal (`settings.weeklyVerse`) em `<aside className="weekly-theme">`.
- `Devotional` (`packages/domain/types.ts`) tem `selection?: BibleSelection`
  opcional (`book`, `chapter`, `first`, `last`, `version`), gravado em
  `devotionals.selection` (`packages/backend/schema.ts`) quando o editorial escolhe
  o trecho pela Bíblia. Devocionais antigos ou com Palavra digitada à mão podem
  não ter `selection`; aí só existem as strings `reference` e `scripture`.
- Deep link da Bíblia já existe: `/biblia?book&chapter&verse&version`
  (`bibleParamsSchema` em `router.tsx`; `bible.tsx` rola até
  `verse-${chapter}-${verse}` e destaca esse versículo com `selected-verse`).
  `bibleQuotePath()` em `packages/domain/sharing.ts` monta esse caminho.
- Compartilhar hoje (`apps/web/src/pages/selection-menu.tsx`) é **copiar para a
  área de transferência** (`navigator.clipboard.writeText(quoteText(quote))`, com
  textarea de cópia manual). Não há `navigator.share` em `apps/web/src`.
  Enviar para amigos: `ShareToFriends` (`apps/web/src/social.tsx`), que recebe
  um `BibleQuote` (exige `book`/`chapter`/`first`/`last`/`version`).
- Estilos: `apps/web/src/styles/devotional.css`.
- URL pública do app não estava versionada (`apps/web/wrangler.toml` só traz o
  comentário `https://devotio.<sua-conta>.workers.dev`). Decidida pelo Hil: ver D2.

## Decisões (2026-10-23)

Escolhidas pela Malfoyd com delegação do Hil.

- **D1 — Decidido:** botão de compartilhar o devocional inteiro no **topo** da
  tela, como ícone de compartilhar (ex.: `Share2` do `lucide-react`, já usado no
  `SelectionMenu`), com `aria-label="Compartilhar devocional"`.
- **D2 — Decidido:** o texto do devocional inteiro leva a data do devocional no topo
  ("Devocional de DD/MM/AAAA", sem campo de título), depois
  Palavra (referência + texto), Meditar, Oração e, no fim, uma linha curta
  "Devotio" com o link do app.
- **URL — Decidido (Hil, 23/10/2026):** a linha "Devotio" usa
  `https://devotio.zee-dash-one.workers.dev` (URL da fase pré-beta). Deixar numa
  constante de config, ex.: `VITE_PUBLIC_APP_URL` com esse valor padrão (lida em
  `apps/web` e passada à função do domínio), para trocar fácil depois do beta.
  `window.location.origin` **não** é a fonte principal.
- **D3 — Decidido:** Meditar e Oração compartilhados levam a referência bíblica
  do dia no fim.
- **D4 — Decidido:** abrir as Escrituras pelo título mostra os versículos da
  passagem (ex.: 26 e 27) **já marcados**, com scroll no primeiro. Usar parâmetro
  novo na URL coerente com o campo `verses` da 06 (ex.:
  `/biblia?book=ez&chapter=36&verse=26&verses=26,27&version=…`, validado em
  `bibleParamsSchema`); sem `verses`, `verse` continua funcionando como hoje.
- **D5 — Decidido:** "intervalo" é clicar um por um nos versículos seguidos;
  Shift+clique (e Shift+↑/↓) desativado, como na 06.
- **D6 — Decidido:** toque simples no Meditar/Oração não faz nada; só segurar abre
  o compartilhamento. Seleção de texto nativa desativada ali também.
- **Compartilhar — Decidido:** Web Share API (`navigator.share`) quando existir;
  senão copiar e mostrar "copiado" (mesmo utilitário da 06).

## Comportamento a implementar

1. **Palavra:** versículos funcionam igual à 06 (toque/clique alterna e soma; um,
   vários ou grupos separados; segurar faz o mesmo; sem seleção nativa; sem
   pull-to-refresh). Os marcados podem ser compartilhados (Web Share/cópia) ou
   enviados para um amigo (`ShareToFriends`), igual às Escrituras.
   **Reaproveitar** o hook/componente de seleção e o `SelectionMenu` da 06/09. Os números dos
   versículos vêm de `devotional.selection` (lista `verses` ou `first..last`) +
   capítulo do repositório da Bíblia; alternativa: prefixo `N - ` das linhas.
   Sem `selection`, a Palavra fica só para leitura (sem marcação).
2. **Título da referência:** com `selection`, vira link para a Bíblia no capítulo,
   com os versículos da passagem marcados e scroll no primeiro (D4). Sem
   `selection`, continua texto simples (não converter a string da referência).
3. **Meditar:** segurar o texto abre o `SelectionMenu` numa variante só de
   compartilhar/copiar o Meditar,
   **sem** "Enviar para amigos"; o texto termina com a referência do dia (D3).
   Toque simples não faz nada (D6).
4. **Oração:** igual ao Meditar.
5. **Devocional inteiro:** ícone no topo (D1). Texto simples, sem formatação rica,
   bem espaçado, gerado por função pura no domínio (ex.:
   `devotionalShareText(devotional, appUrl)` em `packages/domain`, com teste):

   ```text
   Devocional de 23/10/2026

   PALAVRA
   Ezequiel 36:26-27 — <nome da versão>

   26 - ...
   27 - ...

   MEDITAR

   ...

   ORAÇÃO

   ...

   Devotio — https://devotio.zee-dash-one.workers.dev
   ```

   **Cabeçalho — Decidido (Hil, 23/10/2026):** só a data do devocional (o dia a
   que ele pertence, `devotional.date`), ex.: "Devocional de 23/10/2026". Não
   criar campo de título (`Devotional` em `packages/domain/types.ts` não tem um).

Fora do escopo: mudanças no cadastro editorial, compartilhar o tema semanal,
backend novo (a 06 já entrega o campo `verses`; se faltar algo, parar e perguntar
ao Hil), app mobile.

## Plano e checklist

- [x] Aplicar a 06 antes da 07 na branch conjunta; publicação do backend registrada na entrega.
- [x] Registrar as decisões desta tarefa na spec pelo PR (ex.: seção nova em
      [`specs/001-devocional-diario/spec.md`](../../specs/001-devocional-diario/spec.md)).
- [x] Domínio, testes antes: `devotionalShareText()` e texto de Meditar/Oração
      com referência no fim.
- [x] Config: `VITE_PUBLIC_APP_URL` (padrão `https://devotio.zee-dash-one.workers.dev`)
      numa constante em `apps/web`; documentar em `apps/web/.env.example` (sem segredo).
- [x] Web: parâmetro `verses` em `bibleParamsSchema` (`packages/domain/validators/local.ts`, consumido pelo router) e
      marcação inicial em `bible.tsx`; `bibleQuotePath()` gerando `verses`.
- [x] Web: Palavra com o hook/componente de seleção da 06 + menu (Compartilhar,
      Copiar, Enviar para amigos).
- [x] Web: título da referência como `Link` quando houver `selection`.
- [x] Web: toque longo em Meditar/Oração abre painel só de compartilhar/copiar.
- [x] Web: ícone de compartilhar no topo com o devocional inteiro.
- [x] CSS em `apps/web/src/styles/devotional.css` (anti-seleção, anti-pull-to-refresh).
- [x] Testes de UI (ex.: `apps/web/src/local-app.test.tsx`) para os cinco fluxos.
- [x] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build:ready`.
- [x] Um commit por tarefa, push, PR; registrar comandos e URL do PR aqui.

## Fluxo aplicado nesta entrega

Hil autorizou explicitamente uma branch conjunta criada da `main` atualizada, um commit por tarefa, PR e merge pelo agente. Essa autorização substitui o plano inicial de branches separadas e merge manual. O backend do piloto deve estar publicado antes do merge da web.

## Critérios de aceite

As marcações abaixo registram implementação e cobertura automatizada. Homologação em aparelhos físicos Android/iOS permanece pendente; não foi declarada como realizada.

- [x] Palavra: tocar/clicar/segurar marca e soma (um, vários, grupos separados),
      igual à `/biblia`; clicar de novo desmarca só aquele; Shift+clique não
      faz intervalo; sem seleção nativa e sem pull-to-refresh no celular.
- [x] Palavra: Compartilhar usa Web Share quando existe, senão copia e mostra
      "copiado"; Copiar e Enviar para amigos entregam o trecho e a referência agrupada.
- [x] Título "Ezequiel 36:26-27" abre `/biblia` em Ezequiel 36 com 26 e 27 marcados,
      rolado até o 26, na versão do devocional.
- [x] Devocional sem `selection`: título não é link e a Palavra só é lida, sem erro.
- [x] Meditar e Oração: toque simples não faz nada; segurar abre só
      compartilhar/copiar (sem amigos); o texto termina com a referência do dia.
- [x] Ícone de compartilhar no topo gera texto simples, bem espaçado: "Devocional de
      DD/MM/AAAA" com a data do devocional (não a de hoje),
      Palavra (referência + texto), Meditar, Oração e a linha "Devotio" com
      `https://devotio.zee-dash-one.workers.dev` (ou o valor de `VITE_PUBLIC_APP_URL`).
- [x] Web Share com fallback nos três tipos de compartilhamento.
- [x] Celular e desktop; lint, typecheck, testes e `build:ready` passam.

## Teste manual

1. `npm run dev --workspace=web` (modo local com SQLite) e abrir `/devocional`.
2. Na Palavra, marcar versículos (um, seguidos e separados) → Copiar → colar e
   conferir texto e referência agrupada; Compartilhar no Firefox desktop →
   aviso "copiado".
3. Enviar para amigos com os marcados → conferir o recebido.
4. Clicar no título da referência → Bíblia no capítulo certo, versículos da
   passagem marcados, scroll no primeiro.
5. Tocar no Meditar → nada; segurar → painel só com compartilhar/copiar; colar e
   conferir a referência no fim. Repetir na Oração.
6. Ícone de compartilhar no topo → colar no WhatsApp Web/bloco de notas e
   conferir ordem, espaçamento e a linha "Devotio — https://devotio.zee-dash-one.workers.dev".
7. Celular (Android e iOS): repetir 2–6; Compartilhar abre a folha nativa; puxar a
   página para baixo na Palavra → sem recarregar; segurar → sem menu nativo de texto.
8. Abrir um devocional sem `selection` (se houver no SQLite local) → título sem link, sem erro.

## Impacto / conflitos com outras tarefas

Revisão de 23/10/2026 contra o código real. Ordem: 08 → 09 → 06 → **07**.

- **Menu:** hoje `SelectionMenu` (`apps/web/src/pages/selection-menu.tsx`) só é
  usado em `bible.tsx` e exige um `BibleQuote`. Usar o **mesmo componente** na
  Palavra (assim herda o "abre contraído no celular" da 09 e o Web Share da 06).
  Para Meditar/Oração, não criar um sheet separado: dar ao `SelectionMenu` uma
  variante só com Compartilhar/Copiar (ex.: prop `actions` ou `text` em vez de
  `quote`), sem Enviar para amigos/comunidade/Criar devocional. O Web Share nativo
  abre por cima, a partir do botão Compartilhar do menu.
- **Gestos do menu fora da Bíblia:** o deslizar rápido para expandir o menu
  contraído só funciona dentro de `.bible-page` (`selection-drawer-gestures.ts`
  linha 16). No devocional, expandir será pelo ícone ou arrastando o menu; se o Hil
  quiser o swipe também ali, generalizar o seletor (ex.: um atributo
  `data-selection-surface`), sem pegar outras telas.
- **Segurar no Meditar/Oração × rolagem:** o toque longo tem de cancelar com
  movimento (mesmo limiar de 10 px e 350 ms do leitor) para não abrir o menu
  enquanto a pessoa rola o texto. A tela do devocional não tem swipe de capítulo
  (`useBiblePageGestures` só está em `bible.tsx`), então não há conflito com a 08 ali.
- **Abrir pelo título com `verses` no modo Paginado:** o Paginado mostra o capítulo
  inteiro com rolagem vertical (sem páginas internas). Basta abrir o capítulo,
  marcar a lista e rolar até o primeiro versículo; testar nos dois modos
  (Paginado e Contínuo). Com a seleção já marcada ao abrir, o swipe de capítulo
  fica suspenso (`!selected`) até limpar; é o esperado.
- **Conflito de merge:** a 07 mexe em `bible.tsx` (parâmetro `verses`),
  `router.tsx`, `selection-menu.tsx` e `local-app.test.tsx`, os mesmos arquivos de
  06/08/09. Começar só depois do merge das três.

## Resultado

Ver o resultado da implementação e o registro final de entrega abaixo.

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 23/10/2026. Hil, o devocional agora cabe no bolso de um amigo: um toque e a Palavra, a meditação e a oração saem andando de coração em coração.

## Resultado da implementação — 24/10/2026

Palavra usa o hook da 06 e o menu da 09; Meditar/Oração reutilizam o mesmo menu com ações de texto. Texto completo usa a data publicada e URL pública configurável; links validam a lista de versos e abrem com marcação e scroll, em Paginado e Contínuo. Publicações antigas sem seleção seguem somente leitura; snapshots numerados preservam o texto publicado.

Teste de domínio escrito antes falhou pela ausência da função; implementação detectou formato de data por extenso, corrigido para DD/MM/AAAA. Typecheck passou. Seis testes web focados passaram (seleção, link em dois modos, legado, Meditar, Oração e fallback manual); primeira execução teve timeouts de espera do DOM nesta máquina, reexecução sequencial passou. Teste HTTP npm run verify:local passou com login mockado/SQLite. Verificação no navegador local confirmou 1,2,5,6 marcados e referência João 3:1–2, 5–6; não houve envio a pessoas ou publicação de conteúdo de teste.

Autorização mais recente do Hil substituiu o fluxo inicialmente previsto: uma branch, um commit por tarefa, backend antes da web, PR e merge pelo agente. Aparelhos físicos/folhas nativas de Android e iOS não foram homologados pelo agente; APIs e fallback cobertos por testes.

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
