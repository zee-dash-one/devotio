# Plano de desenvolvimento do produto completo

**Extensão autorizada em 19/10/2026:** [spec 014](../../specs/014-amigos-compartilhamento/spec.md)
acrescenta documentação administrativa, leitura simplificada, amigos no Perfil e
recados privados. Ordem: documentação/leitor → amizades → partilha. Regras
aprovadas constam na spec; não é necessário repetir o aceite do briefing.
Homologação, PR e deploy permanecem separados da implementação local.

> Atualização de execução em 04/10/2026: o usuário autorizou implementar e delegou
> decisões restantes conforme a documentação. A [spec 006](../../specs/006-desenvolvimento-local/spec.md)
> registra três abas, SQLite, login mockado, limpeza de favoritos no logout,
> importação manual de AA e operação editorial local. Não é mais necessário
> aguardar D3: foi adotada a recomendação já presente no plano 001. O levantamento
> abaixo conserva as opções apresentadas; estado de execução nas tasks 006.

**Data:** 04/10/2026. **Estado:** marco local, provedor, importação para o banco e versão inicial AA definidos; demais decisões pendentes antes da execução de requisitos novos.

O pedido atual reúne Devocional, leitura bíblica e Comunidades. Este documento
organiza as specs e suas dependências. O usuário escolheu concluir as três áreas
localmente e só depois planejar a publicação, conforme [ADR 002](../adr/002-local-complete-product.md).
Toda dúvida de produto deve trazer uma recomendação e duas
alternativas; ausência de resposta não aprova a recomendação.

## 1. Base já definida

- Web primeiro, com PWA; Expo e lojas permanecem para outra etapa.
- React/Vite, TanStack Router, domínio compartilhado e backend Convex.
- Google para acesso; regras e isolamento verificados no servidor.
- Minimalismo, revisão humana do conteúdo e ausência de gamificação.
- Pages + Convex, meta de operação nas cotas gratuitas e um ambiente de piloto,
  conforme decisões registradas na spec 005.
- Mural publicado pela liderança e entrada por código, conforme spec 004 §10.

Essas escolhas vêm da documentação existente. Não serão reabertas sem motivo
ou pedido do usuário. Implementação local não equivale a homologação pública.

## 2. Cobertura e lacunas por spec

| Frente | Fonte | Situação observada | Trabalho restante |
|---|---|---|---|
| Devocional | [001](../../specs/001-devocional-diario/spec.md) | Leitura diária e processo editorial na base; revisão de 04/10 inclui janela e favoritos | Hoje + sete dias anteriores; snapshots privados no banco e JSON local; reconciliação; aceites de áudio, data e acessibilidade |
| Comunidades | [002](../../specs/002-comunidade-v1/spec.md) | Criação, convite, mural paginado, listas, ticks e remoção implementados localmente | Conferir todos os aceites, divergências documentais, metadados de associação e comportamento com sessões reais e grupos maiores |
| Bíblia | [003](../../specs/003-conteudo-biblico/spec.md) | ABíbliaDigital, importação e AA escolhidas; schema ainda sem tabelas bíblicas | Conferir edição/contrato e condições de importação; revisar e aprovar spec; fechar navegação e busca |
| Fundação | [004](../../specs/004-fundacao-lancamento/spec.md) | Auth, PWA e backend implementados; verificações locais registradas | Conciliar favoritos offline com política anterior de cache; homologar sessão e operação editorial |
| Publicação | [005](../../specs/005-piloto-publicacao/spec.md) | Planejamento adiado até concluir o marco local; escolhas anteriores preservadas | Retomar condições de publicação depois do aceite das três áreas |

Favoritos e Bíblia ainda não aparecem no schema ativo. As referências antigas a
tabelas bíblicas “já existentes” precisam ser corrigidas na revisão da 003.
O plano 001 já prevê apagar o espelho de favoritos no logout/troca de conta;
falta alinhar essa regra entre todas as specs afetadas pelo offline.

## 3. Decisões apresentadas ao usuário

| ID | Dúvida | Recomendação apresentada | Alternativa 2 | Alternativa 3 | Estado |
|---|---|---|---|---|---|
| D1 | Marco de entrega das três áreas | Desenvolver por etapas e abrir o produto com as três áreas | Publicar Devocional/Comunidades e acrescentar Bíblia depois | Completar primeiro a versão local e planejar a publicação depois | Alternativa 3 escolhida em 04/10/2026 |
| D2 | Escolha da tradução e fonte | Pesquisar opções em português com permissão de distribuição gratuita e trazer comparação | Verificar uma tradução específica indicada pelo usuário | Avaliar fonte/arquivo autorizado já fornecido pelo usuário | Fonte: abibliadigital.api.br; versão inicial AA |
| D3 | Cópia local ao sair da conta | Apagar no logout, manter no banco e baixar após novo login; converge com plano 001 | Persistir com desbloqueio local, sujeito a definição de proteção/recuperação | Oferecer escolha explícita de manter/apagar no aparelho | Aguardando confirmação/alinhamento |

D1 está registrada na ADR 002 e na constituição §VIII. D2/D4/D5 definem provedor,
importação para o banco e AA inicial. Identificação exata da edição e condições
de cópia integral ainda precisam ser registradas na integração.
D3 não amplia a visibilidade dos favoritos: eles continuam exclusivos do titular.

### Perguntas apresentadas após a escolha do provedor

