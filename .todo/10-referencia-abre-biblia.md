# 10 — Referência do devocional abre a Bíblia

**Status:** aberta; plano revisto em 25/10/2026 a pedido do Hil. Não implementada nesta revisão.
**Origem:** reforço da [07](./.done/07-devocional-compartilhar.md), integrada no PR #12.
**Branch de implementação sugerida:** `fix/devotional-reference-link`.
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

## Checklist de implementação

- [ ] Confirmar o recorte de legado e múltiplos capítulos proposto acima.
- [ ] Atualizar a spec 001 com os requisitos aprovados.
- [ ] Teste de regressão no contrato real `home.get`, incluindo seleção opcional e permissões existentes.
- [ ] Corrigir retorno do backend e conferir paridade local.
- [ ] Melhorar link e cobrir navegação, grupos, faixa, ausência de seleção e números inválidos.
- [ ] Lint, typecheck, testes pertinentes, `build:ready` e conferência de links documentais.
- [ ] PR próprio; backend compatível publicado no piloto antes do merge da web.
- [ ] Registrar comandos, resultado e URL do PR; arquivar apenas após a implementação concluída.

## Entrega

Seguir o fluxo do [AGENTS.md](../AGENTS.md). Esta tarefa agora prevê alteração de backend mesmo sem backfill. O PR de implementação deve incluir:

- [ ] Backend: run npm run deploy:backend before merging (pilot upbeat-jellyfish-720).

A publicação e o merge da implementação dependem de autorização do Hil. A revisão deste plano não publica software nem altera dados.

## Registro da revisão — 25/10/2026

- Leitura do índice, tarefa, regras e fontes: concluída.
- `npm run graphify -- query 'editorial publish release home devotional shareText' --budget 800`: sucesso; resultado limitado pelo orçamento, usado apenas para localização. Fontes relevantes conferidas diretamente.
- `git ls-remote origin refs/heads/main`: base remota confirmada em `3f1c854`.
- `git switch -c docs/devotional-image-sharing-plan`: sucesso, preservando os três documentos locais indicados pelo Hil.
- Revisão documental; testes de aplicação e consulta a dados de produção não foram executados.
- PR da revisão: a registrar antes da entrega.

- Verificação documental: todos os links locais dos três arquivos resolvem; `git diff --check` passou. Código e infraestrutura não foram alterados.
