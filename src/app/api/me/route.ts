import { prisma } from "@/lib/db";
import { withPlayer, json } from "@/lib/api";
import { publicAgent } from "@/lib/serialize";

export async function GET() {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;

  const agents = await prisma.agent.findMany({
    where: { playerId: guard.player.id },
    include: { inventory: true },
    orderBy: { createdAt: "desc" },
  });

  return json({
    player: { id: guard.player.id, handle: guard.player.handle },
    agents: agents.map(publicAgent),
  });
}
