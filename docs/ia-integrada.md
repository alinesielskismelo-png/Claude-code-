# IA integrada (primeira versão)

Edição de artefatos por IA e suporte a `window.claude.complete` dentro dos artefatos.

## Como funciona

1. No editor, a usuária escreve o que quer mudar no painel **Editar com IA** (`components/ai/AiEditPanel.tsx`).
2. O painel chama `POST /api/ai/edit` com o código atual e o pedido.
3. O servidor chama a API da Claude, que devolve **edições de procurar e substituir** (não o arquivo inteiro). Isso funciona até em artefatos grandes, como o `sala5.html` (700 KB), e é mais barato.
4. O servidor aplica as edições. Se alguma não casar com o código, devolve o erro à IA uma vez para ela corrigir.
5. O painel mostra o diff linha a linha. **Aceitar** salva uma nova versão (via `onAccept`, que o editor liga a `POST /api/artifacts/[id]/versions` com `source: "ai"`). **Descartar** não salva nada.
6. **Desfazer** salva o código anterior como uma nova versão. O histórico continua linear e nada é apagado.

## Rotas

| Rota | Corpo | Resposta |
|---|---|---|
| `POST /api/ai/edit` | `{ code, instruction, title? }` | `{ code, summary, edits, usage }` |
| `POST /api/ai/complete` | `{ prompt }` ou `{ messages }` | `{ text }` |

Erros sempre vêm como `{ error }`. Sem chave configurada, as duas rotas respondem **501**.

O iframe do artefato não chama `/api/ai/complete` direto: o shim envia `postMessage` para a página pai, e a página pai (mesma origem) chama a rota. Esse lado fica no runner do MVP (`components/runner/Bridge`).

## Configuração (variáveis de ambiente, só no servidor)

| Variável | Padrão | Para quê |
|---|---|---|
| `ANTHROPIC_API_KEY` | (obrigatória) | Chave da API da Claude. Nunca vai para o navegador. |
| `AI_MODEL` | `claude-opus-5-5` | Modelo usado. |
| `AI_EDIT_EFFORT` | `high` | Esforço nas edições de código (`low` a `max`). |
| `AI_COMPLETE_EFFORT` | `low` | Esforço em `window.claude.complete`. |
| `AI_COMPLETE_RPM` | `30` | Pedidos por minuto aceitos em `/api/ai/complete`. |
| `AI_MAX_CODE_CHARS` | `2000000` | Tamanho máximo do artefato para edição. |

Dependência: `@anthropic-ai/sdk` (testado com 1.12.0).

## Custos (estimativa)

Cada edição envia o artefato inteiro. Um artefato de 100 KB tem cerca de 30 mil tokens, o que custa por volta de US$ 0,12 de entrada por pedido no Claude Opus 5.5 (US$ 4 por milhão). Pedidos seguidos no mesmo artefato em poucos minutos reaproveitam o cache e saem bem mais baratos. O `sala5.html` (700 KB) custa perto de US$ 0,80 no primeiro pedido.

## Suposições desta versão

- **Stack**: Next.js App Router + TypeScript, alias `@/` na raiz, como no esqueleto do MVP. A escolha final de stack ainda é da Aline.
- **Login**: as rotas de IA confiam que o app já exige login (middleware do esqueleto). Elas só checam a origem e limitam pedidos por minuto. Sem login, qualquer pessoa com o endereço poderia gastar a chave.
- **Fallback de recusa**: as chamadas usam `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Se o modelo recusar um pedido por segurança, a API tenta automaticamente outro modelo. Dá para remover em `lib/ai/anthropic.ts`.
- **Limite por minuto em memória**: funciona num servidor só. Na Vercel, com várias instâncias, é aproximado.
- `window.claude.complete` devolve o texto inteiro, sem streaming.

## Testes

```bash
node --test --experimental-strip-types tests/ai-edits.test.ts
```
