"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Chess,
  type Move as ChessMove,
  type PieceSymbol,
  type Square,
} from "chess.js";
import "react-chessground/dist/styles/chessground.css";

import { AnalysisBar } from "@/features/manual-board/components/analysis-bar";
import { useStockfishEngine } from "@/features/manual-board/hooks/use-stockfish-engine";

const Chessground = dynamic(() => import("react-chessground"), {
  ssr: false,
});
const ChessboardSurface = Chessground as unknown as ComponentType<any>;

type MoveDescriptor = { from: string; to: string };

const getDests = (
  fen: string,
): { dests: Map<string, string[]>; turn: "white" | "black" } => {
  const chess = new Chess(fen);
  const moves =
    (chess.moves({ verbose: true }) as unknown as MoveDescriptor[]) ?? [];
  const dests = new Map<string, string[]>();
  moves.forEach((mv) => {
    if (!dests.has(mv.from)) dests.set(mv.from, []);
    dests.get(mv.from)!.push(mv.to);
  });
  return { dests, turn: chess.turn() === "w" ? "white" : "black" };
};

const START_FEN = new Chess().fen();
const ROOT_ID = "root";

type MoveNode = {
  id: string;
  san: string;
  fen: string;
  ply: number;
  moveNumber: number;
  color: "white" | "black";
  parentId: string | null;
  children: string[];
  source: "pgn" | "manual";
  move?: { from: Square; to: Square };
};

const createRootNode = (): MoveNode => ({
  id: ROOT_ID,
  san: "",
  fen: START_FEN,
  ply: 0,
  moveNumber: 0,
  color: "white",
  parentId: null,
  children: [],
  source: "manual",
});

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
};

