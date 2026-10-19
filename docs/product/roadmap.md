# Roadmap e decisões de lançamento

Ordem orientada a dependências e evidências, sem datas artificiais. [Estado atual](../engineering/status.md) e [checklist de release](../operations/release.md) complementam este roteiro.

## Posição em 03/10/2026

Revisão de 19/10/2026: a [spec 014](../../specs/014-amigos-compartilhamento/spec.md)
foi autorizada para documentar o acesso administrativo, simplificar a leitura,
adicionar amizades consentidas e partilha privada de trechos. Implementação no
checkout para revisão; PR e publicação com o usuário. Expo adiado. As etapas
históricas abaixo não comprovam o estado do deployment atual.

Reconstrução web autorizada pelo usuário conforme spec 004 §10. Base técnica das etapas 1–4 implementada localmente. Permanecem pendentes homologação OAuth, conteúdo/licenças, política, testes físicos e publicação. Decisões abaixo registram a revisão inicial; web/Google/editorial interno/convite por código/mural sem edição foram adotados na implementação.

## Etapas

> Prioridade em 04/10/2026: concluir as três áreas na web local e só então
> retomar o planejamento público. A sequência vigente está no
> [plano do produto](development-plan.md), conforme [ADR 002](../adr/002-local-complete-product.md).
> A tabela abaixo conserva o roteiro anterior do piloto; Bíblia deixa de ser
> uma etapa posterior ao marco local.

| Etapa | Entrega | Critério para avançar |
|---|---|---|
| 0 — Alinhar o piloto | Rever spec 004, confirmar web primeiro, acesso e tradução | Decisões registradas; spec aprovada antes de plano/tasks/código |
| 1 — Fundação real | Convex oficial, auth, providers, validação e lint | Login e chamada protegida funcionam em homologação; nenhuma exceção de auth |
| 2 — Devocional | Substituir demonstração por dados reais; fluxo editorial mínimo | Spec 001 validada, conteúdo autorizado, vazio/rede/data/áudio testados |
| 3 — Comunidade | Integração real, autorização, convite, listas e paginação | Spec 002 validada por grupo/papel e via chamada direta |
| 4 — Experiência e distribuição | Aplicar guia visual, rotas, PWA e privacidade | Leitura acessível, instalação/atualização testadas e portões de release concluídos |
| 5 — Piloto acompanhado | 20–50 convidados, operação manual e feedback | Semana de custo/estabilidade medida; correções prioritárias resolvidas |
| Depois | Expo/lojas, offline, Bíblia, clubes ou histórico conforme necessidade | Nova priorização, spec e orçamento; não implementar por antecipação |

As etapas 2 e 3 continuam formando a v1. Nativo é distribuição posterior do núcleo, sem obrigar Bíblia/Clubes a entrar junto. Textos autenticados exigem rede no piloto; offline completo é uma feature própria.

## Decisões que precisam ser fechadas

| Decisão | Recomendação documentada | Quem decide / efeito |
|---|---|---|
| Canal inicial | Web responsiva instalável | Produto; evita custo inicial de lojas |
| Acesso | Google como único provedor do piloto | Produto + público piloto; bloqueia plano da spec 004 |
| Leitura sem conta | Preservar exigência atual de autenticação | Abrir leitura pública exigiria revisão da spec 001 |
| Tradução | Escolher edição com direitos de uso comprovados | Editorial; bloqueia conteúdo real |
| Publicação editorial | Operação interna humana, rascunho fora da leitura | Produto/editorial; definir data de liberação e correções na spec 004 |
| Mural | Sem editar/remover mensagem nesta v1, conforme §7 da spec 002 | Produto deve resolver conflito da matriz histórica §6 antes da implementação |
| Convites | Código, sem busca pública de usuários | Validar com produto; já é a recomendação do plano 002 |
| Privacidade | Coletar mínimo; definir retenção/exclusão/público | Responsável do projeto; bloqueia piloto com dados reais |
| Áudio | Opcional; texto primeiro | Editorial/operação; depende de direitos e orçamento de egresso |
| Responsáveis | Nomear editorial, operação e engenharia | Dono do projeto; pode acumular papéis |

A nova documentação não registra aprovação humana fictícia. Propostas de distribuição, auth e operação viram requisitos aprovados por meio da spec 004. Os contratos já aprovados em 001/002 continuam válidos, ressalvadas divergências explicitamente identificadas.

## Concluído nesta revisão documental

- [x] Organizar índice, visão, stack, arquitetura, design e operação.
- [x] Verificar fontes oficiais de cotas, lojas, autenticação e licença ACF.
- [x] Separar protótipo de produto implantado e registrar bloqueios.
- [x] Criar rascunho da fundação de lançamento e atualizar referências das specs.
- [x] Verificar links locais, typecheck dos quatro workspaces e 14 testes de domínio; registrar lint ainda não configurado.
- [ ] Aprovar requisitos novos e resolver decisões pendentes.
- [ ] Implementar e validar o piloto.
