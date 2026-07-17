import { chatText, chatJSON, type ChatMessage } from "@/lib/llm";
import {
  ABILITIES,
  abilityModifier,
  formatModifier,
  strictnessGuidance,
  strictnessLabel,
} from "@/lib/dnd";
import type { CheckResult } from "@/lib/dnd";
import type {
  AgentDecision,
  CampaignContext,
  CheckPlan,
  LogLine,
  Narrator,
  OpeningScene,
  PartyMember,
  RecapResult,
  ResolveResult,
} from "./types";

function describeMember(m: PartyMember): string {
  const abil = ABILITIES.map(
    (a) => `${a.short} ${m.abilities[a.key]} (${formatModifier(abilityModifier(m.abilities[a.key]))})`,
  ).join(", ");
  const inv = m.inventory.length
    ? m.inventory.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ")
    : "nothing notable";
  const cond = m.conditions.length ? m.conditions.join(", ") : "none";
  return [
    `- ${m.name} — level ${m.level} ${m.race} ${m.className} (HP ${m.hp}/${m.maxHp}, AC ${m.ac})`,
    `  Abilities: ${abil}`,
    `  Skills: ${m.skills.join(", ") || "none"}. Conditions: ${cond}.`,
    `  Inventory: ${inv}.`,
    `  Personality: ${m.persona}`,
  ].join("\n");
}

function dmSystemPrompt(ctx: CampaignContext): string {
  return [
    "You are the Dungeon Master (DM) for a game of Dungeons & Dragons played by AI-controlled characters.",
    "You narrate the world, voice all NPCs and monsters, and adjudicate outcomes using D&D 5e rules.",
    "Write vivid, second-person-to-the-party narration. Keep each response to 1-3 tight paragraphs.",
    "",
    `## Campaign: ${ctx.name}`,
    `## Story premise\n${ctx.storyPrompt}`,
    `## Story strictness: ${ctx.strictness}/100 (${strictnessLabel(ctx.strictness)})`,
    strictnessGuidance(ctx.strictness),
    "",
    "## The party",
    ctx.party.map(describeMember).join("\n"),
    "",
    "## Current world state",
    ctx.sceneSummary || "(the adventure is just beginning)",
  ].join("\n");
}

function recentLogText(log: LogLine[]): string {
  if (!log.length) return "(no events yet)";
  return log.map((l) => `${l.author}: ${l.content}`).join("\n");
}

export class LlmNarrator implements Narrator {
  readonly kind = "llm" as const;

  async openingScene(ctx: CampaignContext): Promise<OpeningScene> {
    const messages: ChatMessage[] = [
      { role: "system", content: dmSystemPrompt(ctx) },
      {
        role: "user",
        content:
          "Open the adventure. Set the opening scene where the party begins, hook them into the premise, and end by inviting them to act. Then, on a new line beginning with 'STATE:', give a one-paragraph factual summary of the current situation for your own future reference.",
      },
    ];
    const text = await chatText(messages, { temperature: 0.95 });
    return splitNarrationState(text, ctx.storyPrompt);
  }

  async planCheck(
    ctx: CampaignContext,
    actorName: string,
    actionText: string,
  ): Promise<CheckPlan> {
    const messages: ChatMessage[] = [
      { role: "system", content: dmSystemPrompt(ctx) },
      {
        role: "user",
        content: [
          `${actorName} attempts the following action: "${actionText}"`,
          "",
          "Decide whether this action requires an ability check to resolve. Trivial or purely narrative actions do not.",
          "Respond as JSON with keys: needsCheck (boolean), ability (one of str,dex,con,intel,wis,cha), skill (a D&D skill name or empty), dc (integer 5-30, typical 10-20), rationale (short string).",
        ].join("\n"),
      },
    ];
    const plan = await chatJSON<CheckPlan>(messages, { temperature: 0.3 });
    return plan;
  }

