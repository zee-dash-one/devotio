# 11 — Artes compartilháveis do devocional, geradas uma vez no servidor

**Status:** implementação concluída em 2026-10-26; release e homologação em dispositivos pendentes.
**Branch de implementação:** `feat/devotional-share-images` (tarefas 10 e 11 juntas, a pedido do Hil).
**Escopo:** domínio, renderização Node, armazenamento Convex, adaptador SQLite e web/PWA. Backend antes da web.
**Relação com a [10](./10-referencia-abre-biblia.md):** estudo e backend independentes; integrar a tela após a correção do link para reduzir conflitos.

## Objetivo e decisões já dadas pelo Hil

O devocional do dia é o mesmo para todos. O servidor prepara e armazena as imagens; cada pessoa escolhe uma arte pronta e compartilha o mesmo arquivo. O volume de pessoas não deve multiplicar a geração.

Conteúdo mínimo já registrado: data, referência bíblica, Meditar e Oração, sem transcrever o texto bíblico. O Hil pediu considerar tamanhos, formatos e artes diferentes. Comunidades, app nativo e metadados `og:image` continuam fora desta entrega.

**Uma vez** significa uma vez por combinação de revisão do conteúdo, tamanho, arte, composição e versão do renderizador. Correção editorial ou alteração de template pode exigir nova geração. Falhas podem repetir trabalho; a publicação do resultado deve ser idempotente.

## Experiência proposta

1. O botão de compartilhar no topo oferece **Texto** e **Imagem**. Hoje ele chama o compartilhamento de texto diretamente; não existe ainda uma galeria de imagens.
2. Imagem abre um painel com tamanho, arte e prévia da opção selecionada. Mostrar a data e, se houver várias páginas, sua ordem e quantidade.
3. O arquivo da escolha é baixado enquanto a prévia aparece. O botão Compartilhar só fica disponível quando o arquivo estiver pronto; a leitura do devocional continua independente.
4. O próximo toque chama `navigator.canShare({ files })` e `navigator.share({ files })` diretamente, sem esperar fetch ou renderização nesse clique. Compartilhar somente os arquivos; o texto e a marca necessários ficam na imagem.
5. Oferecer **Baixar imagem** sempre. Sem suporte a arquivos, apresentar download/prévia para salvar. Cancelamento voluntário não inicia download nem mostra erro.
6. O sistema operacional escolhe quais aplicativos aparecem. Não prometer abertura direta no Instagram, publicação em Stories ou carrossel automático. Com várias páginas, validar o conjunto de arquivos; se não aceito, oferecer cada página separadamente.

Abrir a leitura não baixa o catálogo inteiro. Abrir o painel prepara a opção padrão; trocar a escolha prepara só a nova opção. Reutilizar o mesmo Blob na prévia e no compartilhamento, com cache de memória limitado por revisão/variante, cancelamento de fetch antigo e liberação de object URLs. Isso reduz tráfego de quem apenas lê o devocional.

## Catálogo inicial recomendado para revisão visual

| Tamanho | Dimensões propostas | Uso pretendido |
|---|---|---|
| Vertical | 1080 × 1920, 9:16 | Status/Stories, conforme o destino escolhido |
| Retrato | 1080 × 1350, 4:5 | Publicações verticais |
| Quadrado | 1080 × 1080, 1:1 | Opção compacta e versátil |

Duas artes para começar: **Papel claro**, próxima à identidade atual; **Verde escuro**, com tipografia clara e contraste adequado. São templates determinísticos com fontes/elementos próprios ou licenciados. O texto vem do editorial; nenhuma IA é necessária para gerar a arte a cada dia.

Proposta: três tamanhos × duas artes = **seis variantes por revisão**. Com uma página por variante, são seis imagens finais para todos os usuários. A prova técnica começa com apenas uma variante; os seis exemplos reais do mesmo conteúdo devem ser revisados antes da integração completa.

Separar tamanho/proporção de formato do arquivo: começar com **PNG**, apropriado ao protótipo tipográfico; medir qualidade e bytes antes de decidir JPEG. Não produzir PNG, JPEG e WebP de cada arte por padrão. Miniaturas adicionais só se melhorarem a escolha e o orçamento justificar.

## Conteúdo longo e escolhas ainda propostas

