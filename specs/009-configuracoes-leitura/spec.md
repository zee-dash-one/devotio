# Spec: Configurações de aparência e leitura bíblica

Extensão aprovada em 09/10/2026: [spec 012](../012-versoes-biblia/spec.md) acrescenta
Versão da Bíblia e ALM1911 no build local/conectado. As restrições abaixo sobre
AA como única edição descrevem o escopo original da 009, substituídas somente
para essa inclusão aprovada. Tema, fonte e modos continuam seguindo esta spec.

Revisão autorizada: menu da conta fecha ao clicar/tocar fora, pressionar Escape ou acionar qualquer botão/link interno, inclusive Configurações. Fechar o menu não cancela a ação acionada.

**ID:** 009-configuracoes-leitura
**Status:** aprovada para implementação web local pelo usuário em 08/10/2026
**Versão alvo:** web local completa, antes de publicação
**Revisão:** 08/10/2026

## 1. Contexto e problema

A leitura precisa se adaptar ao ambiente e às necessidades de cada pessoa, sem sair da página, repetir downloads ou perder o trecho em leitura. O perfil oferece um único modal para aparência e modo de leitura. Alterações são imediatas, inclusive dentro do modal, sem confirmação adicional ou botão Salvar.

Esta feature usa a AA local já disponível. Separar o armazenamento bíblico, disponibilizar outras traduções e baixar a Bíblia inteira para uso offline são outra entrega, descrita no [plano do corpus](../../docs/engineering/bible-corpus-plan.md). Sua conclusão não bloqueia estas configurações.

## 2. Papéis envolvidos

Sem diferenciação de papel. Gestor do sistema, gestor de comunidade, membro e usuário sem comunidade alteram suas próprias preferências. Configurações não concedem acesso editorial ou comunitário.

## 3. Histórias de usuário

- Como usuário, quero ajustar tema e fonte e ver o resultado imediatamente, sem perder minha leitura.
- Como usuário, quero escolher entre capítulos contínuos e um capítulo por página, com navegação previsível.
- Como usuário, quero retomar minhas escolhas no mesmo aparelho e revisitar capítulos sem downloads repetidos.
- Como usuário que seleciona textos para devocionais ou comunidades, quero manter a seleção e o rascunho ao ajustar a aparência.

## 4. Requisitos funcionais

### 4.1 Modal e aplicação imediata

1. Menu do perfil → **Configurações** abre um modal sobre a página atual.
2. Campos: **Tema**, **Tamanho da fonte** e **Modo de leitura bíblica**. Não incluir seletor de traduções ainda indisponíveis.
3. Cada alteração aplica imediatamente à página, menus, campos, seleção e ao próprio modal. Fechar mantém as escolhas; não funciona como Cancelar.
4. Botão Fechar e Escape encerram o modal, preservando página, posição de leitura, busca, seleção e formulários. O foco retorna ao acionador.
5. Escolhas persistem por perfil neste aparelho e são restauradas na recarga. Outro perfil usa suas próprias escolhas ou os padrões. Sem armazenamento disponível, a aplicação continua em memória.
6. Revisão visual solicitada em 08/10/2026: todos os selects da web abrem modal de opções, seguindo o modal de devocionais recentes. Título do campo, lista com opção atual marcada e grupos dos livros; selecionar aplica e fecha. Fechar por X, Escape ou backdrop não altera o valor. Navegação por setas/Home/End e digitação, confirmação por Enter/Espaço, Tab dentro do modal e retorno do foco ao campo. Superfícies e foco seguem os temas. Modal de opções aberto nas Configurações fica acima do modal pai; fechar o filho mantém o pai aberto. Preservar rótulos, valores e campos desabilitados; sem regra de negócio ou consulta nova.

### 4.2 Temas

