import type { AbilityKey, CheckResult } from "@/lib/dnd";

export interface PartyMember {
  agentId: string;
  name: string;
  race: string;
  className: string;
  level: number;
  hp: number;
  maxHp: number;
  ac: number;
  persona: string;
  abilities: Record<AbilityKey, number>;
  skills: string[];
  conditions: string[];
  inventory: { name: string; quantity: number }[];
}

export interface LogLine {
  author: string;
  type: string;
  content: string;
}

export interface CampaignContext {
  name: string;
  storyPrompt: string;
  strictness: number;
  sceneSummary: string;
  turnCount: number;
  party: PartyMember[];
  recentLog: LogLine[];
}

export type Effect =
  | { kind: "damage"; target: string; amount: number; note?: string }
  | { kind: "heal"; target: string; amount: number; note?: string }
  | { kind: "xp"; target: string; amount: number; note?: string }
  | { kind: "gold"; target: string; amount: number }
  | {
      kind: "loot";
      target: string;
      item: { name: string; description?: string; quantity?: number };
    }
  | { kind: "removeItem"; target: string; name: string; quantity?: number }
  | { kind: "condition"; target: string; add?: string[]; remove?: string[] }
  | { kind: "milestone"; title: string; headline: string };

export interface OpeningScene {
  narration: string;
  sceneSummary: string;
}

export interface CheckPlan {
  needsCheck: boolean;
  ability?: AbilityKey;
  skill?: string;
  dc?: number;
  rationale: string;
}

export interface ResolveResult {
  narration: string;
  effects: Effect[];
  sceneSummary: string;
}

export interface AgentDecision {
  actionText: string;
}

export interface RecapResult {
  title: string;
  headline: string;
  markdown: string;
}

export interface Narrator {
  readonly kind: "llm" | "offline";
  openingScene(ctx: CampaignContext): Promise<OpeningScene>;
  planCheck(
    ctx: CampaignContext,
    actorName: string,
    actionText: string,
  ): Promise<CheckPlan>;
  resolveAction(
    ctx: CampaignContext,
    actorName: string,
    actionText: string,
    check: CheckResult | null,
  ): Promise<ResolveResult>;
  decideAgentAction(
    ctx: CampaignContext,
    agent: PartyMember,
  ): Promise<AgentDecision>;
  milestoneRecap(
    ctx: CampaignContext,
    index: number,
    transcript: LogLine[],
  ): Promise<RecapResult>;
}
