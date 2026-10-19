# Usar o produto local

## Amigos e recados — revisão 014

O menu da conta oferece **Meu perfil e amigos**. Gere um código com Marina,
saia e entre como Daniel; envie um convite usando esse código. Entre novamente
como Marina e aceite. Daniel também pode convidá-la em Comunidade → Membros.
Com a amizade aceita, selecione um trecho em Bíblia → Enviar para amigos,
marque Marina, escreva um recado e confirme. Daniel vê a seta de envio; Marina vê
o envelope na mesma edição/capítulo. Ambos encontram seus recados no Perfil.
Teste remoção, falha/reenvio, busca por nome e troca de edição: envio antigo
continua disponível sem liberar novos envios após remover a amizade.

SQLite conserva as cinco tabelas sociais entre reinícios. Eventos SSE invalidam
amigos/histórico/marcações ativos após alterações. Trocar perfil encerra o stream
e remove estado em memória; não há cache persistente de recados no navegador.
Perfis fictícios são sempre ativos; aprovação/desativação real é verificada
nos testes Convex e deve ser homologada no ambiente conectado.

O painel `/gestao-acesso` é do ambiente conectado com senha/TOTP; login local
simulado não o substitui. [Guia do proprietário](../operations/user-administration.md).

**05/10/2026 — escopo da [spec 006](../../specs/006-desenvolvimento-local/spec.md).**
Web com SQLite persistente, identidade simulada e Bíblia AA importada. Não exige
Convex, Google, Docker ou conta externa para usar depois da preparação inicial.

## Iniciar

Com Node 24.19.0 e npm 11.6.2, na raiz:

```sh
npm ci
npm run setup:local
npm run dev
```

