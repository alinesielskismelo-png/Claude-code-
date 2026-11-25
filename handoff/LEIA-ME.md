# Pacote de passagem — projeto da Aline

> **Para a IA que está chegando:** este arquivo é o ponto de partida. Leia tudo antes de agir.
> Ele existe para que qualquer conta do Claude (ou outra IA) continue o trabalho da Aline
> do ponto onde a conta anterior parou, sem que ela precise explicar tudo de novo.
>
> **Última atualização:** 25/11/2026 (horário de Brasília) — Claude (outra conta, pelo Claude Duet)

---

## 1. Regra de manutenção (vale para toda IA que trabalhar aqui)

1. **Ao terminar cada etapa**, atualize este arquivo: a seção 4 (estado), a seção 6 (próximos passos)
   e a data de "Última atualização" acima. Depois acrescente uma linha no [DIARIO.md](DIARIO.md).
2. **Não espere os créditos acabarem.** Nenhuma IA consegue saber com certeza quando os créditos da
   conta vão acabar. Por isso o pacote precisa estar **sempre** atualizado, e não só "no fim".
3. **Nunca** escreva aqui senhas, chaves secretas (`service_role`, `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`,
   `APP_PASSWORD`), códigos de verificação ou dados pessoais sensíveis. **Este repositório é público**:
   qualquer pessoa na internet pode ler o que está aqui.
4. Acrescente, não apague: corrija informações erradas, mas mantenha o histórico no DIARIO.md.
5. Escreva em português, simples. A Aline é iniciante.

---

## 2. Quem é a Aline e como trabalhar com ela

- Fala **português**. É **iniciante** em programação: explique sempre **passo a passo**, numerado,
  dizendo onde clicar e o que copiar. Explique cada termo técnico em uma frase.
- Quer **custo zero** (planos gratuitos).
- Usa um **iPad** (6ª geração, iPadOS 17) e também computador. O iPad fica para depois; a prioridade agora
  é o site funcionando.
- Gosta de ser chamada para **decidir**: apresente as opções com uma recomendação e o porquê.
- O site é de **uso pessoal**: não coloque avisos, banners de privacidade ou termos.
- Ela usa **várias IAs**: Claude (conta principal e conta secundária), ChatGPT, Gemini e Grok.

### Regras de visual (painéis e dashboards)
- **Nada de rosa** no Painel da Aline, na aba Cursos nem no Dashboard de Cursos.
- Paleta comum: **creme + marinho + azul**; vermelho só para alertas.
- **Nunca deixar item sem logo.** Manter as logos que ela já colocou e buscar as que faltam.
- Preservar a **identidade de cada instituição** (Harvard bordô, Google 4 cores, Fiocruz azul com faixa
  colorida, Coursera azul).
- No Painel, cada curso é só **visão geral**, com um botão de "fuga" para o Dashboard de Cursos.
- Versão preferida da aba Cursos: **"só informativo"** (só refinar, não reinventar).
- O Claude é o **responsável final pelo design e acabamento**. As outras IAs propõem; o Claude avalia,
  aproveita o que for melhor e corrige o que fugir da identidade (em especial o Grok, que ainda não
  conhece bem o estilo dela).

---

## 3. Objetivo geral

Construir o **Sielskis Workspace** (nome provisório): uma plataforma privada onde a Aline importa os
códigos dos artefatos criados no Claude, organiza numa biblioteca, roda com segurança e salva versões.

**Decisão da Aline: o site NÃO tem IA dentro.** Ela pede mudanças nos chats das IAs, e as IAs alimentam o
site (pelo repositório ou importando o código). Não reative a IA integrada.

---

## 4. Estado de cada frente

### 4.1 Site Sielskis Workspace (este repositório)
- **Código:** pronto na branch `main` (Next.js 16 + TypeScript). Biblioteca, versões, execução isolada,
  backup, login por senha única e login com Google. Detalhes técnicos no [README](../README.md).
- **Guia para colocar no ar:** [docs/colocar-no-ar.md](../docs/colocar-no-ar.md).
- **Supabase (banco de dados):** ✅ criado. Projeto `sielskis-workspace`, banco com as 3 tabelas da
  migração `supabase/migrations/0001_init.sql`.
- **Vercel (hospedagem):** ✅ **no ar desde 24/11.** Projeto `sielskis-workspace` (conta `alinesielskisicloud`).
  - Site: https://sielskis-workspace.vercel.app (entra com a senha `APP_PASSWORD`, que só a Aline sabe).
  - Endereço onde os artefatos rodam isolados: https://sielskis-workspace-run.vercel.app
  - Variáveis preenchidas: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`, `NEXT_PUBLIC_RUNNER_ORIGIN`.
  - Toda vez que algo entra na branch `main`, a Vercel publica sozinha a versão nova.
  - Se a Vercel disser "Para vincular um repositório do GitHub...", vá em Vercel > Account Settings >
    Authentication > GitHub > "..." > **Reautenticar**. Isso resolveu em 24/11.
- **Login com Google:** ⏳ depois que o site estiver no ar.
- **Contas do GitHub:** a Aline tem duas. `alinesielskismelo-png` é dona deste repositório;
  `alinesielskisicloud` está ligada à Vercel e ao Supabase. Se a Vercel não listar o repositório,
  importe pela URL: `vercel.com/new/import?s=https://github.com/alinesielskismelo-png/Claude-code-`.
