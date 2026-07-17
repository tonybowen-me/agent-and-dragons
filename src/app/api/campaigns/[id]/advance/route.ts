import { z } from "zod";
import { prisma } from "@/lib/db";
import { withPlayer, json, error } from "@/lib/api";
import { runAgentTurn } from "@/lib/engine";

const schema = z.object({ agentId: z.string().optional() }).optional();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const agentId = parsed.success ? parsed.data?.agentId : undefined;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      memberships: { include: { agent: { select: { id: true, playerId: true } } } },
    },
  });
  if (!campaign) return error("Campaign not found.", 404);

  const isOwner = campaign.createdById === guard.player.id;
  const ownsMember = campaign.memberships.some(
    (m) => m.agent.playerId === guard.player.id,
  );
  if (!isOwner && !ownsMember)
    return error("Only players with an agent in this campaign can advance it.", 403);

  if (agentId) {
    const target = campaign.memberships.find((m) => m.agent.id === agentId);
    if (!target) return error("That agent is not in this campaign.", 400);
    if (!isOwner && target.agent.playerId !== guard.player.id)
      return error("You can only auto-run your own agents.", 403);
  }

  try {
    await runAgentTurn(id, agentId);
  } catch (e) {
    if (e instanceof Error && e.message === "CAMPAIGN_NOT_ACTIVE")
      return error("The adventure has not started yet.");
    if (e instanceof Error && e.message === "NO_LIVING_AGENTS")
      return error("No living agents remain to act.");
    throw e;
  }
  return json({ ok: true });
}