| Tema | Comportamento |
|---|---|
| Dia | Fundo claro e texto escuro para ambientes iluminados |
| Noite | Fundo escuro e partes claras em tons quentes/amarelados, evitando branco intenso predominante |
| Papiro | Tons claros pastel, marrons e cinzas, com aspecto discreto de papel antigo |
| Contraste | Separação forte entre texto e superfícies, com controles, foco e seleção facilmente distinguíveis |
| Pelo horário | Alterna Dia/Noite pelo relógio local do aparelho, sem localização ou interação diária |

Proposta: padrão **Dia**; “Pelo horário” usa Dia de 06:00 até antes de 18:00 e Noite no restante. Reavaliar na abertura, ao voltar ao app e nas transições, sem consultas de servidor. Mudanças de relógio/fuso são reconhecidas na próxima reavaliação. Tema Noite não promete prevenir cansaço ou alterar o sono.

A tela editorial mantém sua estrutura minimalista e tipografia uniforme; branco é o fundo de Dia, e os outros temas usam suas próprias superfícies. Essa revisão complementa a aparência definida na spec 007 sem alterar o CRUD.

### 4.3 Escala de fonte

Proposta: slider de **oito posições: 14, 16, 18, 20, 22, 24, 28 e 32 px**, como equivalentes de tamanho do corpo de leitura na base padrão; inicial **20 px**. São valores para validação de produto, não uma afirmação de padrão universal.

Exibir o valor escolhido; permitir operação por teclado. O texto de leitura e a interface, incluindo o modal, acompanham a escala com tamanhos relativos. Manter zoom do navegador, quebra de linhas, controles alcançáveis e rolagem no modal. Nunca cortar texto nem reduzir automaticamente a escolha para fazê-la caber. Preservar o versículo visível como âncora após alteração.

### 4.4 Modos e capítulos preparados

| Modo | Exibição | Navegação |
|---|---|---|
| Contínuo | Capítulos um abaixo do outro, separados por título; carregamento progressivo antecipado (lazy loading) | Rolagem vertical, sem troca horizontal de capítulo |
| Paginado | Um capítulo visível e botões Anterior/Próximo ao final | Arraste longo para a esquerda (direita → esquerda) avança; para a direita volta, como virar página de livro. Botões fazem o equivalente |

1. Proposta de padrão: **Paginado**, compatível com a apresentação atual.
2. Ambos preparam atual, anterior e próximo antes de a pessoa precisar deles, reutilizando conteúdo disponível. Nos limites do livro, preparar somente os vizinhos existentes; não atravessar livros automaticamente nesta entrega.
3. Ao avançar, preparar apenas o vizinho novo. Conteúdo existente não é baixado de novo; falha de antecipação não bloqueia o atual.
4. Mudar o modo aplica na hora, mantendo capítulo/versículo visível, seleção e contexto de retorno ao formulário. Contínuo não mantém uma lista crescente de capítulos fora de leitura.
5. Scroll para cima/baixo apenas rola o texto. Arraste curto não muda capítulo. Cada gesto aceito muda no máximo um capítulo.
6. Arrastar o menu lateral nunca seleciona versos nem troca capítulo. Expandir/recolher o menu pela leitura consome o gesto.
7. Toque/segurar alternam versos individualmente, inclusive grupos separados (spec 008); arraste não seleciona. Com seleção ativa, swipe de capítulo fica suspenso; botões continuam disponíveis e limpam a seleção se mudarem o capítulo.
8. Seleção não atravessa capítulos no modo Contínuo. Ao selecionar para devocional/comunidade, mantém-se o fluxo contextual com botão flutuante e retorno ao formulário, sem menu lateral normal.

## 5. Requisitos não-funcionais

