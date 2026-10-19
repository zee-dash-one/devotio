# Conteúdo, licenças e privacidade

## 1. Responsabilidade editorial

Cada devocional precisa de um responsável humano identificado. A redação deve distinguir texto bíblico, reflexão e sugestão de oração. Preferir 3–5 versículos contextualizados, reflexão em parágrafos curtos e oração breve; não transformar um tamanho editorial recomendado em validação rígida sem spec.

Rascunho → revisão bíblica e linguística → conferência de licença → aprovação humana → publicação → verificação no app. A sugestão para o piloto é manter rascunhos fora da base de leitura e inserir apenas conteúdo aprovado pelo processo interno. Esse fluxo ainda precisa ser formalizado na spec 004 e no plano correspondente.

Checklist editorial:

- Referência, tradução e edição corretas; nenhuma troca silenciosa entre ACF, ARC, AA ou outra tradução.
- Citação exata, separada do comentário humano; nome do revisor e data registrados.
- Reflexão sem dado pessoal de membros ou situação pastoral identificável sem autorização adequada.
- Oração coerente com o conteúdo; tom acolhedor, sem culpa ou promessa de resultado.
- Áudio, quando presente, corresponde ao texto, tem autorização de voz e não inclui música sem licença.
- Data local de exibição conferida; sete dias de material revisado como reserva editorial, sem expor rascunhos.
- Procedimento de correção/retirada disponível; não sobrescrever conteúdo sem registro operacional.

## 2. Licenciamento bíblico

**ACF não deve ser presumida como domínio público.** A SBTB publica condições de citação e exige crédito; citações limitadas e redistribuição integral têm escopos diferentes. Registrar os termos aplicáveis à edição e ao uso pretendido, inclusive áudio e distribuição digital. [Direitos autorais oficiais da SBTB, consultados em 02/10/2026](https://www.biblias.com.br/direitos-autorais).

A presença de uma tradução no GitHub não concede direitos sobre ela. Licença do código de uma API também não licencia automaticamente as traduções. Antes de importar qualquer versão, inclusive ACF, reunir evidência de autorização ou licença aplicável. Não considerar a permissão de pequenas citações como liberação para a Bíblia completa.

Para o piloto, usar somente trechos cujo uso tenha sido validado. A spec 003 fica fora do caminho crítico. Não importar um dataset inteiro “provisoriamente” para corrigir licenciamento depois.

Registro mínimo, mantido pelo responsável editorial em local de acesso restrito quando incluir autorização privada:

| Material | Edição/fonte | Detentor/licença | Usos permitidos | Crédito exigido | Evidência/data | Revisor |
|---|---|---|---|---|---|---|
| Tradução inicial | A definir | A confirmar | Texto/áudio/digital a confirmar | A confirmar | Pendente | A definir |
| Reflexões | Produção própria proposta | Autorização dos autores | Publicação no app | Nome conforme acordo | Pendente | A definir |
| Lora / Inter / ícones | Pacotes escolhidos | Preservar arquivos de licença | Conferir distribuição | Conforme licença | Antes do build público | Engenharia |

Este registro não substitui a confirmação dos termos com o titular quando houver dúvida de escopo.

## 3. Dados pessoais e visibilidade

Participação religiosa pode revelar dados pessoais sensíveis. A ANPD inclui convicção religiosa e filiação a organização religiosa nessa categoria. O projeto precisa definir finalidade e base legal adequada antes de coletar dados reais; não basta copiar uma política genérica. [Orientação da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes).

| Dado | Finalidade | Exposição no produto |
|---|---|---|
| Identificador de auth, nome, e-mail | Conta e vínculo da sessão | Próprio usuário; nunca e-mail na lista de membros |
| Associação e papel no grupo | Autorizar funções | Nomes/papéis conforme spec 002; apenas membros do grupo |
| Mural e listas | Comunicação pastoral | Apenas comunidade correspondente |
| Tick individual | Estado pessoal | Só o titular; demais recebem contagem agregada |
| Logs técnicos | Diagnóstico operacional | Operadores autorizados, sem conteúdo de oração/reflexão pessoal |
| Orações e marcações privadas | Fora do piloto | Não habilitar até spec própria |

Uma contagem em grupo pequeno pode permitir inferências; não a descrever como anonimização garantida. Não enviar IDs dos participantes junto com agregados. Não coletar progresso de leitura para criar perfil espiritual.

## 4. Preparação obrigatória para o piloto

### Recados entre amigos — spec 014

Amizades exigem convite e aceite. A lista de vínculos é visível apenas ao próprio
titular; códigos não substituem autenticação. Descoberta na comunidade revela
apenas os nomes já acessíveis aos participantes, sem e-mail ou lista de amigos.
O remetente vê seus destinatários; cada destinatário recebe somente nome do
remetente, trecho e recado. Gestores não recebem acesso adicional a esses dados.
Texto bíblico e nomes ficam registrados como estavam no envio. Remover amizade
bloqueia novos envios, preservando recados anteriores; desativação não apaga cópias
de outras pessoas. Não há edição/exclusão de recados enviados nesta entrega.
Pedidos de exclusão continuam dependendo do processo operacional do piloto, sem
promessa de remover conteúdo já copiado por participantes. Recados não são
persistidos no cache do navegador. Restrições de comentários/orações não mudam.

### Preparação operacional

Definir operador/controlador e contato de atendimento, público e faixa etária, base legal, finalidade, provedores, região de hospedagem e tratamento internacional aplicável. Preparar aviso de privacidade legível antes do login, fluxo de pedidos de acesso/correção/exclusão e rotina de resposta a incidentes.

Escolher prazos de retenção por categoria, incluindo logs e backups. A spec 002 preserva histórico ao remover membro: isso não equivale a decidir retenção eterna nem a resolver exclusão de conta. Fechar essa diferença antes de produção. Caso haja menores, definir o tratamento aplicável antes do recrutamento.

No piloto proposto: sem analytics de terceiros, publicidade ou cache offline de conteúdo autenticado. Logout e troca de conta limpam dados em memória da interface; revogação de associação corta consultas futuras. Exportações de backup ficam fora do repositório, com acesso restrito.

**Pendências:** responsáveis, política final, prazos, processo de exclusão e tradução autorizada ainda não definidos. Este documento orienta a implementação; não é a política pública final do serviço.
