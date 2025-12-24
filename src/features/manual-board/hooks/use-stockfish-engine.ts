"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STOCKFISH_SCRIPT_URL = new URL(
  "stockfish/src/stockfish-17.1-lite-single-03e3232.js",
  import.meta.url,
).toString();

const STOCKFISH_WASM_URL = new URL(
  "stockfish/src/stockfish-17.1-lite-single-03e3232.wasm",
  import.meta.url,
).toString();

type UseStockfishOptions = {
  minDepth?: number;
  maxDepth?: number;
  depthStep?: number;
  skillLevel?: number;
  multiPv?: number;
};

type ParsedInfo = {
  depth?: number;
  cp?: number;
  mate?: number;
  nodes?: number;
  bestMove?: string;
};

type EngineMetrics = {
  cp: number | null;
  mate: number | null;
  depth: number | null;
  bestMove: string;
  nodes: number | null;
  lastUpdatedAt: number | null;
};

const INITIAL_METRICS: EngineMetrics = {
  cp: null,
  mate: null,
  depth: null,
  bestMove: "",
  nodes: null,
  lastUpdatedAt: null,
};

const DEFAULT_MIN_DEPTH = 10;
const DEFAULT_MAX_DEPTH = 60;
const DEFAULT_STEP = 5;
const DEFAULT_SKILL = 18;

const parseInfoLine = (line: string): ParsedInfo | null => {
  if (!line.startsWith("info")) return null;
  const depthMatch = line.match(/depth (\d+)/);
  const cpMatch = line.match(/score cp (-?\d+)/);
  const mateMatch = line.match(/score mate (-?\d+)/);
  const nodesMatch = line.match(/nodes (\d+)/);
  const pvMatch = line.match(/ pv (.+)/);

  return {
    depth: depthMatch ? Number(depthMatch[1]) : undefined,
    cp: cpMatch ? Number(cpMatch[1]) : undefined,
    mate: mateMatch ? Number(mateMatch[1]) : undefined,
    nodes: nodesMatch ? Number(nodesMatch[1]) : undefined,
    bestMove: pvMatch ? pvMatch[1].split(" ")[0] : undefined,
  };
};

export type StockfishEngineSnapshot = EngineMetrics & {
  isReady: boolean;
  isAnalyzing: boolean;
};

