# Experiência e direção visual

**Direção:** um livro devocional contemporâneo, acolhedor e sóbrio. O conteúdo ocupa o centro; a interface oferece orientação sem disputar atenção. Este guia descreve o destino visual, não uma auditoria de conformidade do protótipo.

## 1. Princípios de composição

- Uma coluna de leitura, uma ação principal por contexto e hierarquia previsível.
- A beleza nasce de tipografia, proporção e espaço; não exige fotografias, animações elaboradas ou ilustrações pagas.
- Mostrar a informação inteira quando curta. Não transformar a reflexão em carrossel ou conteúdo desbloqueável.
- Separar citação bíblica, reflexão humana e sugestão de oração por títulos e tratamento tipográfico.
- Comunidade tem caráter de mural pastoral. Sem likes, seguidores, indicadores de popularidade ou badges.
- Instalar o app é opcional; a leitura funciona no navegador sem uma apresentação introdutória obrigatória.

## 2. Arquitetura da informação

**Revisão 014 (19/10/2026):** Bíblia exibe filtros e versículos, com título de
capítulo na rolagem contínua. Introdução, ornamento, instruções permanentes e
rodapé textual saem do leitor; fonte/edição ficam nas Configurações. Menu da conta
ganha Meu perfil e amigos, sem quarta aba principal. Convites e amigos são privados.
Envios usam seta e recebimentos envelope com contorno, agrupados pelo início do
trecho. Botões têm rótulos acessíveis, detalhes em modal e histórico paginado no
Perfil. O modal de envio conserva recado/destinatários em falha. O painel de
aprovação permanece fora da navegação pública e está documentado em operação.

```text
Acesso
└─ App
   ├─ Devocional (entrada padrão)
   │  ├─ Tema do mês / tema da semana
   │  ├─ Texto bíblico / reflexão / oração
   │  └─ Áudio quando disponível
   ├─ Comunidade
   │  ├─ Seletor de comunidade
   │  ├─ Escritura / mural
   │  ├─ Listas
   │  └─ Membros e gestão conforme papel
   └─ Menu discreto de conta
      └─ Sair / privacidade / ajuda / instalar quando disponível
```

Conforme a spec 006, o modo local possui três entradas: **Devocional**, **Bíblia**
e **Comunidade**. Devocional é a entrada padrão. Em celular, barra inferior com
ícone e rótulo; em desktop, navegação compacta no topo. O menu de conta mantém
ajuda, privacidade, saída/troca de perfil e editorial somente para o perfil autorizado.

URLs reais planejadas: `/devocional`, `/comunidade`, `/comunidade/$communityId`, subrotas `membros` e `listas`; acesso em `/entrar`. Links diretos preservam o destino após login. O histórico do navegador e o botão voltar devem funcionar.

## 3. Tela Devocional

Ordem de leitura: tema mensal compacto → tema semanal discreto → data → texto bíblico e referência → reflexão → oração. O áudio aparece como ação secundária perto da data, sem empurrar a Escritura para baixo com uma capa grande.

```text
┌──────────────────────────────────┐
│ Devotio                    Conta │
│ Tema do mês · referência         │  fixo, compacto
├──────────────────────────────────┤
│ Tema da semana                   │
│ Sexta-feira, 2 de outubro         │
│ Ouvir devocional  ▶               │  só se houver áudio
│                                  │
│ Palavra                          │
│ Texto bíblico completo…           │
│ Livro capítulo:versos · tradução  │
│                                  │
│ Reflexão                         │
│ Parágrafos curtos e confortáveis… │
│                                  │
│ Oração                           │
│ Uma sugestão, sem cobrança…       │
├──────────────────────────────────┤
│  Devocional        Comunidade    │
└──────────────────────────────────┘
```

A spec 001 exige o tema mensal fixo. Mantê-lo com altura contida, sem somar cabeçalhos altos; testar textos longos e zoom. Se o sticky prejudicar leitura ou esconder foco, propor revisão do requisito antes de substituir por uma faixa recolhível. Não truncar silenciosamente uma citação para fazê-la caber.

Sem título editorial novo obrigatório no schema: usar data, referência e títulos de seção. Não inventar uma saudação, “tempo de leitura” ou progresso como requisito do MVP.

## 4. Comunidade e acesso

Na Comunidade, o nome do grupo e o seletor ficam antes do mural. “Mural”, “Listas” e “Membros” são navegação local; não criar três novas abas globais. Mostrar as mensagens da página em ordem cronológica, com “Carregar anteriores” para o histórico. Não usar rolagem infinita no piloto.

Sem comunidade: explicar “Você ainda não participa de uma comunidade” e oferecer “Entrar com código”; “Criar comunidade” é secundário, preservando a spec 002. Na entrada, confirmar apenas o nome do grupo; não expor mural ou membros a quem ainda não pertence.

O AG vê ações editoriais junto à seção correspondente, evitando um painel cheio de botões no topo. Remoção de membro pede confirmação com nome e comunidade. Erros de envio preservam o texto digitado. Marcação de lista mostra estado de envio e reverte em falha, sem confete. A contagem agregada tem baixo destaque e não é placar.

