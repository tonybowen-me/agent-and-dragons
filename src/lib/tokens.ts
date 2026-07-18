import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { Player } from "@prisma/client";

const TOKEN_PREFIX = "aad_";

export function newApiToken(): string {
  return TOKEN_PREFIX + randomBytes(24).toString("hex");
}

/** Create a new API key for a player. Returns the raw token (shown once). */
export async function mintApiToken(
  playerId: string,
  label = "",
): Promise<{ id: string; token: string; label: string; createdAt: Date }> {
  const token = newApiToken();
  const row = await prisma.apiToken.create({
    data: { token, playerId, label: label.trim().slice(0, 80) },
  });
  return { id: row.id, token, label: row.label, createdAt: row.createdAt };
}

/** Resolve a raw API token to its owning player, touching lastUsedAt. */
export async function getPlayerByApiToken(
  raw: string | undefined | null,
): Promise<Player | null> {
  const token = raw?.trim();
  if (!token) return null;
  const row = await prisma.apiToken.findUnique({
    where: { token },
    include: { player: true },
  });
  if (!row) return null;
  // Best-effort usage timestamp; never block auth on it.
  prisma.apiToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return row.player;
}

/** Extract a bearer token from an Authorization header value. */
export function bearerFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value.trim();
}

export async function listApiTokens(playerId: string) {
  const rows = await prisma.apiToken.findMany({
    where: { playerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, lastUsedAt: true, createdAt: true, token: true },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    // Only expose a masked hint, never the full secret after creation.
    hint: `${r.token.slice(0, 8)}…${r.token.slice(-4)}`,
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function revokeApiToken(playerId: string, tokenId: string): Promise<boolean> {
  const row = await prisma.apiToken.findUnique({ where: { id: tokenId } });
  if (!row || row.playerId !== playerId) return false;
  await prisma.apiToken.delete({ where: { id: tokenId } });
  return true;
}
