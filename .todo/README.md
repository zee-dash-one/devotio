# .todo — Planejamento e Tarefas (Fase 4)

Índice único de tarefas e decisões abertas da Fase 4. Apenas o que está **ativo** permanece listado aqui.

## Tarefas abertas

- [01 — Imagem limitada pelo texto](01-imagem-limite-texto.md)
- [02 — Superusuário e gestão de contas](02-superusuario.md)

## Decisões abertas

Nenhuma decisão pendente no momento.

## Como operar este quadro

1. **Ordem de leitura:** [`AGENTS.md`](../AGENTS.md) → este arquivo → [`docs/README.md`](../docs/README.md) → arquivo da tarefa.
2. **Uma tarefa por arquivo:** cada nova frente de trabalho ganha um arquivo `NN-slug-curto.md` em `.todo/` contendo objetivo, decisões aprovadas pelo Hil, plano técnico (domínio, Convex, SQLite local e UI) e checklist de verificação.
3. **Sem dúvidas abertas no código:** se o arquivo da tarefa tiver perguntas de escopo ou visibilidade sem resposta do Hil, aguarde a definição antes de implementar.
4. **Execução e Git:** seguir estritamente [`AGENTS.md`](../AGENTS.md) — sem PowerShell para comandos, uma branch por tarefa a partir da `main`, commits em inglês por escopo, validação completa (`lint`, `typecheck`, `test`, `build:ready`), sem deploy e sem merge.
5. **Atualização documental limpa:** ao concluir e abrir o PR, atualizar os arquivos relevantes em [`docs/`](../docs/README.md) refletindo apenas o novo estado atual do sistema (sem changelogs nem histórico) e remover a tarefa concluída.