| ID | Decisão | Recomendação | Alternativa 2 | Alternativa 3 | Estado |
|---|---|---|---|---|---|
| D4 | Uso da API | Importar uma versão para o banco, preservando a spec, com condições de cópia confirmadas | Consultar capítulos sob demanda com cache no backend | Consultar sempre pelo backend sem armazenar texto | Opção 1 escolhida em 04/10/2026 |
| D5 | Tradução padrão | NVI, linguagem contemporânea | NVT, fluidez de leitura | ACF, linguagem tradicional | Usuário escolheu AA em resposta livre; demais opções descartadas |

A [nota do provedor](../engineering/bible-provider.md) distingue documentação
consultada de testes ainda pendentes. Não confundir `.api.br` com o domínio antigo.

## 4. Próxima rodada de esclarecimentos

Apresentar as questões conforme as respostas anteriores, sempre com três opções
e sem transformar hipóteses em decisões:

- Navegação da Bíblia: como integrá-la às áreas principais sem esconder a leitura.
- Preservar os 66 livros e busca por palavra já previstos na 003; reabrir somente se solicitado.
- Definir execução do backend de desenvolvimento e identidade no marco local;
  prévia efêmera não basta e funcionamento sem internet não foi solicitado.
- Política de acesso a favoritos offline ao reabrir o aplicativo sem conexão;
  logout e expiração de sessão são situações diferentes.
- Limite de favoritos e escala esperada do piloto, antes de dimensionar retenção.
- Regras ao favoritar novamente a mesma data após correção editorial: preservar
  snapshot existente ou substituir mediante ação explícita; não atualizar em silêncio.
- Fonte de referência para a janela local no servidor: não aceitar um “hoje”
  arbitrário enviado pelo client como autorização para consultar qualquer data.
- Confirmar processo de conteúdo e responsáveis antes de detalhar operação pública.

Não acrescentar anotações bíblicas, planos de leitura, chat, clubes, push ou painel
editorial completo ao escopo sem solicitação e spec própria/aprovada.

## 5. Entregas e critérios para execução

Os blocos abaixo são dependências de planejamento, não um cronograma aprovado.

| Bloco | Entrega verificável | Depende de | Critério de conclusão |
|---|---|---|---|
| A — Alinhamento | Specs, ADRs e planos coerentes com as respostas | D3 e dúvidas restantes | Decisões registradas, requisitos aprovados e tasks executáveis |
| B — Devocional completo | Janela recente e favoritos pessoais | A; política de armazenamento e data | Oito datas exatas; snapshot isolado; retirada/correção editorial conforme spec; servidor vence na reconciliação; limpeza local testada |
| C — Leitura bíblica | Livros, capítulos, versículo e busca em AA | A; edição/condições registradas; spec 003 aprovada | Importação idempotente e retomável; integridade do texto; leitura do banco sem API externa; referências e erro/vazio acessíveis |
| D — Comunidades completas | Aceites da 002 cumpridos na base reconstruída | A; contas para homologação | Associação exigida em toda operação; mural paginado; ticks próprios/idempotentes; último admin protegido; atualização entre sessões |
| E — Experiência integrada | Navegação entre as três áreas, teclado, celular e estados de rede | B/C/D e decisão de navegação | Links diretos, retorno do login, acessibilidade, áudio e comportamento offline conferidos |
| F — Planejamento posterior da publicação | Retomar a spec 005 | Aceite local de B/C/D/E | Fechar plano público, responsáveis e homologações em uma próxima etapa |

Não estimar datas de entrega antes de fechar escopo, fonte bíblica e dependências
de contas. Trabalho de homologação pode revelar correções adicionais.

## 6. Organização das tasks após as respostas

**Backend/domain:** atualizar planos 001/002 para os contratos reais; definir
schema e índices antes da implementação; regras e validadores em domain;
autorização e transações no Convex; testes de data, snapshots, isolamento e importação.

**Web:** apresentar janela/favoritos, leitura bíblica e comunidade sem duplicar
regras; estados de loading/vazio/erro; armazenamento do aparelho via adaptador;
navegação e acessibilidade conforme decisões aprovadas.

**Mobile:** manter as tasks abertas e explicitamente adiadas. Documentar o que é
compartilhado e o que exigirá apresentação/storage/áudio próprios no Expo.

**Cross-cutting:** atualizar arquitetura antes de novas tabelas; verificar licença
inclusive para cópias pessoais; lint, typecheck, testes, build/PWA; revisão visual;
homologação real, custos, privacidade, recuperação e evidências por task.

## 7. Acompanhamento desta rodada

- [x] Conferir constituição, índice, estado, specs e schema ativo.
- [x] Identificar janela/favoritos já previstos e dependências da Bíblia.
- [x] Registrar conflitos e três primeiras decisões sem escolher pelo usuário.
- [x] Registrar D1: produto local completo antes da publicação.
- [x] Registrar fonte indicada em D2 e consultar sua documentação.
- [x] Registrar D4: importação para o banco; D5: versão inicial AA.
- [ ] Receber D3 e esclarecer dúvidas restantes, sem pressupor aprovação.
- [ ] Revisar e obter aprovação das specs afetadas antes dos planos executáveis.
- [ ] Atualizar planos/tasks por feature e fechar a sequência de desenvolvimento.
- [ ] Iniciar implementação conforme as aprovações.

Este levantamento não modifica código, schema ou dados. Evidências de qualidade
da base permanecem no [estado real](../engineering/status.md); não foram refeitas
como parte desta revisão documental.
