# Cópia reserva: se um dia o site for aberto para mais pessoas

**Hoje o site é só para uso pessoal**, e o guia [`colocar-no-ar.md`](colocar-no-ar.md) é o que vale.
Este arquivo fica guardado como reserva. Ele lista, em linguagem simples, o que precisa mudar
**antes** de deixar outras pessoas entrarem. Nada daqui foi feito ainda.

## 1. O que muda no código (pedir ao Claude)

Hoje todo mundo que entra vê **a mesma biblioteca**. Isso é ótimo para uma pessoa só, mas com
mais pessoas cada uma veria e poderia apagar os artefatos das outras. Antes de abrir:

1. **Separar os dados por pessoa**: cada artefato passa a ter um "dono" (o e-mail de quem criou),
   e cada pessoa só vê os seus. No banco, isso é uma coluna nova (`owner_email`) nas tabelas
   `artifacts` e `artifact_kv`, e um filtro em todas as rotas.
2. **Papéis**: decidir se haverá "administradora" (você) e "convidados", e o que cada um pode fazer.
3. **Compartilhar um artefato** (opcional): link só de leitura para um artefato específico.
4. **Backup por pessoa**: o botão "Baixar backup" passa a baixar só os artefatos de quem clicou.
5. **Limite de uso**: um teto de artefatos e de tamanho por pessoa, para não estourar o plano gratuito.

## 2. O que muda nas configurações

1. **Quem pode entrar**: em `ALLOWED_EMAILS`, coloque os e-mails separados por vírgula.
   Ex.: `voce@gmail.com, colega@gmail.com`.
2. **Google**: enquanto o app estiver em modo **Teste**, só entram as contas cadastradas como
   "usuários de teste" (até 100). Para mais que isso, é preciso **publicar** o app no Google Cloud;
   para usar só o e-mail (escopo `openid email`), em geral não exige a verificação completa,
   mas confira a tela do Google na hora.
3. **Vercel**: o plano **Hobby** é só para uso pessoal e **não comercial**. Se o site passar a ter
   uso comercial (cobrar, divulgar como serviço), é preciso mudar de plano antes.
4. **Supabase**: o plano gratuito tem limite de espaço (500 MB de banco). Acompanhe em
   **Project Settings → Usage**.

## 3. O que muda na parte jurídica (revisão do Gemini e do ChatGPT)

Com dados de outras pessoas, deixa de ser uso estritamente particular. Antes de abrir, pedir às
IAs a revisão jurídica, com base na matriz de riscos do documento compartilhado:

1. **LGPD (Lei 13.709/2018)**: aviso de privacidade dizendo quais dados são guardados (e-mail e
   artefatos), para quê, onde (Supabase, Vercel) e como pedir para apagar.
2. **Termos de uso** curtos: o que a pessoa pode guardar e o que não pode (por exemplo, dados de
   processos ou de terceiros).
3. **Marcas e logos** de instituições nos artefatos: revisar antes de mostrar para outras pessoas.
4. **Licenças** das bibliotecas e fontes: revisar a lista já enviada ao Gemini.

## 4. Sinalização que passa a ser necessária

Hoje o site não mostra avisos, porque é seu e foi projetado por você. Com mais pessoas, entram:
- link para o **aviso de privacidade** e os **termos** na tela de login;
- nome de quem está logado no topo, para cada um saber em que conta está;
- aviso claro de que o acesso vence à meia-noite.

## 5. Ordem sugerida

1. Pedir ao Claude a separação de dados por pessoa (item 1), em um PR.
2. Pedir ao Gemini e ao ChatGPT o aviso de privacidade e os termos (item 3).
3. Ajustar as configurações (item 2).
4. Testar com **uma** pessoa de confiança antes de abrir para mais.