export function ManualBoard() {
  const [nodes, setNodes] = useState<Record<string, MoveNode>>({
    [ROOT_ID]: createRootNode(),
  });
  const [currentNodeId, setCurrentNodeId] = useState<string>(ROOT_ID);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [preferredChildren, setPreferredChildren] = useState<
    Record<string, string>
  >({});
  const [childPicker, setChildPicker] = useState<{
    parentId: string;
    options: string[];
    highlight: number;
  } | null>(null);
  const [pgnInput, setPgnInput] = useState("");
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [suggestionLockId, setSuggestionLockId] = useState<number | null>(null);
  const [gameDetails, setGameDetails] = useState({
    whitePlayer: "",
    whiteScore: "",
    blackPlayer: "",
    blackScore: "",
    result: "*",
    event: "",
    timeControl: "",
    termination: "",
    site: "",
    round: "",
    eco: "",
    date: "",
  });
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [hideStartMenu, setHideStartMenu] = useState(false);
  const [boardHeight, setBoardHeight] = useState(0);
  const boardShellRef = useRef<HTMLDivElement | null>(null);
  const [promotionRequest, setPromotionRequest] = useState<{
    from: Square;
    to: Square;
    color: "white" | "black";
  } | null>(null);

  const currentNode = nodes[currentNodeId] ?? nodes[ROOT_ID];
  const currentFen = currentNode?.fen ?? START_FEN;
  const position = useMemo(() => getDests(currentFen), [currentFen]);
  const lastMoveSquares = useMemo<[Square, Square] | []>(() => {
    const node = nodes[currentNodeId];
    if (node?.move) {
      return [node.move.from, node.move.to] as [Square, Square];
    }
    // Chessground conserva el último resaltado si la prop es undefined; un array vacío lo limpia.
    return [];
  }, [nodes, currentNodeId]);

  const promotionPieces: { key: PieceSymbol; label: string }[] = [
    { key: "q", label: "Dama" },
    { key: "r", label: "Torre" },
    { key: "b", label: "Alfil" },
    { key: "n", label: "Caballo" },
  ];

  const engineSnapshot = useStockfishEngine(currentFen, {
    minDepth: 10,
    maxDepth: 50,
    depthStep: 5,
    skillLevel: 18,
  });
  const {
    cp,
    mate,
    depth: engineDepth,
    bestMove,
    lastUpdatedAt: engineLastUpdate,
    isReady: engineReady,
    isAnalyzing: engineThinking,
  } = engineSnapshot;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = boardShellRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setBoardHeight(entry.contentRect.height);
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const bestMoveSan = useMemo(() => {
    if (!bestMove || bestMove === "(none)") {
      return "";
    }
    try {
      const chess = new Chess(currentFen);
      const from = bestMove.slice(0, 2) as Square;
      const to = bestMove.slice(2, 4) as Square;
      const promotion = (bestMove.slice(4, 5) || "q") as PieceSymbol;
      const move = chess.move({
        from,
        to,
        promotion,
      });
      return move?.san ?? bestMove;
    } catch {
      return bestMove;
    }
  }, [bestMove, currentFen]);

  const engineEvalLabel = useMemo(() => {
    if (!engineReady) return "···";
    if (mate !== null) {
      const prefix = mate > 0 ? "M" : "-M";
      return `${prefix}${Math.abs(mate)}`;
    }
    if (cp === null) return "···";
    const value = cp / 100;
    const formatted = value.toFixed(2);
    return value >= 0 ? `+${formatted}` : formatted;
  }, [engineReady, cp, mate]);

  const boardStyle = useMemo(
    () => ({
      width: "100%",
      height: "100%",
    }),
    [],
  );

  const isSuggestionLocked = useMemo(() => {
    if (suggestionLockId === null) return false;
    if (!engineLastUpdate) return true;
    return engineLastUpdate <= suggestionLockId;
  }, [engineLastUpdate, suggestionLockId]);

  const canPlaySuggestion =
    engineReady && Boolean(bestMoveSan) && !isSuggestionLocked;

  const activePathIds = useMemo(() => {
    const path: string[] = [];
    let cursor: string | null = currentNodeId;
    while (cursor && cursor !== ROOT_ID) {
      path.unshift(cursor);
      cursor = nodes[cursor]?.parentId ?? null;
    }
    return path;
  }, [currentNodeId, nodes]);

  const getNextChildId = useCallback(
    (node: MoveNode | undefined) => {
      if (!node || node.children.length === 0) return null;
      const stored = preferredChildren[node.id];
      if (stored && node.children.includes(stored)) {
        return stored;
      }
      return node.children[0];
    },
    [preferredChildren],
  );

  const mainlineIds = useMemo(() => {
    const ids: string[] = [];
    let cursor = ROOT_ID;
    let next = getNextChildId(nodes[cursor]);
    while (next) {
      ids.push(next);
      cursor = next;
      next = getNextChildId(nodes[cursor]);
    }
    return ids;
  }, [getNextChildId, nodes]);

  const mainlineChildMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    let prev = ROOT_ID;
    mainlineIds.forEach((id) => {
      map[prev] = id;
      prev = id;
    });
    return map;
  }, [mainlineIds]);

  const timelineRows = useMemo(() => {
    const entries = mainlineIds
      .map((id) => nodes[id])
      .filter((node): node is MoveNode => Boolean(node));
    const rows: {
      moveNumber: number;
      white?: MoveNode;
      black?: MoveNode;
    }[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      rows.push({
        moveNumber: entries[i]?.moveNumber ?? rows.length + 1,
        white: entries[i],
        black: entries[i + 1],
      });
    }
    return rows;
  }, [mainlineIds, nodes]);

  const focusNode = useCallback((targetId: string) => {
    setCurrentNodeId(targetId);
  }, []);

  const handleManualMove = (
    from: string,
    to: string,
    promotion: PieceSymbol = "q",
  ): boolean => {
    let didMove = false;

    setNodes((prev) => {
      const shouldReset = showStartMenu && prev[ROOT_ID].children.length === 0;
      const workingNodes = shouldReset ? { [ROOT_ID]: createRootNode() } : prev;
      const baseNodeId = shouldReset ? ROOT_ID : currentNodeId;
      const baseNode = workingNodes[baseNodeId];
      if (!baseNode) return prev;

      const chess = new Chess(baseNode.fen);
      const piece = chess.get(from as Square);
      if (!piece || piece.color !== chess.turn()) {
        return prev;
      }

      const move = chess.move({
        from: from as Square,
        to: to as Square,
        promotion,
      });
      if (!move) return prev;
      didMove = true;

      const resultingFen = chess.fen();
      const existingChildId =
        workingNodes[baseNodeId]?.children.find(
          (childId) => workingNodes[childId]?.fen === resultingFen,
        ) ?? null;

      if (existingChildId) {
        setChildPicker(null);
        setCurrentNodeId(existingChildId);
        if (shouldReset) {
          setPreferredChildren({});
          setPgnInput("");
          setPgnError(null);
        }
        return workingNodes;
      }

      const newNodeId = generateId();
      const newNode: MoveNode = {
        id: newNodeId,
        san: move.san,
        fen: resultingFen,
        ply: baseNode.ply + 1,
        moveNumber: Math.ceil((baseNode.ply + 1) / 2),
        color: move.color === "w" ? "white" : "black",
        parentId: baseNodeId,
        children: [],
        source: "manual",
        move: { from: from as Square, to: to as Square },
      };

<<<<<<< HEAD
      // Mantener las ramas existentes y agregar la nueva.
=======
      const parentHadChildren = baseNode.children.length > 0;
>>>>>>> 6bf758a (chore: prepare chess analyzer)
      const nextNodes = {
        ...workingNodes,
        [baseNodeId]: {
          ...baseNode,
          children: [...baseNode.children, newNodeId],
        },
        [newNodeId]: newNode,
      };

<<<<<<< HEAD
      if (baseNode.children.length === 0) {
        setPreferredChildren((prevPref) => ({ ...prevPref, [baseNodeId]: newNodeId }));
      }

      setChildPicker(null);
      setCurrentNodeId(newNodeId);

=======
      if (!parentHadChildren) {
        setPreferredChildren((prevPref) => ({ ...prevPref, [baseNodeId]: newNodeId }));
      }
      setChildPicker(null);
      setCurrentNodeId(newNodeId);
>>>>>>> 6bf758a (chore: prepare chess analyzer)
      if (shouldReset) {
        setPreferredChildren({});
        setPgnInput("");
        setPgnError(null);
      }

      return nextNodes;
    });

    if (didMove && !hideStartMenu) {
      setHideStartMenu(true);
    }
    return didMove;
  };

  const handleApplySuggestion = () => {
    if (!bestMove || bestMove === "(none)") return;
    const from = bestMove.slice(0, 2);
    const to = bestMove.slice(2, 4);
    if (!from || !to) return;
    const promotion = (bestMove.slice(4, 5) || "q") as PieceSymbol;
    const applied = handleManualMove(from, to, promotion);
    if (applied) {
      setSuggestionLockId(Date.now());
    }
  };

  const requestMove = (from: string, to: string) => {
    const baseNode = nodes[currentNodeId];
    if (!baseNode) return;
    const chess = new Chess(baseNode.fen);
    const piece = chess.get(from as Square);
    if (piece?.type === "p") {
      const targetRank = Number(to[1]);
      const isPromotionRank =
        (piece.color === "w" && targetRank === 8) ||
        (piece.color === "b" && targetRank === 1);
      if (isPromotionRank) {
        setPromotionRequest({
          from: from as Square,
          to: to as Square,
          color: piece.color === "w" ? "white" : "black",
        });
        return;
      }
    }
    handleManualMove(from, to);
  };

  const confirmPromotion = (piece: PieceSymbol) => {
    if (!promotionRequest) return;
    handleManualMove(promotionRequest.from, promotionRequest.to, piece);
    setPromotionRequest(null);
  };

  const cancelPromotion = () => setPromotionRequest(null);

  const goToParent = useCallback(() => {
    const parentId = nodes[currentNodeId]?.parentId;
    if (parentId) {
      setCurrentNodeId(parentId);
    }
  }, [currentNodeId, nodes]);

  const goToChildMainline = useCallback(() => {
    const node = nodes[currentNodeId];
    if (!node) return;
    const nextId = getNextChildId(node);
    if (nextId) {
      focusNode(nextId);
    }
  }, [currentNodeId, nodes, getNextChildId, focusNode]);

  const goToChildInteractive = useCallback(() => {
    const node = nodes[currentNodeId];
    if (!node || node.children.length === 0) return;
    if (node.children.length > 1) {
      setChildPicker({
        parentId: currentNodeId,
        options: node.children,
        highlight: 0,
      });
      return;
    }
    const nextId = getNextChildId(node);
    if (nextId) {
      focusNode(nextId);
    }
  }, [currentNodeId, nodes, getNextChildId, focusNode]);

  const handleSelectChild = useCallback(
    (childId: string) => {
      focusNode(childId);
      setChildPicker(null);
    },
    [focusNode],
  );

  const activeChildPicker = useMemo(() => {
    if (!childPicker) return null;
    return childPicker.parentId === currentNodeId ? childPicker : null;
  }, [childPicker, currentNodeId]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (activeChildPicker) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setChildPicker((prev) => {
            if (!prev) return prev;
            const total = prev.options.length;
            const highlight = (prev.highlight - 1 + total) % total;
            return { ...prev, highlight };
          });
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setChildPicker((prev) => {
            if (!prev) return prev;
            const total = prev.options.length;
            const highlight = (prev.highlight + 1) % total;
            return { ...prev, highlight };
          });
          return;
        }
        if (event.key === "ArrowRight" || event.key === "Enter") {
          event.preventDefault();
          const option =
            activeChildPicker.options[activeChildPicker.highlight];
          if (option) {
            handleSelectChild(option);
          }
          return;
        }
        if (event.key === "Escape" || event.key === "ArrowLeft") {
          event.preventDefault();
          setChildPicker(null);
          return;
        }
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToParent();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToChildInteractive();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    activeChildPicker,
    goToChildInteractive,
    goToParent,
    handleSelectChild,
  ]);

  const handleReset = () => {
    // Solo volver al inicio, sin borrar ramas ni reabrir menú.
    setCurrentNodeId(ROOT_ID);
    setChildPicker(null);
  };

  const goToStart = useCallback(() => {
    setCurrentNodeId(ROOT_ID);
    setChildPicker(null);
  }, []);

  const goToEnd = useCallback(() => {
    let cursor = currentNodeId;
    let next = getNextChildId(nodes[cursor]);
    while (next) {
      cursor = next;
      next = getNextChildId(nodes[cursor]);
    }
    setCurrentNodeId(cursor);
    setChildPicker(null);
  }, [currentNodeId, getNextChildId, nodes]);

  const hasNextMove = useMemo(
    () => Boolean(nodes[currentNodeId]?.children.length),
    [currentNodeId, nodes],
  );
  // Mostrar el onboarding cuando no se ha ocultado explícitamente,
  // incluso si ya hay movimientos creados (permite volver a las opciones).
  const showStartMenu = !hideStartMenu;
  const onboardingSections = [
    { id: "pgn", label: "Cargar desde FEN/PGN", description: "Pegá la partida antes de empezar y después seguí con tus propias variantes." },
    { id: "moves", label: "Hacer movimientos", description: "Arrastrá piezas legales sobre el tablero para recrear una partida o analizar variantes." },
    { id: "setup", label: "Configurar posición", description: "Próximamente podrás editar piezas casilla por casilla para estudiar situaciones concretas." },
    { id: "collections", label: "Colecciones de partidas", description: "Guarda sets temáticos (aperturas, tácticas) para cargarlos rápido." },
    { id: "history", label: "Cargar del historial de partidas", description: "Integrá tu cuenta de Lichess o Chess.com para reconstruir partidas reales." },
    { id: "study", label: "Importar estudio", description: "Trae capítulos enteros con anotaciones y compártelos fácilmente." },
    { id: "analysis", label: "Cargar análisis anterior", description: "Volvé a una sesión guardada para seguir donde la dejaste." },
  ];

  const handleImportPgn = () => {
    const trimmed = pgnInput.trim();
    if (!trimmed) {
      setPgnError("Pegá un PGN antes de cargar.");
      return;
    }

    const chess = new Chess();
    try {
      chess.loadPgn(trimmed);
    } catch {
      setPgnError("El PGN no es válido.");
      return;
    }

    const verboseMoves = chess.history({ verbose: true }) as ChessMove[];
    const replay = new Chess();
    const newNodes: Record<string, MoveNode> = {
      [ROOT_ID]: createRootNode(),
    };
    let parentId: string = ROOT_ID;
    let lastId = ROOT_ID;

    verboseMoves.forEach((move, index) => {
      replay.move(move);
      const moveId = generateId();
      newNodes[moveId] = {
        id: moveId,
        san: move.san,
        fen: replay.fen(),
        ply: index + 1,
        moveNumber: Math.ceil((index + 1) / 2),
        color: move.color === "w" ? "white" : "black",
        parentId,
        children: [],
        source: "pgn",
        move: {
          from: move.from as Square,
          to: move.to as Square,
        },
      };
      newNodes[parentId] = {
        ...newNodes[parentId],
        children: [...(newNodes[parentId]?.children ?? []), moveId],
      };
      parentId = moveId;
      lastId = moveId;
    });

    setNodes(newNodes);
    setCurrentNodeId(lastId);
    setPreferredChildren({});
    setChildPicker(null);
    setPgnError(null);
  };

  const handleDetailsChange = (field: keyof typeof gameDetails, value: string) => {
    setGameDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDetails = () => {
    // En una versión futura podríamos persistir estos datos junto con el PGN.
    setIsDetailsOpen(false);
  };


  type VariationGroup = {
    moveNumber: number | null;
    white?: { id: string; san: string };
    black?: { id: string; san: string };
  };

type VariationToken = {
  key: string;
  text: string;
  type: "label" | "move";
  active?: boolean;
};

  const summarizeVariation = useCallback(
    (startId: string) => {
      const groups: VariationGroup[] = [];
      let cursor: string | undefined = startId;
      let guard = 0;
      while (cursor && guard < 16) {
        const nodeId = cursor as string;
        const node: MoveNode | undefined = nodes[nodeId];
        if (!node) break;

        if (node.color === "white") {
          groups.push({
            moveNumber: node.moveNumber,
            white: { id: node.id, san: node.san },
          });
        } else {
          const last = groups[groups.length - 1];
          if (last && last.moveNumber === node.moveNumber && !last.black) {
            last.black = { id: node.id, san: node.san };
          } else {
            groups.push({
              moveNumber: node.moveNumber,
              black: { id: node.id, san: node.san },
            });
          }
        }

        if (node.children.length !== 1) break;
        cursor = node.children[0];
        guard += 1;
      }
      return groups;
    },
    [nodes],
  );

  const formatVariationLabel = useCallback((groups: VariationGroup[]) => {
    return groups
      .map((group) => {
        if (group.white) {
          const blackPart = group.black ? ` ${group.black.san}` : "";
          return `${group.moveNumber}. ${group.white.san}${blackPart}`;
        }
        if (group.black) {
          return `${group.moveNumber}... ${group.black.san}`;
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }, []);

  const buildVariationTokens = useCallback(
    (groups: VariationGroup[], activeMoveId: string): VariationToken[] => {
      const tokens: VariationToken[] = [];
      groups.forEach((group) => {
        const moveNumber = group.moveNumber ?? 0;
        if (group.white) {
          tokens.push({
            key: `num-${group.white.id}`,
            text: `${moveNumber}.`,
            type: "label",
          });
          tokens.push({
            key: `move-${group.white.id}`,
            text: group.white.san,
            type: "move",
            active: group.white.id === activeMoveId,
          });
        }
        if (group.black) {
          tokens.push({
            key: `prefix-${group.black.id}`,
            // Si ya hubo jugada blanca, no repetimos el número con "...".
            text: group.white ? "" : `${moveNumber}...`,
            type: "label",
          });
          tokens.push({
            key: `move-${group.black.id}`,
            text: group.black.san,
            type: "move",
            active: group.black.id === activeMoveId,
          });
        }
      });
      return tokens.filter((token) => token.text.trim().length > 0);
    },
    [],
  );

  const getMainChild = (node?: MoveNode): string | undefined => {
    if (!node || node.children.length === 0) return undefined;
    const pref = preferredChildren[node.id];
    if (pref && node.children.includes(pref)) return pref;
    return node.children[0];
  };

  const renderInlineSubvariations = (nodeId?: string): ReactNode => {
    if (!nodeId) return null;
    const node = nodes[nodeId];
    if (!node || node.children.length === 0) return null;
    // Preferimos el hijo elegido (preferredChildren) o, en su defecto, el primero.
    const mainChild = getMainChild(node);
    const variations = node.children.filter((childId) => childId !== mainChild);
    if (variations.length === 0) return null;
    return (
      <span className="ml-1 inline-flex flex-wrap items-center gap-1 text-muted">
        {variations.map((childId) => {
          const groups = summarizeVariation(childId);
          const label = formatVariationLabel(groups);
          if (!label) return null;
          return (
            <span key={childId} className="inline-flex items-center gap-1">
              <span>({label})</span>
            </span>
          );
        })}
      </span>
    );
  };

  const renderVariations = (node?: MoveNode) => {
    if (!node || node.children.length === 0) {
      return null;
    }
    const mainChild = getMainChild(node);
    const variations = node.children.filter((childId) => childId !== mainChild);
    if (variations.length === 0) {
      return null;
    }
    return (
      <div className="ml-6 border-l border-slate-700/60 pl-3 text-xs text-muted">
        {variations.map((childId) => {
          const variationNode = nodes[childId];
          if (!variationNode) return null;
          const groups = summarizeVariation(childId);
          const label = formatVariationLabel(groups);
          const tokens = buildVariationTokens(groups, currentNodeId);
          const isActive =
            childId === currentNodeId || activePathIds.includes(childId);
          return (
            <div key={childId} className="relative">
              <button
                type="button"
                className={[
                  "mt-1 w-full rounded-2xl px-2 py-1 text-left text-xs transition",
                  isActive
                    ? "bg-slate-700/70 text-white"
                    : "hover:bg-slate-800/40 text-muted",
                ].join(" ")}
                onClick={() => focusNode(childId)}
              >
              <span className="flex flex-wrap items-center gap-1">
                {tokens.length > 0 ? (
                  tokens.map((token) => (
                    <span
                      key={token.key}
                      className={[
                        token.type === "label"
                          ? "text-muted"
                          : "rounded px-1 py-0.5",
                        token.type === "move"
                          ? token.active
                            ? "bg-slate-600 text-white"
                            : "bg-slate-800/30 text-foreground"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {token.text}
                    </span>
                  ))
                ) : (
                  <span className="truncate">{label || variationNode.san}</span>
                )}
                {renderInlineSubvariations(childId)}
              </span>
              </button>
              {renderChildPickerPopover(childId)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderChildPickerPopover = useCallback(
    (targetId?: string) => {
      if (
        !targetId ||
        !activeChildPicker ||
        activeChildPicker.parentId !== targetId
      ) {
        return null;
      }
      return (
        <div className="variations-popover absolute left-0 top-full z-30 mt-1 w-48 rounded-xl border border-slate-800 bg-slate-950 p-1 shadow-2xl">
          <div className="max-h-48 overflow-y-auto">
            {activeChildPicker.options.map((childId, idx) => {
              const child = nodes[childId];
              if (!child) return null;
              const isActive = idx === activeChildPicker.highlight;
              const childGroups = summarizeVariation(childId);
              const tokens = buildVariationTokens(childGroups, currentNodeId);
              const summary = formatVariationLabel(childGroups);
              return (
                <button
                  key={childId}
                  type="button"
                  className={[
                    "row flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition",
                    isActive
                      ? "selected rounded-lg bg-slate-800 text-white"
                      : "hover:bg-slate-800/40 text-foreground",
                  ].join(" ")}
                  onClick={() => handleSelectChild(childId)}
                >
                  <span className="flex flex-wrap items-center gap-1 text-xs">
                    {tokens.length > 0 ? (
                      tokens.map((token) => (
                        <span
                          key={token.key}
                          className={
                            token.type === "move" ? "text-foreground" : "text-muted"
                          }
                        >
                          {token.text}
                        </span>
                      ))
                    ) : (
                      <span className="truncate">
                        {summary || child.san || "…"}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    },
    [
      activeChildPicker,
      nodes,
      summarizeVariation,
      buildVariationTokens,
      currentNodeId,
      formatVariationLabel,
      handleSelectChild,
    ],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,560px)_minmax(0,1fr)]">
      <div className="surface-card rounded-3xl p-4 flex flex-col items-center gap-3">
        <AnalysisBar
          cp={cp}
          mate={mate}
          isReady={engineReady}
          orientation={orientation}
          boardHeight={boardHeight || undefined}
        />
      </div>
      <div className="surface-card order-1 rounded-3xl p-4">
        <div className="flex justify-center">
          <div className="board-shell" ref={boardShellRef} style={boardStyle}>
            <ChessboardSurface
              turnColor={position.turn}
              orientation={orientation}
              fen={currentFen}
              lastMove={lastMoveSquares}
              coordinates={false}
              movable={{
                free: false,
                color: position.turn,
                dests: position.dests,
                events: {
                  after: (from: string, to: string) => requestMove(from, to),
                },
              }}
              draggable={{ enabled: true }}
            />
          </div>
        </div>
        <div className="mt-4 rounded-3xl border border-slate-800/60 bg-slate-950/40 p-4 text-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted">
            <span>Evaluación del motor</span>
            <span>Profundidad {engineDepth ?? "—"}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold">{engineEvalLabel}</p>
            <span className="text-xs text-muted">
              {engineReady
                ? engineThinking
                  ? "Calculando..."
                  : "Listo"
                : "Inicializando"}
            </span>
            <span className="text-[10px] uppercase tracking-[0.4em] text-muted">
              Perspectiva: blancas
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">
                Mejor jugada sugerida
              </p>
              <p className="text-base font-semibold">
                {bestMoveSan || "Sin sugerencias"}
              </p>
            </div>
            <button
              type="button"
              className="viewer-button viewer-button--primary ml-auto"
              onClick={handleApplySuggestion}
              disabled={!canPlaySuggestion}
            >
              Jugar recomendación
            </button>
          </div>
        </div>
      </div>
      <div className="surface-card order-2 flex flex-col gap-4 rounded-3xl p-4">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            Análisis
          </p>
          <h2 className="text-xl font-semibold">Juega contra vos mismo</h2>
          <p className="text-sm text-muted">
            Usá las flechas del teclado (← →) para retroceder o avanzar entre
            jugadas y creá variantes arrastrando piezas desde cualquier
            posición.
          </p>
        </header>


        <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted">
          <p>
            Turno actual:{" "}
            <span className="font-semibold text-foreground">
              {position.turn === "white" ? "Blancas" : "Negras"}
            </span>
          </p>
        </div>
        <div className="flex justify-between">
          <button
            type="button"
            className="viewer-button"
            onClick={() => {
              setHideStartMenu(false);
              setOpenSection(null);
            }}
            style={{ visibility: showStartMenu ? "hidden" : "visible" }}
          >
            ← Opciones
          </button>
          <button
            type="button"
            className="viewer-button viewer-button--primary"
            onClick={() => setIsDetailsOpen(true)}
          >
            Guardar partida
          </button>
        </div>
        {showStartMenu && (
          <div className="rounded-3xl border border-slate-800 p-4">
            <h4 className="text-sm font-semibold">Opciones disponibles</h4>
            <p className="text-xs text-muted">
              Elegí una categoría para ver qué podés hacer antes de jugar.
            </p>
            <ul className="mt-4 space-y-2">
              {onboardingSections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl bg-slate-800/30 px-4 py-3 text-left transition hover:bg-slate-800/60"
                    onClick={() => {
                      if (section.id === "moves") {
                        setHideStartMenu(true);
                        return;
                      }
                      setOpenSection((prev) => (prev === section.id ? null : section.id));
                    }}
                  >
                    <span className="text-sm font-medium">{section.label}</span>
                    <span className="text-xl text-muted">
                      {openSection === section.id ? "▴" : "▾"}
                    </span>
                  </button>
                  {openSection === section.id && (
                    <div className="mt-2 rounded-2xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-xs text-muted">
                      {section.id === "pgn" ? (
                        <>
                          <p>{section.description}</p>
                          <textarea
                            className="mt-3 w-full rounded-2xl border border-slate-800 bg-transparent p-3 text-sm"
                            rows={3}
                            placeholder="1. d4 d5 2. c4 e6 3. Nc3 ..."
                            value={pgnInput}
                            onChange={(event) => setPgnInput(event.target.value)}
                          />
                          {pgnError ? (
                            <p className="mt-2 text-xs text-red-400">{pgnError}</p>
                          ) : (
                            <p className="mt-2 text-xs text-muted">
                              Si preferís, dejalo vacío y arrancá a arrastrar piezas para crear
                              una línea manual.
                            </p>
                          )}
                          <button
                            type="button"
                            className="viewer-button viewer-button--primary mt-3"
                            onClick={handleImportPgn}
                          >
                            Importar
                          </button>
                        </>
                      ) : section.id === "moves" ? (
                        <p>{section.description}</p>
                      ) : (
                        <p>{section.description}</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="viewer-button"
              onClick={goToStart}
              disabled={currentNodeId === ROOT_ID}
            >
              |&lt;
            </button>
            <button
              type="button"
              className="viewer-button"
              onClick={goToParent}
              disabled={!nodes[currentNodeId]?.parentId}
            >
              &lt;
            </button>
            <button
              type="button"
              className="viewer-button"
              onClick={goToChildMainline}
              disabled={!nodes[currentNodeId] || nodes[currentNodeId].children.length === 0}
            >
              &gt;
            </button>
            <button
              type="button"
              className="viewer-button"
              onClick={goToEnd}
              disabled={!hasNextMove}
            >
              &gt;|
            </button>
          </div>
          <button
            type="button"
            className="viewer-button ml-auto"
            onClick={handleReset}
          >
            Reiniciar
          </button>
          <button
            type="button"
            className="viewer-button"
            onClick={() =>
              setOrientation((prev) => (prev === "white" ? "black" : "white"))
            }
          >
            Cambiar vista
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Historial y variantes</h4>
            <span className="text-xs text-muted">
              {mainlineIds.length === 0
                ? "Sin jugadas todavía"
                : `${mainlineIds.length} jugadas`}
            </span>
          </div>
          <ol className="timeline-list mt-4 max-h-[360px] space-y-2 overflow-y-auto">
            {timelineRows.length === 0 && (
              <li className="timeline-empty text-sm text-muted">
                Empezá moviendo una pieza blanca.
              </li>
            )}
            {timelineRows.map(({ moveNumber, white, black }) => (
              <li
                key={`row-${moveNumber}-${white?.id ?? "w"}-${black?.id ?? "b"}`}
                className="timeline-row flex flex-col rounded-2xl px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-muted">{moveNumber}.</span>
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <div className="relative flex-1">
                  <button
                    type="button"
                    className={[
                      "timeline-move flex w-full justify-start",
                      currentNodeId === white?.id ? "timeline-move--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => white && focusNode(white.id)}
                  >
                    <span className="flex items-center gap-1">
                      {white?.san ?? "..."}
                      {renderInlineSubvariations(white?.id)}
                    </span>
                  </button>
                      {renderChildPickerPopover(white?.id)}
                    </div>
                    <div className="relative flex-1">
                      <button
                        type="button"
                        className={[
                          "timeline-move flex w-full justify-end",
                          currentNodeId === black?.id ? "timeline-move--active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => black && focusNode(black.id)}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      {black?.san ?? "..."}
                      {renderInlineSubvariations(black?.id)}
                    </span>
                  </button>
                      {renderChildPickerPopover(black?.id)}
                    </div>
                  </div>
                </div>
                {renderVariations(white)}
                {renderVariations(black)}
                {moveNumber === 1 && renderVariations(nodes[ROOT_ID])}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {isDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold">Detalles de la partida</h3>
              <button
                type="button"
                className="text-muted hover:text-foreground"
                onClick={() => setIsDetailsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="grid gap-2">
                <label className="text-xs text-muted">Jugador con blancas</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                    value={gameDetails.whitePlayer}
                    onChange={(e) => handleDetailsChange("whitePlayer", e.target.value)}
                    placeholder="Nombre"
                  />
                  <input
                    className="w-24 rounded-2xl border border-slate-700 bg-transparent px-3 py-2 text-center"
                    value={gameDetails.whiteScore}
                    onChange={(e) => handleDetailsChange("whiteScore", e.target.value)}
                    placeholder="Puntaje"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-muted">Jugador con negras</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                    value={gameDetails.blackPlayer}
                    onChange={(e) => handleDetailsChange("blackPlayer", e.target.value)}
                    placeholder="Nombre"
                  />
                  <input
                    className="w-24 rounded-2xl border border-slate-700 bg-transparent px-3 py-2 text-center"
                    value={gameDetails.blackScore}
                    onChange={(e) => handleDetailsChange("blackScore", e.target.value)}
                    placeholder="Puntaje"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted">Resultado</label>
                <select
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                  value={gameDetails.result}
                  onChange={(e) => handleDetailsChange("result", e.target.value)}
                >
                  <option value="*">Sin resultados</option>
                  <option value="1-0">1-0</option>
                  <option value="0-1">0-1</option>
                  <option value="½-½">½ - ½</option>
                </select>
              </div>
              <input
                className="rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                placeholder="Evento"
                value={gameDetails.event}
                onChange={(e) => handleDetailsChange("event", e.target.value)}
              />
              <input
                className="rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                placeholder="Control de tiempo"
                value={gameDetails.timeControl}
                onChange={(e) => handleDetailsChange("timeControl", e.target.value)}
              />
              <input
                className="rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                placeholder="Cancelación"
                value={gameDetails.termination}
                onChange={(e) => handleDetailsChange("termination", e.target.value)}
              />
              <input
                className="rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                placeholder="Ubicación"
                value={gameDetails.site}
                onChange={(e) => handleDetailsChange("site", e.target.value)}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                  placeholder="Ronda"
                  value={gameDetails.round}
                  onChange={(e) => handleDetailsChange("round", e.target.value)}
                />
                <input
                  className="rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                  placeholder="ECO"
                  value={gameDetails.eco}
                  onChange={(e) => handleDetailsChange("eco", e.target.value)}
                />
                <input
                  type="date"
                  className="rounded-2xl border border-slate-700 bg-transparent px-3 py-2"
                  placeholder="Fecha"
                  value={gameDetails.date}
                  onChange={(e) => handleDetailsChange("date", e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                className="viewer-button"
                onClick={() => setIsDetailsOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="viewer-button viewer-button--primary"
                onClick={handleSaveDetails}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {promotionRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Elegí la pieza</h3>
              <button
                type="button"
                className="text-muted hover:text-foreground"
                onClick={cancelPromotion}
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Coronar peón{" "}
              {promotionRequest.color === "white" ? "blanco" : "negro"}.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {promotionPieces.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-sm font-semibold transition hover:bg-slate-800"
                  onClick={() => confirmPromotion(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-slate-700 px-4 py-2 text-sm"
              onClick={cancelPromotion}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {promotionRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Coronar peón</h3>
              <button
                type="button"
                className="text-muted hover:text-foreground"
                onClick={cancelPromotion}
                aria-label="Cancelar coronación"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Elegí la pieza para el peón{" "}
              {promotionRequest.color === "white" ? "blanco" : "negro"}.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {promotionPieces.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-sm font-semibold transition hover:bg-slate-800"
                  onClick={() => confirmPromotion(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-slate-700 px-4 py-2 text-sm"
              onClick={cancelPromotion}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

