# Padrões de Código, Testes e Design

Diretrizes vigentes para código, verificação automatizada, interface e acessibilidade.

## 1. Convenções de código

- **TypeScript estrito** em todos os workspaces. `any` é proibido sem comentário explícito justificando a necessidade.
- **Validação única com Zod:** toda entrada de formulário, rota, cache ou função de servidor é definida em `packages/domain/validators` e reaproveitada entre `apps/web`, `packages/backend/convex` e `packages/backend/local`.
- **Regras puras no domínio:** cálculos de permissão, limites, cotas, janelas de data e transições de estado ficam em módulos puros de `packages/domain` com testes unitários dedicados; as funções do servidor carregam o estado real do banco e aplicam essas regras.
- **Padrões Convex (`packages/backend/convex`):**
  - Ler sempre `packages/backend/_generated/ai/guidelines.md` antes de editar código Convex.
  - Declarar validadores de `args` em todas as funções públicas e internas.
  - Consultar sempre por índice (`withIndex`), nunca por varredura irrestrita (`filter` em tabelas que crescem), e paginar listas abertas.
  - Lançar erros voltados ao usuário com `ConvexError("Mensagem clara em português")`.

## 2. Suíte de testes e qualidade

| Escopo | Ferramentas | Comando |
|---|---|---|
| Domínio (`packages/domain`) | Vitest (+ Testing Library para hooks) | `npm run test --workspace=domain` |
| Backend (`packages/backend`) | Vitest + `convex-test` (Convex) + testes reais em SQLite/HTTP local | `npm run test --workspace=backend` |
| Web (`apps/web`) | Vitest + React Testing Library + `jsdom` (StrictMode e roteador real) | `npm run test --workspace=web` |
| Validação completa pré-PR | ESLint + `tsc` + build web/PWA + auditoria do artefato (`verify:web`) | `npm run build:ready` |

Requisitos permanentes para qualquer mudança:
- Toda regra de negócio nova exige cobertura em `packages/domain`.
- Toda permissão ou limite de servidor exige teste do caminho autorizado **e** do caminho negado (`403` / `ConvexError`).
- Todo bug corrigido recebe teste de regressão reproduzindo a falha anterior.

## 3. Direção visual e componentes

- **Identidade:** livro devocional contemporâneo, acolhedor e silencioso. Uma coluna central de leitura (~60–68 caracteres por linha, máx. ~680 px), hierarquia clara entre Palavra, Meditar e Oração, sem banners chamativos, confetes, badges ou contadores agressivos.
- **Tokens e tipografia (`packages/ui-kit`):**
  - Fontes locais empacotadas via Fontsource (licenças SIL OFL em `apps/web/public/licenses`): **Lora** para leitura longa e **Inter** para controles e navegação (`font-display: swap`).
  - Cinco temas completos (`Dia`, `Noite`, `Papiro`, `Contraste` e `Pelo horário`), aplicados em toda a interface — páginas, cabeçalho, menus, modais, estados de foco, seleção de versículos e editor.
  - Escala tipográfica em 8 passos (`14 px` a `32 px`, padrão `20 px`) propagada proporcionalmente sem truncar citações nem quebrar controles.
- **Casca e navegação (`apps/web`):**
  - Três áreas principais: **Devocional**, **Bíblia** e **Comunidade** (barra inferior fixa em telas móveis com respeito à *safe area*; cabeçalho fixo no desktop que se compacta suavemente ao rolar após 64 px e reexpande no topo, sem disparar consultas de rede).
  - **Perfil e amigos**, **Favoritos**, **Configurações**, **Gestão de devocionais** (quando autorizado), **Ajuda** e **Privacidade** ficam no menu da conta, evitando poluir a navegação primária.
  - Seletores de opções utilizam componente unificado baseado em `<dialog>` nativo acessível (sem `<select>` nativo desalinhado dos temas), preservando hierarquia de modais aninhados via portal.
- **Gestos sem conflito na leitura bíblica:**
  - Controles, modais e o menu lateral de seleção têm prioridade sobre gestos da página; arrastar o menu lateral contrai/expande o painel sem selecionar versículos nem trocar de capítulo.
  - Long-press seguido de arraste seleciona versículos contíguos dentro do mesmo capítulo; enquanto houver seleção ativa, o swipe de página fica suspenso.
  - No modo `Paginado`, apenas arraste horizontal amplo (sem seleção ativa e predominante sobre o eixo vertical) troca de capítulo (`esquerda = anterior`, `direita = próximo`).

## 4. Acessibilidade e linguagem

- **Meta WCAG 2.2 AA:** contraste adequado em todos os temas, não depender apenas de cor para indicar seleção ou erro, alvos de toque de pelo menos `44 × 44 px`, foco visível por teclado, fechamento por `Escape` com devolução de foco ao elemento acionador e suporte a `prefers-reduced-motion`.
- **Reflow e escala:** layout funcional desde `320 CSS px` de largura, zoom de `200%` e fonte máxima (`32 px`) sem sobreposição de barras fixas.
- **Tom textual:** português claro, sereno e respeitoso; mensagens de erro orientam como prosseguir preservando o rascunho digitado, sem linguagem de culpa ou urgência.
