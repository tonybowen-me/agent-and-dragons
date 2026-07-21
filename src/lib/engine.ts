import { prisma } from "@/lib/db";
import {
  abilityCheck,
  abilityModifier,
  hitDie,
  levelForXp,
  type AbilityKey,
} from "@/lib/dnd";
import { getNarrator } from "@/lib/narrator";
import type {
  CampaignContext,
  Effect,
  LogLine,
} from "@/lib/narrator/types";
import { toPartyMember, parseStringArray } from "@/lib/serialize";
import type { Agent, Campaign, InventoryItem } from "@prisma/client";

const RECENT_LOG_LIMIT = 14;
const MILESTONE_TURN_INTERVAL = 4;

type AgentWithInv = Agent & { inventory: InventoryItem[] };

interface LoadedContext {
  campaign: Campaign;
  members: AgentWithInv[];
  context: CampaignContext;
  byName: Map<string, AgentWithInv>;
}

async function loadContext(campaignId: string): Promise<LoadedContext> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      memberships: {
        orderBy: { turnOrder: "asc" },
        include: { agent: { include: { inventory: true } } },
      },
    },
  });
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");

  const members = campaign.memberships.map((m) => m.agent);
  const recentMessages = await prisma.message.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    take: RECENT_LOG_LIMIT,
  });
  const recentLog: LogLine[] = recentMessages
    .reverse()
    .map((m) => ({
      author: m.authorName || (m.type === "dm" ? "DM" : "System"),
      type: m.type,
      content: m.content,
    }));

  const context: CampaignContext = {
    name: campaign.name,
    storyPrompt: campaign.storyPrompt,
    strictness: campaign.strictness,
    sceneSummary: campaign.sceneSummary,
    turnCount: campaign.turnCount,
    party: members.map(toPartyMember),
    recentLog,
  };

  const byName = new Map<string, AgentWithInv>();
  for (const a of members) byName.set(a.name.toLowerCase(), a);

  return { campaign, members, context, byName };
}

function resolveTarget(
  byName: Map<string, AgentWithInv>,
  target: string,
): AgentWithInv | null {
  if (!target) return null;
  const exact = byName.get(target.toLowerCase());
  if (exact) return exact;
  // fuzzy: first name whose name contains / is contained by target
  for (const [name, agent] of byName) {
    if (name.includes(target.toLowerCase()) || target.toLowerCase().includes(name))
      return agent;
  }
  return null;
}

