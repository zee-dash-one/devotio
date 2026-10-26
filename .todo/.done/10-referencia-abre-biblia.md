# 10 — Referência do devocional abre a Bíblia

**Status:** implementação concluída em 2026-10-26; release e homologação em dispositivos pendentes.
**Origem:** reforço da [07](./07-devocional-compartilhar.md), integrada no PR #12.
**Branch de implementação:** `feat/devotional-share-images` (tarefas 10 e 11 juntas, a pedido do Hil).
**Escopo proposto:** corrigir o contrato de leitura Convex e a apresentação do link; manter a seleção dentro de um capítulo.

## Objetivo

Ao tocar na referência de um devocional com seleção estruturada, abrir a Bíblia na versão, livro e capítulo corretos, marcar exatamente os versículos da passagem e rolar até o primeiro. O link deve ser reconhecível e acessível.

## Diagnóstico confirmado no código em 25/10/2026

Base: `main` em `3f1c854`. Consulta Graphify seguida de leitura direta das fontes.

1. `packages/domain/react/convex.ts` conecta `watchHome` a `home:get`.
2. `packages/backend/home.ts` monta o objeto do devocional manualmente e **omite `doc.selection`**. Portanto, um registro pode ter seleção no banco e ainda assim chegar à web sem esse campo. A inspeção de produção não foi necessária para constatar essa omissão; ainda não sabemos se o registro específico relatado tem seleção.
3. `apps/web/src/pages/devotional.tsx` cria o link e permite seleção na Palavra somente quando `day.selection` existe. A omissão no contrato afeta ambos os recursos.
4. O link existente herda a cor e não tem sublinhado visível. Melhorar o CSS resolve a descoberta da ação, mas não corrige sozinho o contrato.
5. `selectionVerses` e a URL `verses` já suportam intervalos e grupos dentro de um capítulo. `BibleSelection` não representa vários capítulos.

## Plano enxuto recomendado

### 1. Corrigir a entrega da seleção

- Retornar `selection: doc.selection` como campo opcional em `home.get`.
- Conferir o contrato `Devotional`, o adaptador conectado e a leitura local; nenhum campo obrigatório novo nem migração geral.
- Cobrir a função real do backend com um registro que tem seleção e outro legado que não tem. Um fixture de UI que já fornece seleção não detecta o erro atual.
- Conferir os consumidores de snapshots/favoritos existentes sem sobrescrever cópias pessoais antigas. Ausência de seleção em um snapshot continua sendo ausência, não motivo para inventar dados.

### 2. Tornar o link visível

- Referência inteira com sublinhado e ícone discreto, foco visível e área de toque de pelo menos 44 px.
- Preservar o link semântico e usar rótulo `Abrir {referência} na Bíblia`.
- Validar Colossenses 1:3–23 e uma lista descontínua nos modos Paginado e Contínuo.
- Se um link contiver números inválidos, mostrar informação clara em vez de prometer uma passagem marcada que não foi aplicada.

### 3. Manter os casos especiais pequenos

**Recomendação, ainda não aprovada como mudança de requisito:** sem seleção estruturada, manter a referência legada como texto e permitir ao editorial corrigir o registro escolhendo o trecho pela Bíblia. Não incluir parser de texto livre nem seleção entre capítulos nesta correção.

Trechos entre capítulos precisam de modelo próprio e aceite separado. Não abrir uma passagem parcial como se todo o trecho estivesse selecionado. O relato sobre o devocional específico pode ser conferido por leitura do piloto na implementação, se necessário; é diagnóstico, não decisão de produto.

## Decisões do plano anterior

| Questão | Encaminhamento proposto |
|---|---|
| D1 — legado sem seleção | Manter texto; corrigir pelo editorial quando desejado. Aprovar antes de ampliar o comportamento vigente. |
| D2 — vários capítulos | Adiar a ampliação do modelo; não é pré-requisito das imagens. |
| D3 — seleção no registro de hoje | Conferir se necessário, depois de corrigir a omissão já comprovada no retorno do backend. Não presumir que o dado foi perdido. |

## Relação com a tarefa 11

A renderização de imagens depende da data, referência, Meditar e Oração, não de `BibleSelection`. O estudo do renderizador e o backend da [11](./11-compartilhar-devocional-imagem.md) podem avançar antes do merge da 10. Integrar as alterações de `devotional.tsx` em sequência para reduzir conflitos. Esta ordem não autoriza agentes paralelos nem publicação.

## Checklist do plano original (resultado consolidado abaixo)

- [x] Confirmar o recorte de legado e múltiplos capítulos proposto acima.
- [x] Atualizar a spec 001 com os requisitos aprovados.
- [x] Teste de regressão no contrato real `home.get`, incluindo seleção opcional e permissões existentes.
- [x] Corrigir retorno do backend e conferir paridade local.
- [x] Melhorar link e cobrir navegação, grupos, faixa, ausência de seleção e números inválidos.
- [x] Lint, typecheck, testes pertinentes, `build:ready` e conferência de links documentais.
- [ ] PR próprio; backend compatível publicado no piloto antes do merge da web.
- [ ] Registrar comandos, resultado e URL do PR; arquivar apenas após a implementação concluída.

