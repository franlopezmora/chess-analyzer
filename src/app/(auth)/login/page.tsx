import Link from "next/link";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión | Chess Analyzer",
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  const googleEnabled =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET);

  const githubEnabled =
    Boolean(process.env.GITHUB_CLIENT_ID) &&
    Boolean(process.env.GITHUB_CLIENT_SECRET);

  return (
    <div className="auth-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="auth-card w-full max-w-md rounded-3xl surface-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <p className="hero-eyebrow text-sm tracking-[0.3em]">Chess Analyzer</p>
          <h1 className="mt-2 text-2xl font-semibold">Ingresá a tu tablero</h1>
          <p className="text-sm text-muted">
            Usa el usuario demo o conectá tus proveedores sociales cuando estén
            configurados.
          </p>
        </div>

        <LoginForm
          providers={{
            credentials: true,
            google: googleEnabled,
            github: githubEnabled,
          }}
        />

        <p className="mt-6 text-center text-xs text-muted">
          ¿No tenés cuenta?{" "}
          <Link href="/#" className="font-medium text-muted underline">
            Próximamente onboarding
          </Link>
        </p>
      </div>
    </div>
  );
}

