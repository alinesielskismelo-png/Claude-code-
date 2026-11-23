# Como colocar o site no ar — passo a passo, tela por tela

> Guia para **uso pessoal**. Se um dia quiser abrir o site para mais pessoas, veja a cópia reserva
> [`abrir-para-mais-pessoas.md`](abrir-para-mais-pessoas.md).

## Antes de começar (leia tudo, leva 2 minutos)

**O que você vai fazer:** criar 3 contas grátis e ligar uma na outra. São 4 etapas, sempre nesta ordem:

| Etapa | Site que você abre | Para que serve | Tempo |
|---|---|---|---|
| 1 | **supabase.com** | Guardar seus artefatos (é o "arquivo" do site) | 10 min |
| 2 | **vercel.com** | Deixar o site no ar, com um endereço próprio | 10 min |
| 3 | **console.cloud.google.com** | Criar o botão "Entrar com Google" | 15 min |
| 4 | **vercel.com** de novo | Colar as últimas configurações e testar | 10 min |

**Use um computador** (não o iPad), com o navegador Chrome ou Safari. Você vai trabalhar com
**várias abas abertas ao mesmo tempo**. Em cada passo, o guia diz em qual aba você deve estar.

**Como ler cada passo:**
- **ONDE:** a aba e a tela em que você precisa estar.
- **CLIQUE:** o botão ou link exato (o nome aparece entre aspas, igual está na tela).
- **ESCREVA ou COLE:** o que digitar e em qual campo.
- **VOCÊ DEVE VER:** como saber que deu certo antes de ir para o próximo passo.

**Nenhuma das 3 contas pede cartão de crédito.** Se alguma tela pedir cartão ou "upgrade", **pare**
e me mande um print: é sinal de que algo saiu do plano grátis.

**Chave secreta** é um texto que funciona como senha. Neste guia há 3 delas. Você vai **copiar de
uma aba e colar direto na outra**. Nunca cole uma chave secreta em chat, e-mail ou documento.
Se precisar me mostrar uma tela que tem chave, cubra a chave antes do print.

### Sua folha de anotações

Anote aqui (num papel ou no app Notas) só o que **não** é secreto. Você vai precisar depois:

| O quê | Exemplo | O seu |
|---|---|---|
| Endereço do site | `https://aline-artefatos.vercel.app` | |
| Endereço dos artefatos | `https://aline-artefatos-run.vercel.app` | |
| Seu e-mail do Google | `voce@gmail.com` | |

---

## Etapa 1 — Supabase (onde os dados ficam guardados)

### 1.1 Criar a conta
1. **ONDE:** uma aba nova do navegador.
   **ESCREVA** na barra de endereço: `supabase.com` e aperte Enter.
2. **CLIQUE:** no botão verde **"Start your project"** (canto superior direito).
3. **CLIQUE:** em **"Continue with GitHub"**. Se o GitHub pedir, entre com a sua conta do GitHub
   (a mesma onde está o repositório) e **CLIQUE** em **"Authorize supabase"**.
4. **VOCÊ DEVE VER:** uma tela de boas-vindas ou a lista de projetos ("Dashboard").
   Se pedir para criar uma **organização**: em "Name" **ESCREVA** `Aline`, em "Type" escolha
   **"Personal"**, em "Plan" escolha **"Free - $0/month"** e **CLIQUE** em **"Create organization"**.

### 1.2 Criar o projeto
1. **CLIQUE:** em **"New project"**.
2. Preencha:
   - **Project name:** **ESCREVA** `artefatos`
   - **Database Password:** **CLIQUE** em **"Generate a password"**. Você não vai precisar dela, pode deixar como está.
   - **Region:** **CLIQUE** na lista e escolha **"South America (São Paulo)"**.
3. **CLIQUE:** em **"Create new project"**.
4. **VOCÊ DEVE VER:** uma tela dizendo que o projeto está sendo preparado ("Setting up project").
   **Espere uns 2 minutos** até aparecer a página inicial do projeto.

### 1.3 Criar as tabelas (onde os artefatos vão ficar)
1. **Abra uma segunda aba** e vá para o repositório no GitHub:
   `github.com/alinesielskismelo-png/Claude-code-`
2. Nessa aba do GitHub, **CLIQUE** na pasta **`supabase`**, depois em **`migrations`**, depois no arquivo **`0001_init.sql`**.
3. No canto superior direito do arquivo, **CLIQUE** no ícone de **copiar** (dois quadradinhos, "Copy raw file").
4. **Volte para a aba do Supabase.** No menu da esquerda, **CLIQUE** em **"SQL Editor"** (ícone de terminal `>_`).
5. **CLIQUE** em **"New query"** (ou no **"+"**) para abrir uma folha em branco.
6. **CLIQUE** dentro da área grande de texto e **COLE** (Ctrl+V no Windows, Cmd+V no Mac).
7. **CLIQUE** no botão verde **"Run"** (canto inferior direito) ou aperte Ctrl+Enter / Cmd+Enter.
8. **VOCÊ DEVE VER:** embaixo, a mensagem **"Success. No rows returned"**. Se aparecer um aviso perguntando
   se quer mesmo rodar, **CLIQUE** em **"Run this query"**.

