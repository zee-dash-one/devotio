# Spec: Cadastro editorial integrado à Bíblia publicada

**ID:** 013-editorial-biblia-publicada
**Status:** implementada no checkout; revisão do usuário, PR e publicação pendentes
**Versão alvo:** web publicada e local; Expo adiado
**Revisão:** 16/10/2026

## 1. Contexto e problema

O formulário publicado divergiu do fluxo local da spec 007: referência, tradução,
texto bíblico, crédito e horário são digitados, sem escolher o trecho pela Bíblia.
O pedido de 09/10 exige integrar esse cadastro e manter uma cópia integral
padronizada das escrituras para permitir troca de fontes/versões.
O menu ausente, embora a rota funcione, é correção independente da spec 012.

## 2. Papéis envolvidos

Leitores aprovados leem; gestores editoriais aprovados criam, corrigem e retiram
devocionais. Administração comunitária não concede editorial. O mantenedor
prepara as fontes autorizadas e a importação de novas edições.

## 3. Histórias de usuário

- Encontrar Bíblia nos menus desktop e celular, além da rota direta.
- Escolher data livre e trecho sem redigitar referência, versão ou versículos.
- Alternar entre cadastro e leitura sem perder textos e seleção.
- Guardar cada edição integral em formato comum, preservando o arquivo original.

## 4. Requisitos funcionais

1. Mostrar o menu Bíblia quando houver edição disponível, independentemente do
   adaptador privado local de favoritos/editorial.
2. Preservar o JSON fornecido e uma cópia integral padronizada que distingue
   edição, livro, capítulo e versículo. Importação reexecutável sem duplicação,
   com procedência, contagens e hash; falhas não substituem um corpus íntegro.
3. Leitura, busca e seleção usam um contrato comum, permitindo trocar fornecedor
   sem reescrever telas. A cópia integral é do projeto, não um download obrigatório
   de toda a Bíblia no navegador.
4. A edição de `docs/bibles/ALM1911.json`, chamada ARC1911 pelo usuário, é a única
   inicialmente oferecida no editorial publicado. Proposta: rótulo **Almeida Revista
   e Corrigida 1911 (ARC1911)**, mantendo a chave `alm1911` e o texto fornecido.
   Snapshots antigos conservam seus rótulos; a AA local existente não é excluída.
5. Novo cadastro apresenta somente datas livres de hoje em diante, considerando
   Brasília. Datas de devocionais retirados também continuam ocupadas. Navegar
   por meses permite datas futuras sem limite artificial. O servidor confirma
   disponibilidade na gravação e impede duplicidade entre editores simultâneos.
6. Editar é uma ação própria da listagem e conserva a data original.
7. Referência abre a Bíblia; botão alterna entre leitura e cadastro. Preservar
   data, reflexão, oração, edição, capítulo e versos nas idas e voltas. Retornar
   sem selecionar outro trecho conserva o anterior.
8. Selecionar versos preenche referência e Texto bíblico, ambos não editáveis.
   O servidor valida a seleção e reconstrói o texto pela fonte confiável, sem
   aceitar versículos adulterados pelo cliente.
9. Tradução usa o seletor padrão e lista edições disponíveis. Trocar exige uma
   seleção na edição escolhida antes de salvar; nunca trocar apenas o rótulo.
10. Reflexão e Sugestão de oração são obrigatórias, com até 512 caracteres cada,
    validadas no cliente e servidor. Textos antigos maiores permanecem legíveis,
    sem truncamento; ao editar, informar o excesso e exigir adequação explícita.
11. Créditos é o nome autenticado, não editável e derivado da sessão no servidor.
    Proposta para correções: preservar crédito original e auditar o novo revisor.
12. Disponibilidade automática às 00:00 da data da leitura em Brasília. Exibir
    essa informação sem campo de horário editável, independentemente do dispositivo.
13. Proposta para o motivo: criação registra “Publicação inicial” automaticamente;
    correção e retirada pedem justificativa curta, explicando que pertence ao
    histórico administrativo e não aparece no devocional.
14. Fonte/condições de uso acompanham a edição escolhida. Gravação exige ação humana
    explícita; falhas preservam o formulário, sucesso depende da resposta do servidor.

## 5. Requisitos não-funcionais

Regras no domínio/backend, apresentação nos apps. Corpus fora do JavaScript inicial,
capítulos sob demanda, sem polling ou autosave por tecla. Controles acessíveis por
teclado e celular. Importação/correção não apaga publicações ou dados privados.

## 6. Regras de visibilidade/permissão

| Papel | Pode ver | Pode criar | Pode editar/remover |
|---|---|---|---|
| Leitor aprovado | Bíblia e devocionais liberados | Não neste fluxo | Não |
| Gestor editorial aprovado | Bíblia e listagem editorial | Devocional em data livre | Correção e retirada auditadas |
| Admin comunitário sem editorial | Mesmo acesso do leitor | Não neste fluxo | Não |
| Pendente/desativado/visitante | Entrada e situação de acesso | Não | Não |

Autorizar no servidor. Não ampliar visibilidade de marcações, favoritos ou orações.

## 7. Fora de escopo

Novas traduções além da fornecida e AA local existente; migração de contas/comunidades
para outro banco; download integral obrigatório no navegador; Expo; IA; alteração
automática de textos ou snapshots existentes.

## 8. Dados envolvidos

Corpus com metadados de edição/fonte, livros, capítulos e versos; fonte original
preservada. Devocionais/eventos existentes são a fonte de datas, autoria e auditoria.
Novos devocionais guardam seleção estruturada; antigos sem seleção continuam
legíveis. O plano definirá campos opcionais e documentará a arquitetura.

## 9. Decisões propostas para aprovação

- Cópia integral padronizada no projeto; distribuição pública por capítulos.
- Rótulo ARC1911 mantendo a chave `alm1911` e snapshots anteriores.
- Sem truncamento de textos antigos; adequação explícita ao editar.
- Crédito original preservado em correções, com revisor auditado.
- Motivo automático na criação, solicitado e explicado em correções/retiradas.

## 10. Aprovação e lançamento

Pedido detalhado e reiterado do usuário em 09/10 autoriza aplicar os requisitos.
Nesta rodada, alterações permanecem locais: o usuário revisará e fará o PR;
não fazer commit, push, PR ou publicação automaticamente.
A correção do menu já autorizado pela spec 012 foi entregue anteriormente.
Web local e conectada; Expo adiado.
Verificar regras no servidor, fonte confiável, ida/volta do cadastro, seletores,
menus, fuso e persistência; lint/typecheck/testes/build antes de publicação.
Registrar separadamente qualquer homologação autenticada não realizada.
