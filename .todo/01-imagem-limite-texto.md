# Compartilhar texto em imagem, limitado pelo tamanho do texto

## Objetivo

A arte do devocional leva Meditar e Oração inteiros. Se o texto não cabe em 10 páginas de algum formato, a edição recusa o conteúdo em vez de cortar.

## Decisão

O Hil definiu retomar este fluxo com limite por tamanho de texto. O teto vigente permanece: 512 caracteres em cada campo e no máximo 10 páginas por formato, sem truncar.

## Checklist

- [x] O cálculo de páginas vive no domínio e a renderização usa o mesmo recorte.
- [x] Salvar no modo local e no Convex recusa a combinação que estoura a arte.
- [x] O editor e o compartilhamento mostram o limite.
- [ ] Validar `npm run test` nos pacotes tocados e abrir o PR.