## Entrega

Seguir o fluxo do [AGENTS.md](../../AGENTS.md). Esta tarefa agora prevê alteração de backend mesmo sem backfill. O PR de implementação deve incluir:

- [ ] Backend: run npm run deploy:backend before merging (pilot upbeat-jellyfish-720).

A publicação e o merge da implementação dependem de autorização do Hil. A revisão deste plano não publica software nem altera dados.

## Registro da revisão — 25/10/2026

- Leitura do índice, tarefa, regras e fontes: concluída.
- `npm run graphify -- query 'editorial publish release home devotional shareText' --budget 800`: sucesso; resultado limitado pelo orçamento, usado apenas para localização. Fontes relevantes conferidas diretamente.
- `git ls-remote origin refs/heads/main`: base remota confirmada em `3f1c854`.
- `git switch -c docs/devotional-image-sharing-plan`: sucesso, preservando os três documentos locais indicados pelo Hil.
- Revisão documental; testes de aplicação e consulta a dados de produção não foram executados.
- PR documental em rascunho: https://github.com/zee-dash-one/devotio/pull/13.

- Verificação documental: todos os links locais dos três arquivos resolvem; `git diff --check` passou. Código e infraestrutura não foram alterados.
- `git commit` da revisão, `git push -u origin docs/devotional-image-sharing-plan` e `gh pr create --draft`: concluídos; PR #13 aberto para revisão do plano.

## Implementação — 25/10/2026

Hil autorizou implementar as duas tarefas na branch `feat/devotional-share-images`, com arte básica substituível agora. Adotados os recortes e padrões do plano; acabamento da arte será posterior.

- `git fetch origin main`, `git switch main`, `git pull --ff-only origin main`: sucesso, base atualizada.
- `git switch -c feat/devotional-share-images`; `git cherry-pick 91d6a86 0219414`: sucesso, plano preservado.
- Leitura de regras, planos, contratos e fontes: concluída.
- Instalação de Workpool, resvg e fontkit: sucesso. Uma tentativa posterior parou por limite do serviço de revisão automática; retomada a pedido do Hil.

## Resultado da implementação — 26/10/2026

Implementação concluída na branch feat/devotional-share-images. Publicação do backend, preparação das imagens no piloto e homologação física continuam pendentes do Hil, conforme o [procedimento de release](../../docs/operations/devotional-images.md). O PR reúne as duas tarefas conforme autorização explícita do Hil.

- npm run test --workspace=domain -- --maxWorkers=1 --testTimeout=15000: sucesso, 105 testes.
- npm run test --workspace=backend -- --maxWorkers=1 --testTimeout=30000: sucesso, 87 testes.
- npm run test --workspace=web -- --maxWorkers=1 --testTimeout=15000: sucesso, 78 testes.
- npm run build:ready: sucesso, lint, typecheck, build e conferência do pacote público.
- npm run verify:local e node scripts/verify-devotional-images.mjs: sucesso, incluindo autenticação, seis variantes e reutilização dos mesmos bytes PNG.
- node scripts/preview-devotional-images.mjs: sucesso; oito PNGs nas seis variantes, 965970 bytes, 2719 ms no exemplo local. Conferência visual detectou e corrigiu um título órfão antes da paginação.
- npx convex dev --once --debug-bundle-path .data/convex-image-bundle --typecheck disable --env-file <seletor público temporário>: sucesso; empacotamento diagnóstico encerrou antes de qualquer push. Não comprova execução remota.
- Falhas intermediárias corrigidas: versão inicial de Workpool incompatível com APIs disponíveis nos testes; isolamento de componentes no convex-test antigo; dependência nativa do resvg não externalizada na raiz; fixtures/tipos e showModal ausentes nos testes. Todas as suítes acima passaram após as correções.
- Primeiro verify:local encontrou o modo conectado; reinício do Vite com variáveis apenas do processo selecionou o modo SQLite e a verificação passou. Nenhum arquivo de ambiente foi alterado.
- git diff --check: sucesso. Arquivos gerados, bancos e imagens de exemplo permanecem locais e ignorados.

O renderer final usa fontkit + resvg nativo, com fonte incorporada e licença OFL; substitui a hipótese inicial de Satori/WASM. Artes básicas substituíveis, três tamanhos e dois estilos; revisão por hash, fila serial, recuperação e retenção de 30 dias. Compartilhamento nativo depende do suporte do navegador; download permanece disponível.

- npm install --save-dev --save-exact esbuild@0.27.0: sucesso; dependência dos scripts declarada explicitamente, sem mudar a versão instalada.
- Commits separados: 4eca879 (referências), b9d309b (domínio/backend/local), e9b415b (web).