export function useStockfishEngine(
  fen: string,
  options?: UseStockfishOptions,
): StockfishEngineSnapshot {
  const [metrics, setMetrics] = useState<EngineMetrics>(INITIAL_METRICS);
  const [engineReady, setEngineReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const analyzingFenRef = useRef<string | null>(null);
  const debounceIdRef = useRef<number | null>(null);
  const lastAnalyzedFenRef = useRef<string | null>(null);
  const pendingRequestRef = useRef<{ fen: string; preserveMetrics: boolean; resetDepth: boolean } | null>(null);
  const isAnalyzingRef = useRef(false);
  const minDepthRef = useRef(options?.minDepth ?? DEFAULT_MIN_DEPTH);
  const maxDepthRef = useRef(options?.maxDepth ?? DEFAULT_MAX_DEPTH);
  const depthStepRef = useRef(options?.depthStep ?? DEFAULT_STEP);
  const currentDepthRef = useRef<number>(options?.minDepth ?? DEFAULT_MIN_DEPTH);
  const skillRef = useRef(options?.skillLevel ?? DEFAULT_SKILL);
  const multiPvRef = useRef(options?.multiPv ?? 1);
  const analysisPerspectiveRef = useRef<1 | -1>(1);

  useEffect(() => {
    minDepthRef.current = options?.minDepth ?? DEFAULT_MIN_DEPTH;
    currentDepthRef.current = minDepthRef.current;
  }, [options?.minDepth]);

  useEffect(() => {
    maxDepthRef.current = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  }, [options?.maxDepth]);

  useEffect(() => {
    depthStepRef.current = options?.depthStep ?? DEFAULT_STEP;
  }, [options?.depthStep]);

  useEffect(() => {
    skillRef.current = options?.skillLevel ?? DEFAULT_SKILL;
  }, [options?.skillLevel]);

  useEffect(() => {
    multiPvRef.current = options?.multiPv ?? 1;
  }, [options?.multiPv]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const workerUrl = new URL(STOCKFISH_SCRIPT_URL, window.location.origin);
    workerUrl.hash = encodeURIComponent(STOCKFISH_WASM_URL);
    const worker = new Worker(workerUrl, { name: "stockfish-lite" });
    workerRef.current = worker;
    analyzingFenRef.current = null;

    const sendCommand = (command: string) => {
      worker.postMessage(command);
    };

    const applyOptions = () => {
      sendCommand(`setoption name Skill Level value ${skillRef.current}`);
      if (multiPvRef.current > 1) {
        sendCommand(`setoption name MultiPV value ${multiPvRef.current}`);
      }
    };

    const handleInfo = (line: string) => {
      const parsed = parseInfoLine(line);
      if (!parsed || !analyzingFenRef.current) return;
      const perspective = analysisPerspectiveRef.current;

      setMetrics((prev) => {
        let nextCp = prev.cp;
        let nextMate = prev.mate;
        let nextBest = prev.bestMove;

        if (parsed.mate !== undefined) {
          nextMate = parsed.mate * perspective;
          nextCp = null;
        } else if (parsed.cp !== undefined) {
          nextCp = parsed.cp * perspective;
          if (nextMate !== null) {
            nextMate = null;
          }
        }

        if (parsed.bestMove) {
          nextBest = parsed.bestMove;
        }

        const nextDepth =
          parsed.depth !== undefined
            ? Math.max(parsed.depth, prev.depth ?? 0)
            : prev.depth;

        return {
          cp: nextCp,
          mate: nextMate,
          depth: nextDepth ?? prev.depth ?? null,
          bestMove: nextBest,
          nodes: parsed.nodes ?? prev.nodes,
          lastUpdatedAt: Date.now(),
        };
      });
    };

    const handleBestMove = (line: string) => {
      const finishedFen = analyzingFenRef.current;
      const best = line.split(" ")[1] ?? "";
      setMetrics((prev) => ({
        ...prev,
        bestMove: best || prev.bestMove,
        lastUpdatedAt: Date.now(),
      }));
      setIsAnalyzing(false);
      isAnalyzingRef.current = false;
      analyzingFenRef.current = null;

      if (
        finishedFen &&
        !pendingRequestRef.current &&
        currentDepthRef.current < maxDepthRef.current
      ) {
        const nextDepth = Math.min(
          maxDepthRef.current,
          (currentDepthRef.current ?? minDepthRef.current) + depthStepRef.current,
        );
        if (nextDepth > (currentDepthRef.current ?? minDepthRef.current)) {
          currentDepthRef.current = nextDepth;
          pendingRequestRef.current = {
            fen: finishedFen,
            preserveMetrics: true,
            resetDepth: false,
          };
        }
      }
    };

    worker.onmessage = (event) => {
      const raw =
        typeof event.data === "string" ? event.data.trim() : event.data;
      if (!raw) return;
      if (raw === "uciok") {
        applyOptions();
        sendCommand("isready");
        return;
      }
      if (raw === "readyok") {
        setEngineReady(true);
        return;
      }
      if (raw.startsWith("info")) {
        handleInfo(raw);
        return;
      }
      if (raw.startsWith("bestmove")) {
        handleBestMove(raw);
      }
    };

    sendCommand("uci");

    return () => {
      worker.terminate();
      workerRef.current = null;
      if (debounceIdRef.current) {
        window.clearTimeout(debounceIdRef.current);
        debounceIdRef.current = null;
      }
    };
  }, []);

type StartOptions = {
    preserveMetrics?: boolean;
  resetDepth?: boolean;
  };

  const startAnalysis = useCallback(
    (targetFen: string, opts?: StartOptions) => {
      if (!engineReady) return;
      const worker = workerRef.current;
      if (!worker) return;

      if (
        isAnalyzingRef.current &&
        analyzingFenRef.current !== targetFen
      ) {
        pendingRequestRef.current = {
          fen: targetFen,
          preserveMetrics: Boolean(opts?.preserveMetrics),
          resetDepth: opts?.resetDepth ?? isNewPosition,
        };
        worker.postMessage("stop");
        return;
      }

      const isNewFen = lastAnalyzedFenRef.current !== targetFen;
      if (isNewFen || opts?.resetDepth) {
        currentDepthRef.current = minDepthRef.current;
      }
      if (isNewFen || !opts?.preserveMetrics) {
        setMetrics({ ...INITIAL_METRICS });
      }
      if (isNewFen) {
        lastAnalyzedFenRef.current = targetFen;
      }

      const depthToUse = currentDepthRef.current ?? minDepthRef.current;

      const fenParts = targetFen.split(" ");
      const sideToMove = fenParts[1] ?? "w";
      analysisPerspectiveRef.current = sideToMove === "b" ? -1 : 1;
      analyzingFenRef.current = targetFen;
      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      worker.postMessage("stop");
      worker.postMessage("ucinewgame");
      worker.postMessage(`position fen ${targetFen}`);
      worker.postMessage(`go depth ${depthToUse}`);
    },
    [engineReady],
  );

  const lastFenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!engineReady) return;
    if (!fen) return;
    if (lastFenRef.current === fen) return;
    lastFenRef.current = fen;
    pendingRequestRef.current = null;

    const immediateTimeout = window.setTimeout(() => {
      startAnalysis(fen, { preserveMetrics: false, resetDepth: true });
    }, 100);

    return () => {
      window.clearTimeout(immediateTimeout);
    };
  }, [fen, engineReady, startAnalysis]);

  useEffect(() => {
    if (!engineReady) return;
    if (isAnalyzing) return;
    const request = pendingRequestRef.current;
    if (request) {
      pendingRequestRef.current = null;
      startAnalysis(request.fen, {
        preserveMetrics: request.preserveMetrics,
        resetDepth: request.resetDepth,
      });
    }
  }, [engineReady, isAnalyzing, startAnalysis]);

  const snapshot = useMemo<StockfishEngineSnapshot>(
    () => ({
      ...metrics,
      isReady: engineReady,
      isAnalyzing,
    }),
    [metrics, engineReady, isAnalyzing],
  );

  return snapshot;
}

