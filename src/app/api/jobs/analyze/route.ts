import { NextResponse } from "next/server";
import { dequeueAnalysisJob } from "@/lib/analysis-queue";
import { processAnalysisJob } from "@/jobs/analyze-game";

export async function POST() {
  const job = await dequeueAnalysisJob();

  if (!job) {
    return NextResponse.json(
      { processed: 0, message: "No hay trabajos pendientes." },
      { status: 200 },
    );
  }

  await processAnalysisJob(job);

  return NextResponse.json(
    {
      processed: 1,
      gameId: job.gameId,
    },
    { status: 200 },
  );
}

