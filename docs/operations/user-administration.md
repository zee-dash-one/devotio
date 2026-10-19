# Gestão de usuários no piloto

Implementação da [spec 011](../../specs/011-gestao-usuarios-aprovacao/spec.md).
Página web: `/gestao-acesso`, sem link nos menus. Usuários comuns continuam entrando
com Google. Administradores de comunidade não são superusuários.

## Como encontrar e entrar no painel

Abra **o endereço do aplicativo seguido de `/gestao-acesso`**, por exemplo
`https://seu-dominio/gestao-acesso`. Salve esse endereço nos favoritos do navegador.
Não existe atalho em **Configurações**, no **Perfil** ou nos menus públicos.
Ocultar o link é uma escolha de navegação; a proteção real é verificada no servidor.

Entre com o **login do proprietário**, sua **senha administrativa** e o **código
atual de seis dígitos do autenticador (TOTP)** configurado na preparação abaixo.
O login Google normal não substitui essa entrada. Após entrar, filtre a situação
por pendentes, consulte o cadastro e libere o acesso desejado. Atualize a lista
quando necessário. Recarregar a página exige nova entrada; a sessão dura 30 minutos.

| Acesso | O que permite | Como encontrar |
|---|---|---|
| Proprietário (login + senha + TOTP) | Aprovar/desativar contas e conceder permissões | Rota direta `/gestao-acesso` |
| Gestão editorial | Cadastrar, corrigir e retirar devocionais | Menu da conta → Gestão de devocionais, quando concedida |
| Administração de comunidade | Administrar a comunidade atribuída | Dentro da própria comunidade |
| Leitor aprovado | Ler e usar suas comunidades e amizades | Login normal; Perfil acessível pelo menu da conta |

Aprovar uma conta não concede automaticamente editorial ou administração de
comunidade. Cada permissão é independente. Novos cadastros Google aguardam
aprovação enquanto o controle do piloto estiver ligado; desativar esse controle
só afeta novos cadastros, sem aprovar pendentes nem reativar desativados.
Desativação conserva dados e impede acesso; não equivale a exclusão definitiva.
O painel não permite ler amizades ou recados privados dos participantes.

Se faltar configuração administrativa, prepare o proprietário conforme a próxima
seção. Se perdeu as credenciais, consulte **Sessões, tentativas e recuperação**
neste documento. Nunca coloque credenciais reais nesta documentação.

## Preparar o proprietário

1. Na raiz do repositório, execute em um terminal privado:

   ```powershell
   node scripts/setup-admin.mjs
   ```

2. Informe seu e-mail de login e uma senha de pelo menos 14 caracteres. A senha
   não aparece na tela. Adicione a chave exibida ao seu autenticador como conta
   baseada em tempo (TOTP, SHA-1, seis dígitos, 30 segundos).
3. O script cria `.env.admin.local`, ignorado pelo Git, com `ADMIN_LOGIN`,
   `ADMIN_PASSWORD_HASH` (scrypt) e `ADMIN_TOTP_SECRET`. Ele não substitui arquivo
   existente e não configura nem publica nenhum serviço.
4. Guarde senha/chave em local privado de recuperação. Configure as três variáveis
   no dashboard do deployment Convex correto. Não use prefixo `VITE_`, não cole no
   chat, não envie esse arquivo ao repositório e não o coloque em pasta pública.
5. Configure `PILOT_EXISTING_USERS_BEFORE` com o instante ISO UTC de ativação
   deste controle. Exemplo de formato: `2026-10-09T15:00:00.000Z` (substituir pelo
   instante real). Contas Better Auth criadas antes dele continuam aprovadas;
   depois dele aguardam aprovação. Não avançar esse marco em deploys seguintes.

O valor de ADMIN_TOTP_SECRET é a representação privada usada pelo servidor;
a chave exibida para o autenticador é sua codificação Base32. Não são valores
intercambiáveis. O script usa o mesmo utilitário TOTP que a verificação no servidor.

## Publicar e preservar contas

Identifique primeiro o deployment compartilhado pelo site. Nesta máquina havia
`dev:upbeat-jellyfish-720` na raiz e `anonymous:anonymous-backend` em
`packages/backend/.env.local` durante a implementação. Esses registros não
autorizam publicar nem comprovam qual é usado no site. Execute a partir da raiz
com seleção explícita do deployment, sem imprimir chaves. Gere snapshot conforme
o processo de operação existente antes de mudar dados reais.

Depois de configurar variáveis e autorizar o rollout:

1. Publicar o backend no deployment escolhido (inclui o componente rate-limiter).
2. Executar a mutation interna `users:backfill` com `{"cursor":null}`. Ela processa
   100 registros por lote e agenda continuação. Confirmar término nos logs.
3. Executar `users:importAuthUsers` com `{"cursor":null}`; processa 50 contas por
   lote e agenda continuação. Confirmar término antes de liberar a interface.
   Repetir é seguro; registros já vinculados e pré-cadastros são preservados.