| Item anterior | Recomendação para o primeiro lançamento | Estado |
|---|---|---|
| D1 — tamanhos | Três tamanhos e duas artes, após validar uma variante | Proposta para aprovação visual |
| D2 — identidade | Marca Devotio e URL pública discretas; data e referência legíveis | Proposta |
| D3 — composição | Meditar + Oração + referência em composições fixas; sem editor livre nem canvas no navegador | Recomendação alinhada à geração compartilhada |
| D4 — texto longo | Preservar conteúdo e dividir em páginas numeradas; nunca cortar silenciosamente ou reduzir a letra até ficar ilegível | Proposta; validar com exemplos longos |
| D5 — retenção | 30 dias após a data editorial para arquivos ativos; remover versões substituídas e arquivos órfãos antes disso | Proposta a confirmar após medir volume |

Para D4, propor limite operacional de dez páginas por variante, aferido com os textos reais. Se não couber com o tamanho mínimo de fonte aprovado, sinalizar ao editorial e não publicar aquela revisão de imagens incompleta. A leitura em texto continua disponível. Não resumir automaticamente a meditação. Páginas e limite de fonte precisam de revisão visual, não apenas testes de strings.

A primeira entrega atende o devocional publicado do dia. Favoritos são snapshots pessoais: não reutilizar uma imagem editorial atual apenas por ter a mesma data de um favorito antigo. Galeria histórica e exportação de favoritos exigem decisão própria. Retenção de arquivos não amplia a janela de leitura do app.

Cache: HTTP do navegador e memória do painel, respeitando os cabeçalhos efetivos. Manter o service worker restrito ao shell, conforme regra vigente; não depender de novo cache offline para entregar esta funcionalidade.

## Arquitetura recomendada

`Editorial salva → identifica revisão → agenda geração → renderizador Node → File Storage → manifesto de imagens → web escolhe e compartilha`

### Responsabilidades e integração

- **Domínio:** conteúdo exportável, ordenação de blocos/páginas, catálogo de variantes, validação e dados canônicos usados no hash. Sem Satori, DOM, canvas ou bibliotecas de imagem no núcleo compartilhado.
- **Renderizador Node:** Satori para SVG e resvg WASM para PNG como primeira hipótese. Templates, medição de texto, fontes Lora/Inter e desenho ficam no módulo de renderização do backend, reaproveitável pelo servidor local.
- **Convex:** agendamento, controle das revisões, gravação dos arquivos, permissões, manifesto e limpeza. Queries/mutations em módulo separado da action marcada `"use node"`.
- **Web:** escolhas, prévia, estado de carregamento e entrega do File ao sistema.

Convex instalado: **1.46.0**, conferido em `node_modules/convex/package.json`. A documentação online pode ser mais nova: a prova deve validar bundle e runtime com essa versão antes de propor atualização de dependências.

### Dados e geração confiável

Propor uma tabela `devotionalImageSets` por devocional/revisão, com índice composto, estado `pending | rendering | ready | failed | obsolete`, tentativas, identificador da execução, timestamps e manifesto dos arquivos. Registrar essa tabela em `docs/architecture.md` quando o desenho for aprovado e implementado. O devocional recebe apenas referência/revisão opcional do conjunto desejado; contratos antigos continuam válidos.

A chave inclui os campos realmente desenhados, catálogo habilitado, fontes/assets e versão de layout. Não usar apenas `updatedAt`, pois alterações administrativas sem efeito visual não precisam regenerar imagens. Cálculo deve ser determinístico e compatível com o runtime da mutation; não importar `node:crypto` numa mutation do runtime padrão.

1. A mutation editorial identifica/reutiliza a revisão e agenda somente se ainda não houver trabalho pendente ou pronto para ela. Índice e decisão dentro da mesma transação evitam dois jobs por saves simultâneos.
2. A action reivindica o job por mutation, lê um snapshot da revisão e processa variantes em sequência ou pequenos lotes. Renderização não bloqueia a mutation editorial.
3. Cada arquivo armazenado é registrado como temporário no job. Publicar o manifesto somente quando o conjunto estiver completo e ainda corresponder à revisão atual, sem retirada do devocional.
4. Resultado obsoleto é descartado e seus arquivos removidos. Em correção editorial, a imagem da revisão antiga deixa de ser oferecida até a nova ficar pronta, evitando compartilhar conteúdo desatualizado como atual.
5. Implementar tentativas limitadas com espera crescente, por exemplo três, e ação editorial de tentar novamente. Actions agendadas não recebem a garantia de retry automático das mutations.
6. Um job de recuperação identifica execução interrompida/expirada e não deixa `rendering` preso. Usar identificador de tentativa e prazo de posse para que uma execução antiga não publique depois da substituta.
7. Limpeza diária cobre conjuntos obsoletos, temporários e vencidos, em lotes por índice. Uma falha entre upload e registro pode deixar órfão: conferir o inventário de storage com margem de tempo, sem apagar arquivos de jobs ainda ativos ou de outros usos futuros.

