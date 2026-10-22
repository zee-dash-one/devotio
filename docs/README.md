# Documentação do Devotio

**Revisão:** 21/10/2026. A leitura é organizada por decisão, separando intenção de produto de capacidades implementadas.

## Revisão atual: configurações e leitura

- [Notificações pessoais — spec 016](../specs/016-notificacoes/spec.md): sino
  conectado e local, quatro eventos, leitura explícita e destinos autorizados.
- [Papéis comunitários — spec 015](../specs/015-comunidade-papeis-permissoes/spec.md):
  permissão/limite de criação, owner, pedidos, saída e transferência. Rollout
  depende dos PRs e da operação do proprietário; ver [estado real](engineering/status.md).

- [Build e publicação em scripts](operations/release.md): `build:ready`, atualização do backend do piloto, comandos distintos de produção/preview e publicação local em um comando (`deploy:pilot`). Correção de 21/10/2026.

- [Amigos e partilha privada — spec 014](../specs/014-amigos-compartilhamento/spec.md): Perfil, convites consentidos, recados bíblicos e leitura simplificada. [Como usar](product/friends-and-sharing.md).
- **Aprovar usuários:** rota direta `/gestao-acesso`, com login/senha/TOTP do proprietário; não aparece nas Configurações nem no Perfil. [Passo a passo](operations/user-administration.md#como-encontrar-e-entrar-no-painel).

- [Editorial integrado à Bíblia — spec 013](../specs/013-editorial-biblia-publicada/spec.md): cadastro conectado, datas livres, seleção bíblica, limites, autoria, Brasília 00:00 e cópia SQL integral; código implementado, publicação/homologação pendentes.

- [Escolha da versão bíblica e Almeida 1911 — spec 012](../specs/012-versoes-biblia/spec.md): aprovada em 09/10/2026 para a web local/conectada; implementação e verificação registradas no estado real.

- [Configurações de aparência e leitura — spec 009](../specs/009-configuracoes-leitura/spec.md): modal do perfil, cinco temas, escala de fonte e leitura contínua/paginada implementados na web local; homologação visual/física pendente.
- [Plano do corpus bíblico](engineering/bible-corpus-plan.md): proposta de armazenamento separado e pacotes offline; inclui diretrizes de cache e desempenho. A migração não é requisito para começar as configurações com AA local.
- [Fonte e importação da AA](engineering/bible-provider.md): procedência, hash e verificação histórica da cópia existente; pendências para publicação e distinção entre importação e leitura.

No modo local, AA usa o SQLite da aplicação. A entrega 012 acrescenta ARC1911 (identificador `alm1911`) e escolha da versão nas Configurações. A 013 mantém sua cópia integral em `.data/bibles/corpus.sqlite`, por edição/livro/capítulo/versículo, e gera dela os arquivos estáticos publicados. Até seis capítulos ficam no cache por perfil, incluindo a janela atual/anterior/próximo. Tema, fonte e modo são aplicados imediatamente e persistem por perfil/aparelho. Leitura e busca não consultam a API bíblica externa. Isolamento geral da AA e pacote integral offline continuam propostas separadas. Consulte o [estado real](engineering/status.md) para implementação e publicação verificadas.

## Produto

- [Constituição](constitution.md): princípios permanentes; alterações exigem ADR.
- [Visão e MVP](product/vision.md): público, proposta, escopo e critérios de sucesso.
- [Roadmap](product/roadmap.md): etapas, dependências e decisões pendentes.
- [Plano do produto completo](product/development-plan.md): levantamento de Devocional, Bíblia e Comunidades; decisões e dependências para aprovação.
- [Catálogo de specs](../specs/README.md): contratos de cada funcionalidade.

## Design

- [Experiência e sistema visual](design/experience.md): navegação, telas, tokens, conteúdo, acessibilidade e avaliação de usabilidade.

## Engenharia

- [Graphify local](engineering/graphify.md): instalação isolada, skill Codex e consultas ao mapa de código.
- [Stack](engineering/stack.md): escolha por camada; existente versus planejado.
- [Arquitetura](architecture.md): fronteiras, fluxos, permissões e modelo de dados.
- [Estado real](engineering/status.md): evidências no repositório e bloqueios.
- [Fonte bíblica](engineering/bible-provider.md): contrato do provedor, AA importada e pendências de redistribuição.
- [Plano do corpus bíblico](engineering/bible-corpus-plan.md): proposta de isolamento, pacotes offline, edições candidatas e desempenho da leitura.
- [Desenvolvimento](engineering/development.md): instalação, comandos e validação.
- [Produto local](engineering/local-development.md): SQLite, perfis mock, AA e roteiro para testar as três áreas.

## Operação

- [Gestão de usuários e aprovação](operations/user-administration.md): configuração do proprietário, TOTP, preservação de contas e operação do painel da spec 011.

- [Lançamento gratuito](operations/free-launch.md): fornecedores, cotas e capacidade.
- [Publicação e operação](operations/release.md): checklist, deploy e recuperação.
- [Conteúdo e privacidade](operations/content-privacy.md): revisão humana, licenças e dados.

## Decisões

- [ADR 001 — Web primeiro e stack do piloto](adr/001-web-first-free-launch.md).
- [ADR 002 — Três áreas locais antes da publicação](adr/002-local-complete-product.md).
- [ADR 003 — SQLite e identidade simulada](adr/003-local-sqlite-mock.md).

## Como manter os documentos

| Informação | Fonte de verdade | Responsável pela revisão |
|---|---|---|
| Princípios | Constituição | Produto / liderança pastoral |
| Comportamento e visibilidade | Spec aprovada | Produto / responsável da feature |
| Decisão técnica transversal | ADR + stack + arquitetura | Engenharia |
| Aparência e interação | Guia de experiência | Design |
| Implementação disponível | Código + evidência de validação | Engenharia |
| Conclusão da entrega | Tasks + evidência do aceite | Responsável da feature |
| Preços e limites | Custos + fonte oficial datada | Operação |

Uma proposta não substitui uma spec aprovada. Em caso de conflito, registre a divergência e atualize a spec antes de implementar o novo comportamento. Arquivos existentes e checkboxes antigos não comprovam entrega.

Manter os caminhos `docs/constitution.md`, `docs/architecture.md` e IDs das specs estáveis. Novos documentos entram neste índice. Valores de serviços exigem data e fonte; não são promessas permanentes.
