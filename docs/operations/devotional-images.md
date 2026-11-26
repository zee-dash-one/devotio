# Imagens do devocional — operação

## O que foi implementado

O editorial agenda uma geração por SHA-256 do conteúdo desenhado e versões de layout/fonte/fundo. A fila Workpool 0.3.1 executa um conjunto por vez, com três tentativas. O leitor recebe o manifesto somente para a revisão corrente, publicada e não retirada, do dia em São Paulo. Abrir ou compartilhar nunca agenda trabalho público.

O renderizador Node usa fontkit para medidas e contornos da fonte Lora e resvg 2.6.2 para PNG assíncrono. Isso permite paginação por largura real e dispensa carregar fontes da rede ou do filesystem do deployment. A fonte está empacotada em rendering/font.data.ts; sua licença SIL OFL acompanha o código. O fundo SVG básico é próprio. Não há serviço externo de imagens ou IA.

Três tamanhos, duas paletas, PNG, até dez páginas por variante. A referência e a data aparecem em cada página. Meditar e Oração são preservados; texto excedente ou caracteres não cobertos pela fonte causam falha explícita, sem truncamento. A arte final será refinada posteriormente, conforme pedido do Hil.

## Preparar localmente

1. Rode npm ci e npm run setup:local quando estiver preparando este checkout.
2. Rode npm run dev no modo local já configurado (sem URLs Convex no ambiente). O Vite abre SQLite e agenda as imagens existentes, uma vez por revisão.
3. Entre com um perfil local. No devocional do dia, toque Compartilhar → Imagem.
4. Escolha tamanho e arte. Aguarde a prévia; compartilhe se o dispositivo suportar arquivos ou use Baixar imagem.
5. Arquivos locais ficam em .data/devotional-images e o manifesto em devotionalImageSets no SQLite. A limpeza local roda na inicialização; correções e retiradas invalidam os arquivos imediatamente. O processamento PNG é assíncrono.

Para produzir exemplos sem abrir o app: node scripts/preview-devotional-images.mjs. A saída em .data/image-preview é ignorada pelo Git. Use os exemplos para revisar mudanças de layout e conferir metrics.json.

## Publicar pelo PR

O backend do piloto é dev:upbeat-jellyfish-720, no projeto adm-zone:devotio-pilot. O backend precisa subir antes do merge, pois a main publica a web automaticamente. Os campos novos são opcionais; a web antiga continua funcionando.

1. Na branch do PR, rode npm ci e npm run build:ready.
2. Hil publica o backend com npm run deploy:backend, confirmando que o CLI mostra upbeat-jellyfish-720. Não use deploy:backend:prod para o piloto.
3. Simule a preparação do dia: node scripts/prepare-devotional-images.mjs. Para outras datas, acrescente AAAA-MM-DD ao comando (até 31).
4. Confira os IDs/datas e aplique: node scripts/prepare-devotional-images.mjs --apply. Isso cria/reutiliza conjuntos de imagens; não cria eventos editoriais nem republica o texto. O script fixa explicitamente o alvo do piloto e transmite JSON sem problemas de aspas do PowerShell.
5. No preview HTTPS do PR, abra o devocional, confira prévias e downloads. Em um telefone real, confira os destinos oferecidos e o envio do arquivo.
6. Depois dessa conferência, faça o merge do PR. O Cloudflare publica a web automaticamente. Nenhuma configuração de R2/CDN nem migração manual do banco é necessária.

O diagnóstico local do bundle usa convex dev --once --debug-bundle-path DIRETORIO_VAZIO --typecheck disable com seletor explícito do piloto. A versão 1.46.0 encerra antes do envio; esse diagnóstico não comprova execução Linux remota. O primeiro passo 5 acima confirma o runtime efetivo após o deploy autorizado.

## Trocar a arte

- Edite packages/backend/rendering/backgrounds.node.ts: paletas e elementos SVG confiáveis. Os fundos atuais não dependem de arquivos remotos.
- Mude a version da arte correspondente em packages/domain/devotional-images.ts. Se mudar composição ou fonte, mude IMAGE_LAYOUT_VERSION.
- Gere exemplos e confira margens/contraste/paginação. O renderer converte a fonte em contornos, mantendo o resultado independente das fontes do dispositivo.
- Publique backend e web na ordem acima, depois use o script de preparação para o dia e agendamentos afetados. O hash novo gera uma revisão nova para todos; abrir o painel continua só consumindo os arquivos existentes.

## Recuperação e retenção

A interface mantém leitura e texto disponíveis durante falhas. Gestores editoriais podem usar Preparar imagens novamente no painel do devocional. A mutation também pode ser acionada pelo dashboard como devotionalImages:retry, sujeita à autenticação editorial; operadores usam ensureDates pelo script interno.

A geração tem um número de geração e um número de tentativa. Uma tentativa antiga não pode registrar arquivos nem finalizar uma geração nova. Um registro de hash antes do upload permite localizar arquivos órfãos sem apagar arquivos de outras funcionalidades. A limpeza de órfãos é diária e paginada; estados interrompidos e vencimentos são conferidos a cada 30 minutos. Arquivos vencem 30 dias após a data editorial; revisões substituídas/retiradas têm seus arquivos removidos imediatamente. O cron diário invalida subscriptions na mudança de dia.

Para pausar novas gerações e ocultar manifestos, o operador pode configurar DEVOTIONAL_IMAGES_ENABLED=false no deployment do piloto. Trabalhos já iniciados podem terminar, mas os manifestos ficam ocultos. Para reativar, restaure true e prepare as datas necessárias. Alterações de ambiente/publicação são decisões do Hil.

Uma URL já publicada permite acesso a quem a possui. Retirada exclui o arquivo da origem; cópias baixadas/compartilhadas e caches de terceiros não podem ser recolhidos. Favoritos antigos não recebem imagens por coincidência de data: o manifesto exige a revisão exata do conteúdo.

## Medição e limites da validação

Exemplo local com acentos e referência Colossenses 1:3–23: seis variantes, oito arquivos (quadrado em duas páginas), aproximadamente 0,97 MB no total e 2,7 s na medição final. É medição local de um exemplo, não previsão de latência remota. Nessa ordem de grandeza, 30 revisões diárias ocupam cerca de 29 MB; dez mil downloads de uma página de 150 KB transferem cerca de 1,5 GB, além das prévias. Textos mais longos aumentam páginas e bytes.

O painel baixa somente a variante selecionada, limita a memória a 32 MiB/dez páginas e libera URLs/requests ao trocar ou fechar. O service worker mantém apenas o shell. Não foi habilitada cobrança adicional. Homologação física Safari/PWA no iPhone e Chrome/PWA no Android permanece com o Hil; testes jsdom não comprovam destinos do sistema operacional.

O pacote nativo resvg também está declarado na raiz: o CLI Convex 1.46 lê a lista de dependências externas no package.json ao lado de convex.json, mesmo em monorepo. O backend mantém sua dependência explícita. Convex-test 0.0.65 foi adotado para corrigir o isolamento das execuções de componentes nos testes; o runtime Convex permaneceu em 1.46.0.