O botão de compartilhar não agenda renderizações públicas por usuário. O custo de renderização cresce com revisões e variantes; o tráfego de download cresce com uso.

### Liberação, retirada e URLs

Gerar antecipadamente ao salvar um devocional agendado, mas só devolver o manifesto após a liberação editorial, enquanto não estiver retirado. A query deve ler o devocional e sua revisão corrente, sem expor conjuntos futuros, obsoletos ou privados. Reutilizar `editorial.release` para invalidar subscriptions na hora da liberação: `Date.now()` sozinho não dispara atualização reativa.

URLs diretas do Convex permitem acesso a qualquer pessoa que tenha o endereço. Isso atende à distribuição de artes já publicadas, mas a URL não é uma barreira de autenticação. Não expor URLs futuras por endpoints de listagem ou logs públicos. Se houver necessidade de autorizar cada download, usar endpoint autenticado em vez de URL direta.

Retirada deve ocultar o manifesto imediatamente, invalidar jobs pendentes e agendar exclusão dos arquivos. Apagar apenas o campo no banco não revoga uma URL já emitida. Arquivos já baixados ou enviados para terceiros não podem ser recolhidos; caches também precisam ser considerados na política de retirada.

### Infraestrutura e modo local

Começar no Convex já usado pelo app; não adicionar serviço independente de renderização ou bucket R2 antes de medir. Satori + WASM ainda é hipótese, não compatibilidade comprovada neste projeto. Caso o bundle/runtime não suporte a solução, avaliar pacote nativo externalizado; só então um renderizador externo. A arquitetura de catálogo/manifesto fica estável nessa troca.

Não presumir que `fs.readFile(node_modules/...)` funcionará no deployment. A prova deve demonstrar como fontes, WASM e imagens de fundo chegam ao runtime, com caminhos empacotados e licença documentada. Usar assets confiáveis e fixos, sem URLs arbitrárias trazidas pelo usuário.

No modo SQLite, reutilizar o renderizador no servidor Node de desenvolvimento, gravando arquivos em pasta ignorada e metadados no banco local. Trabalho pesado assíncrono/worker preserva a resposta HTTP. Assim os testes locais exercitam geração de servidor e reutilização de arquivos, sem criar um segundo renderizador no navegador. Antes de integrar o renderer, fixtures locais podem representar estados e manifesto, identificadas como fixtures e excluídas do build público.

## Sequência eficiente de execução

| Etapa | Entrega verificável | Dependência |
|---|---|---|
| A — Especificar | Registrar direção confirmada e propostas aprovadas na spec 001; catálogo e política de texto longo | Revisão deste plano |
| B — Provar uma imagem | Conteúdo curto e longo, acentos, fontes, PNG e bundle do Convex; medir bytes, duração e memória | A; sem depender da 10 |
| C — Revisar seis exemplos | Mesmo devocional nos três tamanhos e nas duas artes; examinar legibilidade, paginação e margens | B e revisão visual do Hil |
| D — Persistir e reutilizar | Job, storage, manifesto, estados, retry, limpeza e adaptador local | B; catálogo aprovado em C |
| E — Integrar web | Texto/Imagem, escolha, prévia, File pronto, compartilhar/baixar, tratamento de cancelamento | D; reconciliar a tela com a 10 |
| F — Homologar e liberar | Dispositivos reais, orçamento, backfill controlado e release backend antes da web | C–E |

Não instalar bibliotecas, produzir artes ou executar esta sequência durante a revisão documental. A spec registra os requisitos aprovados antes do código; não marcar os exemplos ou a compatibilidade como já validados.

## Orçamento sem prometer cota gratuita

Medir bytes dos arquivos finais, páginas, eventuais miniaturas, tempo por revisão e downloads. Confirmar o plano/cotas do time; não inferir o custo apenas pela quantidade de imagens geradas.

Exemplo **hipotético**, em unidades decimais: seis variantes × uma página × 500 kB × 30 dias = **90 MB** de armazenamento. Dez mil downloads de 500 kB = **5 GB** de transferência. Se cada variante tiver quatro páginas, o armazenamento quadruplica. Pré-carregamentos, retries e previews também trafegam bytes, mesmo sem compartilhamento concluído.

