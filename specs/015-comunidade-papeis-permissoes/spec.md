# Spec: Permissão de criação e papéis comunitários

**ID:** 015-comunidade-papeis-permissoes
**Status:** aprovada; implementada na branch, rollout/homologação pendentes
**Versão alvo:** v1 web/PWA

## 1. Contexto e problema

A criação de comunidades precisa de autorização explícita e limite por pessoa.
A comunidade precisa distinguir seu responsável pela posse, seus administradores
e seus membros, aprovando quem solicita entrada.

## 2. Papéis envolvidos

O proprietário do sistema concede permissão/limite e pode transferir posse no
painel. Cada comunidade tem um owner; owner e admins cuidam do mural, escritura,
listas e entrada. Membros leem e marcam seus próprios itens.

## 3. Histórias de usuário

- Como proprietário, quero autorizar criação com limite para organizar o piloto.
- Como responsável comunitário, quero decidir pedidos e nomear administradores.
- Como leitor, quero acompanhar meu pedido e sair quando desejar.

## 4. Requisitos funcionais

1. Só conta aprovada, com permissão e abaixo do limite, cria comunidade. Limite
   padrão 1 ao conceder permissão, de 0 a 20, contando comunidades de que é owner.
2. Criador torna-se owner. Revogar permissão ou diminuir limite preserva grupos
   existentes e impede novas criações até que as condições sejam atendidas.
3. Código de convite gera pedido, sem acesso antes de aprovação. Repetir pedido
   pendente não duplica; solicitante pode cancelar e reenviar após recusa/cancelamento.
   Pedidos não expiram; solicitante vê status, inclusive recusa.
4. Owner/admin da comunidade aprovam ou recusam; aprovação concede papel membro.
5. Admin promove membro. Só owner remove/rebaixa admin; ninguém remove/rebaixa
   owner por ações comuns. Autogestão de papel usa saída/transferência próprias.
6. Membro/admin pode sair, preservando ao menos um gestor ativo. Owner transfere
   posse antes de sair; destino é membro aprovado, antigo owner torna-se admin.
7. Painel pode transferir posse para participante aprovado. Owner precisa
   transferir antes de ser desativado; último gestor ativo permanece protegido.
8. Comunidades legadas recebem como owner o admin ativo mais antigo, com desempate
   pelo vínculo; membros atuais permanecem, sem conceder permissão de criação.
   Se não houver admin ativo, operação informa pendência e preserva a comunidade.
9. Sem permissão, ocultar Criar comunidade e mostrar orientação discreta. Sem
   vaga disponível, informar limite atingido. Sem pedido de permissão pelo app.

## 5. Requisitos não-funcionais

Autorização e limite devem ser transacionais e aplicados no servidor. Preservar
dados e compatibilidade entre backend novo e web anterior durante a publicação.
Listas crescentes de pedidos são paginadas. Web e ambiente local têm as mesmas regras.

## 6. Visibilidade e permissão

| Papel | Pode ver | Pode criar | Pode alterar/remover |
|---|---|---|---|
| Proprietário do sistema | Painel protegido | Concessões e pré-cadastros | Permissão, limite, posse e papéis, com auditoria |
| Owner | Comunidade e pedidos locais | Publicações, listas e convites | Pedidos, admins, membros e transferência |
| Admin | Comunidade e pedidos locais | Publicações, listas e convites | Pedidos, promover membros, remover membros |
| Membro | Comunidade de que participa | Pedido em outro grupo | Próprias marcações, cancelar pedido e sair |
| Solicitante | Próprios pedidos e nome pelo convite | Pedido por código | Cancelar próprio pedido |

## 7. Fora de escopo

Busca pública, entrada livre, rotação de convite, exclusão de comunidades,
notificações (tarefa 03), app nativo e solicitação de permissão de criação.

## 8. Dados envolvidos

Permissão/limite em usuários; owner nas comunidades; papel owner nos vínculos;
pedidos com autor, comunidade, status e decisão. Mudanças auditadas no painel.

## 9. Perguntas em aberto

Nenhuma decisão de produto pendente para este escopo.

## 10. Aprovação e lançamento

Hil aprovou os requisitos respondendo "Adotar essas decisões na tarefa 02" em
21/10/2026. O plano e checklist estão na [tarefa 02 concluída](../../.todo/.done/02-comunidades-permissoes-papeis.md).
Mobile adiado, sem marcar implementação nativa concluída. Hil publica backend,
executa backfill e revisa/integra o PR após PR #6; sem deploy automático pelo agente.
