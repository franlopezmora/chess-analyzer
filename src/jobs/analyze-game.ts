import { Chess } from "chess.js";
import StockfishFactory from "stockfish/src/stockfish-17.1-lite-single-03e3232.js";
import {
  AnalysisStatus,
  MoveClassification,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AnalysisJobPayload } from "@/lib/analysis-queue";

type EvaluationResult = {
  moveId: string;
  evaluation: number;
  bestMove?: string;
  classification: MoveClassification;
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export async function processAnalysisJob({
  gameId,
}: AnalysisJobPayload): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      moves: {
        orderBy: { ply: "asc" },
      },
    },
  });

  if (!game) {
    console.warn(`[analysis] Game ${gameId} no encontrado`);
    return;
  }

  const { evaluations, maxDepth } = await evaluateMovesWithEngine(game.moves);
  const summary = summarizeEvaluations(evaluations, maxDepth);

  await prisma.analysis.upsert({
    where: { gameId: game.id },
    create: {
      gameId: game.id,
      engine: process.env.STOCKFISH_ENGINE_NAME ?? "Stockfish",
      depth: summary.depth,
      averageCentipawnLoss: summary.averageLoss,
      totalTimeMs: summary.etaMs,
      completedAt: new Date(),
      moves: {
        create: evaluations.map((move) => ({
          moveId: move.moveId,
          evaluationCp: move.evaluation,
          bestMove: move.bestMove,
          classification: move.classification,
        })),
      },
    },
    update: {
      engine: process.env.STOCKFISH_ENGINE_NAME ?? "Stockfish",
      depth: summary.depth,
      averageCentipawnLoss: summary.averageLoss,
      totalTimeMs: summary.etaMs,
      completedAt: new Date(),
      moves: {
        deleteMany: {},
        create: evaluations.map((move) => ({
          moveId: move.moveId,
          evaluationCp: move.evaluation,
          bestMove: move.bestMove,
          classification: move.classification,
        })),
      },
    },
  });

  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: AnalysisStatus.COMPLETED,
      accuracy: summary.accuracy,
      blunders: summary.blunders,
      mistakes: summary.mistakes,
      inaccuracies: summary.inaccuracies,
    },
  });
}

async function evaluateMovesWithEngine(moves: { id: string; san: string }[]) {
  const chess = new Chess();
  const evaluations: EvaluationResult[] = [];
  let previousScore = 0;
  let maxDepth = 0;

  for (const move of moves) {
    chess.move(move.san);
    const fen = chess.fen();
    const { cp, bestMove, depth } = await getEvaluation(fen);
    const delta = Math.abs(cp - previousScore);
    maxDepth = Math.max(maxDepth, depth ?? 0);

    evaluations.push({
      moveId: move.id,
      evaluation: cp,
      bestMove,
      classification: classifyDelta(delta),
    });

    previousScore = cp;
  }

  return { evaluations, maxDepth };
}

function classifyDelta(delta: number): MoveClassification {
  if (delta > 180) {
    return MoveClassification.BLUNDER;
  }
  if (delta > 90) {
    return MoveClassification.MISTAKE;
  }
  if (delta > 45) {
    return MoveClassification.INACCURACY;
  }
  return MoveClassification.GOOD;
}

async function getEvaluation(fen: string) {
  if (process.env.STOCKFISH_ENABLED !== "true") {
    return {
      cp: heuristicMaterialScore(fen),
      bestMove: undefined,
      depth: 0,
    };
  }

  try {
    const engine = StockfishFactory();
    const targetDepth = Number(process.env.STOCKFISH_DEPTH ?? 12);

    let resolved = false;
    let evaluation = 0;
    let bestMove: string | undefined;
    let depthReached = 0;

    const messageHandler = (message: { data?: string } | string) => {
      const text = typeof message === "string" ? message : message.data ?? "";

      if (text === "uciok") {
        engine.postMessage?.("isready");
        return;
      }

      if (text === "readyok") {
        engine.postMessage?.(`position fen ${fen}`);
        engine.postMessage?.(`go depth ${targetDepth}`);
        return;
      }

      if (text.startsWith("info") && text.includes("score")) {
        const depthMatch = text.match(/depth (\d+)/);
        if (depthMatch) {
          depthReached = Number(depthMatch[1]);
        }

        const mateMatch = text.match(/score mate (-?\d+)/);
        if (mateMatch) {
          evaluation = Number(mateMatch[1]) > 0 ? 1000 : -1000;
        } else {
          const cpMatch = text.match(/score cp (-?\d+)/);
          if (cpMatch) {
            evaluation = Number(cpMatch[1]);
          }
        }
      }

      if (text.startsWith("bestmove")) {
        const [, move] = text.split(" ");
        bestMove = move;
        resolved = true;
      }
    };

    engine.onmessage = messageHandler as (
      message: string | { data?: string }
    ) => void;
    engine.postMessage?.("uci");

    await new Promise<void>((resolve) => {
      const timeout = Number(process.env.STOCKFISH_TIMEOUT_MS ?? 4000);
      setTimeout(() => {
        if (!resolved) {
          engine.postMessage?.("stop");
        }
        engine.postMessage?.("quit");
        resolve();
      }, timeout);
    });

    return {
      cp: evaluation,
      bestMove,
      depth: depthReached || targetDepth,
    };
  } catch (error) {
    console.warn("[stockfish] Error evaluating fen. Fallback en heurística.", error);
    return {
      cp: heuristicMaterialScore(fen),
      bestMove: undefined,
      depth: 0,
    };
  }
}

function heuristicMaterialScore(fen: string) {
  const chess = new Chess(fen === START_FEN ? undefined : fen);
  const board = chess.board();
  const values: Record<string, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 0,
  };

  let score = 0;
  for (const row of board) {
    for (const square of row) {
      if (!square) continue;
      const value = values[square.type];
      score += square.color === "w" ? value : -value;
    }
  }
  return score;
}

function summarizeEvaluations(
  evaluations: EvaluationResult[],
  depth: number,
) {
  if (evaluations.length === 0) {
    return {
      averageLoss: 0,
    depth: depth,
      etaMs: 0,
      accuracy: 0,
      blunders: 0,
      mistakes: 0,
      inaccuracies: 0,
    };
  }

  const losses = evaluations.map((move) => Math.abs(move.evaluation));
  const averageLoss =
    losses.reduce((acc, value) => acc + value, 0) / evaluations.length;

  const blunders = evaluations.filter(
    (move) => move.classification === MoveClassification.BLUNDER,
  ).length;
  const mistakes = evaluations.filter(
    (move) => move.classification === MoveClassification.MISTAKE,
  ).length;
  const inaccuracies = evaluations.filter(
    (move) => move.classification === MoveClassification.INACCURACY,
  ).length;

  const accuracy = Math.max(
    0,
    100 - averageLoss / (10 + evaluations.length),
  );

  return {
    averageLoss,
    depth: depth || Number(process.env.STOCKFISH_DEPTH ?? 12),
    etaMs: evaluations.length * Number(process.env.STOCKFISH_TIMEOUT_MS ?? 4000),
    accuracy: Number(accuracy.toFixed(2)),
    blunders,
    mistakes,
    inaccuracies,
  };
}

