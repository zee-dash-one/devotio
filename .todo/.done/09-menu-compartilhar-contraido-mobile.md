# 09 — Menu de compartilhar abre contraído no celular

**Status:** implementada em 2026-10-23 na branch conjunta autorizada pelo Hil.
depois da [08](./08-direcao-arrasto-capitulo.md) e antes da [06](./06-selecao-versiculos.md).
**Branch sugerida:** `feat/mobile-collapsed-share-menu`.
**Escopo:** só web (`apps/web`); sem backend, sem `npm run deploy:backend`.

## Contexto

Pedido do Hil em teste de usabilidade: no **celular**, o menu lateral de
compartilhar (aberto ao selecionar/segurar versículo) deve abrir sempre
**contraído** (estreito, só ícones). Hoje ele abre expandido, com botão de contrair.
No desktop nada muda: continua abrindo expandido. A marcação dos versículos
selecionados já funciona e **não deve ser alterada**.

## Leia antes

[AGENTS.md](../../AGENTS.md) (seção "Fluxo de mudanças — pré-beta"),
[.todo/README.md](../README.md), [apps/web/AGENTS.md](../../apps/web/AGENTS.md),
[specs/008](../../specs/008-selecao-compartilhamento-notificacoes/spec.md) (linhas ~190–197:
contrair/expandir o menu).

## Como está hoje (levantado no código em 23/10/2026, só leitura)

- Componente: `apps/web/src/pages/selection-menu.tsx`, `SelectionMenu`. Único uso:
  `apps/web/src/pages/bible.tsx` (~808–815), com `key={`${book}:${chapter}`}`
  (remonta ao trocar de capítulo) e só fora do modo picker (`!params.pick`).
- Estado: `const [collapsed, setCollapsed] = useState(false);` → sempre abre expandido.
  `data-state="collapsed" | "expanded"` e classe `selection-menu-collapsed`.
- Expandir/contrair hoje (manter como está):
  - botão de ícone `ArrowLeft`/`ArrowRight` com `aria-label` "Expandir menu de
    seleção" / "Contrair menu de seleção" e `aria-expanded`;
  - `apps/web/src/selection-drawer-gestures.ts`, `useSelectionDrawerGestures()`:
    arrastar **dentro do menu** ≥ 40 px na horizontal — para a direita contrai,
    para a esquerda expande (linha 32, `setCollapsed(x > 0)`); com o menu
    contraído, um deslizar **rápido (< 350 ms) para a esquerda, por toque, em
    qualquer ponto de `.bible-page`** também expande (linhas 16 e 24);
  - "Enviar para comunidade" expande o menu (`setCollapsed(false)`), e os avisos
    de cópia manual também.
- Estilos: `apps/web/src/styles/bible.css` (`.selection-menu` ~167–189,
  `.selection-menu-collapsed` ~216–231, largura `calc(64px + safe-area)`).
- Testes: `apps/web/src/local-app.test.tsx` (~328–375) cobrem contrair/expandir
  pela seta e por swipe, partindo do menu expandido.

### Ponto de corte celular/desktop

O app tem mais de um:

- `@media (max-width: 640px)`: o corte de **celular** mais usado no CSS, inclusive
  no próprio leitor (`styles/bible.css` linha 139) e em `controls.css` 156,
  `base.css` 287, `shell.css` 143/423, `devotional.css` 140/347, `community.css` 402.
- `max-width: 900px` / `min-width: 901px`: corte do **layout desktop do cabeçalho**
  (`shell.css` 6/400, `base.css` 280, `devotional.css` 133). É o único em JS:
  `apps/web/src/compact-header.ts` linha 10, `window.matchMedia("(min-width: 901px)")`.
- Outros pontuais: 600 px (administração/editorial), 700 px (feedback), 1100 px e
  1400 px (larguras de leitura), `(hover: hover) and (pointer: fine)` em `controls.css` 56.

**Usar `(max-width: 640px)`.** É o corte de celular do leitor e da maior parte do
CSS; entre 641 e 900 px (tablet/janela estreita) há espaço para o menu de 280 px
aberto, então ele segue expandido como no desktop. O corte de 900/901 px descreve
o cabeçalho, não o tamanho do celular. Criar uma constante única (ex.:
`apps/web/src/media.ts` com `export const MOBILE_QUERY = "(max-width: 640px)"` e
`isMobileViewport()` protegido para `typeof window.matchMedia !== "function"`,
igual ao `compact-header.ts`) para a 07 reaproveitar.

## O que fazer

1. Em `SelectionMenu`, estado inicial `useState(() => isMobileViewport())`: abre
   contraído no celular e expandido no desktop. Só na montagem; não reagir a
   resize/rotação enquanto aberto (o usuário controla depois).
2. Não mudar expandir/contrair (ícone, arraste no menu, swipe rápido na página,
   "Enviar para comunidade"), nem a marcação dos versículos.
3. Testes: caso novo com `matchMedia` simulado para 640 px → `data-state="collapsed"`
   ao abrir; desktop → `"expanded"`. Ajustar os testes de ~328–375 para definir o
   viewport explicitamente.
4. Atualizar `specs/008` (seção do menu, ~190–197) no PR: "no celular (≤ 640 px)
   o menu abre contraído; no desktop, expandido".

