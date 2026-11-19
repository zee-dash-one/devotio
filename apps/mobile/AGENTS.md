# AGENTS.md — apps/mobile

Estende [`AGENTS.md`](../../AGENTS.md) e [`docs/architecture.md`](../../docs/architecture.md), incluindo todas as regras de Git e de execução (sem PowerShell).

## Situação atual

Diretório reservado para o futuro aplicativo nativo (sem `package.json` nem workspace ativo). Hoje o atendimento móvel ocorre pela Web/PWA.

## Diretrizes para quando o workspace nativo for iniciado

- **Stack prevista:** Expo + Expo Router + NativeWind + `expo-audio`.
- **Reuso obrigatório do núcleo:** consumir os mesmos contratos, regras, validadores e hooks de `packages/domain`, o mesmo backend em `packages/backend` e os mesmos tokens de `packages/ui-kit`.
- **Apresentação própria:** componentes React Native dedicados (sem compartilhar DOM com `apps/web`) e zero lógica de permissão exclusiva no cliente.
- **Segurança e recursos nativos:** armazenar credenciais apenas em storage seguro da plataforma (nunca em `AsyncStorage` puro); áudio em segundo plano, offline e notificações push exigem planejamento dedicado e homologação em aparelhos iOS e Android físicos antes de publicação em lojas.
