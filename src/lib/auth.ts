import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { Player } from "@prisma/client";

export const SESSION_COOKIE = "aad_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function newToken(): string {
  return randomBytes(24).toString("hex");
}

export async function getCurrentPlayer(): Promise<Player | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { player: true },
  });
  return session?.player ?? null;
}

export async function requirePlayer(): Promise<Player> {
  const player = await getCurrentPlayer();
  if (!player) throw new Error("UNAUTHENTICATED");
  return player;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export interface RedeemResult {
  ok: boolean;
  error?: string;
  player?: Player;
  token?: string;
}

/**
 * Validate an invite code and either attach to an existing player handle or
 * create a new player, then mint a session token.
 */
export async function redeemInvite(
  rawCode: string,
  rawHandle: string,
): Promise<RedeemResult> {
  const code = rawCode.trim();
  const handle = rawHandle.trim();

  if (!code) return { ok: false, error: "An invite code is required." };
  if (handle.length < 2 || handle.length > 24)
    return { ok: false, error: "Pick a handle between 2 and 24 characters." };
  if (!/^[a-zA-Z0-9 _-]+$/.test(handle))
    return {
      ok: false,
      error: "Handles may only contain letters, numbers, spaces, _ and -.",
    };

  const invite = await prisma.inviteCode.findUnique({ where: { code } });
  if (!invite || !invite.active)
    return { ok: false, error: "That invite code is not valid." };
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses)
    return { ok: false, error: "That invite code has been fully redeemed." };

  const existing = await prisma.player.findUnique({ where: { handle } });
  if (existing)
    return {
      ok: false,
      error: "That handle is already taken. Choose another.",
    };

  const player = await prisma.player.create({
    data: { handle, inviteCodeId: invite.id },
  });
  await prisma.inviteCode.update({
    where: { id: invite.id },
    data: { uses: { increment: 1 } },
  });

  const token = newToken();
  await prisma.session.create({ data: { token, playerId: player.id } });

  return { ok: true, player, token };
}
