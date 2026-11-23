// Configuração da IA integrada. Tudo aqui roda só no servidor.
// A chave (ANTHROPIC_API_KEY) nunca é enviada ao navegador nem ao iframe do artefato.

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

function effortFromEnv(name: string, fallback: Effort): Effort {
  const value = process.env[name];
  return value && (EFFORTS as string[]).includes(value) ? (value as Effort) : fallback;
}

export const aiConfig = {
  // Modelo padrão. Pode ser trocado por AI_MODEL sem mexer no código.
  model: process.env.AI_MODEL || "claude-opus-5-5",
  // Edição de código: esforço alto. window.claude.complete: baixo, para ser rápido e barato.
  editEffort: effortFromEnv("AI_EDIT_EFFORT", "high"),
  completeEffort: effortFromEnv("AI_COMPLETE_EFFORT", "low"),
  // Limites de segurança contra abuso e custo.
  maxCodeChars: Number(process.env.AI_MAX_CODE_CHARS || 2_000_000),
  maxInstructionChars: 8_000,
  maxCompleteChars: Number(process.env.AI_MAX_COMPLETE_CHARS || 200_000),
  completeRequestsPerMinute: Number(process.env.AI_COMPLETE_RPM || 30),
};

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
