# Tasks: editorial e corpus padronizado

## Backend/domain

- [x] Validador de cadastro e políticas de datas/limites compartilhados.
- [x] Calendário/consulta/gravação editorial Convex com seleção e autoria confiáveis.
- [x] Importador e adaptador SQLite do corpus integral; build e citações por essa cópia.
- [x] Testes de regras, importação, autorização e gravação.

## Web

- [x] Integrar listagem ao cadastro e ida/volta à Bíblia com estado preservado.
- [x] Datas livres, tradução padrão, campos derivados, 512 caracteres e Brasília 00:00.
- [x] Auditoria explicada em correções/retiradas e automática na criação.
- [x] Testes do fluxo conectado e compatibilidade local.
- [x] Alinhar o cadastro local: datas livres mensais, tradução, crédito/fonte e motivo de correção; testes de domínio, SQLite e interface local passaram.

## Mobile

- [ ] Expo adiado (não concluído).

## Cross-cutting

- [x] Atualizar arquitetura, operação e estado real.
- [x] Lint/typecheck/testes/build e inspeção do corpus gerado: 189 testes (90 domínio, 48 backend, 51 web), typecheck, lint, build, `verify-web-build` e codegen Convex em `--dry-run --typecheck enable` passaram.
- [ ] Homologação autenticada/visual/física (separada da verificação automatizada).

Sem commit, push, PR ou publicação nesta rodada, conforme instrução do usuário.