/** Apply mechanical effects, persisting changes and returning human log lines + milestone flags. */
async function applyEffects(
  campaignId: string,
  byName: Map<string, AgentWithInv>,
  effects: Effect[],
): Promise<{ logs: string[]; milestone: { title: string; headline: string } | null }> {
  const logs: string[] = [];
  let milestone: { title: string; headline: string } | null = null;

  for (const effect of effects) {
    if (effect.kind === "milestone") {
      milestone = { title: effect.title, headline: effect.headline };
      continue;
    }
    const agent = resolveTarget(byName, effect.target);
    if (!agent) continue;

    switch (effect.kind) {
      case "damage": {
        const newHp = Math.max(0, agent.hp - Math.abs(effect.amount));
        const alive = newHp > 0;
        await prisma.agent.update({
          where: { id: agent.id },
          data: { hp: newHp, alive },
        });
        agent.hp = newHp;
        agent.alive = alive;
        logs.push(
          `${agent.name} takes ${Math.abs(effect.amount)} damage${effect.note ? ` ${effect.note}` : ""} (HP ${newHp}/${agent.maxHp}).${alive ? "" : ` ${agent.name} falls!`}`,
        );
        break;
      }
      case "heal": {
        const newHp = Math.min(agent.maxHp, agent.hp + Math.abs(effect.amount));
        await prisma.agent.update({
          where: { id: agent.id },
          data: { hp: newHp, alive: true },
        });
        agent.hp = newHp;
        logs.push(`${agent.name} recovers ${Math.abs(effect.amount)} HP (HP ${newHp}/${agent.maxHp}).`);
        break;
      }
      case "xp": {
        const newXp = Math.max(0, agent.xp + effect.amount);
        const oldLevel = agent.level;
        const newLevel = levelForXp(newXp);
        let data: Record<string, number> = { xp: newXp, level: newLevel };
        logs.push(`${agent.name} gains ${effect.amount} XP.`);
        if (newLevel > oldLevel) {
          const conMod = abilityModifier(agent.con);
          const perLevel = Math.floor(hitDie(agent.className) / 2) + 1 + conMod;
          const hpGain = Math.max(1, perLevel) * (newLevel - oldLevel);
          const newMaxHp = agent.maxHp + hpGain;
          data = { ...data, maxHp: newMaxHp, hp: newMaxHp };
          agent.maxHp = newMaxHp;
          agent.hp = newMaxHp;
          logs.push(
            `⭐ ${agent.name} reaches level ${newLevel}! Max HP rises to ${newMaxHp} (fully restored).`,
          );
        }
        await prisma.agent.update({ where: { id: agent.id }, data });
        agent.xp = newXp;
        agent.level = newLevel;
        break;
      }
      case "gold": {
        const newGold = Math.max(0, agent.gold + effect.amount);
        await prisma.agent.update({ where: { id: agent.id }, data: { gold: newGold } });
        agent.gold = newGold;
        logs.push(
          `${agent.name} ${effect.amount >= 0 ? "gains" : "loses"} ${Math.abs(effect.amount)} gold (${newGold} total).`,
        );
        break;
      }
      case "loot": {
        const qty = effect.item.quantity ?? 1;
        await prisma.inventoryItem.create({
          data: {
            agentId: agent.id,
            name: effect.item.name,
            description: effect.item.description ?? "",
            quantity: qty,
          },
        });
        logs.push(`${agent.name} obtains ${effect.item.name}${qty > 1 ? ` x${qty}` : ""}.`);
        break;
      }
      case "removeItem": {
        const item = await prisma.inventoryItem.findFirst({
          where: { agentId: agent.id, name: { equals: effect.name } },
        });
        if (item) {
          const qty = effect.quantity ?? item.quantity;
          if (qty >= item.quantity) {
            await prisma.inventoryItem.delete({ where: { id: item.id } });
          } else {
            await prisma.inventoryItem.update({
              where: { id: item.id },
              data: { quantity: item.quantity - qty },
            });
          }
          logs.push(`${agent.name} loses ${effect.name}.`);
        }
        break;
      }
      case "condition": {
        const current = new Set(parseStringArray(agent.conditionsJson));
        for (const c of effect.add ?? []) current.add(c);
        for (const c of effect.remove ?? []) current.delete(c);
        const arr = [...current];
        await prisma.agent.update({
          where: { id: agent.id },
          data: { conditionsJson: JSON.stringify(arr) },
        });
        agent.conditionsJson = JSON.stringify(arr);
        if ((effect.add ?? []).length)
          logs.push(`${agent.name} is now ${(effect.add ?? []).join(", ")}.`);
        if ((effect.remove ?? []).length)
          logs.push(`${agent.name} is no longer ${(effect.remove ?? []).join(", ")}.`);
        break;
      }
    }
  }

  return { logs, milestone };
}

