import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { redeemInvite } from "@/lib/auth";
import { mintApiToken } from "@/lib/tokens";
import { publicAgent } from "@/lib/serialize";
import { loadCampaignView } from "@/lib/campaignView";
import {
  startCampaign,
  submitPlayerAction,
  runAgentTurn,
} from "@/lib/engine";
import {
  CLASSES,
  RACES,
  SKILLS,
  abilityModifier,
  hitDie,
  starterKit,
  strictnessLabel,
} from "@/lib/dnd";

/**
 * Player-scoped game operations shared by the REST API and the MCP server, so
 * a human at the website and an external agent over MCP go through identical
 * validation and rules.
 */

export type ActionErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT";

export class ActionError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

const STANDARD_ARRAY = { str: 15, dex: 14, con: 13, intel: 12, wis: 10, cha: 8 };

/**
 * Redeem an invite code and mint an API key in one step. Lets an external
 * agent bootstrap access over MCP without ever touching the website.
 */
export async function redeemInviteForApiToken(code: string, handle: string) {
  const res = await redeemInvite(code, handle);
  if (!res.ok || !res.player)
    throw new ActionError("BAD_REQUEST", res.error ?? "Could not redeem that invite.");
  const key = await mintApiToken(res.player.id, "mcp");
  return {
    player: { id: res.player.id, handle: res.player.handle },
    apiKey: key.token,
  };
}

export interface CreateAgentInput {
  name: string;
  race: string;
  className: string;
  persona: string;
  backstory?: string;
  abilities?: {
    str: number;
    dex: number;
    con: number;
    intel: number;
    wis: number;
    cha: number;
  };
  skills?: string[];
}

export async function createAgent(playerId: string, input: CreateAgentInput) {
  const name = input.name?.trim();
  const persona = input.persona?.trim();
  if (!name || name.length > 40)
    throw new ActionError("BAD_REQUEST", "Name is required (max 40 chars).");
  if (!persona)
    throw new ActionError("BAD_REQUEST", "A persona/personality prompt is required.");
  if (!RACES.includes(input.race))
    throw new ActionError("BAD_REQUEST", `Unknown race. Choose one of: ${RACES.join(", ")}.`);
  if (!CLASSES.includes(input.className))
    throw new ActionError("BAD_REQUEST", `Unknown class. Choose one of: ${CLASSES.join(", ")}.`);

  const abilities = input.abilities ?? STANDARD_ARRAY;
  const validSkills = (input.skills ?? []).filter((s) => s in SKILLS).slice(0, 4);
  const maxHp = Math.max(1, hitDie(input.className) + abilityModifier(abilities.con));
  const ac = 10 + abilityModifier(abilities.dex);

  const agent = await prisma.agent.create({
    data: {
      playerId,
      name,
      race: input.race,
      className: input.className,
      persona,
      backstory: (input.backstory ?? "").trim(),
      str: abilities.str,
      dex: abilities.dex,
      con: abilities.con,
      intel: abilities.intel,
      wis: abilities.wis,
      cha: abilities.cha,
      maxHp,
      hp: maxHp,
      ac,
      gold: 10,
      skillsJson: JSON.stringify(validSkills),
      inventory: {
        create: starterKit(input.className).map((item) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity ?? 1,
        })),
      },
    },
    include: { inventory: true },
  });
  return publicAgent(agent);
}

export async function listAgents(playerId: string) {
  const agents = await prisma.agent.findMany({
    where: { playerId },
    include: { inventory: true },
    orderBy: { createdAt: "desc" },
  });
  return agents.map(publicAgent);
}

export interface CreateCampaignInput {
  name: string;
  storyPrompt: string;
  strictness?: number;
}

export async function createCampaign(playerId: string, input: CreateCampaignInput) {
  const name = input.name?.trim();
  const storyPrompt = input.storyPrompt?.trim();
  if (!name || name.length > 80)
    throw new ActionError("BAD_REQUEST", "Campaign name is required (max 80 chars).");
  if (!storyPrompt)
    throw new ActionError("BAD_REQUEST", "A story prompt is required.");
  let strictness = input.strictness ?? 50;
  if (!Number.isFinite(strictness)) strictness = 50;
  strictness = Math.max(0, Math.min(100, Math.round(strictness)));

  return prisma.campaign.create({
    data: {
      name,
      storyPrompt,
      strictness,
      shareToken: randomBytes(9).toString("hex"),
      createdById: playerId,
    },
  });
}

export async function listCampaigns(playerId: string) {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { handle: true } },
      memberships: {
        include: {
          agent: { select: { name: true, className: true, level: true, playerId: true } },
        },
      },
      _count: { select: { messages: true, recaps: true } },
    },
  });
  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    storyPrompt: c.storyPrompt,
    strictness: c.strictness,
    strictnessLabel: strictnessLabel(c.strictness),
    status: c.status,
    turnCount: c.turnCount,
    createdBy: c.createdBy.handle,
    isOwner: c.createdById === playerId,
    party: c.memberships.map((m) => ({
      name: m.agent.name,
      className: m.agent.className,
      level: m.agent.level,
      mine: m.agent.playerId === playerId,
    })),
    messageCount: c._count.messages,
    recapCount: c._count.recaps,
  }));
}

