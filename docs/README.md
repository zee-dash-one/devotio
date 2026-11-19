# Documentação Viva — Devotio

Esta pasta documenta **apenas o estado atual do sistema, suas regras vigentes e procedimentos operacionais**. Não mantém histórico de alterações nem diários de entregas passadas.

| Documento | Escopo |
|---|---|
| [`constitution.md`](constitution.md) | Princípios permanentes de produto, privacidade, curadoria pastoral e fronteiras técnicas |
| [`product.md`](product.md) | Funcionalidades existentes, jornadas, limites e regras de negócio em vigor |
| [`architecture.md`](architecture.md) | Camadas do monorepo, paridade Convex/SQLite, schema completo, corpus bíblico, caches e armadilhas |
| [`design.md`](design.md) | Convenções de código, suíte de testes, sistema visual, componentes, gestos e acessibilidade |
| [`development.md`](development.md) | Execução local com SQLite, perfis de teste, ambiente conectado Convex, scripts e Graphify |
| [`operations.md`](operations.md) | Deploy (Cloudflare Workers + Convex), painel `/gestao-acesso`, artes do devocional, cotas e privacidade |

Dados canônicos versionados nesta pasta:
- `docs/bibles/ALM1911.json` — corpus integral da Almeida Revista e Corrigida 1911 utilizado pela preparação estática da web, pelas funções editoriais/sociais do Convex e pelos testes. **Não mover nem editar manualmente.**

Para regras de agentes e fluxo Git, consulte [`../AGENTS.md`](../AGENTS.md). Para o planejamento ativo da Fase 4, consulte [`../.todo/README.md`](../.todo/README.md).