4. Publicar a web apontando para o mesmo deployment, invalidando o shell antigo
   pelo fluxo normal da PWA. Durante a troca, clientes antigos podem precisar
   recarregar para registrar contas que existiam somente no provedor Google.
5. Abrir `/gestao-acesso` e testar login/senha/código, logout e expiração.
   A interface informa indisponibilidade se faltar configuração; não há senha padrão.
6. Homologar com uma conta antiga, uma nova pendente e uma conta desativada.
   Conferir aprovação e revogação em outra aba, edição editorial e administração
   de uma comunidade específica. Conferir que o menu público não mostra o painel.

`convex codegen` gera tipos e valida o pacote em modo de geração, sem finalizar
deploy. Não confundir sua mensagem de upload para análise com publicação concluída.

## Operação cotidiana

- Criar usuário prepara nome/e-mail e acesso inicial. Google vincula apenas o
  e-mail verificado correspondente; o painel não cria senhas de participantes.
- Buscar usa prefixo de nome ou e-mail e situação; páginas de 25 registros.
- Editar altera nome e permissão editorial. E-mail é imutável para evitar trocar
  a identidade vinculada. Aprovar/Reativar são ações explícitas.
- Desativar pede confirmação, preserva todos os dados e impede acesso após novo
  login. Não é exclusão definitiva. Antes de desativar o último administrador
  ativo de um grupo, conceda esse papel a outro participante aprovado.
- Comunidades permite conceder/remover participação e papel admin por grupo.
- Desligar aprovação afeta apenas novos cadastros. Não aprova pendentes nem reativa
  contas desativadas.
- A permissão editorial libera o menu de gestão conectado, com cadastro manual,
  edição e retirada usando licença, responsável e motivo. O seletor da Bíblia
  SQLite e o corpus local não foram migrados para o Convex por esta feature.

## Sessões, tentativas e recuperação

Sessão administrativa de 30 minutos; recarregar a página exige nova entrada.
O token não é guardado em localStorage, URL ou cookie de terceiros. Sair revoga o
token no servidor; sem rede, ele deixa a memória local e expira no servidor no
prazo máximo da sessão. Não há renovação automática.

Há limite global do proprietário de cinco tentativas iniciais, repondo uma por
minuto. Tentativas com falha também consomem o limite. A proteção pode temporariamente
impedir a entrada do proprietário sob abuso; não substitui proteção de rede do
provedor. Cada código TOTP só pode gerar uma sessão: espere o próximo para entrar
em outro navegador. Relógio do autenticador deve estar sincronizado.

Perda de autenticador/senha: operador com acesso ao dashboard gera novo conjunto
pelo script, preservando o arquivo anterior em local privado antes de criar outro,
configura as novas variáveis e reinscreve o autenticador. Rotação de qualquer
credencial invalida sessões anteriores na próxima operação. Recuperação exige
acesso operacional ao Convex; não há redefinição por e-mail ou códigos de recuperação.

Metadados administrativos e contas desativadas são conservados até decisão de
retenção do responsável. Não são incluídos senhas, códigos ou tokens no histórico
administrativo. Dados já copiados por um participante não podem ser recolhidos.

## Fontes técnicas consultadas em 09/10/2026

### Editorial conectado — revisão 013

A permissão editorial abre a listagem e o cadastro integrado à leitura bíblica.
Novos devocionais exigem uma data livre atual/futura e seleção ARC1911. Texto,
referência, tradução, autoria e Brasília 00:00 são derivados. Reflexão e oração
têm 512 caracteres. Publicações antigas continuam legíveis; para salvar uma
correção com texto maior, o editor deve reduzi-lo explicitamente. O motivo da
criação é automático; correções/retiradas exigem justificativa administrativa,
sem exibi-la ao leitor. Retirada conserva o registro e reserva sua data.

O rollout da 013 exige backend e web compatíveis: `editorialAccess:get/calendar`
são novos, `save` passa a receber seleção e conteúdo editorial, e o schema recebe
`devotionals.selection` opcional. Planejar a atualização do backend antes da web,
com intervalo controlado, pois o formulário anterior envia argumentos removidos.
Verificar login editorial, calendário, seleção, publicação/correção/retirada em
homologação e conservar os artefatos anteriores para recuperação. Nenhum deploy
foi autorizado nesta rodada: revisar as mudanças antes de publicar.

O build importa o JSON aprovado em `.data/bibles/corpus.sqlite` e gera os assets
bíblicos públicos a partir dele; não enviar esse SQLite ao Convex. O backend
empacota o JSON original como fonte confiável para reconstruir a citação.

- [Better Auth 2FA](https://better-auth.com/docs/plugins/2fa): TOTP e tratamento
  da chave como segredo. Implementação usa `@better-auth/utils` 0.4.2 instalado,
  sem habilitar cadastro público por senha nem reutilizar login Google como 2FA.
- [Convex rate-limiter](https://github.com/get-convex/rate-limiter): componente
  transacional e necessidade de preservar consumo mesmo quando a operação falha.

Homologação real com Google, aplicativo autenticador e publicação é distinta dos
testes automatizados. Consultar as tasks para o estado de cada verificação.
