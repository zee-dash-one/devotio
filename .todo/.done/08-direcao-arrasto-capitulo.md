# 08 — Direção do arrasto que troca de capítulo (modo paginado)

**Status:** implementação concluída em 2026-10-24; entrega pelo [PR #12](https://github.com/zee-dash-one/devotio/pull/12).
(ordem: 08 → [09](./09-menu-compartilhar-contraido-mobile.md) → [06](06-selecao-versiculos.md) → [07](07-devocional-compartilhar.md)).
**Branch sugerida:** `fix/chapter-swipe-direction`.
**Escopo:** só web (`apps/web`) + spec; sem backend, sem `npm run deploy:backend`.

## Contexto

Bug relatado pelo Hil em teste de usabilidade: na leitura bíblica em modo
**Paginado**, arrastar para o lado troca de capítulo com a direção invertida.
Padrão esperado = virar página de livro:

- arrastar o dedo **da direita para a esquerda** → **avança** o capítulo;
- arrastar **da esquerda para a direita** → **volta** o capítulo.

O áudio do Hil veio truncado nesse ponto; por isso a direção final é um item de
validação no celular pelo Hil (ver "Validação do Hil").

## Leia antes

[AGENTS.md](../../AGENTS.md) (seção "Fluxo de mudanças — pré-beta"),
[.todo/README.md](../README.md), [apps/web/AGENTS.md](../../apps/web/AGENTS.md),
[specs/009](../../specs/009-configuracoes-leitura/spec.md) (modos de leitura e gestos).

## Como está hoje (levantado no código em 23/10/2026, só leitura)

- `apps/web/src/bible-page-gestures.ts`, `useBiblePageGestures()`:
  - linha 17: `const x = event.clientX - gesture.x` (positivo = dedo foi para a direita);
  - linha 20: `gesture.delta = x`;
  - **linha 29:** `if (Math.abs(current.delta) >= Math.max(80, current.width * .25))
    callbacks.current.navigateChapter(current.delta > 0 ? 1 : -1);`
    → arrastar **da esquerda para a direita avança (+1)** e da direita para a
    esquerda volta (−1). É o contrário de virar página de livro.
- `apps/web/src/pages/bible.tsx`, linhas 411–420: o hook só fica ativo com
  `preferences.mode === "paged" && !selected && !search`; `navigateChapter(offset)`
  chama `open(params.book, params.chapter + offset)` dentro do livro atual.
- **O código segue a spec:** `specs/009-configuracoes-leitura/spec.md`, linha 68
  (tabela de modos, Paginado): "Arraste longo para esquerda volta; para direita
  avança". A correção muda essa regra, então a spec 009 precisa ser atualizada no
  mesmo PR (sem editar a spec fora do PR).
- Teste existente: `apps/web/src/local-app.test.tsx`, teste
  "swipe longo pagina uma vez; movimento curto e vertical não navegam"
  (linhas ~283–302): arrastar 450→100 (direita→esquerda) espera capítulo **2**
  (linha ~297) e 100→450 espera capítulo **3** (linha ~300). Ou seja, o teste
  trava o comportamento atual e precisa ser invertido.
- **Sem ambiguidade de "páginas dentro do capítulo":** no modo Paginado a tela
  mostra um capítulo inteiro (`[current]` em `bible.tsx` ~611–613) com rolagem
  vertical e botões Anterior/Próximo (~816–838). Não há paginação horizontal
  interna; o arrasto só troca de capítulo. No modo Contínuo o hook fica desligado.

### Limiares atuais (manter — o Hil pediu sensibilidade "não muito baixa")

Todos em `apps/web/src/bible-page-gestures.ts`:

- linha 18: o gesto é descartado se não virou arrasto em **350 ms** ou se o
  movimento vertical passa de **12 px** e domina o horizontal;
- linha 19: só vira arrasto com **≥ 12 px** na horizontal e `|x| > 2 × |y|`;
- linha 29: só troca de capítulo com **`|delta| ≥ max(80 px, 25% da largura do
  container)`** (ex.: tela de 400 px → 100 px);
- linha 27: suprime o clique por **400 ms** depois do arrasto (não marca versículo).

Não alterar nenhum desses valores nesta tarefa.

## O que fazer

1. Inverter só o mapeamento da linha 29:
   `navigateChapter(current.delta < 0 ? 1 : -1)` (delta negativo = dedo foi para a
   esquerda = avança). Opcional: extrair função pura e exportada, ex.
   `swipeChapterOffset(delta: number, width: number): -1 | 0 | 1`, com o mesmo
   limiar, para testar o mapeamento isolado.
2. Atualizar o teste de `local-app.test.tsx` (linhas ~296–300): 450→100 avança
   para o capítulo **4**; 100→450 volta para o **3**. Manter os casos de
   movimento curto e vertical que não navegam.
3. Criar teste unitário do mapeamento (se extrair a função), ex.
   `apps/web/src/bible-page-gestures.test.ts`: −120 px numa largura de 400 → +1;
   +120 → −1; ±79 → 0; largura 600 e ±140 → 0 (25% = 150); ±150 → ±1.
4. Atualizar `specs/009-configuracoes-leitura/spec.md` linha 68 para: "Arraste
   longo para a esquerda (direita → esquerda) avança; para a direita volta, como
   virar página de livro. Botões fazem o equivalente."

## Checklist

- [ ] Branch nova a partir da `main` atualizada.
- [ ] Teste invertido/criado **antes** da correção (deve falhar), depois corrigir.
- [ ] Inverter o mapeamento em `bible-page-gestures.ts` sem mudar limiares.
- [ ] Atualizar spec 009 (linha 68).
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build:ready`.
- [x] Um commit por tarefa, push, PR; registrar comandos e URL do PR aqui.

## Fluxo aplicado nesta entrega

Hil autorizou explicitamente uma branch conjunta criada da `main` atualizada, um commit por tarefa, PR e merge pelo agente. Essa autorização substitui o plano inicial de branches separadas e merge manual. O backend do piloto deve estar publicado antes do merge da web.

## Critérios de aceite

As marcações abaixo registram implementação e cobertura automatizada. Homologação em aparelhos físicos Android/iOS permanece pendente; não foi declarada como realizada.

- [x] Modo Paginado, celular: arrastar da direita para a esquerda (longo) avança
      um capítulo; da esquerda para a direita volta um.
- [x] Desktop com mouse (o hook também aceita mouse): mesmo mapeamento.
- [x] Arrasto curto (< max(80 px, 25% da largura)) e arrasto vertical não trocam capítulo.
- [x] Cada arrasto troca no máximo um capítulo; no capítulo 1 voltar não faz nada;
      no último, avançar não faz nada.
- [x] Soltar após o arrasto não marca versículo nem abre o menu.
- [x] Modo Contínuo: nada muda (gesto continua desligado).
- [x] Botões Anterior/Próximo continuam iguais.
- [x] Limiares iguais aos atuais (12 px, 2×, 350 ms, 80 px/25%, 400 ms).
- [x] Teste de `local-app.test.tsx` invertido e teste do mapeamento passando;
      spec 009 atualizada; lint, typecheck, testes e `build:ready` passam.

## Teste manual

1. `npm run dev --workspace=web` (modo local) e, em Configurações, escolher **Paginado**.
2. Abrir `/biblia?book=jo&chapter=3`.
3. Celular (ou DevTools com toque): arrastar da direita para a esquerda → João 4;
   da esquerda para a direita → João 3.
4. Arrastar pouco (menos de ~1/4 da tela) → continua no capítulo.
5. Rolar para cima/baixo → só rola, sem trocar capítulo.
6. Em João 1, arrastar da esquerda para a direita → nada; no último capítulo,
   da direita para a esquerda → nada.
7. Desktop: repetir 3–5 com o mouse.

## Validação do Hil (obrigatória antes do merge)

O áudio veio truncado no trecho da direção. Antes de aprovar o PR, o Hil confirma
**no celular**, no preview do PR ou no `npm run dev`, que "direita → esquerda
avança" é o que ele quis. Se for o contrário, o PR volta a não mudar a direção e
esta tarefa registra o motivo.

## Impacto / conflitos com outras tarefas

- **06 e 08 mexem nos mesmos arquivos** (`apps/web/src/pages/bible.tsx`,
  `apps/web/src/local-app.test.tsx`; a 06 também pode tocar
  `bible-page-gestures.ts`). Fazer a 08 primeiro: é pequena, fixa a direção e o
  teste do gesto antes de a 06 reescrever os handlers; a 06 já parte da `main`
  com o gesto corrigido e o teste invertido, evitando conflito de merge.
- **Limiar de 350 ms**: é o mesmo tempo do "segurar" em `bible.tsx` (linha ~716).
  A 08 não muda nenhum dos dois; a 06 precisa preservar a convivência (ver a
  seção de impacto da 06).
- **Gesto de expandir o menu** (`apps/web/src/selection-drawer-gestures.ts`,
  linhas 16, 24 e 32): com seleção ativa e menu contraído, deslizar para a esquerda
  expande o menu. Hoje não conflita com a 08 porque o swipe de capítulo fica
  suspenso com seleção ativa (`!selected`, `bible.tsx` linha 413). Não remover
  essa suspensão aqui. Depois da 08, "esquerda" passa a ser a mesma direção de
  avançar capítulo e de expandir o menu; a 09 (menu contraído no celular) depende
  dessa suspensão — ver a seção de impacto da 09.

## Resultado

Ver o resultado da implementação e o registro final de entrega abaixo.

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 23/10/2026. Hil, o Devotio tinha nascido canhoto pra virar página. Agora vira capítulo do jeito que a mão já espera.

## Resultado da implementacao — 2026-10-23

Branch conjunta feat/verse-selection-and-devotional-sharing autorizada pelo Hil, um commit por tarefa e merge autorizado. Mapeamento invertido sem alterar limiares, clique suprimido, suspensao com selecao e limites do livro.

Teste antes: npm run test --workspace=web -- --run src/local-app.test.tsx -t "swipe longo" --maxWorkers=1 falhou (esperado 4, recebido 2). Depois da correcao: mesmo comando passou. Suite geral e build registrados no PR conjunto. Homologacao em aparelho fisico nao realizada pelo agente.

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