- Tema e fonte não disparam consultas de conteúdo, importações ou atualização de sessão. Mudar modo na mesma janela também não repete consultas.
- Preparar somente vizinhos ausentes, deduplicar solicitações simultâneas e priorizar o capítulo visível. Sem polling ou retries infinitos.
- Janela ativa limitada a três capítulos completos; cache recente limitado a seis, incluindo essa janela. Antecipação não conta como visita nem elimina desnecessariamente o histórico acessado.
- Ler vários capítulos não acumula o livro inteiro em memória/na tela. Reposicionar a janela preserva o versículo visível, inclusive ao voltar.
- Leituras iniciadas em outro livro/contexto não sobrescrevem a tela atual ao terminar.
- Modal operável por teclado, com foco contido e retorno ao acionador. Texto, ícones, seleção e foco legíveis em todos os temas; conteúdo utilizável na maior fonte e com zoom do navegador.
- Capítulo no cache continua acessível em falha de rede; capítulo ausente informa indisponibilidade sem carregamento infinito. Não prometer Bíblia integral offline nesta spec.
- Persistência não bloqueia a atualização visual. Alterações rápidas de fonte não geram gravações redundantes de capítulos.

## 6. Regras de visibilidade/permissão

| Papel | Pode ver | Pode criar | Pode editar/remover |
|---|---|---|---|
| Gestor do sistema | Suas configurações | Suas preferências | Suas preferências |
| Gestor de comunidade | Suas configurações | Suas preferências | Suas preferências |
| Membro / sem comunidade | Suas configurações | Suas preferências | Suas preferências |

Não publicar preferências, histórico de leitura ou seleção na comunidade. Papéis e permissões de compartilhamento/CRUD permanecem verificados pelo servidor, como nas specs 007/008. Nenhuma preferência do cliente altera autorização.

## 7. Fora de escopo

- Migração do corpus, importação de novas traduções, pacote offline integral ou novo índice de busca.
- Sincronização de preferências entre aparelhos; localização geográfica e cálculo de nascer/pôr do sol.
- Peregrino, leitura em áudio, marcações de leitura, seleção entre capítulos ou mudanças de permissão.
- Implementação nativa nesta etapa.

## 8. Dados envolvidos

Preferências: tema escolhido, tamanho do texto, modo de leitura e identificação do perfil local para isolamento. Sem novas tabelas no schema Convex ou no banco bíblico/comunitário nesta entrega. Reutilizar catálogo, capítulos AA e seleção existentes; nenhuma alteração no texto, metadados de citações, devocionais ou rascunhos.

Validação e políticas de preferências/cache pertencem ao núcleo compartilhado; apresentação, persistência no navegador e gestos são adaptadores da plataforma. Detalhes técnicos serão definidos no plano após aprovação.

## 9. Propostas para revisão

Requisitos e detalhes abaixo autorizados pelo pedido “Implemente essas mudanças agora”, em 08/10/2026:

1. Nome **Pelo horário**, janela Dia 06:00–18:00; padrões Dia, 20 px e Paginado.
2. Oito tamanhos de 14 a 32 px, em vez de três presets.
3. Vizinhos limitados ao livro atual e seleção ativa suspendendo swipe de capítulo, para preservar seleção/menu sem gestos conflitantes.

## 10. Aprovação e lançamento

- Aprovação: usuário, 08/10/2026, para implementação da revisão documental anterior. Web local implementada; execução e evidências em [plano](plan.md)/[tasks](tasks.md), com homologação visual/física pendente.
- Canal inicial: web local. Mobile futuro deve preservar comportamento e preferências equivalentes, com gestos/armazenamento próprios; não marcar entregue.
- Dependências: AA local, cache existente e fluxos das specs 006/007/008; não depende da migração do corpus.
- Critérios de liberação: validar todos os requisitos, chamadas somente para vizinhos ausentes, cache limitado, persistência isolada e preservação de estado; verificar visualmente os cinco temas, fonte máxima e gestos em aparelho físico.
- Conteúdo/licença: nenhuma nova edição ou redistribuição pública nesta entrega. Publicação continua dependente das condições de uso da AA e do plano do piloto.
