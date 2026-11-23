import { googleConfigured, passwordConfigured } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  "email-nao-autorizado": "Esta conta Google não tem acesso. Entre com o e-mail autorizado.",
  "google-falhou": "O Google não confirmou o login. Tente de novo.",
  "sessao-expirada": "O login demorou demais. Tente de novo.",
  cancelado: "Login cancelado.",
  "google-desligado": "O login com Google ainda não foi configurado.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  return (
    <main className="login">
      <LoginForm
        google={googleConfigured()}
        password={passwordConfigured()}
        next={next}
        initialError={(sp.erro && ERROS[sp.erro]) || ""}
      />
    </main>
  );
}
