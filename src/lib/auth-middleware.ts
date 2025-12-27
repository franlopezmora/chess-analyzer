import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function authMiddleware(_request: NextRequest) {
  // Autorización deshabilitada temporalmente: todas las rutas pasan directo.
  return NextResponse.next();
}

export const auth = authMiddleware;