- **Feito em 25/11 (PRs #6 a #13, já na `main`):** Hub como página inicial, ligação com o Google para os
  artefatos (Agenda, Drive, Planilhas e Gmail pelo `window.claude.use("mcp")`), fotos e arquivos
  (`use("assets")`) e ajustes de cota do Gmail e de fuso da Agenda.
- **Em revisão (branch `claude/ponte-com-ias`):** aba **"Com IA"** no editor. Sem IA dentro do site: ela monta
  o pedido com o código para colar no chat da IA e lê a resposta colada de volta, mostra o que mudou,
  avisa se a IA cortou partes e salva como versão "IA". Só entra no ar quando a Aline aprovar o merge.
- **Ainda não funciona na plataforma:** conectores que não sejam do Google.

### 4.2 Painel da Aline e Dashboard de Cursos (artefatos no Claude)
- **Painel da Aline:** abas Faculdade (PUC Goiás, Direito 2026.2, notas N1/N2) e Cursos
  ("só informativo"). Aba Faculdade redesenhada e concluída em 23/11.
- **Dashboard de Cursos** (= Sala de Extensão = e-learning): página própria dos cursos (Harvard, Google,
  Fiocruz, Coursera…). O Painel aponta para ele com um único botão "Abrir o Dashboard de Cursos ↗".
- **Hub da Aline:** conecta o e-learning e o Painel.
- Ainda falta saber **qual matéria cai em qual dia/aula** (horário: manhã, 7h às 12h15, 3 aulas).

### 4.3 Atlas Visual de Pesquisa (Canva) — "EstagIÁrios"
- O ChatGPT pediu ao Claude a revisão da diagramação. O Claude entregou um PDF de 29 páginas
  (Drive, pasta "EstagIÁrios") e uma nota no Evernote. Em 23/11 havia uma rodada de correções em andamento.
- Regras do caderno EstagIÁrios (Evernote): leia primeiro a nota
  "📌 LEIA PRIMEIRO — Manual de colaboração dos EstagIÁrios". Título das notas:
  "Nome da IA – DD/MM/AA – Assunto"; nunca editar a nota de outra IA; só escrever quando a Aline pedir.

### 4.4 Documento compartilhado entre IAs (Google Docs)
- "Cooperação de IAs para o site": espaço de **debate**. Cada IA defende sua proposta com argumentos
  realistas e **a Aline decide**.
- Trecho com marca-texto amarelo **"Recado Aline"** = comando para todas as IAs. Cada IA responde no
  documento e no próprio chat: resumo, propostas, voto e justificativa.
- Nunca apagar ou sobrescrever o registro de outra IA. Distinguir fato de hipótese.
- Papéis: ChatGPT = conteúdo e coordenação; Gemini = segurança, acessibilidade e jurídico;
  Grok = co-designer e engenharia/dados (supervisionado pelo Claude); Claude principal = integração,
  design final e testes; Claude secundário = reserva.

---

## 5. Links

| O quê | Link |
|---|---|
| Este repositório | https://github.com/alinesielskismelo-png/Claude-code- |
| Este pacote | https://github.com/alinesielskismelo-png/Claude-code-/tree/main/handoff |
| Documento compartilhado entre IAs | https://docs.google.com/document/d/10i_h8BGG6IJ_XKzDFAWPy86kekHA4hR7O_PFao_CZCk/edit |
| Painel da Aline (artefato) | https://claude.ai/artifact/WixrzYsxPePK2w3RexjY8x |
| Dashboard de Cursos (artefato) | https://claude.ai/artifact/LnWxHre8eFUooY9eR6QhGt |
| Hub da Aline (artefato) | https://claude.ai/artifact/Y98v7GeUBHsNruk4zCyPhU |
| Evernote | caderno **"EstagIÁrios"** |
| Google Drive | pastas **"EstagIÁrios"** e **"01 Faculdade PUC Goiás › 2026 › 2026.2"** (uma pasta por matéria, "Nome (2026.2)") |
| Canva | design **"Atlas Visual de Pesquisa"** |

> ⚠️ Os artefatos do Claude são **privados da conta que os criou**. Outra conta do Claude não consegue
> abrir esses links. Para continuar um painel em outra conta, a Aline baixa o arquivo HTML do artefato
> (botão de baixar/copiar código) e anexa no chat novo. Veja o [COMO-PASSAR.md](COMO-PASSAR.md).

---

## 6. Próximos passos (em ordem)

1. ~~Vercel~~ ✅ feito em 24/11.
2. **Revisar e aprovar a aba "Com IA"** (pull request da branch `claude/ponte-com-ias`). Ao aprovar o merge,
   a Vercel publica sozinha.
3. **Testar o site no ar:** a Aline entra com a senha, importa um artefato (ex.: o Hub da Aline), salva
   uma versão e baixa o backup.
4. **Importar os artefatos** (Hub, Painel, Dashboard de Cursos) para o site.
5. **Login com Google** (Google Cloud + `ALLOWED_EMAILS`), seguindo `docs/colocar-no-ar.md`.
6. **Painel:** descobrir com a Aline o horário de cada matéria; seguir refinando a aba Cursos
   "só informativo".
7. **Depois:** testes no iPad.

---

## 7. O que nunca fazer
- Colocar segredos ou senhas em arquivos, commits, documentos ou mensagens.
- Reativar IA dentro do site.
- Usar rosa nos painéis, ou deixar curso/instituição sem logo.
- Apagar registros de outras IAs no documento compartilhado ou no Evernote.
- Clicar em botões que publicam, pagam ou mudam permissões sem a Aline aprovar.
