# Artefatos

> **Vai continuar o trabalho em outra conta ou outra IA?** Comece pela pasta [`handoff/`](handoff/LEIA-ME.md).

Plataforma privada para guardar, rodar e editar os artefatos que você cria no Claude.

- **Importar** HTML de arquivo único ou componentes React (.jsx/.tsx): colando o código ou arrastando arquivos.
- **Biblioteca** com busca (sem diferenciar acentos) e tags.
- **Executar com segurança**: cada artefato roda num iframe isolado, em outra origem, sem acesso à sua sessão, aos seus cookies nem à rede.
- **Salvar alterações** com histórico de versões: abrir, restaurar ou baixar qualquer versão.
- **Dados do artefato** (localStorage, `window.storage`, `window.claude.use("db")`) ficam guardados na plataforma e voltam quando você abre de novo.
- **Sem IA dentro do site**: as mudanças são feitas nas conversas com as IAs (Claude, ChatGPT, Gemini) e entram aqui como versão nova.

## Rodar no seu computador

Precisa do Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # defina APP_PASSWORD (ou o login Google)
npm run dev
```

Abra http://localhost:3000. Sem Supabase configurado, tudo fica em arquivos na pasta `data/` (faça backup dela).
Sem `APP_PASSWORD`, em desenvolvimento a plataforma abre sem senha; em produção ela se recusa a funcionar.

## Hospedar online (Vercel + Supabase, grátis)

Siga o passo a passo em [`docs/colocar-no-ar.md`](docs/colocar-no-ar.md). Em resumo:
Supabase para os dados, Google Cloud só para o botão "Entrar com Google", e Vercel para o site,
com um segundo endereço `*-run.vercel.app` só para rodar os artefatos.

## Login

- **Entrar com Google**: só os e-mails em `ALLOWED_EMAILS` entram.
- **Senha única** (`APP_PASSWORD`): opcional, útil no computador ou como reserva.
- A sessão vale até a **meia-noite** (fuso `SESSION_TIMEZONE`, padrão `America/Sao_Paulo`). Tirar um e-mail
  da lista derruba a sessão dele na hora.

## Backup

O botão **Baixar backup** (no topo) baixa um `.json` com todos os artefatos, todas as versões (código)
e os dados salvos por cada artefato.

## Segurança da execução

| Camada | O que faz |
|---|---|
| Origem separada | O artefato é carregado de `NEXT_PUBLIC_RUNNER_ORIGIN`, que só serve `/run/shell`. |
| iframe `sandbox` sem `allow-same-origin` | O artefato fica com origem opaca: não lê cookies, storage nem a página pai. |
| CSP rígida (`/run/shell`) | `connect-src 'none'`: nada de fetch/XHR/WebSocket. Scripts e estilos só de CDNs conhecidas (cdnjs, jsdelivr, unpkg, esm.sh, Tailwind, jQuery) e Google Fonts. |
| Ponte por `MessagePort` | Só a página da plataforma fala com o servidor. O artefato pede (salvar dado) e a plataforma decide. |
| Login | Google (só e-mails autorizados) ou senha; cookie `httpOnly` assinado que vence à meia-noite; rotas que mudam dados recusam outras origens. |

Limitações conhecidas: imagens e mídia podem vir de qualquer `https` (para não quebrar artefatos), então uma URL de imagem
poderia levar dados do próprio artefato para fora. Links externos abrem em nova aba.

## Compatibilidade com artefatos do Claude

O shim (`lib/runner/shim.ts`) recria fora do claude.ai:

| API | Situação |
|---|---|
| `localStorage` / `sessionStorage` | ✅ localStorage persiste na plataforma; sessionStorage só na sessão |
| `window.storage.get/set/delete/list` | ✅ persiste na plataforma |
| `window.claude.complete(prompt)` | ❌ sem IA no site: o artefato recebe "não disponível" |
| `window.claude.use("db")` (`doc().set/get/update/onSnapshot`) | ✅ persiste na plataforma |
| `window.claude.use("sample")` | ❌ sem IA no site: recebe "não disponível" |
| `window.claude.use("mcp")`, `use("assets")` | ❌ ainda não: o artefato recebe "não disponível" e entra no modo dele sem conector |

Testado com *Hub da Aline* (funciona, inclusive salvando os perfis) e *Dashboard de Cursos / sala5* (abre em modo leitura,
porque depende do conector do Google Sheets).

## Estrutura

```
app/                 páginas (biblioteca, importar, editor, tela cheia, login) e rotas de API
app/run/shell        página vazia servida na origem dos artefatos, com a CSP
components/runner    iframe + ponte com o servidor
lib/store            persistência: arquivos locais ou Supabase (mesma interface)
lib/runner           shim de window.claude, montagem do documento e CSP
lib/auth.ts, lib/google.ts  sessão e login com Google
docs/                guia para colocar no ar
supabase/migrations  esquema do banco
```

## Testes

```bash
npm test                 # testes de unidade
npx tsc --noEmit         # tipos
# ponta a ponta (com o servidor rodando e Playwright instalado):
BASE=http://localhost:3000 PASSWORD=suasenha node scripts/e2e.mjs caminho/artefato.html
```
