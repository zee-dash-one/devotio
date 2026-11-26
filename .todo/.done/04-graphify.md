# 04 - Instalação local do Graphify

**Status:** concluída em 2026-10-22 — instalada, documentada e PR aberto.
**Branch:** `chore/graphify-setup`.

## Solicitação e escopo

Hil pediu atualizar main, criar branch, instalar Graphify no Devotio e documentar.
Ferramenta de desenvolvimento; nenhum comportamento do produto ou schema muda.
Por isso o plano operacional fica nesta tarefa, sem criar uma spec de produto.

## Plano

- [x] Conferir árvore limpa, atualizar main e criar branch.
- [x] Fixar pacote oficial `graphifyy` em ambiente Python isolado do repositório.
- [x] Instalar a integração do Codex apenas neste projeto, preservando suas regras.
- [x] Documentar instalação, comandos, atualização e limites de privacidade.
- [x] Conferir instalação e documentação, registrar resultados e abrir PR.

## Comandos e resultados

- `git status --short --branch`: sucesso; main limpa.
- Leitura de AGENTS.md, .todo/README.md, .docs/README.md e documentos indicados:
  concluída. Fontes oficiais do Graphify consultadas para escolher pacote e escopo.
- `git pull --ff-only origin main`: sucesso; main já atualizada em 923b356.
- `git switch -c chore/graphify-setup`: sucesso.
- `Get-Command uv,python,py,pipx,graphify`: Python e py disponíveis; sem uv/pipx/graphify.
- `python --version`: sucesso, 3.12.10.
- `python -m pip index versions graphifyy`: sucesso; versão atual 0.9.94.
  A consulta é só de metadados; nenhum pacote instalado globalmente.
- `python -m pip download --no-deps --dest .tools/graphify-download graphifyy==0.9.94`:
  sucesso; wheel oficial inspecionado antes da instalação.
- `python -m venv .tools/graphify`: falhou no sandbox ao inicializar ensurepip;
  repetido com execução autorizada fora do sandbox: sucesso.
- `.tools/graphify/Scripts/python.exe -m pip install --disable-pip-version-check --requirement tools/graphify/requirements.txt`:
  sucesso, Graphify 0.9.94 e dependências somente no venv ignorado pelo Git.
- `graphify install --project --platform codex` pelo executável do venv: sucesso;
  criou .codex/skills/graphify (não .agents/skills/graphify), referências e hook.
  A tentativa de ler o caminho .agents falhou; corrigida para o caminho informado
  pelo instalador. Nenhum arquivo de skill preexistente foi modificado.
- Seção genérica do instalador em AGENTS.md substituída por orientação local,
  preservando as regras anteriores; hook ajustado para o launcher Node do venv.
  Skill e referências oficiais mantidas; LICENSE, LICENSE-MIT e NOTICE copiados
  do pacote Apache-2.0 instalado para preservar autoria e termos.
- `npm run graphify -- --version`: sucesso, 0.9.94.
- `.tools/graphify/Scripts/python.exe -m pip check`: sucesso, dependências válidas.
- `npm run graphify:code`: sucesso, 168 arquivos de código, 1.338 nós e 3.939
  relações; sem extração semântica ou chamadas a modelos. Após incluir caches
  adicionais em .graphifyignore, repetição: sucesso, 1.335 nós e 3.935 relações,
  com dois arquivos excluídos removidos do mapa.
- `npm run graphify -- query communityGovernance --budget 400`: sucesso; encontrou
  o contrato do domínio e suas relações. Resposta limitada intencionalmente pelo
  orçamento, sem ler a íntegra do grafo no contexto do agente.
- `npm run graphify -- cluster-only . --no-label`: sucesso; 65 comunidades,
  relatório e HTML gerados localmente. Grafo consolidado: 1.335 nós e 3.794
  arestas após consolidação das relações pelo clustering; sem nomeação por LLM.
- `git check-ignore .tools/graphify/Scripts/python.exe graphify-out/graph.json`:
  sucesso; ambiente e artefatos gerados ficam locais.
- Inspeção de metadados do graph.json pelo Python local: sucesso; 162 caminhos
  únicos de código, nenhum nas pastas excluídas. Nenhum conteúdo de .env foi lido.
- Verificação PowerShell de links: sucesso, 145 links relativos em 12 documentos.
  `git diff --check`: sucesso; apenas aviso habitual de conversão LF/CRLF.
- `$env:TURBO_FORCE = 'true'` e `npm run build:ready`: sucesso; lint (incluindo o
  launcher novo), typecheck e build sem cache. PWA com 22 recursos, corpus fora
  de JS/precache e ausência de fixtures/cache de API. Apenas avisos existentes
  de SQLite experimental e anotações de dependências.

Suítes de testes não foram executadas; nenhuma regra de produto mudou.
Não houve deploy, configuração de modelos/MCP ou alteração global de assistentes.

- `git add` dos arquivos da ferramenta e `git diff --cached --check`: sucesso;
  nenhum venv, grafo, banco ou credencial entrou no índice.
- `git commit -m 'chore(tooling): install project-scoped Graphify'`: sucesso,
  a1de05e. Skill/referências oficiais e licenças versionadas com a instalação.
- `git add` da documentação e `git commit -m 'docs(tooling): document Graphify setup and local usage'`:
  sucesso, b29fec5.
- `git push -u origin chore/graphify-setup`: sucesso.
- `Set-Content` do corpo no TEMP e `gh pr create --repo zee-dash-one/devotio --base main --head chore/graphify-setup ...`:
  sucesso; PR #9 aberto e anexado ao chat.
- Registro concluído movido para .todo/.done/; referências e índice atualizados.
- `gh pr edit 9 --body-file <arquivo no TEMP>`: sucesso; link do registro
  arquivado atualizado no PR.
- Verificação de links após arquivar: sucesso, 145 links em 12 documentos.
  `git diff --check`: sucesso. `git rev-list --left-right --count origin/main...main`:
  sucesso, 0/0; a main local permanece sem alterações.
- `npm run graphify -- hook-check`: sucesso, sem saída do Graphify, conforme o
  comportamento neutro do hook instalado no Codex Desktop.

PR: https://github.com/zee-dash-one/devotio/pull/9

## Fontes

- https://github.com/Graphify-Labs/graphify
- https://pypi.org/project/graphifyy/