Só avaliar CDN/R2 ou novo codec se as medições justificarem. Retenção e número de variantes devem ter limites configurados; não habilitar cobrança adicional automaticamente.

## Validação e aceite

- [ ] Aprovar catálogo visual, marca/URL, paginação e retenção; atualizar spec 001 sem declarar aprovada uma recomendação apenas por estar neste plano.
- [ ] Provar renderer/fontes/WASM no runtime e versão reais, com conteúdo curto, longo e acentos. Registrar métricas e artefatos.
- [x] Salvar sem mudança e salvar concorrentemente reaproveitam a mesma revisão; abrir/compartilhar nunca gera novos arquivos.
- [x] Editar durante render, retirar durante render, falhar após upload e recuperar execução interrompida não publicam revisão errada nem deixam jobs presos.
- [x] Nenhuma URL futura vaza; horário de liberação atualiza a web; exclusão de arquivo invalida a URL de origem.
- [x] As seis variantes usam o mesmo conteúdo e cada página mantém ordem, data, referência e legibilidade. Sem corte silencioso.
- [x] Downloads limitados à escolha; sem buscar seis imagens grandes a cada leitura; memória e object URLs liberadas ao sair/trocar.
- [x] Compartilhamento exige arquivo pronto, ação do usuário e HTTPS; cancelamento não baixa arquivo. Fallback explícito funciona por página e com erro de rede.
- [ ] iPhone Safari/PWA e Android Chrome/PWA: confirmar envio real para WhatsApp, destinos disponíveis e salvar. Desktop: compartilhar quando suportado ou download. Não considerar jsdom homologação do sistema operacional.
- [x] SQLite local usa contrato e renderização de servidor equivalentes; favoritos não recebem por engano imagem de revisão diferente.
- [x] Testes significativos de domínio/backend/web, lint, typecheck, `verify:local` e `build:ready` passam.
- [ ] Medir custo projetado e obter acordo sobre retenção antes de habilitar geração automática.

## Release e recuperação

PRs de implementação por escopo/tarefa, a partir da main atualizada, conforme [AGENTS.md](../../AGENTS.md). Previews de branch usam o backend do piloto: não são ambiente isolado para ensaios destrutivos. Prova local primeiro; deployment de teste isolado quando necessário e autorizado.

1. Publicar backend compatível no piloto `upbeat-jellyfish-720` mediante autorização; não usar `deploy:backend:prod` nem `npx convex deploy` para esse piloto.
2. Executar ação interna idempotente para garantir as imagens do dia e dos agendamentos abrangidos pela política, com simulação/listagem de IDs antes do lote. **Preferir essa ação a salvar editorialmente de novo**, evitando auditorias/publicações falsas só para gerar imagens.
3. Conferir manifesto, arquivos e compartilhamento no preview HTTPS com o backend atualizado.
4. Merge autorizado publica a web pelo Cloudflare. Registrar SHA, deployment e resultado.
5. Se houver falha, desabilitar o recurso de imagens e novas gerações; preservar leitura/compartilhamento por texto. Ajustar jobs antes de tentar novamente.

Checklist do PR de implementação:
- [ ] Backend: run npm run deploy:backend before merging (pilot upbeat-jellyfish-720).
- [ ] Generate and verify today's image set before enabling the image share UI.
- [ ] Record native-device acceptance and the measured storage/egress budget.

## Fontes e evidências — consultadas em 25/10/2026