async function createMilestoneRecap(
  campaignId: string,
  index: number,
): Promise<void> {
  const { context } = await loadContext(campaignId);
  // Gather transcript since the previous milestone.
  const prev = await prisma.recap.findFirst({
    where: { campaignId },
    orderBy: { index: "desc" },
  });
  const transcriptMessages = await prisma.message.findMany({
    where: {
      campaignId,
      ...(prev ? { createdAt: { gt: prev.createdAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  const transcript: LogLine[] = transcriptMessages.map((m) => ({
    author: m.authorName || (m.type === "dm" ? "DM" : "System"),
    type: m.type,
    content: m.content,
  }));

  const recap = await getNarrator().milestoneRecap(context, index, transcript);
  await prisma.recap.create({
    data: {
      campaignId,
      index,
      title: recap.title,
      headline: recap.headline,
      markdown: recap.markdown,
      turnAt: context.turnCount,
    },
  });
  await prisma.message.create({
    data: {
      campaignId,
      type: "system",
      authorName: "Chronicle",
      content: `📖 Milestone ${index} recorded: ${recap.title} — ${recap.headline}`,
    },
  });
}

export async function startCampaign(campaignId: string): Promise<void> {
  const { campaign, members, context } = await loadContext(campaignId);
  if (campaign.status !== "lobby") return;
  if (members.length === 0) throw new Error("NO_MEMBERS");

  const opening = await getNarrator().openingScene(context);
  await prisma.message.create({
    data: {
      campaignId,
      type: "dm",
      authorName: "DM",
      content: opening.narration,
    },
  });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "active", sceneSummary: opening.sceneSummary },
  });
}

/** Core resolution shared by player-submitted and autonomous agent actions. */
async function resolveActorAction(
  campaignId: string,
  actor: AgentWithInv,
  actionText: string,
): Promise<void> {
  const { context, byName } = await loadContext(campaignId);
  const narrator = getNarrator();

  const plan = await narrator.planCheck(context, actor.name, actionText);
  let check = null;
  if (plan.needsCheck && plan.ability) {
    const ability = plan.ability as AbilityKey;
    const score = context.party.find((p) => p.agentId === actor.id)?.abilities[ability] ?? 10;
    const proficient = plan.skill
      ? parseStringArray(actor.skillsJson).includes(plan.skill)
      : false;
    const dc = plan.dc ?? 12;
    check = abilityCheck(score, proficient, actor.level, dc);
    const label = plan.skill ? `${plan.skill} (${ability.toUpperCase()})` : ability.toUpperCase();
    await prisma.message.create({
      data: {
        campaignId,
        type: "roll",
        agentId: actor.id,
        authorName: "Dice",
        content: `${actor.name} rolls ${label}: d20(${check.d20}) ${check.modifier >= 0 ? "+" : ""}${check.modifier} = ${check.total} vs DC ${check.dc} — ${check.critical === "hit" ? "CRIT!" : check.critical === "miss" ? "CRIT FAIL" : check.success ? "success" : "failure"}`,
        rollJson: JSON.stringify({ ...check, ability, skill: plan.skill ?? null }),
      },
    });
  }

  const result = await narrator.resolveAction(context, actor.name, actionText, check);
  await prisma.message.create({
    data: {
      campaignId,
      type: "dm",
      authorName: "DM",
      content: result.narration,
    },
  });

  const { logs, milestone } = await applyEffects(campaignId, byName, result.effects);
  for (const line of logs) {
    await prisma.message.create({
      data: { campaignId, type: "system", authorName: "Rules", content: line },
    });
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sceneSummary: result.sceneSummary,
      turnCount: { increment: 1 },
    },
  });

  const shouldMilestone =
    milestone !== null || updated.turnCount % MILESTONE_TURN_INTERVAL === 0;
  if (shouldMilestone) {
    if (milestone) {
      await prisma.message.create({
        data: {
          campaignId,
          type: "system",
          authorName: "DM",
          content: `✨ Milestone: ${milestone.title} — ${milestone.headline}`,
        },
      });
    }
    const nextIndex = updated.milestoneCount + 1;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { milestoneCount: nextIndex },
    });
    await createMilestoneRecap(campaignId, nextIndex);
  }
}

export async function submitPlayerAction(
  campaignId: string,
  agentId: string,
  actionText: string,
): Promise<void> {
  const { campaign, byName } = await loadContext(campaignId);
  if (campaign.status !== "active") throw new Error("CAMPAIGN_NOT_ACTIVE");
  const actor = [...byName.values()].find((a) => a.id === agentId);
  if (!actor) throw new Error("AGENT_NOT_IN_CAMPAIGN");

  await prisma.message.create({
    data: {
      campaignId,
      type: "player_action",
      agentId: actor.id,
      authorName: actor.name,
      content: actionText,
    },
  });
  await resolveActorAction(campaignId, actor, actionText);
}

/** Autonomous turn: the AI agent decides and takes its own action. */
export async function runAgentTurn(
  campaignId: string,
  agentId?: string,
): Promise<void> {
  const { campaign, members, context, byName } = await loadContext(campaignId);
  if (campaign.status !== "active") throw new Error("CAMPAIGN_NOT_ACTIVE");
  const living = members.filter((m) => m.alive);
  if (living.length === 0) throw new Error("NO_LIVING_AGENTS");

  let actor: AgentWithInv;
  if (agentId) {
    const found = byName.size ? [...byName.values()].find((a) => a.id === agentId) : undefined;
    if (!found) throw new Error("AGENT_NOT_IN_CAMPAIGN");
    actor = found;
  } else {
    actor = living[campaign.turnCount % living.length];
  }

  const decision = await getNarrator().decideAgentAction(
    context,
    toPartyMember(actor),
  );
  await prisma.message.create({
    data: {
      campaignId,
      type: "agent",
      agentId: actor.id,
      authorName: actor.name,
      content: decision.actionText,
    },
  });
  await resolveActorAction(campaignId, actor, decision.actionText);
}
