/**
 * Origem onde os artefatos rodam. Em produção vem de NEXT_PUBLIC_RUNNER_ORIGIN.
 * Em desenvolvimento troca localhost <-> 127.0.0.1, que o navegador trata como origens diferentes.
 */
export function getRunnerOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_RUNNER_ORIGIN;
  if (configured) return configured.replace(/\/+$/, "");
  const { protocol, hostname, port } = window.location;
  const p = port ? `:${port}` : "";
  if (hostname === "localhost") return `${protocol}//127.0.0.1${p}`;
  if (hostname === "127.0.0.1") return `${protocol}//localhost${p}`;
  return window.location.origin;
}
