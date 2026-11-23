/** Host (sem protocolo) da origem separada onde os artefatos rodam, se configurada. */
export function runnerHost(): string | null {
  const o = process.env.NEXT_PUBLIC_RUNNER_ORIGIN;
  if (!o) return null;
  try {
    return new URL(o).host;
  } catch {
    return null;
  }
}

/** Origem da plataforma, usada para restringir quem pode embutir o runner. */
export function appOrigin(): string | null {
  return process.env.APP_ORIGIN || null;
}
