# Como colocar o site no ar (passo a passo, custo zero)

Este guia é para quem nunca fez isso. São 4 partes, e cada uma leva de 5 a 15 minutos.
Você vai criar 3 contas gratuitas. **Nenhuma pede cartão de crédito.** Se alguma tela pedir cartão,
pare e avise: é sinal de que algo saiu do plano gratuito.

Palavras que aparecem no guia:
- **Supabase**: o "arquivo" na internet onde ficam guardados seus artefatos e versões.
- **Vercel**: o serviço que deixa o site no ar, num endereço como `aline-artefatos.vercel.app`.
- **Google Cloud**: só é usado para criar o botão "Entrar com Google". Não é cobrado.
- **Variável de ambiente**: um "campo de configuração" do site, com nome e valor (ex.: `ALLOWED_EMAILS` = seu e-mail).
- **Chave secreta**: um texto que funciona como senha. Nunca cole em chat, documento ou e-mail.

Antes de começar, escolha um nome para o site, só com letras minúsculas e hífens, por exemplo
`aline-artefatos`. Ele vai virar dois endereços:
- `https://aline-artefatos.vercel.app` (o site)
- `https://aline-artefatos-run.vercel.app` (onde os artefatos rodam, isolados do site)

Se o nome já existir na Vercel, escolha outro e use o mesmo em todo o guia.

---

## Parte 1 — Supabase (onde os dados ficam guardados)

1. Abra https://supabase.com e clique em **Start your project**. Entre com sua conta do GitHub.
2. Clique em **New project**.
   - **Name**: `artefatos`
   - **Database Password**: clique em **Generate a password** (você não vai precisar dela no dia a dia).
   - **Region**: **South America (São Paulo)**.
   - Plano: **Free**.
3. Espere uns 2 minutos até o projeto ficar pronto.
4. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
5. Abra o arquivo `supabase/migrations/0001_init.sql` do repositório no GitHub, copie todo o texto,
   cole no SQL Editor e clique em **Run**. Deve aparecer "Success".
6. No menu da esquerda, abra **Project Settings → API** (ou **Data API**) e deixe esta aba aberta.
   Você vai copiar dois valores daqui na Parte 3:
   - **Project URL** (começa com `https://` e termina com `.supabase.co`)
   - **service_role** (em "Project API keys"; clique em "Reveal"). **Essa é secreta.**

> O Supabase gratuito "adormece" o projeto se ninguém usar o site por 7 dias. Para acordar, entre
> no supabase.com e clique em **Restore project**. Seus dados não se perdem. E use o botão
> **Baixar backup** do site de vez em quando.

## Parte 2 — Google (botão "Entrar com Google")

1. Abra https://console.cloud.google.com e entre com a conta Google que você vai usar no site.
2. No topo, clique no seletor de projeto → **Novo projeto** → nome `artefatos` → **Criar**.
   Confira se o projeto novo ficou selecionado no topo.
3. No menu, abra **APIs e serviços → Tela de consentimento OAuth** (às vezes aparece como
   **Google Auth Platform**) e clique em **Começar**.
   - Nome do app: `Artefatos da Aline`
   - E-mail de suporte: o seu
   - Público: **Externo**
   - E-mail de contato: o seu → **Concluir**.
4. Em **Público** (ou "Usuários de teste"), clique em **Adicionar usuários** e coloque o seu e-mail.
   Deixe o app em modo **Teste**. Assim, só você consegue usar.
5. Abra **Clientes** (ou **Credenciais**) → **Criar cliente** (ou "Criar credenciais → ID do cliente OAuth").
   - Tipo: **Aplicativo da Web**
   - Nome: `artefatos-site`
   - Em **URIs de redirecionamento autorizados**, clique em **Adicionar URI** e cole
     (troque pelo nome que você escolheu):
     `https://aline-artefatos.vercel.app/api/auth/google/callback`
   - Clique em **Criar**.
6. Vai aparecer o **ID do cliente** e a **Chave secreta do cliente**. Deixe essa janela aberta
   (ou baixe o JSON) para a Parte 3. **A chave é secreta.**

## Parte 3 — Vercel (colocar o site no ar)

> **Antes desta parte**, o código do site precisa estar no ramo principal (`main`) do repositório.
> Quem faz isso é o Claude, depois do seu ✅. Sem isso, a Vercel publica um repositório vazio.

1. Abra https://vercel.com/signup, escolha **Hobby** (grátis, uso pessoal) e entre com o GitHub.
2. Clique em **Add New… → Project** e, na lista, escolha o repositório **Claude-code-** → **Import**.
   (Se ele não aparecer, clique em "Adjust GitHub App Permissions" e libere esse repositório.)
3. Em **Project Name**, escreva o nome que você escolheu (ex.: `aline-artefatos`).
4. Abra **Environment Variables** e adicione uma por uma (nome à esquerda, valor à direita):

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | o Project URL da Parte 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave service_role da Parte 1 |
   | `GOOGLE_CLIENT_ID` | o ID do cliente da Parte 2 |
   | `GOOGLE_CLIENT_SECRET` | a chave secreta do cliente da Parte 2 |
   | `ALLOWED_EMAILS` | o seu e-mail do Google (o mesmo da Parte 2) |
   | `SESSION_SECRET` | um texto aleatório com 40 ou mais letras e números (ex.: gere uma senha longa no gerenciador de senhas do iPhone/Chrome) |
   | `APP_ORIGIN` | `https://aline-artefatos.vercel.app` |
   | `NEXT_PUBLIC_RUNNER_ORIGIN` | `https://aline-artefatos-run.vercel.app` |

5. Clique em **Deploy** e espere uns 2 minutos.
6. Agora, o segundo endereço: abra o projeto → **Settings → Domains** → **Add Domain**, digite
   `aline-artefatos-run.vercel.app` e confirme. (É grátis: endereços que terminam em `.vercel.app`
   não são comprados.)
7. Volte em **Deployments**, clique nos três pontinhos do último deploy → **Redeploy**.

## Parte 4 — Testar

1. Abra `https://aline-artefatos.vercel.app`. Deve aparecer a tela com **Entrar com Google**.
2. Entre com o seu e-mail. Se aparecer um aviso do Google de "app não verificado", clique em
   **Continuar**: o app é seu e está em modo de teste.
3. Clique em **Importar**, arraste o *Hub da Aline.html* e abra. Mude algo nele e recarregue a página
   para ver se ficou salvo.
4. Clique em **Baixar backup** e veja se baixa um arquivo `artefatos-backup-…json`.
5. Teste com outra conta Google: ela **não** pode entrar.

Depois da meia-noite, o site pede para entrar de novo. Isso é de propósito.

## Se algo der errado

- **"Configure o login…" ou "Defina SESSION_SECRET…"**: falta alguma variável da Parte 3, passo 4.
  Corrija em **Settings → Environment Variables** e faça **Redeploy**.
- **Erro do Google "redirect_uri_mismatch"**: o endereço da Parte 2, passo 5, não é igual ao do site.
  Confira letra por letra, inclusive o `https://` e o `/api/auth/google/callback`.
- **"Esta conta Google não tem acesso"**: o e-mail em `ALLOWED_EMAILS` está diferente do que você usou.
- **Artefatos não abrem**: confira o passo 6 da Parte 3 (o segundo endereço) e faça Redeploy.