export async function joinCampaign(
  playerId: string,
  campaignId: string,
  agentId: string,
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { _count: { select: { memberships: true } } },
  });
  if (!campaign) throw new ActionError("NOT_FOUND", "Campaign not found.");
  if (campaign.status === "ended")
    throw new ActionError("CONFLICT", "This campaign has ended.");

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.playerId !== playerId)
    throw new ActionError("FORBIDDEN", "That agent is not yours.");

  const existing = await prisma.membership.findUnique({
    where: { campaignId_agentId: { campaignId, agentId } },
  });
  if (existing) return { ok: true, alreadyJoined: true };

  await prisma.membership.create({
    data: { campaignId, agentId, turnOrder: campaign._count.memberships },
  });
  await prisma.message.create({
    data: {
      campaignId,
      type: "system",
      authorName: "Table",
      content: `${agent.name} (${agent.race} ${agent.className}) joins the party.`,
    },
  });
  return { ok: true, alreadyJoined: false };
}

export async function startCampaignAsPlayer(playerId: string, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ActionError("NOT_FOUND", "Campaign not found.");
  if (campaign.createdById !== playerId)
    throw new ActionError("FORBIDDEN", "Only the campaign creator can begin the adventure.");
  try {
    await startCampaign(campaignId);
  } catch (e) {
    if (e instanceof Error && e.message === "NO_MEMBERS")
      throw new ActionError("BAD_REQUEST", "Add at least one agent before starting.");
    throw e;
  }
  return { ok: true };
}

export async function submitAction(
  playerId: string,
  campaignId: string,
  agentId: string,
  actionText: string,
) {
  const text = actionText?.trim();
  if (!text) throw new ActionError("BAD_REQUEST", "Describe an action for your agent.");
  if (text.length > 600)
    throw new ActionError("BAD_REQUEST", "Keep actions under 600 characters.");

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.playerId !== playerId)
    throw new ActionError("FORBIDDEN", "That agent is not yours.");
  const membership = await prisma.membership.findUnique({
    where: { campaignId_agentId: { campaignId, agentId } },
  });
  if (!membership)
    throw new ActionError("BAD_REQUEST", "That agent is not in this campaign.");

  try {
    await submitPlayerAction(campaignId, agentId, text);
  } catch (e) {
    if (e instanceof Error && e.message === "CAMPAIGN_NOT_ACTIVE")
      throw new ActionError("CONFLICT", "The adventure has not started yet.");
    throw e;
  }
  return { ok: true };
}

export async function advanceTurn(
  playerId: string,
  campaignId: string,
  agentId?: string,
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      memberships: { include: { agent: { select: { id: true, playerId: true } } } },
    },
  });
  if (!campaign) throw new ActionError("NOT_FOUND", "Campaign not found.");

  const isOwner = campaign.createdById === playerId;
  const ownsMember = campaign.memberships.some((m) => m.agent.playerId === playerId);
  if (!isOwner && !ownsMember)
    throw new ActionError("FORBIDDEN", "Only players with an agent in this campaign can advance it.");

  if (agentId) {
    const target = campaign.memberships.find((m) => m.agent.id === agentId);
    if (!target)
      throw new ActionError("BAD_REQUEST", "That agent is not in this campaign.");
    if (!isOwner && target.agent.playerId !== playerId)
      throw new ActionError("FORBIDDEN", "You can only auto-run your own agents.");
  }

  try {
    await runAgentTurn(campaignId, agentId);
  } catch (e) {
    if (e instanceof Error && e.message === "CAMPAIGN_NOT_ACTIVE")
      throw new ActionError("CONFLICT", "The adventure has not started yet.");
    if (e instanceof Error && e.message === "NO_LIVING_AGENTS")
      throw new ActionError("CONFLICT", "No living agents remain to act.");
    throw e;
  }
  return { ok: true };
}

/** Full campaign view (same data the web play screen uses). */
export async function getCampaignView(playerId: string, campaignId: string) {
  const view = await loadCampaignView(campaignId, playerId);
  if (!view) throw new ActionError("NOT_FOUND", "Campaign not found.");
  return view;
}

/**
 * Compact, agent-friendly campaign state: recent log, party vitals, your
 * agents, and whose turn it is — trimmed to keep an LLM client's context lean.
 */
export async function getCampaignState(
  playerId: string,
  campaignId: string,
  logLimit = 25,
) {
  const view = await getCampaignView(playerId, campaignId);
  return {
    campaign: view.campaign,
    role: view.viewer.role,
    myAgentIds: view.viewer.myMemberAgentIds,
    party: view.party.map((p) => ({
      id: p.id,
      name: p.name,
      race: p.race,
      className: p.className,
      level: p.level,
      xp: p.xp,
      hp: p.hp,
      maxHp: p.maxHp,
      ac: p.ac,
      gold: p.gold,
      alive: p.alive,
      conditions: p.conditions,
      owner: p.ownerHandle,
      mine: p.mine,
      inventory: p.inventory.map((i) => ({ name: i.name, quantity: i.quantity })),
    })),
    log: view.messages.slice(-logLimit),
    recaps: view.recaps,
  };
}

export async function getChronicleMarkdown(playerId: string, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, storyPrompt: true },
  });
  if (!campaign) throw new ActionError("NOT_FOUND", "Campaign not found.");
  const recaps = await prisma.recap.findMany({
    where: { campaignId },
    orderBy: { index: "asc" },
    select: { index: true, title: true, headline: true, markdown: true, turnAt: true },
  });
  return { campaign, recaps };
}
