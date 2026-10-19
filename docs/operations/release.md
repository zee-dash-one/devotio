# Publicação e operação do piloto

## Preparação da spec 014 (19/10/2026)

Não houve publicação nesta implementação. Após revisão do usuário, publicar
backend compatível antes da web: `social` introduz funções públicas autenticadas
e cinco tabelas aditivas (`friendCodes`, `friendships`, `scriptureShares`,
`shareViews`, `shareMarkers`). Não há backfill: relações começam vazias.
Não executar deploy automaticamente. Ao voltar à web anterior, conservar as
tabelas e dados sociais; não removê-los em rollback de schema.

Homologar com três contas aprovadas e uma pendente/desativada: convite/aceite,
comunidade em comum, envio para dois destinatários, recebimento sem lista alheia,
remoção, retry, paginação e marcações na edição correta. Verificar telas pequenas,
zoom, teclado, foco do modal e atualização PWA. Conferir que web e Convex apontam
para o mesmo deployment e que fixtures não entraram no build.
[Guia de uso](../product/friends-and-sharing.md) e [acesso administrativo](user-administration.md).

**Situação:** roteiro de preparação; nenhum deploy foi feito nesta revisão. Dependências de produto novas estão na spec 004, ainda em rascunho.

## 1. Portões de lançamento

| Portão | Evidência necessária | Estado |
|---|---|---|
| Produto | Decisões da spec 004, público e provedor de acesso aprovados | Pendente |
| Conteúdo | Tradução autorizada, responsáveis e material revisado | Pendente |
| Backend | Configuração Convex oficial, geração real e auth integrada | Pendente |
| Permissões | Chamadas diretas negadas para anônimo/não membro/membro sem papel | Pendente |
| Dados | Sem demos, duplicações ou vazamento de rascunhos | Pendente |
| UI/UX | Dois fluxos completos; erros/vazio/rede/zoom/teclado verificados | Pendente |
| PWA | Instalar, atualizar e ficar offline sem expor dados privados | Pendente |
| Qualidade | Lint real, typecheck, testes e build em ambiente reproduzível | Pendente |
| Operação | Plano Free confirmado, quotas, backup/restauração e rollback ensaiados | Pendente |
| Privacidade | Aviso público, contato, retenção e pedidos de exclusão definidos | Pendente |

## 2. Ambientes e configuração

Desenvolvimento local → homologação com dados fictícios → produção com conteúdo aprovado. Não compartilhar contas, convites ou registros pessoais entre ambientes. Homologação não conecta ao banco de produção.

| Configuração planejada | Onde | É segredo? |
|---|---|---|
| VITE_CONVEX_URL | Build web do ambiente | Não; endpoint público |
| VITE_CONVEX_SITE_URL / VITE_SITE_URL | Build web para integração auth | Não; URLs públicas |
| CONVEX_DEPLOYMENT | Ferramentas locais | Identificador; não publicar configuração interna sem necessidade |
| BETTER_AUTH_SECRET | Ambiente Convex | Sim |
| Credenciais OAuth do provedor | Ambiente Convex | Segredo do provedor nunca no client |
| SITE_URL / trustedOrigins | Auth backend | Não, mas devem ter lista restrita por ambiente |
| Credencial de deploy Convex | Segredo da automação/operador | Sim |
| DEV_BYPASS_AUTH | Somente experimentação isolada | Proibido em produção; validar ausência |

Nomes definitivos de OAuth e arquivos de configuração serão estabelecidos na implementação. Tudo com prefixo `VITE_` é exposto no build. Não colocar token de deploy, chave de admin ou segredo OAuth ali.

## 3. Sequência de publicação planejada

1. Fechar os portões acima e registrar responsável pela liberação.
2. Confirmar configuração das funções Convex no diretório real `packages/backend`, dependências compatíveis e código gerado oficial.
3. Executar os checks do [guia de desenvolvimento](../engineering/development.md) em homologação.
4. Publicar backend compatível com a interface anterior. Configurar auth/origens/callbacks e verificar usuário sem privilégio.
5. Configurar Pages com raiz do repositório, build `npm run build` e saída `apps/web/dist`. Fixar Node/npm e fornecer somente variáveis públicas ao build.
6. Validar link direto/refresh das rotas da SPA, fallback, HTTPS, manifest e service worker antes de enviar o link a convidados.
7. Testar login/logout e retorno OAuth no subdomínio final, em Safari iOS e Chrome Android. Não depender de localhost autorizado.
8. Publicar conteúdo revisado pelo processo interno validado; conferir data, crédito e autoria.
9. Fazer um teste completo com AG, membro e usuário de outro grupo; abrir piloto limitado.
10. Acompanhar custos e erros diariamente na primeira semana. Expandir somente com evidência.

Este é um procedimento alvo: scripts de deploy, CI, manifest e auth ainda precisam ser implementados. Não executar uma receita de deploy como atalho para ignorar os portões.

## 4. Validação mínima

- Login cancelado/expirado; logout e troca de conta sem resíduo de comunidade.
- Sem devocional hoje, áudio ausente, URL de áudio com falha e rede indisponível.
- Virada de data, retomada após suspensão e fuso diferente.
- Convite inválido, repetido e tentativa de enumeração; não vazar membros por código.
- AG A não administra grupo B; membro não escreve no mural; usuário removido perde acesso.
- Tick só do titular, atualização repetida/concomitante sem duplicação e agregado sem nomes.
- Datas duplicadas, singleton duplicado e acesso antecipado a conteúdo futuro.
- PWA desatualizada versus backend novo; teclado, leitor de tela, zoom e barra fixa.

Testes de regras em domain não substituem testes de autorização nas funções reais.

## 5. Recuperação

Antes de migrar dados, exportar snapshot usando ferramenta oficial compatível com o plano e verificar restauração em ambiente separado. Registrar data, versão do schema e responsável. Armazenar cópias fora do Git com acesso restrito; prazo de retenção depende da decisão de privacidade.

Para regressão de frontend, voltar ao deployment estático anterior e invalidar/versionar o cache da PWA. Não presumir que rollback do frontend reverte banco ou backend. Preferir migrações aditivas; ensaiar retorno de código e compatibilidade dos dados.

Se houver exposição indevida, interromper o acesso afetado, preservar evidências técnicas sem ampliar cópias de dados pessoais e acionar o responsável definido na política. Se a falha for cota, reduzir consumo e comunicar indisponibilidade; não habilitar faturamento automaticamente.

## 6. Rotina e responsáveis

| Frequência | Ação | Papel |
|---|---|---|
| Antes de cada publicação editorial | Revisão, licença, data e visualização | Editorial |
| Diário na primeira semana | Uso, falhas de auth, conteúdo disponível | Operação |
| Semanal depois | Cotas, feedback de leitura e reserva editorial | Operação + produto |
| Antes de cada release | Checks, snapshot quando aplicável, teste e rollback | Engenharia |
| Ao mudar serviço/preço/licença | Rever custos, termos e ADR | Responsável do projeto |

Uma pessoa pode acumular papéis; nomes e contato devem ser registrados antes do piloto.