Acesso proposto: marca, uma frase de propósito, “Continuar com Google” e link de privacidade. Cancelamento do provedor devolve à tela com opção de tentar novamente. Não exigir entrada em comunidade para ler o devocional. Provedor único depende da spec 004.

## 5. Sistema visual

Preservar a base de [tokens existentes](../../packages/ui-kit/tokens.ts); valores abaixo são referências de aplicação, não autorização para duplicá-los em componentes.

| Papel | Valor base | Aplicação |
|---|---|---|
| Papel | `#FBF9F5` | Fundo principal |
| Superfície | `#FFFFFF` | Formulários e blocos que precisam de separação |
| Texto principal | `#1C1917` | Escritura, reflexão e títulos |
| Texto secundário | `#57534E` | Data, referências e ajuda |
| Ação principal | `#292524` com texto `#FAFAF9` | Botões e progresso do player |
| Tema mensal | `#2A2825` com texto `#F5F2EB` | Faixa compacta |
| Oração | `#FBF5EC` com texto `#2C261E` | Bloco final, sem excesso de ornamento |
| Acento | `#8C6D3B` | Detalhes; verificar contraste antes de usar em texto pequeno |
| Borda | `#E5DFD5` | Separação decorativa, não único indício de controle |

Não assumir que todo par da paleta é acessível. O token `text.muted` sobre fundos bege precisa de verificação; preferir texto secundário nos metadados até medir. Contornos essenciais de inputs/foco precisam de contraste próprio.

| Elemento | Diretriz |
|---|---|
| Texto longo | Lora, 18–20 px equivalentes, entrelinha 1,75 |
| Interface | Inter, 14–16 px; inputs pelo menos 16 px |
| Títulos | 24–30 px, entrelinha 1,25, sem caixa alta em frases longas |
| Coluna de leitura | 60–68 caracteres por linha, máximo aproximado de 680 px |
| Margens | 20–24 px no celular; 32–48 px em telas amplas |
| Ritmo | Escala 4, 8, 16, 24, 32, 48 px; seções separadas por 32–48 px |
| Superfícies | Raios 8–12 px; borda sutil; sombra apenas quando houver sobreposição |
| Interação | Alvos preferencialmente 44 × 44 px ou maiores; rótulo além do ícone |
| Movimento | Transições discretas de 120–180 ms; respeitar redução de movimento |

Fontes WOFF2 locais com fallback Georgia/system-ui e `font-display: swap`; limitar pesos. Não introduzir modo escuro nesta etapa sem uma paleta completa validada. Tema claro bem executado é suficiente para o piloto.

## 6. Estados e linguagem

| Estado | Resposta da interface |
|---|---|
| Carregando | Skeleton proporcional, região ocupada sinalizada; sem spinner bloqueando toda a tela |
| Hoje sem publicação | “O devocional de hoje ainda não foi publicado. Volte em breve.” |
| Rede indisponível | “Não foi possível carregar. Verifique sua conexão e tente novamente.” |
| PWA offline | Explicar que é preciso conexão; não mostrar conteúdo privado de sessão anterior |
| Áudio falhou | “Não foi possível carregar o áudio.”; texto continua disponível |
| Sessão expirou | Pedir novo acesso; não confundir com ausência de publicação |
| Acesso revogado | Sair do contexto do grupo e remover dados já apresentados |
| Sem mensagens | “Os avisos da comunidade aparecerão aqui.” |
| Envio falhou | Erro junto ao campo, ação “Tentar novamente” e rascunho preservado |

Textos novos são propostas para implementação em `packages/domain/copy`. Escrever em português claro, sem culpa, urgência ou promessa espiritual automática. Não usar “Você perdeu sua sequência”, “Volte antes que seja tarde” ou “Meta espiritual concluída”.

## 7. Acessibilidade e qualidade

Meta: WCAG 2.2 AA. Texto normal com contraste ≥4,5:1; texto grande e componentes essenciais ≥3:1 conforme o critério aplicável. Foco visível, rótulos programáticos, navegação por teclado, link para saltar ao conteúdo e anúncios de erro acessíveis. Ícones decorativos não repetem a fala do rótulo. [Referência W3C](https://www.w3.org/TR/WCAG22/).

Verificar reflow a 320 CSS px, zoom de 200%, orientação paisagem, teclado virtual, foco não encoberto por barras fixas e nomes/comunidades longos. Player deve permitir teclado e leitor de tela; o texto funciona como alternativa ao áudio quando a gravação segue integralmente o devocional.

Metas internas para avaliação: LCP ≤2,5 s, CLS ≤0,1 e INP ≤200 ms quando houver medição de campo; no piloto usar medição de laboratório como diagnóstico, registrando aparelho e rede. Não afirmar conformidade por nota de Lighthouse.

## 8. Roteiro de avaliação

Com cinco participantes, incluindo alguém que amplie fontes e alguém pouco familiarizado com apps: entrar, localizar leitura, ouvir/pausar, entrar por código, alternar grupo e marcar/desmarcar item. Observar hesitações, toques acidentais, legibilidade e entendimento de privacidade. Registrar problemas e correções sem gravar conteúdo pessoal. Aprovação visual exige screenshots em 360, 390, 768 e 1280 px e teste real em Safari iOS e Chrome Android.
