# Briefing temporário — acesso, leitura bíblica e compartilhamento entre amigos

**Origem:** pedido do usuário em 19/10/2026.  
**Finalidade:** referência para escrever e revisar as próximas specs, planos e tarefas.  
**Estado:** briefing de requisitos; não representa funcionalidade implementada nem autorização para publicar.

**Encaminhamento:** implementação autorizada pelo usuário em 19/10/2026 e
formalizada na [spec 014](../specs/014-amigos-compartilhamento/spec.md).
O texto abaixo conserva o briefing aprovado; acompanhe execução e validações nas
[tarefas](../specs/014-amigos-compartilhamento/tasks.md) e no estado do projeto.

## Prompt refinado

Quero evoluir o Devotio de forma discreta, preservando as funcionalidades existentes e a privacidade dos leitores. Organize o trabalho abaixo em especificações e tarefas verificáveis antes de implementar novas funcionalidades.

### 1. Documentar o acesso à gestão de usuários

Documente, em um lugar fácil de encontrar na documentação do projeto, como o proprietário acessa o painel de gestão e aprovação de usuários. Explique qual é a rota, quais credenciais e permissões são necessárias, como funciona a aprovação de novos cadastros e onde o acesso aparece — ou não aparece — na interface. Diferencie o acesso do proprietário das permissões de gestão editorial e administração de comunidades. Revise a documentação operacional existente e mantenha instruções sensíveis fora da interface pública.

**Situação a esclarecer na documentação:** o painel atual está em `/gestao-acesso`, sem entrada nos menus. Verifique o comportamento real das Configurações e do Perfil antes de afirmar que existe um atalho ali. Não exponha senha, segredo do autenticador, códigos de recuperação ou outros dados privados.

### 2. Simplificar a tela de leitura bíblica

Na área principal da leitura bíblica, deixe visíveis apenas os filtros necessários para localizar o trecho e o próprio texto bíblico. Remova textos introdutórios, explicações e outros elementos textuais que disputem atenção com a leitura. Preserve as funcionalidades atuais de navegação, seleção e compartilhamento, usando controles contextuais quando necessário. As futuras marcações de compartilhamento devem ser pequenas, acessíveis e perceptíveis sem poluir os versículos.

### 3. Encontrar e adicionar amigos

Permita que uma pessoa encontre e registre amigos sem criar uma nova aba principal. Considere dois caminhos: compartilhar um código ou convite pessoal e encontrar alguém na lista de participantes de uma comunidade em comum. Defina na spec como funciona o convite, sua aceitação ou recusa e a remoção de uma amizade, evitando que um simples encontro na lista conceda acesso a dados privados.

No Perfil, mostre a lista de amigos da própria pessoa e ofereça busca ou filtro nessa lista. O mesmo conjunto de amigos deve estar disponível para escolher destinatários ao compartilhar um trecho. Defina de forma explícita quem pode encontrar cada perfil e quais informações aparecem antes e depois da amizade.

### 4. Compartilhar um trecho bíblico com amigos

Depois que as amizades estiverem funcionais, permita selecionar um versículo ou um intervalo de versículos na leitura bíblica e enviá-lo a um ou mais amigos. Ao escolher essa ação, abra um modal para selecionar ou localizar os destinatários e escrever um recado. O envio deve exigir confirmação explícita e associar o recado à referência, à edição bíblica e ao trecho selecionado.

Para quem enviou, mostre uma marcação discreta junto ao versículo ou intervalo compartilhado. Ao abri-la, a pessoa vê o próprio recado e os amigos para quem o enviou. Para quem recebeu, use um ícone visualmente distinto no trecho correspondente. Ao abri-lo, a pessoa vê apenas o nome de quem enviou, o recado recebido e o trecho bíblico relacionado; nunca vê os demais destinatários. Se houver vários compartilhamentos no mesmo trecho, a apresentação deve continuar compreensível sem multiplicar ícones de modo excessivo.

As mensagens são privadas entre remetente e destinatários autorizados. O compartilhamento não altera a visibilidade de comentários, orações ou outras marcações bíblicas existentes. Defina na spec o comportamento para amizade removida, conta desativada, envio duplicado, vários destinatários e troca de edição bíblica. Garanta as restrições de visibilidade no servidor, com regras comuns ao domínio e às interfaces.

### Critérios de aceite e sequência

1. A documentação permite encontrar `/gestao-acesso` e entender corretamente quem pode utilizá-lo, sem divulgar segredos.
2. A leitura bíblica fica centrada em filtros e texto, mantendo seleção, navegação e ações contextuais utilizáveis.
3. É possível convidar, aceitar ou recusar, encontrar, listar, filtrar e remover amigos conforme regras de privacidade definidas.
4. Remetente e destinatário veem marcações distintas e somente os dados a que têm direito, inclusive quando o mesmo trecho é enviado a várias pessoas.
5. O fluxo funciona com testes de permissão e de interface, inclusive casos de acesso negado, e é homologado visualmente antes da publicação.

Execute em etapas: primeiro a documentação e a simplificação da leitura; depois amizades; por último, o compartilhamento privado entre amigos. Antes de escrever código novo, produza a spec, o plano e as tarefas segundo o fluxo do repositório e submeta as decisões de produto ainda abertas à revisão do usuário. Não faça commit, push, PR ou publicação sem uma instrução posterior explícita.
