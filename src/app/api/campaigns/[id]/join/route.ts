import { z } from "zod";
import { prisma } from "@/lib/db";
import { withPlayer, json, error } from "@/lib/api";

const schema = z.object({ agentId: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Choose an agent to add.");

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { _count: { select: { memberships: true } } },
  });
  if (!campaign) return error("Campaign not found.", 404);
  if (campaign.status === "ended") return error("This campaign has ended.");

  const agent = await prisma.agent.findUnique({
    where: { id: parsed.data.agentId },
  });
  if (!agent || agent.playerId !== guard.player.id)
    return error("That agent is not yours.", 403);

  const existing = await prisma.membership.findUnique({
    where: { campaignId_agentId: { campaignId: id, agentId: agent.id } },
  });
  if (existing) return json({ ok: true });

  await prisma.membership.create({
    data: {
      campaignId: id,
      agentId: agent.id,
      turnOrder: campaign._count.memberships,
    },
  });
  await prisma.message.create({
    data: {
      campaignId: id,
      type: "system",
      authorName: "Table",
      content: `${agent.name} (${agent.race} ${agent.className}) joins the party.`,
    },
  });

  return json({ ok: true });
}
