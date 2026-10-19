# Tasks — spec 014

## Backend/domain
- [x] Validadores, transições de amizade, limites e projeção privada testados.
- [x] Convex: descoberta autorizada, amizades, envio idempotente e leituras privadas.
- [x] SQLite: persistência equivalente, transações e invalidação entre sessões.
- [x] Adaptadores local/conectado para Repository.social.

## Web
- [x] Leitor minimalista preserva ações e fonte da edição nas Configurações.
- [x] Perfil: código, convites, amigos filtráveis e histórico de trechos.
- [x] Convite pela lista da comunidade.
- [x] Modal de envio e marcações distintas com detalhes privados.

## Mobile
- [ ] Expo adiado; homologação nativa não realizada.

## Cross-cutting
- [x] Atualizar documentação de operação, arquitetura, privacidade, specs e status.
- [x] Testes, lint, typecheck e build; registrar evidências e limitações.
- [ ] Homologação autenticada/visual em aparelhos antes de publicação pelo usuário.

## Evidências — 19/10/2026

205 testes distintos passaram: 94 domínio, 57 backend e 54 web. A suíte backend
completa passou com um worker e timeout de 20 segundos após autorização de
loopback fora do sandbox; testes novos/afetados foram reexecutados após os últimos
ajustes (9 backend e 3 web). Lint e typecheck passaram no monorepo. `npm run
verify:web` passou, com 22 recursos PWA e corpus ARC1911 íntegro fora do JS/precache.
154 links relativos em 18 documentos foram verificados sem destinos ausentes.

O navegador de revisão falhou ao abrir o servidor local por timeout; não houve
homologação visual nem com Google real. Sem commit, push, PR, deploy ou codegen
remoto nesta rodada. [Estado detalhado](../../docs/engineering/status.md).