### 1.4 Gerar a sua chave de sessão (vai ser usada na Etapa 4)
Ainda no **SQL Editor**:
1. **CLIQUE** em **"New query"** de novo.
2. **ESCREVA** exatamente: `select encode(gen_random_bytes(32), 'hex');`
3. **CLIQUE** em **"Run"**.
4. **VOCÊ DEVE VER:** embaixo, uma linha com um texto longo de letras e números. **Essa é uma chave secreta**
   (o nome dela no site é `SESSION_SECRET`). Deixe esta aba aberta: você vai copiar esse texto na Etapa 4.

### 1.5 Achar o endereço e a chave do Supabase
1. No menu da esquerda, **CLIQUE** na **engrenagem "Project Settings"** (lá embaixo).
2. **CLIQUE** em **"Data API"** (em algumas versões aparece como **"API"**).
   **VOCÊ DEVE VER:** um campo **"Project URL"**, com um endereço que começa com `https://` e termina com `.supabase.co`.
3. Agora, no mesmo menu de configurações, **CLIQUE** em **"API Keys"**.
   - Se aparecer uma aba **"Legacy API Keys"** (ou "Legacy anon, service_role API keys"), **CLIQUE** nela.
   - Procure a linha **"service_role"** (marcada como **secret**). **CLIQUE** em **"Reveal"** para mostrar.
   - Se não existir "service_role", use a chave da seção **"Secret keys"** (começa com `sb_secret_`).
4. **Deixe esta aba aberta.** Você vai copiar daqui o **Project URL** e essa **chave secreta** na Etapa 2.

---

## Etapa 2 — Vercel (colocar o site no ar)

### 2.1 Criar a conta
1. **Abra uma terceira aba.** **ESCREVA** `vercel.com/signup` e aperte Enter.
2. Em "Plan Type", **CLIQUE** em **"I'm working on personal projects"** (é o plano **Hobby**, grátis).
3. Em "Your Name", **ESCREVA** seu nome e **CLIQUE** em **"Continue"**.
4. **CLIQUE** em **"Continue with GitHub"** e autorize, como fez no Supabase.
5. **VOCÊ DEVE VER:** o painel da Vercel ("Overview") ou a tela "Let's build something new".

### 2.2 Ligar o repositório
1. **CLIQUE** em **"Add New…"** (canto superior direito) e depois em **"Project"**.
2. Na coluna **"Import Git Repository"**, procure **`Claude-code-`**.
   - **Se não aparecer:** **CLIQUE** em **"Install"** ou em **"Adjust GitHub App Permissions"**.
     Abre uma janela do GitHub: escolha **"Only select repositories"**, selecione **`Claude-code-`**
     e **CLIQUE** em **"Install"** (ou "Save"). Volte para a Vercel; agora ele aparece.
3. Ao lado de **`Claude-code-`**, **CLIQUE** em **"Import"**.

### 2.3 Configurar o projeto (tela "Configure Project" / "New Project")
1. **Project Name:** apague o que estiver lá e **ESCREVA** o nome do seu site, só com letras minúsculas
   e hífens. Exemplo: `aline-artefatos`.
2. **Framework Preset:** deve aparecer **"Next.js"** sozinho. Não mexa.
3. **CLIQUE** em **"Environment Variables"** para abrir essa seção. Cada variável tem dois campos:
   **"Key"** (o nome) e **"Value"** (o valor). Depois de preencher cada uma, **CLIQUE** em **"Add"**
   (ou "Add More") para abrir a próxima linha.

   Agora você vai **pular entre a aba do Supabase e a aba da Vercel**:

   | Na Vercel, em **Key**, escreva | Em **Value**, cole | De onde copiar |
   |---|---|---|
   | `SUPABASE_URL` | o **Project URL** | aba do Supabase → Project Settings → **Data API** |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave **service_role** (secreta) | aba do Supabase → Project Settings → **API Keys** |
   | `SESSION_SECRET` | o texto longo do passo 1.4 (secreto) | aba do Supabase → **SQL Editor** |

   Dica: para copiar, selecione o texto e use Ctrl+C / Cmd+C, ou o ícone de copiar ao lado do campo.

4. **CLIQUE** em **"Deploy"**.
5. **VOCÊ DEVE VER:** uma tela com o registro da construção do site ("Building"). Espere uns 2 minutos,
   até aparecer **"Congratulations!"** ou a imagem do site.

