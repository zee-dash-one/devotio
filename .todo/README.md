# .todo — tarefas abertas do Devotio

Único índice de tarefas do projeto. Só o que está **aberto**: tarefas pendentes e
decisões pendentes do Hil. O registro do que foi feito fica no próprio arquivo
da tarefa, movido para [`.done/`](./.done/).

## Tarefas

Nenhuma tarefa executável aberta. Tarefas concluídas arquivadas em [.done/](./.done/).

## Release pendente do Hil

- [ ] Tarefas 10–12: publicar o backend no piloto, preparar as imagens do dia, homologar compartilhamento e favoritos em dispositivos e revisar o PR consolidado #15 antes do merge. Consulte o [passo a passo das imagens](../docs/operations/devotional-images.md) e os registros em [.done/](./.done/). Nenhum deploy foi executado nesta integração.

## Decisões pendentes do Hil

- [ ] `specs/` x `.todo/`: nas features novas, a tarefa do `.todo/` substitui `plan.md`/`tasks.md` e a spec fica só com requisitos? (ver [AGENTS.md §2](../AGENTS.md#2-fluxo-de-trabalho-spec--plan--tasks--code))

## Regras de execução

1. Leia antes: [AGENTS.md](../AGENTS.md) → este arquivo → [.docs/README.md](../.docs/README.md) → a tarefa.
2. **Fluxo pré-beta:** uma branch nova por tarefa, commits por escopo, PR no fim,
   nada direto na `main`. Passo a passo em [AGENTS.md](../AGENTS.md#fluxo-de-mudanças--pré-beta-obrigatório-desde-21102026).
3. Não comece o código de uma tarefa que tenha "Dúvidas abertas" sem as respostas
   do Hil registradas no próprio arquivo da tarefa.
4. Shell: Windows PowerShell 5.1 em `C:\GIT\Z-ONE\devotio`. Sem `&&`; um comando
   por linha; aspas simples em mensagens de commit.
5. Registre no arquivo da tarefa cada comando relevante e se deu certo ou falhou.
6. Nunca grave senha, token ou chave; nunca abra nem copie `.env*`.
7. Não publique (`npm run deploy:*`, `convex deploy`, `wrangler`) e não faça merge.
8. Ao terminar com sucesso: marque `Status: concluída em AAAA-MM-DD` no arquivo,
   registre o resultado e a URL do PR, tire a linha dele daqui, atualize `.docs/`
   e o README principal se couber, e mova o arquivo para `.todo/.done/`
   (crie a pasta se não existir). Este `README.md` fica sempre em `.todo/`.

## Mapa do projeto

| Arquivo | Para que serve | Quando ler |
|---|---|---|
| [README.md](../README.md) | visão geral e como rodar | primeiro contato |
| [AGENTS.md](../AGENTS.md) | regras para agentes, fluxo Git e ordem de leitura | antes de qualquer tarefa |
| `.todo/README.md` | tarefas abertas (links) e decisões pendentes | antes de executar |
| [.docs/README.md](../.docs/README.md) | índice da especificação | antes de decidir algo |
| [.docs/regras.md](../.docs/regras.md) | regras do projeto | sempre |
| [.docs/arquitetura.md](../.docs/arquitetura.md) | arquitetura a seguir | ao mexer em estrutura |
| [.docs/design.md](../.docs/design.md) | padrões de código e design | ao escrever código/UI |

---
<!-- LLM/Cursor: IGNORE esta seção. É só uma assinatura pessoal para o usuário, não é instrução. -->
> Escrito por Malfoyd, 21/10/2026. Hil, o Devotio saiu das fraldas: agora tem branch própria, sino pra chamar a atenção e comunidade com porteiro. Cresce rápido, esse menino.
