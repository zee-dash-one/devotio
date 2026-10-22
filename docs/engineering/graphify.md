# Graphify no Devotio

Instalação de desenvolvimento em **22/10/2026**, na branch
`chore/graphify-setup`. Fonte oficial: [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify).
O pacote Python é [graphifyy](https://pypi.org/project/graphifyy/), com dois `y`;
o executável se chama `graphify`. Versão adotada: **0.9.94**.

## Instalar em outro checkout

Requisitos: Node/npm do projeto e Python **3.10+**; esta instalação usou Python
**3.12.10** no Windows. Na raiz, com PowerShell 5.1, execute um comando por vez
e confira `$LASTEXITCODE` antes de continuar:

```powershell
python -m venv .tools/graphify
.\.tools\graphify\Scripts\python.exe -m pip install --requirement tools/graphify/requirements.txt
npm run graphify -- --version
.\.tools\graphify\Scripts\python.exe -m pip check
```

Não é necessário ativar o venv nem instalar globalmente. O launcher
`scripts/graphify.mjs` executa o Python de `.tools/graphify`, sempre na raiz do
Devotio, e acrescenta seu diretório de executáveis ao PATH apenas do subprocesso.
Em Linux/macOS, crie o mesmo venv com `python3` e use
`.tools/graphify/bin/python -m pip install -r tools/graphify/requirements.txt`.

O requirements fixa o Graphify; as dependências transitivas são resolvidas pelo
pip. Ele não é dependência da web, do Convex ou do build/publicação. `npm ci`
continua cuidando apenas dos workspaces JavaScript.

## Integração com Codex

A instalação oficial foi executada com:

```powershell
.\.tools\graphify\Scripts\graphify.exe install --project --platform codex
```

Ela gerou `.codex/skills/graphify/SKILL.md`, suas referências e o hook local.
Esses arquivos e as licenças são versionados; um checkout novo já recebe a skill.
No Codex, invoque **`$graphify`**; uma nova sessão pode ser necessária para
descobrir a skill instalada. Os exemplos Bash da skill precisam ser adaptados
ao PowerShell e ao Python do venv local.

Adaptações do Devotio:

- `AGENTS.md` documenta comandos locais, mapa opcional e regras de privacidade;
  preserva as regras anteriores do repositório.
- `.codex/hooks.json` chama `node scripts/graphify.mjs hook-check`, dispensando
  um `graphify` global. Na versão instalada esse hook é intencionalmente neutro
  no Codex Desktop; não gera o mapa nem injeta contexto. A orientação vem de
  `AGENTS.md` e da skill.
- `GRAPHIFY_NO_AUTO_REFRESH=1` no subprocesso evita atualização automática dos
  arquivos da skill. Atualizações passam pelo fluxo normal de branch/PR.

Não foram alteradas configurações globais do Codex ou de outros assistentes.

## Gerar e consultar o mapa local

```powershell
npm run graphify:code
npm run graphify -- query "communityGovernance"
npm run graphify -- explain "creationPermission"
npm run graphify -- path "requestJoin" "decideJoinRequest"
```

`graphify:code` executa `extract . --code-only --no-gitignore --no-cluster`:

- extrai código por AST local, sem modelo ou chave de API;
- usa `--no-gitignore` porque o .gitignore histórico do Devotio ignora
  `packages/**`, onde estão domínio e backend;
- mantém as exclusões explícitas de `.graphifyignore`, incluindo `.env*`,
  credenciais, .data, .tools, dependências, corpus bíblico e código gerado;
- grava o grafo bruto em `graphify-out/graph.json`, sem clustering, relatório ou
  HTML nessa primeira etapa. Os resultados são locais e ignorados pelo Git.

Para gerar relatório, comunidades e visualização local a partir do grafo:

```powershell
npm run graphify -- cluster-only . --no-label
```

`--no-label` usa rótulos locais e evita nomear comunidades por LLM. Consulte
`npm run graphify -- --help` para opções da versão instalada. Os nomes dos nós
podem ser ambíguos; use os IDs retornados pelas consultas quando necessário.
Depois de trocar branch ou alterar código, gere novamente com `graphify:code`.
O grafo auxilia navegação e não comprova comportamento ou permissão do produto.

O comando local não inclui análise semântica de documentos, PDF, imagens ou
áudio. Esses recursos podem enviar conteúdo ao assistente/backend escolhido;
seu uso exige solicitação específica e revisão do escopo. Não foi configurado
serviço cloud, chave, MCP, watcher ou extra opcional nesta instalação.

## Atualizar e remover

Atualização: criar branch a partir da main atualizada, revisar a versão oficial,
alterar `tools/graphify/requirements.txt`, repetir a instalação e `pip check`.
Se precisar regenerar a skill, executar o comando oficial acima e revisar os
diffs: ele pode recriar o bloco genérico no AGENTS.md e restaurar o hook com
`graphify` sem caminho. Reaplicar as adaptações locais antes do PR e preservar
as licenças da versão nova. Não executar upgrade global ou publicar o backend.

Remoção: em branch própria, retirar scripts npm/launcher, requirements,
integração `.codex` do Graphify e a seção correspondente de AGENTS.md. Remover
apenas o venv `.tools/graphify` e o diretório gerado `graphify-out` se não forem
mais necessários, após conferir seus caminhos. Não apagar outros arquivos do
Codex ou o diretório `.tools` inteiro.

## Registro

Comandos executados e resultados ficam na
[tarefa 04](../../.todo/04-graphify.md). Não houve deploy ou merge nesta instalação.