### 2.4 Anotar o endereço do site
1. **CLIQUE** em **"Continue to Dashboard"** (ou no nome do projeto).
2. No painel do projeto, procure **"Domains"**. O endereço aparece ali, por exemplo
   `aline-artefatos.vercel.app`. **Anote na sua folha** com `https://` na frente.
   (Se a Vercel acrescentou letras no final, como `aline-artefatos-x7k2.vercel.app`, anote exatamente esse.)
3. Se você abrir o site agora, vai aparecer a mensagem
   *"Configure o login: GOOGLE_CLIENT_ID…"*. **Isso é esperado**: o login vem na Etapa 3.

### 2.5 Criar o segundo endereço (onde os artefatos rodam, isolados)
1. No painel do projeto, **CLIQUE** na aba **"Settings"** (no topo).
2. No menu da esquerda, **CLIQUE** em **"Domains"**.
3. **CLIQUE** em **"Add Domain"** (ou "Add").
4. **ESCREVA** o endereço do site com `-run` antes de `.vercel.app`. Exemplo: `aline-artefatos-run.vercel.app`.
5. **CLIQUE** em **"Add"** / **"Save"**. Se perguntar o ambiente, deixe **"Production"**.
   Se perguntar sobre redirecionar, escolha **não redirecionar** (deixe como está).
6. **VOCÊ DEVE VER:** os dois endereços na lista, com um sinal verde ("Valid Configuration").
   **Anote o segundo na sua folha** com `https://` na frente.
   Se esse nome já estiver em uso, tente `aline-artefatos-runner.vercel.app` e anote o que funcionou.

---

## Etapa 3 — Google (o botão "Entrar com Google")

### 3.1 Criar o projeto no Google Cloud
1. **Abra uma quarta aba.** **ESCREVA** `console.cloud.google.com` e entre com **a conta Google que você vai usar no site**.
2. Se aparecer uma tela de termos, marque que concorda e **CLIQUE** em **"Concordar e continuar"**.
   **Não** clique em nenhum "Teste gratuito" ou "Ativar faturamento": não é preciso.
3. No topo da página, ao lado do logo "Google Cloud", **CLIQUE** no **seletor de projeto**
   (um botão com o nome de um projeto ou "Selecionar um projeto").
4. Na janela que abre, **CLIQUE** em **"Novo projeto"** (canto superior direito da janela).
5. Em **"Nome do projeto"**, **ESCREVA** `artefatos` e **CLIQUE** em **"Criar"**.
6. Espere uns segundos. Aparece um aviso no sino de notificações. **CLIQUE** no seletor de projeto de novo
   e escolha **`artefatos`**.
7. **VOCÊ DEVE VER:** `artefatos` escrito no seletor do topo. Confira sempre isso antes de continuar.

### 3.2 Configurar a tela de login do Google
1. Na barra de busca do topo, **ESCREVA** `Google Auth Platform` e **CLIQUE** no resultado
   (em algumas contas aparece como **"Tela de consentimento OAuth"**).
2. **CLIQUE** em **"Começar"** (ou "Get started").
3. **Informações do app:**
   - **Nome do app:** **ESCREVA** `Artefatos da Aline`
   - **E-mail para suporte do usuário:** escolha o seu e-mail na lista
   - **CLIQUE** em **"Próxima"**.
4. **Público:** escolha **"Externo"** e **CLIQUE** em **"Próxima"**.
5. **Dados de contato:** **ESCREVA** o seu e-mail e **CLIQUE** em **"Próxima"**.
6. **Concluir:** marque que concorda com a política de dados e **CLIQUE** em **"Continuar"** e depois em **"Criar"**.

### 3.3 Liberar o seu e-mail
1. No menu da esquerda do Google Auth Platform, **CLIQUE** em **"Público"**.
2. Confirme que o status está **"Em teste"** (Testing). **Não** clique em "Publicar app".
3. Desça até **"Usuários de teste"** e **CLIQUE** em **"+ Add users"** (Adicionar usuários).
4. **ESCREVA** o seu e-mail do Google e **CLIQUE** em **"Salvar"**.

### 3.4 Criar a chave do login
1. No menu da esquerda, **CLIQUE** em **"Clientes"**.
2. **CLIQUE** em **"+ Criar cliente"**.
3. **Tipo de aplicativo:** escolha **"Aplicativo da Web"**.
4. **Nome:** **ESCREVA** `artefatos-site`.
5. Desça até **"URIs de redirecionamento autorizados"** e **CLIQUE** em **"+ Adicionar URI"**.
6. **ESCREVA** o endereço do site da sua folha, seguido de `/api/auth/google/callback`. Exemplo:
   `https://aline-artefatos.vercel.app/api/auth/google/callback`
   (sem espaço, sem barra no final, letra por letra igual ao seu endereço).
