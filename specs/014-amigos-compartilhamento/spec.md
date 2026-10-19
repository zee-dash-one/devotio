# Spec: Amigos e partilha privada da Palavra

**ID:** 014-amigos-compartilhamento

**Status:** implementada no checkout; homologação e publicação pendentes

**Versão alvo:** web local e conectada; Expo adiado

**Aprovação:** usuário aprovou o briefing e solicitou implementação em 19/10/2026.

## 1. Contexto e problema

Documentar o acesso administrativo, reduzir ruído na Bíblia e permitir amizade
consentida e envio privado de trechos com recados, sem nova aba principal.

## 2. Papéis envolvidos

Qualquer leitor aprovado pode convidar amigos e compartilhar. Gestão editorial e
administração comunitária não concedem acesso às amizades ou recados de terceiros.
O proprietário acessa a gestão de usuários separadamente em `/gestao-acesso`.

## 3. Histórias de usuário

- Encontrar instruções do painel administrativo e distinguir suas credenciais.
- Ler com filtros e texto, mantendo ações contextuais e identificação do capítulo.
- Convidar por código ou pela lista de uma comunidade em comum e aceitar/recusar.
- Consultar e filtrar meus amigos no Perfil, sem expor minha lista a outras pessoas.
- Enviar uma seleção e recado; reconhecer envios e recebimentos junto aos versos.

## 4. Requisitos funcionais

1. Documentar rota, login/senha/TOTP, aprovação e papéis; não adicionar link público
   ao painel nem presumir acesso por Google/editorial/admin de comunidade.
2. Remover introdução, ornamentação, instruções fixas e rodapé textual da Bíblia.
   Capítulos conservam identificação acessível; filtros, seleção, busca, paginação,
   retorno ao editorial e fonte da edição em Configurações continuam disponíveis.
3. Perfil acessível no menu da conta, sem aba principal. Amigos e convites privados,
   filtráveis por nome. Código pessoal gerado sob demanda, reutilizável até rotação;
   rotação invalida código anterior, sem desfazer amizades/convites existentes.
4. Código apenas permite solicitar amizade. Alternativa: escolher membro de uma
   comunidade em comum; servidor confirma ambos os vínculos. Nome é a única
   informação descoberta; não há diretório público nem busca global por e-mail.
5. Convite exige aceite do destinatário; pode ser recusado ou cancelado. Qualquer
   lado pode remover amizade. Convite inverso não aceita automaticamente. Impedir
   autoamizade/duplicação; até 200 vínculos, incluindo pendentes, por conta.
6. Modal contextual envia trecho e recado obrigatório de até 1.000 caracteres a
   1–20 amigos aprovados. Servidor deriva autor, nomes e texto da fonte confiável.
   Envio atômico e idempotente; repetir a mesma tentativa não duplica recados.
7. Ícones distintos e discretos de envio/recebimento, agrupados por início de
   intervalo. Abrir mostra os recados ligados à marcação e o trecho completo.
   Remetente vê seus destinatários; destinatário vê remetente e recado apenas.
8. Perfil também permite localizar envios/recebimentos paginados e abrir o trecho,
   inclusive quando ele está em outro capítulo. Nenhuma notificação push é exigida.
9. Snapshot conserva edição/texto/nomes do envio. Marcações aparecem só na edição
   correspondente; link abre essa edição. Remoção de amizade impede novos envios,
   mas conserva recados já recebidos. Conta desativada não acessa nem recebe novos
   envios; sua desativação não apaga cópias anteriores dos outros participantes.

## 5. Requisitos não-funcionais

Consultas privadas autenticadas, indexadas e limitadas; histórico paginado. Sem
cache privado persistente de amigos/recados no navegador. Operações exigem rede;
erros preservam o preenchimento. Teclado, foco de modal e telas pequenas utilizáveis.

## 6. Regras de visibilidade/permissão

| Papel | Pode ver | Pode criar | Pode editar/remover |
|---|---|---|---|
| Leitor aprovado (qualquer papel) | Próprios vínculos, envios e recebimentos | Convites e envios a amigos aceitos | Aceitar/recusar recebidos, cancelar enviados, remover amizade |
| Terceiro, inclusive gestor | Nenhum vínculo/recado alheio | Somente no próprio escopo | Nenhum dado alheio |
| Pendente/desativado/visitante | Nenhum dado privado | Nada | Nada |

## 7. Fora de escopo

Chat geral, respostas em conversa, feed público, lista pública de amigos, push,
gamificação, novas traduções, edição/exclusão de recado enviado, mudança da
visibilidade de marcações existentes e implementação Expo.

## 8. Dados envolvidos

Contas e membros existentes; códigos pessoais, amizades, envios bíblicos privados
e índices de visibilidade por participante/capítulo. Detalhes em plan.md e arquitetura.

## 9. Decisões de implementação

Padrões do briefing: aceite explícito, lista privada, retenção de recados entregues,
código rotacionável, limites descritos acima. Sem questões bloqueantes remanescentes.

## 10. Aprovação e lançamento

Implementação autorizada pelo pedido após revisão do briefing. Permanecer local:
sem commit, push, PR ou deploy. Publicação e homologação física ficam para o usuário.
Web conectada e local compartilham políticas; Expo continua pendente.