Abra [Devotio local](http://127.0.0.1:3000/). `setup:local` precisa de rede e baixa
somente AA do repositório oficial da ABíbliaDigital e o catálogo de livros da API.
Nesta máquina os arquivos e o banco já estão preparados: basta `npm run dev`.
Não preencha as variáveis Convex para este modo. Configuração Convex parcial não
ativa o mock; `npm run preview -w web` serve produção e também não ativa o mock.

O mesmo processo Vite monta a interface e o backend em `packages/backend/local`.
Fechar o terminal encerra o servidor; reiniciar o comando preserva os dados.
Não usar `--host 0.0.0.0`: o backend simulado só aceita loopback.

## Perfis e roteiro

| Perfil | Experiência |
|---|---|
| Daniel Almeida — AG | Administra Esperança; publica no mural, cria listas e remove membros |
| Marina Oliveira — membro | Participa de Esperança; lê e marca seus próprios itens |
| Lucas Santos — leitor | Começa sem comunidade; pode entrar por código ou criar um grupo |
| Ester Costa — Gestor do sistema | Menu de conta → Gestão de devocionais; também é administradora da comunidade de teste Caminho |

AG é associação por comunidade; editorial é uma capacidade independente. Ester
tem uma associação inicial explícita em Caminho, não acesso a todos os grupos.
AC/clube continua adiado pela spec 002. Todos podem ler e guardar favoritos pessoais.

1. Entre como Marina; alterne os oito dias e salve um favorito.
2. Abra Bíblia: escolha livro/capítulo, busque “oração” e abra um resultado.
   Um número de versículo é um link para aquela referência.
3. Abra Esperança: consulte mural/listas/membros e marque um item.
4. No menu da conta, use **Sair / trocar perfil**. Entre como Daniel para testar
   gestão. Lucas pode entrar com **ESPERANC**, após confirmar o nome do grupo.
5. Entre como Ester e abra **Gestão de devocionais** → **Cadastrar devocional**.
   Escolha Palavra pela busca/leitura bíblica e escreva Meditação e Oração.
   Palavra, referência e versão são somente leitura. Programar revela data e fonte;
   confirme com o mesmo botão. Disponibilidade à meia-noite de Brasília; criação
   somente em datas livres, hoje ou futuras. Use Editar existente para corrigir
   mantendo a data, ou Excluir / retirar com confirmação. A retirada reserva a
   data e preserva favoritos. Autoria/revisão e auditoria são registradas pelo servidor.
   Na Bíblia normal, selecione versos e use Criar devocional para iniciar um cadastro.
   No cadastro, Buscar na Bíblia ou o botão flutuante abre a escolha contextual:
   não há menu lateral, apenas retorno com o trecho; campos e seleção são preservados.
   Cancelar descarta o rascunho; Auxílio apenas apresenta o futuro Peregrino, sem IA.
6. Recarregue e reinicie o servidor: dados persistem. Volte à Marina para conferir
   que a cópia favorita permaneceu igual após a edição editorial.

## Dados locais e privacidade

### Seleção e notificações (spec 008)

Na Bíblia, clique/toque um verso ou use Shift + clique para um intervalo. Manter
pressionado e arrastar também forma seleção contígua; teclado oferece Espaço/Enter
e Shift + setas. Menu lateral abre com seleção e fecha por X/Limpar.
O painel ocupa toda a altura junto à direita: a seta abaixo de X
alterna entre texto/ícones e somente ícones. Arraste o painel à direita para
contrair e à esquerda para expandir; no celular, deslize a leitura rapidamente
à esquerda para expandir a faixa compacta. Arrastar o painel preserva os versos
selecionados e não executa seus botões ao soltar. Compartilhar
copia versos no formato `1 - texto`, referência e Almeida Atualizada (AA), com
fallback de cópia manual. Criar devocional aparece para Ester e inicia um novo
cadastro com corpo numerado, referência e versão.

Daniel administra Esperança e Ester administra Caminho. Selecionar Enviar para
comunidade permite marcar vários grupos administrados e clicar **Enviar** (ícone).
O trecho fica salvo como rascunho privado em cada grupo, sem publicar/notificar.
Abra a comunidade → **Escrever**, escolha o rascunho e acrescente comentário se
quiser. **Publicar na comunidade** publica; **Guardar e fechar** salva alterações;
**Descartar rascunho** retira da lista. Novos envios preservam os anteriores.
No compositor, pesquise/escolha Palavra na Bíblia: botão flutuante retorna com o
trecho, sem menu lateral. Comentário, capítulo e seleção permanecem na navegação.
Pelo menu principal, a Bíblia continua no fluxo normal. Não substitui escritura fixada.
Rascunhos enviados persistem após recarga/reinício; formulários e seleção de telas
ficam na sessão em memória até recarregar/sair. Nenhuma gravação por tecla.

Busca lista trechos automaticamente após quatro caracteres e uma pausa na digitação.
Resultados abrem o capítulo no verso encontrado. Consultas recentes são reutilizadas
em memória; não modificam o cache dos seis capítulos.

O sino junto à conta reúne avisos do Devotio e de mensagens dos grupos. Abrir o
modal ou o destino não marca leitura: use Lida em cada item. O estado é particular
e persiste no SQLite. SSE atualiza o número automaticamente, sem polling; a lista
é paginada e Atualizar avisos permite recuperar em caso de falha de conexão. Para
testar entre sessões diferentes, use navegadores/perfis de navegador separados;
abas normais do mesmo navegador compartilham o cookie de login.

Não há Lida na Bíblia, marcações de progresso, push ou IA nesta entrega. A tela
branca de cadastro continua sem sino/header e com seus três botões.

- `.data/devotio.sqlite`: contas/sessões fictícias, conteúdo, grupos e Bíblia.
- `.data/devotio.sqlite-wal` / `-shm`: arquivos auxiliares enquanto o banco está aberto.
- `.data/bible/`: AA, catálogo e commit da origem. Não estão no Git nem no build.
- `localStorage`, prefixo `devotio:cache:v1:`: cache JSON versionado por perfil,
  validado com Zod. Guarda oito devocionais, favoritos, catálogo e seis capítulos
  AA. Sobrevive à recarga; limpo no logout, troca ou expiração. O prefixo antigo
  `devotio:favorites:` é removido ao encerrar/trocar identidade.
- Favoritos são snapshots por usuário/data. Repetir favorito não altera a cópia;
  remover e favoritar novamente captura o conteúdo então disponível.
- Sem rede com a sessão já aberta, leituras guardadas continuam legíveis. Nova abertura
  requer validar a sessão; não há alterações offline ou download de áudio.
- O arquivo do banco é bloqueado pelo servidor de arquivos do Vite. Endpoints
  exigem sessão/associação, origem local e identidade esperada pelo adaptador.

O login simulado permite escolher qualquer perfil fictício na máquina. Não é uma
barreira de autenticação adequada para publicação. Não insira dados pessoais reais.

Para backup, pare o servidor antes de copiar `.data` para outro diretório. Para
recomeçar sem perder o estado anterior, pare o servidor e renomeie o banco e seus
auxiliares; uma nova base é criada na próxima inicialização. Não apague o backup
até conferir o novo ambiente.

## Cache e orçamento de chamadas

| Situação | Consultas esperadas de leitura |
|---|---|
| Primeira entrada no Devocional | Um lote com até oito datas e uma consulta dos favoritos |
| Outra data já guardada / shell e leitor simultâneos | Nenhuma consulta adicional dos textos |
| Página aberta sem interação, no mesmo dia | Zero chamadas periódicas |
| Novo dia com os oito textos anteriores disponíveis | Um lote contendo somente a nova data; exclui a mais antiga |
| Retorno após vários dias | Um lote com as datas faltantes, no máximo oito |
| Primeiro acesso à Bíblia | Catálogo uma vez e somente o capítulo solicitado |
| Revisitar um dos seis capítulos guardados | Zero chamadas de capítulo, inclusive após recarga |
| Sétimo capítulo diferente | Uma consulta; remove o menos recentemente acessado |
| Salvar favorito | Uma escrita e uma consulta dos favoritos, se a tela estiver observando |
| Marcar item de uma lista | Uma escrita e atualização somente das páginas abertas daquele grupo |

Além da leitura, há uma verificação de sessão por abertura, compartilhada por
chamadas simultâneas. Login gera token opaco aleatório em cookie HttpOnly/SameSite
com validade de 30 dias; sessões antigas mantêm o prazo original até novo login.
O servidor verifica a identidade nas operações reais. Não há JWT nem renovação
periódica. Eventos do navegador sincronizam troca/logout entre abas sem polling.
O temporizador de 30 segundos consulta apenas o relógio do dispositivo para
detectar expiração e mudança de dia; não envia requisições no mesmo dia.

O cache usa a data do fuso do dispositivo; o servidor valida cada data contra sua
própria janela. Dias sem publicação também ficam lembrados; são tentados novamente
no próximo dia ou por atualização manual. O seed cria textos de demonstração ao
iniciar o servidor, não gera novas publicações automaticamente à meia-noite.

**Menu da conta → Atualizar conteúdo** consulta novamente os oito dias e as áreas
abertas para buscar correções editoriais, favoritos e novidades comunitárias.
Textos bíblicos já guardados são reutilizados (corpus AA fixado nesta versão).
Comunidades e resultados de busca não ficam persistidos; ao sair e reentrar na
área há nova consulta. Não há sincronização em tempo real entre dispositivos.
Uma correção/retirada editorial invalida apenas sua data na sessão que a realizou;
outras sessões precisam atualizar o conteúdo para recebê-la. Favoritos não mudam.

Se o navegador bloquear ou esgotar armazenamento, o app avisa e mantém o cache em
memória até fechar a página. Se atualizar sem servidor, as cópias existentes não
são apagadas. Escritas continuam exigindo servidor; não há fila offline.

## Bíblia e validação

AA: **66 livros, 1.189 capítulos e 31.104 versículos**. Importação atômica,
idempotente, busca FTS5 com acentos normalizados e páginas de 40 resultados.
O texto é servido exclusivamente do SQLite, não da API durante a leitura.
Fonte, commit e SHA256 estão no banco; detalhes e correções de catálogo na
[nota do provedor](bible-provider.md). Redistribuição pública exige a etapa editorial posterior.

```sh
npm run verify:local   # com npm run dev aberto em outro terminal
npm run test
npm run lint
npm run typecheck
npm run verify:web
```

Os dois testes do corpus AA exigem `setup:local`; em checkout sem os arquivos são
explicitamente ignorados. Não reportar o corpus validado quando esses testes pularem.

## Limites da entrega

Google real/Convex permanecem separados e pendentes de homologação. Janela,
favoritos e Bíblia desta entrega estão implementados no SQLite; portar suas
queries/mutations ao Convex é trabalho futuro antes de publicar. Mobile adiado.
Revisão visual automatizada ficou bloqueada pela política de URL da ferramenta;
não há nova evidência de auditoria visual em aparelhos nesta rodada.
