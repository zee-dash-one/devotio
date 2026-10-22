# Catálogo de especificações

Requisitos aprovados orientam código; planos orientam implementação; tasks registram evidência. **Aprovação de spec não significa funcionalidade concluída.**

| ID | Feature | Situação | Papel no lançamento |
|---|---|---|---|
| [001](001-devocional-diario/spec.md) | Devocional diário | Spec aprovada historicamente; integração e aceites pendentes | Núcleo da v1 |
| [002](002-comunidade-v1/spec.md) | Comunidade base | Spec aprovada historicamente; integração e divergências pendentes | Núcleo da v1 |
| [003](003-conteudo-biblico/spec.md) | Importação e leitura bíblica | ABíbliaDigital, importação para o banco e AA inicial escolhidas | Integra o marco local das três áreas; spec em revisão |
| [004](004-fundacao-lancamento/spec.md) | Fundação do lançamento web | Reconstrução autorizada e implementada localmente; homologação pendente | Auth, operação editorial, instalação e condições do piloto |
| [005](005-piloto-publicacao/spec.md) | Publicação do piloto gratuito | Rascunho; escolhas anteriores preservadas | Planejamento retomado após o produto local completo, conforme ADR 002 |
| [006](006-desenvolvimento-local/spec.md) | Produto local completo | Implementado com SQLite, perfis mock e AA; revisão visual pendente | Desenvolvimento autorizado em 04/10/2026; não é publicação |
| [007](007-cadastro-devocionais/spec.md) | Cadastro de devocionais pelo Gestor do sistema | CRUD local implementado; revisão visual física pendente | Palavra pela Bíblia, estado preservado, datas livres, edição/retirada; Peregrino placeholder |
| [008](008-selecao-compartilhamento-notificacoes/spec.md) | Seleção bíblica, compartilhamento e notificações | Implementado localmente; revisão visual/gestos físicos pendente | Cópia numerada, multi-select, rascunhos persistentes, seleção contextual e sino SSE |
| [009](009-configuracoes-leitura/spec.md) | Configurações de aparência e leitura | Aprovada em 08/10; implementada localmente, homologação visual/física pendente | Cinco temas, escala de fonte, modos contínuo/paginado e janela de três capítulos; independente da migração do corpus |
| [010](010-temas-mensal-semanal/spec.md) | Gestão dos temas mensal e semanal | Rascunho; aprovação e vigência pendentes | Gestor do sistema escolhe escrituras e escreve temas de 256/512 caracteres; sem implementação |
| [011](011-gestao-usuarios-aprovacao/spec.md) | Gestão de usuários e aprovação do piloto | Aprovada e implementada na branch em 09/10; configuração/rollout pendentes | Painel não listado, senha/TOTP, aprovação Google, desativação e permissões |
| [012](012-versoes-biblia/spec.md) | Escolha da versão bíblica e Almeida 1911 | Aprovada em 09/10; corpus publicado e verificado por HTTP, correção do menu em validação | Configurações, leitura e busca por edição na web local/conectada |
| [013](013-editorial-biblia-publicada/spec.md) | Editorial integrado à Bíblia publicada | Autorizada em 09/10; código implementado, publicação/homologação pendentes | Datas livres, seleção bíblica, limites, autoria, horário de Brasília e corpus padronizado |
| [014](014-amigos-compartilhamento/spec.md) | Amigos e partilha privada da Palavra | Implementada no checkout em 19/10; homologação/publicação pendentes | Perfil, convites, recados privados, marcações e leitor simplificado |
| [015](015-comunidade-papeis-permissoes/spec.md) | Permissão de criação e papéis comunitários | Aprovada pelo Hil em 21/10; em desenvolvimento | Owner, limite, pedidos de entrada e gestão de papéis |

[Roadmap](../docs/product/roadmap.md) determina a ordem proposta. A [ADR 001](../docs/adr/001-web-first-free-launch.md) registra distribuição web primeiro; tasks nativas permanecem abertas e adiadas.

## Navegação

- 014: [spec](014-amigos-compartilhamento/spec.md), [plano](014-amigos-compartilhamento/plan.md), [tasks](014-amigos-compartilhamento/tasks.md).

- 009: [spec](009-configuracoes-leitura/spec.md), [plano](009-configuracoes-leitura/plan.md), [tasks](009-configuracoes-leitura/tasks.md); [diretrizes do corpus e desempenho](../docs/engineering/bible-corpus-plan.md).

- 008: [spec](008-selecao-compartilhamento-notificacoes/spec.md), [plano](008-selecao-compartilhamento-notificacoes/plan.md), [tasks](008-selecao-compartilhamento-notificacoes/tasks.md).

- 007: [spec](007-cadastro-devocionais/spec.md), [plano](007-cadastro-devocionais/plan.md), [tasks](007-cadastro-devocionais/tasks.md).

- 006: [spec](006-desenvolvimento-local/spec.md), [plano](006-desenvolvimento-local/plan.md), [tasks](006-desenvolvimento-local/tasks.md).

- 001: [spec](001-devocional-diario/spec.md), [plano](001-devocional-diario/plan.md), [tasks](001-devocional-diario/tasks.md).
- 002: [spec](002-comunidade-v1/spec.md), [plano](002-comunidade-v1/plan.md), [tasks](002-comunidade-v1/tasks.md).
- 003: [spec](003-conteudo-biblico/spec.md), [plano em rascunho](003-conteudo-biblico/plan.md), [tasks](003-conteudo-biblico/tasks.md).
- 004: [spec](004-fundacao-lancamento/spec.md), [plano](004-fundacao-lancamento/plan.md), [tasks](004-fundacao-lancamento/tasks.md).
- 005: [spec](005-piloto-publicacao/spec.md), [plano](005-piloto-publicacao/plan.md), [tasks](005-piloto-publicacao/tasks.md).

## Convenções

Estados: rascunho → aprovada → em desenvolvimento → concluída. Registrar data, responsável pela aprovação e escopo da revisão; não inventar aprovação retroativa. Reabrir task quando a evidência não satisfizer o aceite, preservando uma nota sobre a marcação anterior.

Usar os [templates de spec](_templates/spec-template.md), [plano](_templates/plan-template.md) e [tasks](_templates/tasks-template.md). Uma mudança de visibilidade exige revisão explícita da spec, mesmo que tecnicamente pequena.
