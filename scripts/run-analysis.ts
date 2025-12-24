import { dequeueAnalysisJob } from "../src/lib/analysis-queue";
import { processAnalysisJob } from "../src/jobs/analyze-game";

async function main() {
  const job = await dequeueAnalysisJob();
  if (!job) {
    console.info("No hay trabajos pendientes en la cola de análisis.");
    return;
  }

  console.info(`Procesando análisis para gameId=${job.gameId}`);
  await processAnalysisJob(job);
  console.info("Análisis completado.");
}

main().catch((error) => {
  console.error("Error ejecutando análisis:", error);
  process.exit(1);
});