- [Satori oficial](https://github.com/vercel/satori): renderização SVG e fontes fornecidas em bytes; suporte deve ser conferido na versão escolhida.
- [resvg WASM oficial](https://github.com/thx/resvg-js/tree/main/wasm): candidato para rasterização PNG, ainda não validado no Convex do projeto.
- [Convex bundling](https://docs.convex.dev/functions/bundling): empacotamento e pacotes externos; conferir a API instalada 1.46.0 antes de assumir recursos atuais da documentação.
- [Convex arquivos](https://docs.convex.dev/file-storage/serve-files): URLs são acessíveis a quem as possui; alternativa de HTTP action autenticada.
- [Convex agendamento](https://docs.convex.dev/scheduling/scheduled-functions): diferenças de garantia entre mutations e actions.
- [Web Share — W3C](https://www.w3.org/TR/web-share/): compartilhamento de arquivos, validação de suporte e necessidade de ativação do usuário; destinos definidos pelo sistema.

## Registro da revisão

- Leitura de tarefas, regras e fontes do app; consulta Graphify limitada usada como mapa e conferida no código.
- Inspeção de `editorial.publish/release/withdraw`, `home.get`, `watchHome`, tela de leitura, tipos e `shareText`: concluída. Nenhuma alteração de código.
- Leitura da versão instalada e de `node_modules/convex/src/server/storage.ts`: APIs de store/getUrl/delete disponíveis. Não equivale a validar o renderizador.
- Documentação oficial consultada; endpoints Markdown de serve-files e scheduled-functions indisponíveis pela ferramenta, páginas HTML acessíveis.
- PR documental em rascunho: https://github.com/zee-dash-one/devotio/pull/13. Nenhum teste de aplicação, consulta de dados do piloto, instalação ou deploy realizado nesta revisão.

- Verificação documental: todos os links locais dos três arquivos resolvem; `git diff --check` passou. Código e infraestrutura não foram alterados.
- `git commit` da revisão, `git push -u origin docs/devotional-image-sharing-plan` e `gh pr create --draft`: concluídos; PR #13 aberto para revisão do plano.

## Implementação — 25/10/2026

Hil autorizou implementar as duas tarefas na branch `feat/devotional-share-images`, com arte básica substituível agora. Adotados os recortes e padrões do plano; acabamento da arte será posterior.

- `git fetch origin main`, `git switch main`, `git pull --ff-only origin main`: sucesso, base atualizada.
- `git switch -c feat/devotional-share-images`; `git cherry-pick 91d6a86 0219414`: sucesso, plano preservado.
- Leitura de regras, planos, contratos e fontes: concluída.
- Instalação de Workpool, resvg e fontkit: sucesso. Uma tentativa posterior parou por limite do serviço de revisão automática; retomada a pedido do Hil.

## Resultado da implementação — 26/10/2026

Implementação concluída na branch feat/devotional-share-images. Publicação do backend, preparação das imagens no piloto e homologação física continuam pendentes do Hil, conforme o [procedimento de release](../../docs/operations/devotional-images.md). O PR reúne as duas tarefas conforme autorização explícita do Hil.

- npm run test --workspace=domain -- --maxWorkers=1 --testTimeout=15000: sucesso, 105 testes.
- npm run test --workspace=backend -- --maxWorkers=1 --testTimeout=30000: sucesso, 87 testes.
- npm run test --workspace=web -- --maxWorkers=1 --testTimeout=15000: sucesso, 78 testes.
- npm run build:ready: sucesso, lint, typecheck, build e conferência do pacote público.
- npm run verify:local e node scripts/verify-devotional-images.mjs: sucesso, incluindo autenticação, seis variantes e reutilização dos mesmos bytes PNG.
- node scripts/preview-devotional-images.mjs: sucesso; oito PNGs nas seis variantes, 965970 bytes, 2719 ms no exemplo local. Conferência visual detectou e corrigiu um título órfão antes da paginação.
- npx convex dev --once --debug-bundle-path .data/convex-image-bundle --typecheck disable --env-file <seletor público temporário>: sucesso; empacotamento diagnóstico encerrou antes de qualquer push. Não comprova execução remota.
- Falhas intermediárias corrigidas: versão inicial de Workpool incompatível com APIs disponíveis nos testes; isolamento de componentes no convex-test antigo; dependência nativa do resvg não externalizada na raiz; fixtures/tipos e showModal ausentes nos testes. Todas as suítes acima passaram após as correções.
- Primeiro verify:local encontrou o modo conectado; reinício do Vite com variáveis apenas do processo selecionou o modo SQLite e a verificação passou. Nenhum arquivo de ambiente foi alterado.
- git diff --check: sucesso. Arquivos gerados, bancos e imagens de exemplo permanecem locais e ignorados.

O renderer final usa fontkit + resvg nativo, com fonte incorporada e licença OFL; substitui a hipótese inicial de Satori/WASM. Artes básicas substituíveis, três tamanhos e dois estilos; revisão por hash, fila serial, recuperação e retenção de 30 dias. Compartilhamento nativo depende do suporte do navegador; download permanece disponível.

- npm install --save-dev --save-exact esbuild@0.27.0: sucesso; dependência dos scripts declarada explicitamente, sem mudar a versão instalada.
- Commits separados: 4eca879 (referências), b9d309b (domínio/backend/local), e9b415b (web).
