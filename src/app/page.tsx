import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="home-hero flex min-h-screen flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
        <p className="hero-eyebrow">Chess Analyzer</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Subí tus partidas, deja que Stockfish haga la magia y compartí tus
          insights en minutos.
        </h1>
        <p className="hero-description max-w-2xl text-base">
          Accedé directo al dashboard para probar la experiencia y preparar
          capturas de tu portfolio mientras dejamos el login en pausa.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link href="/dashboard" className="btn btn-primary">
            Ir al dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
