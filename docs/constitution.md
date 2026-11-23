# Constituição do Projeto

Princípios permanentes que qualquer decisão de produto, tarefa ou linha de código no Devotio deve respeitar.

## I. Minimalismo é lei, não estética

A tela principal existe para colocar a Palavra diante do leitor sem fricção. Toda proposta de funcionalidade deve responder: **"isso adiciona ruído entre a pessoa e o texto?"** Se sim, fica em segundo plano ou é descartada. Carrosséis promocionais, badges, contadores de sequência (*streaks*) e notificações não essenciais estão fora por padrão.

## II. Reverência acima de engajamento

O Devotio não otimiza tempo de tela, retenção comportamental ou urgência artificial (gamificação, rankings, alertas de FOMO). O valor do produto está na clareza, no recolhimento e na utilidade espiritual real — restrição obrigatória para qualquer pessoa ou agente que altere o sistema.

## III. Núcleo agnóstico, casca fina

Toda regra de negócio, schema, validação e autorização vive em `packages/domain` e `packages/backend` — código independente de DOM ou framework nativo. `apps/web` e `apps/mobile` decidem apenas **como apresentar**, nunca **o que é permitido**.

## IV. Supervisão pastoral e papéis explícitos

Comunidades e curadoria refletem responsabilidades claras: proprietário da plataforma (`/gestao-acesso`), equipe editorial, liderança comunitária (`owner` e `admin`) e membros. Qualquer recurso envolvendo visibilidade entre pessoas exige definição explícita de quem vê o quê — na dúvida, o padrão é **privado**.

## V. Privacidade e discrição por padrão

Favoritos, recados entre amigos, pedidos de entrada e marcações individuais de listas pertencem estritamente ao escopo autorizado. Nunca inferir consentimento de compartilhamento a partir de ações não relacionadas, nem expor e-mails ou listas privadas de amizades a terceiros ou líderes comunitários.

## VI. Planejamento aprovado antes do código

Nenhuma funcionalidade nova entra direto no código sem escopo e decisões de visibilidade/permissão alinhados com o responsável do projeto em `.todo/`. Em um produto pastoral, erros de permissão ou exposição custam confiança, não apenas retrabalho técnico.

## VII. Sobriedade teológica no tom, neutralidade no código

Todo conteúdo devocional e temático tem autoria e revisão humana responsável (`reviewedBy`). O código nunca publica conteúdo teológico de forma autônoma; eventual auxílio computacional futuro será sempre rascunho submetido à revisão humana, nunca publicação direta.
