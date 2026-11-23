# 02 — Superusuário e gestão de contas

## Decisão

- O papel é o campo opcional `users.superuser`, independente do painel `/gestao-acesso` e da capacidade editorial.
- A tela `/sistema/usuarios` fica no menu da conta e autoriza no servidor: aprovar, desativar e excluir.
- Exclusão só ocorre sem comunidade, administração, recado ou envio. Caso contrário a conta é desativada.
- A promoção inicial não guarda e-mail no repositório. No acesso, se existir exatamente uma conta aprovada cujo nome é Hilderney, ela recebe `superuser` e `editorial`.
- No local, Ester e o perfil Hilderney já nascem superusuários. Perfis de demonstração não são excluídos.

## Checklist

- [x] Domínio, Convex, local e menu
- [x] Testes locais e publicação da gestão de contas
- [x] Temas mensal e semanal em `/sistema/temas`
