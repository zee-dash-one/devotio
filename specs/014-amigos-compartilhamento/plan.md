# Plano — spec 014

1. Domain: validadores Zod, contratos de amizades/partilhas e regras puras de
   transição, limites e projeção privada. Repository.social opcional para prévia.
2. Convex: friendCodes por dono/código; friendships por par ordenado e cada lado;
   scriptureShares por remetente/requestId com até 20 destinatários; shareViews
   por dono e por dono/edição/livro/capítulo. shareMarkers mantém inícios distintos
   por edição/capítulo/direção, sem carregar corpos para desenhar ícones; até 352.
   Consultas de histórico paginadas,
   projeção sem destinatários em recebimentos, identidade sempre da sessão.
3. SQLite: tabelas equivalentes, operações transacionais, código gerado no servidor,
   mesma política de domínio. Eventos locais de invalidação usam transporte SSE
   existente, sem gravar recados em cache de navegador ou polling.
4. Web: Perfil no menu da conta; lista, busca e convites; ação na comunidade;
   modal de envio no SelectionMenu; marcações acessíveis por intervalo e painel
   paginado de envios/recebimentos. Reutilizar Modal, Button, Field e tokens.
5. Documentar acesso, arquitetura, privacidade, uso/testes locais, release e índices.
6. Testes de domínio, Convex e SQLite, UI e regressão; lint/typecheck/build.
   Sem deploy para verificar; credenciais reais e dispositivos ficam em homologação.

Expo: contratos preparados, interface não implementada nem marcada concluída.
