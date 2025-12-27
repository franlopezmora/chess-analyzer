import { ManualBoard } from "@/features/manual-board/manual-board";

export default function DashboardPage() {
  return (
    <main className="px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-2">
          <p className="hero-eyebrow text-xs tracking-[0.5em]">Panel</p>
          <h1 className="text-3xl font-semibold">Hola analista</h1>
          <p className="text-muted">
            Próximamente verás tus partidas, estado de análisis y métricas.
            Mientras tanto, este dashboard queda abierto para validar la
            experiencia y preparar capturas para tu portfolio.
          </p>
        </header>

        <section className="surface-card app-card rounded-3xl p-6">
          <ManualBoard />
        </section>
      </div>
    </main>
  );
}
