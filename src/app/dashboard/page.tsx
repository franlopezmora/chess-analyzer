import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ManualBoard } from "@/features/manual-board/manual-board";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-2">
          <p className="hero-eyebrow text-xs tracking-[0.5em]">Panel</p>
          <h1 className="text-3xl font-semibold">
            Hola {session?.user?.name ?? "analista"}
          </h1>
          <p className="text-muted">
            Próximamente verás tus partidas, estado de análisis y métricas.
            Mientras tanto, este dashboard sirve para corroborar que el login
            funciona y para preparar capturas para tu portfolio.
          </p>
        </header>

        <section className="surface-card app-card rounded-3xl p-6">
          <ManualBoard />
        </section>
      </div>
    </main>
  );
}
