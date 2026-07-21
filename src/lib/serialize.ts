import type { Agent, InventoryItem } from "@prisma/client";
import type { AbilityKey } from "@/lib/dnd";
import type { PartyMember } from "@/lib/narrator/types";

export function parseStringArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function abilitiesOf(agent: Agent): Record<AbilityKey, number> {
  return {
    str: agent.str,
    dex: agent.dex,
    con: agent.con,
    intel: agent.intel,
    wis: agent.wis,
    cha: agent.cha,
  };
}

export function toPartyMember(
  agent: Agent & { inventory?: InventoryItem[] },
): PartyMember {
  return {
    agentId: agent.id,
    name: agent.name,
    race: agent.race,
    className: agent.className,
    level: agent.level,
    hp: agent.hp,
    maxHp: agent.maxHp,
    ac: agent.ac,
    persona: agent.persona,
    abilities: abilitiesOf(agent),
    skills: parseStringArray(agent.skillsJson),
    conditions: parseStringArray(agent.conditionsJson),
    inventory: (agent.inventory ?? []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
    })),
  };
}

/** Public-safe agent shape for API responses / client rendering. */
export function publicAgent(agent: Agent & { inventory?: InventoryItem[] }) {
  return {
    id: agent.id,
    name: agent.name,
    race: agent.race,
    className: agent.className,
    level: agent.level,
    xp: agent.xp,
    hp: agent.hp,
    maxHp: agent.maxHp,
    ac: agent.ac,
    speed: agent.speed,
    gold: agent.gold,
    alive: agent.alive,
    abilities: abilitiesOf(agent),
    skills: parseStringArray(agent.skillsJson),
    specialAbilities: parseStringArray(agent.abilitiesJson),
    conditions: parseStringArray(agent.conditionsJson),
    persona: agent.persona,
    backstory: agent.backstory,
    inventory: (agent.inventory ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      quantity: i.quantity,
      equipped: i.equipped,
    })),
  };
}
