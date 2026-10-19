# Plano: editorial e corpus padronizado

Autorizado pelo pedido reiterado do usuário em 09/10. Sem commit/push/deploy.

## Backend/domain

Adicionar validador único de cadastro com reflexão/oração de 512 caracteres,
seleção estruturada e modo criar/corrigir. Manter schema de leitura/publicações
legadas compatível com textos longos; não truncar. Campos de texto bíblico,
referência, tradução, autoria e horário são derivados no servidor.

Convex: consultas autorizadas por data e calendário mensal usando `by_date`,
com até 32 registros. Calendário recebe hoje calculado em Brasília pelo domínio;
mutation verifica hoje usando relógio próprio. Criar rejeita data passada/ocupada,
inclusive retirada. Corrigir exige existência e motivo; crédito original mantido.
Adicionar `selection` opcional a devotionals e atualizar arquitetura. Fonte confiável
do backend é o arquivo autorizado, validado e normalizado por contrato compartilhado;
sem fetch externo na transação. Mutation reconstrói citações por book/chapter/verses.

Criar adaptador SQLite para corpus integral, com metadados de edição, livros e versos
por chave composta. Importar JSON em transação, validar hash/contagens, reimportação
idempotente. Build gera os capítulos públicos a partir dessa cópia em `.data/bibles`.
Adaptador local reconstrói citações pelo mesmo banco; AA existente preservada.

## Web

Listagem conectada leva a `/editorial/cadastro`, que apresenta formulário controlado
com estado no contexto por conta, reaproveitando o picker existente. Referência/botão
abrem `/biblia?pick=devotional`; retorno aplica citação e preserva demais campos.
Tradução usa Dropdown e edições disponíveis; texto/referência/créditos somente leitura.
Datas livres por mês via Dropdown e anterior/próximo mês. Exibir Brasília 00:00,
contadores 512 e explicação do motivo em correções. Criação registra motivo automático.
Alinhar o modo local ao cadastro conectado: consulta mensal autorizada de datas
livres no SQLite, seletor de data, seletor padrão de tradução (AA/ARC1911 quando
disponíveis), motivo explícito em correções e fonte derivada da edição. Preservar
o crédito original em correções e validar seleção/versão no servidor. Reusar
políticas de datas e limites no domínio. O calendário conectado continua vindo
do Convex; o local consulta seu próprio banco.

## Mobile

Contratos compartilhados; Expo adiado. Testar web responsiva por DOM, homologação
visual/física separada.

## Verificação

Domínio: calendário, fuso, limites, seleção e preservação de legados.
Backend: autorização negativa, texto/autoria derivados, duplicidade/datas passadas,
datas retiradas, correção e importação SQLite idempotente/reabertura.
Web: criação -> Bíblia -> retorno, seleção/campos bloqueados, limites, tradução,
datas livres, créditos, motivo automático, edição e erro sem perder textos.
Lint/typecheck/testes/build completos. Codegen somente em dry-run, com análise
remota sem implantação; nunca executar deploy nesta rodada.
