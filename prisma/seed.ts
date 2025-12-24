import {
  AnalysisStatus,
  GameResult,
  JobStatus,
  MoveClassification,
} from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const SEED_USER_EMAIL = "demo@chess-analyzer.dev";
const SEED_GAME_ID = "seed-game-classic";
const SEED_TAG_LABEL = "Destacada";

async function main() {
  const passwordHash = await bcrypt.hash(
    process.env.SEED_USER_PASSWORD ?? "Demo1234!",
    12,
  );

  const demoUser = await prisma.user.upsert({
    where: { email: SEED_USER_EMAIL },
    update: {
      name: "Demo Analyst",
      bio: "Jugador entusiasta que usa Chess Analyzer para documentar sus partidas.",
      passwordHash,
    },
    create: {
      id: "seed-user-demo",
      email: SEED_USER_EMAIL,
      name: "Demo Analyst",
      bio: "Jugador entusiasta que usa Chess Analyzer para documentar sus partidas.",
      locale: "es-AR",
      image: "https://avatars.githubusercontent.com/u/9919?s=200&v=4",
      passwordHash,
    },
  });

  const featuredTag = await prisma.tag.upsert({
    where: {
      userId_label: {
        userId: demoUser.id,
        label: SEED_TAG_LABEL,
      },
    },
    update: {},
    create: {
      id: "seed-tag-featured",
      userId: demoUser.id,
      label: SEED_TAG_LABEL,
      slug: "destacada",
      color: "#0ea5e9",
    },
  });

  const pgn = `[Event "Demo Match"]
[Site "Buenos Aires"]
[Date "2024.11.30"]
[Round "-"]
[White "Demo Analyst"]
[Black "Lichess Bot"]
[Result "1-0"]
[ECO "C50"]
[Opening "Italian Game"]
[Termination "Normal"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 d5 8. exd5 Nxd5 9. O-O Be6 10. Qb3 Na5 11. Qa4+ c6 12. Bxd5 Bxc3 13. Bxe6 b5 14. Qc2 fxe6 15. Qxc3 O-O 16. Re1 Qd5 17. Qxa5 Rxf3 18. gxf3 Qxf3 19. Qc3 Qf5 20. Qxc6 Rf8 21. Qxe6+ Qxe6 22. Rxe6 Rd8 23. Be3 Kf7 24. Ra6 Rd7 25. Rc1 h6 26. Rc5 Rb7 27. b4 Ke7 28. d5 Kd7 29. Rg6 Ke8 30. Bd4 Kf8 31. d6 Rd7 32. Rc7 Ke8 33. Rxg7 Rxg7+ 34. Rxg7 a5 35. d7+ Kd8 36. Bb6# 1-0`;

  const game = await prisma.game.upsert({
    where: { id: SEED_GAME_ID },
    update: {
      updatedAt: new Date(),
    },
    create: {
      id: SEED_GAME_ID,
      userId: demoUser.id,
      title: "Clásica Italiana",
      opponent: "Lichess Bot",
      event: "Demo Match",
      site: "Buenos Aires",
      date: new Date("2024-11-30T19:00:00.000Z"),
      eco: "C50",
      opening: "Italian Game",
      termination: "Normal",
      timeControl: "15+10",
      source: "Seed script",
      status: AnalysisStatus.COMPLETED,
      result: GameResult.WHITE_WIN,
      pgn,
      accuracy: 82.4,
      blunders: 0,
      mistakes: 1,
      inaccuracies: 2,
    },
  });

  await prisma.gameTag.upsert({
    where: {
      gameId_tagId: {
        gameId: game.id,
        tagId: featuredTag.id,
      },
    },
    update: {},
    create: {
      gameId: game.id,
      tagId: featuredTag.id,
    },
  });

  await prisma.move.deleteMany({ where: { gameId: game.id } });
  await prisma.moveAnalysis.deleteMany({
    where: { analysis: { gameId: game.id } },
  });
  await prisma.analysis.deleteMany({ where: { gameId: game.id } });

  const movesData = [
    { ply: 1, san: "e4", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" },
    { ply: 2, san: "e5", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2" },
    { ply: 3, san: "Nf3", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" },
    { ply: 4, san: "Nc6", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" },
    { ply: 5, san: "Bc4", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" },
    { ply: 6, san: "Bc5", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" },
  ];

  await prisma.move.createMany({
    data: movesData.map((move) => ({
      id: `${SEED_GAME_ID}-ply-${move.ply}`,
      gameId: game.id,
      ply: move.ply,
      san: move.san,
      fen: move.fen,
    })),
    skipDuplicates: true,
  });

  const analysis = await prisma.analysis.create({
    data: {
      id: "seed-analysis-classic",
      gameId: game.id,
      engine: "Stockfish 16",
      depth: 18,
      averageCentipawnLoss: 32,
      totalTimeMs: 4200,
      completedAt: new Date(),
      moves: {
        create: movesData.map((move) => ({
          moveId: `${SEED_GAME_ID}-ply-${move.ply}`,
          evaluationCp: move.ply === 5 ? 20 : 0,
          classification:
            move.ply === 5 ? MoveClassification.GOOD : MoveClassification.BOOK,
          comment:
            move.ply === 5
              ? "La jugada desarrolla el alfil y ejerce presión sobre f7."
              : undefined,
        })),
      },
    },
  });

  await prisma.game.update({
    where: { id: game.id },
    data: {
      status: AnalysisStatus.COMPLETED,
      accuracy: 82.4,
      jobs: {
        upsert: {
          where: { id: "seed-job-analysis" },
          update: {},
          create: {
            id: "seed-job-analysis",
            status: JobStatus.COMPLETED,
            payload: {
              depth: analysis.depth,
              engine: analysis.engine,
            },
            completedAt: analysis.completedAt,
          },
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.info("🌱 Seed ejecutado correctamente.");
  })
  .catch(async (error) => {
    console.error("❌ Error ejecutando seed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });

