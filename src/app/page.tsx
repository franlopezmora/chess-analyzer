import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="home-hero flex min-h-screen flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
        <p className="hero-eyebrow">Chess Analyzer</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Subí tus partidas, deja que Stockfish haga la magia y compartí tus
          insights en minutos.
        </h1>
        <p className="hero-description max-w-2xl text-base">
          El módulo de autenticación está listo para conectar Google y GitHub.
          Mientras tanto podés usar el usuario demo para navegar el dashboard y
          preparar capturas para tu portfolio.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          {session ? (
            <Link href="/dashboard" className="btn btn-primary">
              Ir al dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Iniciar sesión
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <a href="https://github.com/" target="_blank" rel="noreferrer" className="btn btn-outline">
            Ver roadmap
          </a>
        </div>
      </section>
      <footer className="section-border px-6 py-6 text-center text-xs text-muted">
        Login demo: <code>demo@chess-analyzer.dev</code> · Contraseña:{" "}
        <code>Demo1234!</code>
      </footer>
    </main>
  );
}