7. **Não preencha** "Origens JavaScript autorizadas". **CLIQUE** em **"Criar"**.
8. **VOCÊ DEVE VER:** uma janela com o **"ID do cliente"** (termina em `.apps.googleusercontent.com`)
   e a **"Chave secreta do cliente"** (secreta). **Não feche esta janela.**
   (Se fechar sem querer: Clientes → clique em `artefatos-site` → os dois aparecem ali.)

---

## Etapa 4 — Terminar na Vercel e testar

### 4.1 Colar as últimas configurações
1. **Volte para a aba da Vercel**, no painel do projeto.
2. **CLIQUE** em **"Settings"** (topo) e depois em **"Environment Variables"** (menu da esquerda).
3. Para cada linha abaixo: em **Key** escreva o nome, em **Value** cole o valor e **CLIQUE** em **"Save"**
   (deixe marcados os ambientes que já vêm marcados).

   | Key | Value | De onde |
   |---|---|---|
   | `GOOGLE_CLIENT_ID` | o **ID do cliente** | aba do Google, passo 3.4 |
   | `GOOGLE_CLIENT_SECRET` | a **Chave secreta do cliente** (secreta) | aba do Google, passo 3.4 |
   | `ALLOWED_EMAILS` | o seu e-mail do Google | sua folha |
   | `APP_ORIGIN` | o endereço do site (com `https://`) | sua folha |
   | `NEXT_PUBLIC_RUNNER_ORIGIN` | o endereço dos artefatos (com `https://`) | sua folha |

4. **VOCÊ DEVE VER:** 8 variáveis na lista (as 3 da Etapa 2 + estas 5).

### 4.2 Publicar de novo com as configurações novas
1. **CLIQUE** na aba **"Deployments"** (topo).
2. Na primeira linha da lista, **CLIQUE** nos **três pontinhos "…"** (à direita) e depois em **"Redeploy"**.
3. Na janela, **CLIQUE** em **"Redeploy"** de novo.
4. Espere uns 2 minutos, até o status ficar **"Ready"** (bolinha verde).

### 4.3 Testar (pode ser no computador e depois no iPad)
1. **Abra o endereço do site** da sua folha.
   **VOCÊ DEVE VER:** a tela **"Artefatos"** com o botão **"Entrar com Google"**.
2. **CLIQUE** em **"Entrar com Google"** e escolha a sua conta.
   - Se aparecer **"O Google não verificou este app"**: **CLIQUE** em **"Continuar"**.
     Isso aparece porque o app é seu e está em modo de teste. É normal.
3. **VOCÊ DEVE VER:** a sua biblioteca, ainda vazia.
4. **CLIQUE** em **"Importar"**, arraste o arquivo **Hub da Aline.html** e **CLIQUE** em **"Salvar"**.
5. Abra o artefato, mude alguma coisa nele (por exemplo, um campo do perfil), **recarregue a página**
   e veja se a mudança continua lá.
6. **CLIQUE** em **"Baixar backup"** (no topo). **VOCÊ DEVE VER:** um arquivo
   `artefatos-backup-(data).json` baixado.
7. Teste de segurança: numa **janela anônima**, abra o site e tente entrar com **outra** conta Google.
   **VOCÊ DEVE VER:** "Esta conta Google não tem acesso".

Pronto: o site está no ar e funciona sem depender de nenhuma IA. Depois da meia-noite ele pede para
entrar de novo; isso é de propósito.

---

## Se algo der errado

| O que aparece | O que fazer |
|---|---|
| "Configure o login…" ou "Defina SESSION_SECRET…" | Falta alguma variável. Vercel → **Settings** → **Environment Variables**: confira os nomes, letra por letra. Depois **Deployments** → **…** → **Redeploy**. |
| Erro do Google **"redirect_uri_mismatch"** | O endereço do passo 3.4 (6) não é igual ao do site. Google Cloud → **Google Auth Platform** → **Clientes** → `artefatos-site` → corrija em "URIs de redirecionamento" → **Salvar**. Espere 5 minutos e tente de novo. |
| "Esta conta Google não tem acesso" com a sua conta | O e-mail em `ALLOWED_EMAILS` está diferente do que você usou para entrar. Corrija na Vercel e faça **Redeploy**. |
| "Acesso bloqueado: o app não concluiu o processo de verificação" | Seu e-mail não está em **Usuários de teste** (passo 3.3). |
| O artefato aparece em branco | Confira o segundo endereço (passo 2.5) e a variável `NEXT_PUBLIC_RUNNER_ORIGIN`, e faça **Redeploy**. |
| Depois de 7 dias sem usar, o site dá erro ao abrir a biblioteca | O Supabase grátis "adormeceu". Entre em **supabase.com** → projeto `artefatos` → **"Restore project"**. Os dados não se perdem. |

Se travar em qualquer passo, mande um print **sem chaves aparecendo** e diga o número do passo.
