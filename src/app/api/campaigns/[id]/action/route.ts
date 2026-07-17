import { z } from "zod";
import { prisma } from "@/lib/db";
import { withPlayer, json, error } from "@/lib/api";
import { submitPlayerAction } from "@/lib/engine";

const schema = z.object({
  agentId: z.string().min(1),
  actionText: z.string().min(1).max(600),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Describe an action for your agent.");

  const agent = await prisma.agent.findUnique({
    where: { id: parsed.data.agentId },
  });
  if (!agent || agent.playerId !== guard.player.id)
    return error("That agent is not yours.", 403);

  const membership = await prisma.membership.findUnique({
    where: { campaignId_agentId: { campaignId: id, agentId: agent.id } },
  });
  if (!membership) return error("That agent is not in this campaign.", 400);

  try {
    await submitPlayerAction(id, agent.id, parsed.data.actionText.trim());
  } catch (e) {
    if (e instanceof Error && e.message === "CAMPAIGN_NOT_ACTIVE")
      return error("The adventure has not started yet.");
    throw e;
  }
  return json({ ok: true });
}