  async resolveAction(
    ctx: CampaignContext,
    actorName: string,
    actionText: string,
    check: CheckResult | null,
  ): Promise<ResolveResult> {
    const checkText = check
      ? `A d20 ability check was rolled: ${check.d20} ${formatModifier(check.modifier)} = ${check.total} vs DC ${check.dc} -> ${check.critical === "hit" ? "CRITICAL SUCCESS" : check.critical === "miss" ? "CRITICAL FAILURE" : check.success ? "SUCCESS" : "FAILURE"}. Narrate an outcome consistent with this result.`
      : "No ability check was required; narrate the direct outcome.";

    const messages: ChatMessage[] = [
      { role: "system", content: dmSystemPrompt(ctx) },
      {
        role: "user",
        content: [
          `Recent events:\n${recentLogText(ctx.recentLog)}`,
          "",
          `${actorName} attempts: "${actionText}"`,
          checkText,
          "",
          "Narrate the outcome as DM, then determine mechanical effects.",
          "Respond as JSON with keys:",
          '- "narration": string (your DM narration, 1-3 paragraphs)',
          '- "sceneSummary": string (updated factual world-state summary)',
          '- "effects": array of effect objects. Each effect is one of:',
          '   {"kind":"damage","target":NAME,"amount":N,"note":STR}',
          '   {"kind":"heal","target":NAME,"amount":N}',
          '   {"kind":"xp","target":NAME,"amount":N}  (award 10-500 xp for meaningful accomplishments)',
          '   {"kind":"gold","target":NAME,"amount":N}  (N may be negative)',
          '   {"kind":"loot","target":NAME,"item":{"name":STR,"description":STR,"quantity":N}}',
          '   {"kind":"removeItem","target":NAME,"name":STR,"quantity":N}',
          '   {"kind":"condition","target":NAME,"add":[STR],"remove":[STR]}',
          '   {"kind":"milestone","title":STR,"headline":STR}  (include ONLY when a significant story beat, boss, level-up-worthy victory, or major location change occurs)',
          "target must exactly match a party member name. Use an empty effects array if nothing mechanical changes.",
        ].join("\n"),
      },
    ];
    const result = await chatJSON<ResolveResult>(messages, { temperature: 0.85 });
    if (!Array.isArray(result.effects)) result.effects = [];
    if (!result.sceneSummary) result.sceneSummary = ctx.sceneSummary;
    return result;
  }

  async decideAgentAction(
    ctx: CampaignContext,
    agent: PartyMember,
  ): Promise<AgentDecision> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: [
          `You are role-playing as ${agent.name}, a level ${agent.level} ${agent.race} ${agent.className} in a game of Dungeons & Dragons.`,
          `Your personality: ${agent.persona}`,
          `Your current state: HP ${agent.hp}/${agent.maxHp}, conditions: ${agent.conditions.join(", ") || "none"}.`,
          `Your inventory: ${agent.inventory.map((i) => i.name).join(", ") || "nothing"}.`,
          "Stay fully in character. Decide ONE concrete action to take on your turn. Be bold and specific.",
          "Reply with a single sentence describing what you say and/or do, in first person.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `The DM's premise: ${ctx.storyPrompt}`,
          `Current scene: ${ctx.sceneSummary}`,
          `Recent events:\n${recentLogText(ctx.recentLog)}`,
          "",
          "What do you do?",
        ].join("\n"),
      },
    ];
    const text = await chatText(messages, { temperature: 1.0, maxTokens: 160 });
    return { actionText: text.replace(/^["']|["']$/g, "").trim() };
  }

  async milestoneRecap(
    ctx: CampaignContext,
    index: number,
    transcript: LogLine[],
  ): Promise<RecapResult> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are the Chronicler for a Dungeons & Dragons campaign. You write engaging Markdown recaps so human spectators can catch up on what the AI adventurers have been doing.",
      },
      {
        role: "user",
        content: [
          `Campaign: ${ctx.name}`,
          `Premise: ${ctx.storyPrompt}`,
          `This is milestone recap #${index}.`,
          "",
          "Party sheet (current):",
          ctx.party.map(describeMember).join("\n"),
          "",
          "Transcript since the last milestone:",
          recentLogText(transcript),
          "",
          "Write a Markdown recap. Respond as JSON with keys:",
          '- "title": a short evocative chapter title',
          '- "headline": a single high-level TL;DR sentence a busy human can skim',
          '- "markdown": a well-structured Markdown recap with sections: a "## TL;DR" bullet summary, a "## What happened" narrative section, and a "## Party status" section noting level-ups, notable loot, injuries, and deaths.',
        ].join("\n"),
      },
    ];
    const recap = await chatJSON<RecapResult>(messages, {
      temperature: 0.7,
      maxTokens: 900,
    });
    return recap;
  }
}

function splitNarrationState(text: string, fallbackSummary: string): OpeningScene {
  const idx = text.indexOf("STATE:");
  if (idx === -1) {
    return { narration: text.trim(), sceneSummary: text.trim().slice(0, 600) || fallbackSummary };
  }
  return {
    narration: text.slice(0, idx).trim(),
    sceneSummary: text.slice(idx + "STATE:".length).trim() || fallbackSummary,
  };
}
