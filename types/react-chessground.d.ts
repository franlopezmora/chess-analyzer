declare module "react-chessground" {
  import { ComponentType } from "react";

type Key = string;

type ChessgroundProps = {
  fen?: string;
  width?: number;
  height?: number;
  orientation?: "white" | "black";
  turnColor?: "white" | "black";
  movable?: {
    free?: boolean;
    color?: "white" | "black" | "both";
    dests?: Map<Key, Key[]>;
    events?: {
      after?: (from: Key, to: Key, metadata?: unknown) => void;
      afterNewPiece?: (role: Key, key: Key, metadata?: unknown) => void;
    };
  };
  draggable?: {
    enabled?: boolean;
  };
  events?: {
    move?: (from: Key, to: Key, capturedPiece?: Key) => void;
  };
};

  const Chessground: ComponentType<ChessgroundProps>;
  export default Chessground;
}

