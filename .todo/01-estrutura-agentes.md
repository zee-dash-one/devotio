# 01 - Versionar a estrutura de agentes

**Status:** em execução em 2026-10-21. Não depende de outra tarefa.

## Objetivo

Levar para o GitHub, pelo fluxo pré-beta (branch + commits por escopo + PR), os
arquivos de estrutura que o Gandalf escreveu em 21/10/2026 direto na pasta local.

## Leia antes

[AGENTS.md](../AGENTS.md) (principalmente "Fluxo de mudanças"), [.todo/README.md](./README.md).

## Pré-requisitos

- Pasta `C:\GIT\Z-ONE\devotio` na `main`, sem outras mudanças além destas:
  `AGENTS.md` e `README.md` alterados; `.todo/` e `.docs/` novos.
- `gh auth status` mostrando login no GitHub.

## Passos

1. Conferir o estado (as mudanças estão na `main` local, ainda sem commit):

   ```powershell
   git status
   git fetch origin
   git status -sb
   ```

   Se a `main` local estiver atrás de `origin/main`, não faça `pull` ainda: siga
   o passo 2 (a branch nova leva as mudanças junto) e depois rebase se o Hil pedir.
2. Criar a branch (as mudanças não commitadas vão junto):

   ```powershell
   git switch -c docs/agent-structure
   ```

3. Commits por escopo:

   ```powershell
   git add AGENTS.md
   git commit -m 'docs(agents): add reading order and pre-beta git flow'
   git add .docs
   git commit -m 'docs: add .docs index, rules, architecture and design summaries'
   git add .todo
   git commit -m 'docs(todo): add task index and community and notification tasks'
   git add README.md
   git commit -m 'docs(readme): add agents section'
   git status
   ```

   O `git status` final deve estar limpo.
4. Enviar e abrir o PR (corpo num arquivo fora do repo):

   ```powershell
   git push -u origin docs/agent-structure
   Set-Content -Path $env:TEMP\pr-body.md -Encoding UTF8 -Value 'Adds AGENTS.md reading order and the pre-beta git flow, the .todo/ task index with tasks 02 and 03, and the .docs/ summaries. Docs only: no code, no backend change.'
   gh pr create --base main --head docs/agent-structure --title 'docs: agent structure and pre-beta git flow' --body-file $env:TEMP\pr-body.md
   ```

5. Copiar a URL do PR para a seção "Resultado" abaixo e parar. Merge é do Hil.

## Aceite

- PR aberto de `docs/agent-structure` para `main`, com 4 commits por escopo.
- `git ls-files .todo .docs` lista os arquivos novos.
- A `main` local continua sem commits novos.

## Depois

Registrar o resultado e a URL do PR aqui, tirar a linha deste arquivo do
`.todo/README.md`, mover este arquivo para `.todo/.done/` (num commit
`docs(todo): close task 01` na próxima branch ou no próprio PR).

## Resultado

Execução retomada em 2026-10-21 na branch `docs/agent-structure`, já existente.
Os commits `e433618` (AGENTS.md) e `ecda145` (.docs/) já estavam presentes;
as únicas mudanças locais restantes eram README.md e os quatro arquivos .todo/,
todos previstos nesta tarefa. Não foi necessário recriar a branch.

Comandos e verificações:

- Leitura de AGENTS.md, .todo/, .docs/, constituição, índice documental e estado
  real: concluída. As tarefas 02 e 03 continuam aguardando decisões do Hil.
- `git status --short --branch`, `git log -6 --oneline`, `git branch -vv` e
  `git ls-files AGENTS.md .docs .todo`: sucesso; confirmaram a execução parcial.
- `git diff -- README.md`: sucesso; alteração restrita à seção para agentes.
- `git fetch origin`: falhou no sandbox por falta de acesso a .git/FETCH_HEAD;
  repetição autorizada fora do sandbox passou.
- `git rev-list --left-right --count origin/main...main`: sucesso, resultado
  `0 0`; main local atualizada e sem commits novos.
- `git log --oneline origin/main..HEAD`: sucesso; apenas os dois commits
  documentais acima antes da continuação.
- `gh auth status`: falhou dentro do sandbox; repetição autorizada fora dele
  confirmou autenticação válida, sem alteração de credenciais.
- `gh pr list --head docs/agent-structure --state all --json number,url,state,title`:
  sucesso; nenhum PR existente para a branch.
- Verificação PowerShell de links relativos em AGENTS.md, README.md, .docs/ e
  .todo/: sucesso, 101 links em 10 documentos, nenhum destino ausente.
- `git diff --check`: sucesso; somente aviso do Git sobre conversão LF/CRLF.

Validação adequada ao escopo documental: revisão de links, referências, comandos
e consistência com os manifests e as regras vigentes. Nenhum código alterado;
lint, typecheck, testes e build não foram executados nesta tarefa documental.

PR: pendente de envio da branch e abertura.

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.
