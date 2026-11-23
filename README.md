# Artefatos

Plataforma privada para guardar, rodar e editar os artefatos que você cria no Claude.

- **Importar** HTML de arquivo único ou componentes React (.jsx/.tsx): colando o código ou arrastando arquivos.
- **Biblioteca** com busca (sem diferenciar acentos) e tags.
- **Executar com segurança**: cada artefato roda num iframe isolado, em outra origem, sem acesso à sua sessão, aos seus cookies nem à rede.
- **Salvar alterações** com histórico de versões: abrir, restaurar ou baixar qualquer versão.
- **Dados do artefato** (localStorage, `window.storage`, `window.claude.use("db")`) ficam guardados na plataforma e voltam quando você abre de novo.
- **IA integrada**: peça a mudança em português, veja o diff e aceite (vira uma versão nova). Detalhes em [docs/ia-integrada.md](docs/ia-integrada.md).

## Rodar no seu computador

Precisa do Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # defina APP_PASSWORD (e ANTHROPIC_API_KEY para a IA)
npm run dev
```

Abra http://localhost:3000. Sem Supabase configurado, tudo fica em arquivos na pasta `data/` (faça backup dela).
Sem `APP_PASSWORD`, em desenvolvimento a plataforma abre sem senha; em produção ela se recusa a funcionar.

## Hospedar online (Vercel + Supabase)

1. **Supabase**: crie um projeto, abra o *SQL Editor* e rode `supabase/migrations/0001_init.sql`.
   Copie a *Project URL* e a *service_role key* (Settings → API).
2. **Vercel**: importe este repositório e defina as variáveis:
   `APP_PASSWORD`, `SESSION_SECRET` (`openssl rand -hex 32`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
3. **Dois domínios para o mesmo deploy**: um para a plataforma (ex.: `app.seudominio.com`) e outro só para rodar artefatos
   (ex.: `run.seudominio.com`). Defina `APP_ORIGIN=https://app.seudominio.com` e
   `NEXT_PUBLIC_RUNNER_ORIGIN=https://run.seudominio.com` e faça um novo deploy.
   Sem o segundo domínio funciona também, mas com uma camada de isolamento a menos (veja abaixo).

## Segurança da execução

| Camada | O que faz |
|---|---|
| Origem separada | O artefato é carregado de `NEXT_PUBLIC_RUNNER_ORIGIN`, que só serve `/run/shell`. |
| iframe `sandbox` sem `allow-same-origin` | O artefato fica com origem opaca: não lê cookies, storage nem a página pai. |
| CSP rígida (`/run/shell`) | `connect-src 'none'`: nada de fetch/XHR/WebSocket. Scripts e estilos só de CDNs conhecidas (cdnjs, jsdelivr, unpkg, esm.sh, Tailwind, jQuery) e Google Fonts. |
| Ponte por `MessagePort` | Só a página da plataforma fala com o servidor. O artefato pede (salvar dado, chamar a IA) e a plataforma decide. |
| Login | Senha única + cookie `httpOnly` assinado; rotas que mudam dados recusam outras origens. |

Limitações conhecidas: imagens e mídia podem vir de qualquer `https` (para não quebrar artefatos), então uma URL de imagem
poderia levar dados do próprio artefato para fora. Links externos abrem em nova aba.

## Compatibilidade com artefatos do Claude

O shim (`lib/runner/shim.ts`) recria fora do claude.ai:

| API | Situação |
|---|---|
| `localStorage` / `sessionStorage` | ✅ localStorage persiste na plataforma; sessionStorage só na sessão |
| `window.storage.get/set/delete/list` | ✅ persiste na plataforma |
| `window.claude.complete(prompt)` | ✅ via `/api/ai/complete` (precisa de `ANTHROPIC_API_KEY`) |
| `window.claude.use("db")` (`doc().set/get/update/onSnapshot`) | ✅ persiste na plataforma |
| `window.claude.use("sample")` | ✅ resposta inteira (sem streaming) |
| `window.claude.use("mcp")`, `use("assets")` | ❌ ainda não: o artefato recebe "não disponível" e entra no modo dele sem conector |

Testado com *Hub da Aline* (funciona, inclusive salvando os perfis) e *Dashboard de Cursos / sala5* (abre em modo leitura,
porque depende do conector do Google Sheets).

## Estrutura

```
app/                 páginas (biblioteca, importar, editor, tela cheia, login) e rotas de API
app/run/shell        página vazia servida na origem dos artefatos, com a CSP
components/runner    iframe + ponte com o servidor
components/ai        painel "Editar com IA"
lib/store            persistência: arquivos locais ou Supabase (mesma interface)
lib/runner           shim de window.claude, montagem do documento e CSP
lib/ai               cliente da API da Claude e edições por procurar/substituir
supabase/migrations  esquema do banco
```

## Testes

```bash
npm test                 # testes de unidade
npx tsc --noEmit         # tipos
# ponta a ponta (com o servidor rodando e Playwright instalado):
BASE=http://localhost:3000 PASSWORD=suasenha node scripts/e2e.mjs caminho/artefato.html
```
