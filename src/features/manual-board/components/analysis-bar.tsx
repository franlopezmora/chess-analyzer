"use client";

import { useMemo } from "react";

type AnalysisBarProps = {
  cp: number | null;
  mate: number | null;
  isReady: boolean;
  orientation: "white" | "black";
  boardHeight?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizePercent = (cp: number | null, mate: number | null): number => {
  if (mate !== null) {
    return mate > 0 ? 100 : 0;
  }
  if (cp === null) return 50;
  const clamped = clamp(cp, -400, 400);
  return 50 + clamped / 8;
};

const formatLabel = (value: number | null, mate: number | null) => {
  if (mate !== null) {
    return `M${Math.abs(mate)}`;
  }
  if (value === null) return "···";
  return Math.abs(value / 100).toFixed(2);
};

export function AnalysisBar({
  cp,
  mate,
  isReady,
  orientation,
  boardHeight,
}: AnalysisBarProps) {
  const percent = useMemo(
    () => normalizePercent(cp, mate),
    [cp, mate],
  );

  const dominantSide = useMemo<"white" | "black" | "none">(() => {
    if (!isReady) return "none";
    if (mate !== null) {
      if (mate > 0) return "white";
      if (mate < 0) return "black";
      return "none";
    }
    if (cp === null || cp === 0) return "none";
    return cp > 0 ? "white" : "black";
  }, [cp, mate, isReady]);

  const labelValue = useMemo(() => formatLabel(cp, mate), [cp, mate]);

  const isWhiteBottom = orientation === "black";

  return (
    <div
      className="relative flex w-8 flex-col overflow-hidden rounded-[0.75rem] border border-slate-800 bg-slate-950 shadow-inner"
      style={{ height: boardHeight && boardHeight > 0 ? boardHeight : 420 }}
    >
      <div
        className="bg-slate-100 transition-[height] duration-300 ease-out"
        style={{
          height: `${percent}%`,
          order: isWhiteBottom ? 0 : 1,
        }}
      />
      <div
        className="bg-slate-800 transition-[height] duration-300 ease-out"
        style={{
          height: `${100 - percent}%`,
          order: isWhiteBottom ? 1 : 0,
        }}
      />
      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-between px-1 py-3 text-center text-xs font-semibold ${
          isWhiteBottom ? "" : "flex-col-reverse"
        }`}
      >
        <span className="text-slate-900">
          {dominantSide === "white" ? labelValue : ""}
        </span>
        <span className="text-slate-100">
          {dominantSide === "black" ? labelValue : ""}
        </span>
      </div>
    </div>
  );
}

