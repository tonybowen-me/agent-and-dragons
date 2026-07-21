import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/auth";
import { ActionError, type ActionErrorCode } from "@/lib/actions";
import type { Player } from "@prisma/client";

const STATUS_BY_CODE: Record<ActionErrorCode, number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

/** Map a thrown ActionError to an HTTP error response; rethrow anything else. */
export function fromActionError(e: unknown): NextResponse {
  if (e instanceof ActionError) return error(e.message, STATUS_BY_CODE[e.code]);
  throw e;
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(
    data,
    typeof init === "number" ? { status: init } : init,
  );
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function withPlayer(): Promise<
  { player: Player } | { response: NextResponse }
> {
  const player = await getCurrentPlayer();
  if (!player) return { response: error("You must sign in with an invite code.", 401) };
  return { player };
}
