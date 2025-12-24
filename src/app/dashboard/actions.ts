"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Chess } from "chess.js";
import { parse } from "@mliebelt/pgn-parser";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AnalysisStatus,
  GameResult,
} from "@/generated/prisma/client";
import { enqueueAnalysisJob } from "@/lib/analysis-queue";
import { processAnalysisJob } from "@/jobs/analyze-game";

type ParsedTag = { name: string; value: string };
type ParsedGameNode = {
  tags?: ParsedTag[];
  result?: string;
};

const uploadSchema = z.object({
  title: z.string().trim().optional(),
  pgn: z
    .string()
    .trim()
    .min(10, "El PGN es obligatorio y debe tener al menos 10 caracteres."),
});

const resultMap: Record<string, GameResult> = {
  "1-0": GameResult.WHITE_WIN,
  "0-1": GameResult.BLACK_WIN,
  "1/2-1/2": GameResult.DRAW,
};

function parseDateTag(rawDate?: string | null) {
  if (!rawDate || rawDate.includes("?")) {
    return undefined;
  }
  const normalized = rawDate.replace(/\./g, "-");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

type UploadState = {
  success?: boolean;
  message?: string;
  error?: string;
};

export async function uploadGameAction(
  _prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Debes iniciar sesión para subir partidas." };
  }

  const result = uploadSchema.safeParse({
    title: formData.get("title"),
    pgn: formData.get("pgn"),
  });

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { pgn, title } = result.data;

  let parsedGame: ParsedGameNode | undefined;
  try {
    const parsedRaw = parse(pgn, { startRule: "game" }) as
      | ParsedGameNode
      | ParsedGameNode[];
    parsedGame = Array.isArray(parsedRaw) ? parsedRaw[0] : parsedRaw;
  } catch {
    return { error: "El PGN no pudo parsearse. Verificá el formato." };
  }

  if (!parsedGame) {
    return { error: "No se encontró una partida válida en el PGN." };
  }

  const tags = Object.fromEntries(
    (parsedGame.tags ?? []).map((tag: ParsedTag) => [tag.name, tag.value]),
  );
  const parsedResult = parsedGame.result ?? "";
  const gameResult =
    parsedResult && parsedResult in resultMap
      ? resultMap[parsedResult]
      : GameResult.UNKNOWN;

  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    return { error: "No se pudo cargar el PGN en el motor de ajedrez." };
  }

  const verboseMoves = chess.history({ verbose: true });
  const replay = new Chess();
  const movesData = verboseMoves.map((move, index) => {
    replay.move(move);
    return {
      id: `${session.user.id}-${Date.now()}-${index + 1}`,
      ply: index + 1,
      san: move.san,
      fen: replay.fen(),
    };
  });

  if (movesData.length === 0) {
    return { error: "El PGN no contiene movimientos." };
  }

  try {
    const savedGame = await prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          userId: session.user.id,
          title:
            title ||
            tags.Event ||
            `Partida ${new Date().toLocaleDateString("es-AR")}`,
          opponent: tags.Black ?? null,
          event: tags.Event ?? null,
          site: tags.Site ?? null,
          date: parseDateTag(tags.Date) ?? null,
          result: gameResult,
          eco: tags.ECO ?? null,
          opening: tags.Opening ?? null,
          termination: tags.Termination ?? null,
          timeControl: tags.TimeControl ?? null,
          source: tags.Source ?? "Upload web",
          status: AnalysisStatus.PENDING,
          pgn,
        },
      });

      await tx.move.deleteMany({
        where: { gameId: game.id },
      });

      await tx.move.createMany({
        data: movesData.map((move) => ({
          id: `${game.id}-${move.ply}`,
          gameId: game.id,
          ply: move.ply,
          san: move.san,
          fen: move.fen,
        })),
      });

      return game;
    });

    const enqueued = await enqueueAnalysisJob({ gameId: savedGame.id });
    if (!enqueued) {
      await processAnalysisJob({ gameId: savedGame.id });
    }

    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Partida "${savedGame.title}" subida correctamente. Se analizará en breve.`,
    };
  } catch (error) {
    console.error("[uploadGameAction]", error);
    return {
      error: "No se pudo guardar la partida. Inténtalo nuevamente.",
    };
  }
}

