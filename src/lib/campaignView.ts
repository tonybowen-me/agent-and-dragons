import { prisma } from "@/lib/db";
import { publicAgent } from "@/lib/serialize";
import { strictnessLabel } from "@/lib/dnd";

export async function loadCampaignView(campaignId: string, playerId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      createdBy: { select: { handle: true } },
      memberships: {
        orderBy: { turnOrder: "asc" },
        include: { agent: { include: { inventory: true, player: { select: { id: true, handle: true } } } } },
      },
    },
  });
  if (!campaign) return null;

  const messages = await prisma.message.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
  });
  const recaps = await prisma.recap.findMany({
    where: { campaignId },
    orderBy: { index: "asc" },
    select: {
      id: true,
      index: true,
      title: true,
      headline: true,
      turnAt: true,
      createdAt: true,
    },
  });

  const memberAgentPlayerIds = new Set(
    campaign.memberships.map((m) => m.agent.playerId),
  );
  const myMemberAgentIds = campaign.memberships
    .filter((m) => m.agent.playerId === playerId)
    .map((m) => m.agent.id);

  const isOwner = campaign.createdById === playerId;
  const role = isOwner
    ? "owner"
    : memberAgentPlayerIds.has(playerId)
      ? "player"
      : "spectator";

  // Agents this player could still add to the campaign.
  const myAgents = await prisma.agent.findMany({
    where: { playerId },
    include: { inventory: true },
    orderBy: { createdAt: "desc" },
  });
  const memberIds = new Set(campaign.memberships.map((m) => m.agent.id));
  const availableAgents = myAgents
    .filter((a) => !memberIds.has(a.id))
    .map(publicAgent);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      storyPrompt: campaign.storyPrompt,
      strictness: campaign.strictness,
      strictnessLabel: strictnessLabel(campaign.strictness),
      status: campaign.status,
      turnCount: campaign.turnCount,
      milestoneCount: campaign.milestoneCount,
      createdBy: campaign.createdBy.handle,
      shareToken: role === "spectator" ? null : campaign.shareToken,
    },
    viewer: {
      role,
      isOwner,
      myMemberAgentIds,
      availableAgents,
    },
    party: campaign.memberships.map((m) => ({
      ...publicAgent(m.agent),
      ownerHandle: m.agent.player.handle,
      mine: m.agent.playerId === playerId,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      type: m.type,
      author: m.authorName,
      content: m.content,
      roll: m.rollJson ? JSON.parse(m.rollJson) : null,
      createdAt: m.createdAt.toISOString(),
    })),
    recaps: recaps.map((r) => ({
      id: r.id,
      index: r.index,
      title: r.title,
      headline: r.headline,
      turnAt: r.turnAt,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export type CampaignView = NonNullable<Awaited<ReturnType<typeof loadCampaignView>>>;