## Checklist

- [ ] Branch nova a partir da `main` atualizada (depois do merge da 08).
- [ ] Testes primeiro (devem falhar), depois a mudança.
- [ ] Constante/função de viewport e estado inicial do `SelectionMenu`.
- [ ] Spec 008 atualizada.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build:ready`.
- [ ] Commits por escopo, push, PR; registrar comandos e URL do PR aqui.

## Fluxo pré-beta (obrigatório)

Siga o passo a passo do [AGENTS.md](../../AGENTS.md#fluxo-de-mudanças--pré-beta-obrigatório-desde-21102026),
um comando por linha no PowerShell 5.1 (sem `&&`):

```powershell
git status
git switch main
git pull --ff-only origin main
git switch -c feat/mobile-collapsed-share-menu
```

Commits separados por escopo (Conventional Commits, em inglês):

```powershell
git commit -m 'test(web): expect collapsed selection menu on mobile viewport'
git commit -m 'feat(web): add shared mobile viewport query'
git commit -m 'feat(web): open selection menu collapsed on mobile'
git commit -m 'docs(specs): document collapsed selection menu on mobile'
```

```powershell
git push -u origin feat/mobile-collapsed-share-menu
gh pr create --base main --head feat/mobile-collapsed-share-menu --title 'feat: open share menu collapsed on mobile' --body-file $env:TEMP\pr-body.md
```

Só web. Copie a URL do PR para cá e **pare**. Merge só pelo Hil; nada direto na
`main`; nenhum deploy pelo agente.

## Critérios de aceite

- [ ] Celular (≤ 640 px): ao selecionar/segurar um versículo, o menu aparece
      contraído (só ícones, `data-state="collapsed"`).
- [ ] Celular: tocar no ícone de expandir, arrastar o menu para a esquerda ou
      deslizar rápido para a esquerda na página expande, como hoje; arrastar para
      a direita ou o ícone contrai.
- [ ] Desktop (> 640 px): abre expandido, igual a hoje.
- [ ] Versículos marcados, destaque e ações (Compartilhar, Enviar para comunidade,
      amigos, Criar devocional, Limpar) funcionam igual a partir do menu contraído.
- [ ] Trocar de capítulo e marcar de novo → no celular volta a abrir contraído.
- [ ] Lint, typecheck, testes e `build:ready` passam.

## Teste manual

1. `npm run dev --workspace=web` e abrir `/biblia?book=jo&chapter=3`.
2. Celular real (ou DevTools em 390 px com toque): marcar um versículo → menu contraído.
3. Expandir pelo ícone; contrair pelo ícone; expandir arrastando o menu para a
   esquerda; contrair arrastando para a direita; com ele contraído, deslizar
   rápido para a esquerda na leitura → expande.
4. Usar Compartilhar e Limpar a partir do menu contraído.
5. Desktop (janela > 640 px): marcar um versículo → menu expandido.
6. Janela entre 641 e 900 px → expandido (confirmar que está confortável).

## Impacto / conflitos com outras tarefas

- **08 (direção do arrasto):** com o menu contraído, deslizar para a **esquerda**
  na página expande o menu (`selection-drawer-gestures.ts` linhas 16/24/32), e
  depois da 08 deslizar para a esquerda passa a **avançar** capítulo. Hoje não há
  disputa porque o swipe de capítulo fica desligado com seleção ativa
  (`bible.tsx` linha 413, `!selected`). Como esta tarefa faz o menu contraído ser
  o normal no celular, **manter essa suspensão**. Os dois hooks escutam
  `pointermove` em captura no `document`; `stopPropagation()` não impede o outro
  listener do mesmo nó, então só a suspensão evita o conflito. Teste: com versículo
  marcado e menu contraído, deslizar para a esquerda expande o menu e **não**
  troca de capítulo.
- **06 (seleção um a um):** a 06 mexe no mesmo `SelectionMenu` (Copiar, Web
  Share) e em `local-app.test.tsx`; fazer a 09 antes evita conflito de merge e a 06
  já parte do menu contraído no celular. Com a seleção acumulada da 06, o menu fica
  aberto mais tempo; contraído, ele cobre menos versículos.
- **07 (devocional):** ver a seção de impacto da 07. O swipe rápido na página só
  vale dentro de `.bible-page` (linha 16); no devocional, expandir será pelo ícone
  ou arrastando o menu.

## Resultado

(preencher ao concluir: comandos executados e resultado, URL do PR)

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 23/10/2026. Hil, o menu aprendeu boas maneiras: no celular ele entra de mansinho, só com os ícones, e espera ser chamado pra se esticar.

## Resultado da implementacao — 2026-10-23

Constante MOBILE_QUERY e inicializacao por isMobileViewport compartilhadas. Teste antes falhou por expanded no celular; teste de remontagem ajustado para aguardar navegacao. Depois passaram os cinco casos de viewport 640/641/1000, remontagem, resize e controles/gestos existentes: npm run test --workspace=web -- --run src/local-app.test.tsx -t "menu usa viewport|contrai/expande|swipe do menu" --maxWorkers=1. Suite geral e build no PR conjunto.
