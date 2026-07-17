import { NextResponse } from "next/server";
import { getCurrentPlayer } from "@/lib/auth";
import type { Player } from "@prisma/client";

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
