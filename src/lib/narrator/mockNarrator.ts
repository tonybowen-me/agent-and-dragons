import { SKILLS, type AbilityKey } from "@/lib/dnd";
import type { CheckResult } from "@/lib/dnd";
import type {
  AgentDecision,
  CampaignContext,
  CheckPlan,
  Effect,
  LogLine,
  Narrator,
  OpeningScene,
  PartyMember,
  RecapResult,
  ResolveResult,
} from "./types";

// Small deterministic PRNG (mulberry32) seeded from a string so the offline
// engine is reproducible for a given campaign state.
function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

const ACTION_KEYWORDS: { words: string[]; ability: AbilityKey; skill?: string }[] = [
  { words: ["attack", "strike", "swing", "shoot", "stab", "fight", "slash", "fire"], ability: "str", skill: "Athletics" },
  { words: ["sneak", "hide", "stealth", "slip", "creep"], ability: "dex", skill: "Stealth" },
  { words: ["persuade", "convince", "negotiate", "charm", "bargain", "talk"], ability: "cha", skill: "Persuasion" },
  { words: ["intimidate", "threaten", "menace"], ability: "cha", skill: "Intimidation" },
  { words: ["deceive", "lie", "bluff", "trick", "disguise"], ability: "cha", skill: "Deception" },
  { words: ["climb", "jump", "lift", "shove", "break", "force"], ability: "str", skill: "Athletics" },
  { words: ["dodge", "leap", "balance", "tumble", "flip", "acrobat"], ability: "dex", skill: "Acrobatics" },
  { words: ["search", "investigate", "examine", "inspect", "study"], ability: "intel", skill: "Investigation" },
  { words: ["recall", "remember", "know", "arcana", "spell", "cast"], ability: "intel", skill: "Arcana" },
  { words: ["perceive", "listen", "watch", "spot", "notice", "look"], ability: "wis", skill: "Perception" },
  { words: ["heal", "medicine", "tend", "bandage"], ability: "wis", skill: "Medicine" },
  { words: ["sense", "insight", "read"], ability: "wis", skill: "Insight" },
];

const SETTINGS = [
  "a mist-wreathed crossroads",
  "the creaking common room of a roadside inn",
  "the ruins of a moon-touched watchtower",
  "a market square gone strangely quiet",
  "the mouth of a cavern breathing cold air",
];

const ESCALATIONS = [
  "A cloaked messenger presses a wax-sealed letter into the nearest hand and vanishes.",
  "The ground trembles; somewhere distant, a horn sounds three long notes.",
  "A shimmering rift opens midair, spilling pale light and the scent of ozone.",
  "A goblin scout bursts from cover, shrieks, and bolts back into the dark.",
  "The stars overhead rearrange themselves into an arrow pointing skyward.",
  "A merchant's cart tips, and out rolls a humming, rune-etched orb.",
  "A voice with no source whispers each adventurer's name in turn.",
];

const OUTCOME_SUCCESS = [
  "The gambit lands cleanly.",
  "Fortune bends your way.",
  "It works better than anyone expected.",
  "The room seems to hold its breath, then relaxes in your favor.",
];
const OUTCOME_FAIL = [
  "It goes sideways almost immediately.",
  "The attempt falters at the worst moment.",
  "Something was overlooked, and it costs you.",
  "The world does not cooperate.",
];

function abilityForAction(actionText: string): { ability: AbilityKey; skill?: string } {
  const lower = actionText.toLowerCase();
  for (const entry of ACTION_KEYWORDS) {
    if (entry.words.some((w) => lower.includes(w)))
      return { ability: entry.ability, skill: entry.skill };
  }
  return { ability: "cha" };
}

export class MockNarrator implements Narrator {
  readonly kind = "offline" as const;

  async openingScene(ctx: CampaignContext): Promise<OpeningScene> {
    const rng = mulberry32(hashString(ctx.name + ctx.storyPrompt));
    const setting = pick(SETTINGS, rng);
    const names = ctx.party.map((p) => p.name).join(", ") || "the adventurers";
    const narration = [
      `The tale begins at ${setting}. ${ctx.storyPrompt}`,
      `${names} find themselves drawn together here, weapons close and instincts sharp. The air hums with the sense that something is about to happen — and that whatever they do next will matter.`,
      `What do you do?`,
    ].join("\n\n");
    const sceneSummary = `The party (${names}) has gathered at ${setting}. Premise: ${ctx.storyPrompt} Nothing has been resolved yet.`;
    return { narration, sceneSummary };
  }

  async planCheck(
    _ctx: CampaignContext,
    _actorName: string,
    actionText: string,
  ): Promise<CheckPlan> {
    const lower = actionText.toLowerCase();
    const trivial = ["say", "look around", "wait", "rest", "think", "greet"].some(
      (w) => lower.startsWith(w),
    );
    const { ability, skill } = abilityForAction(actionText);
    const rng = mulberry32(hashString(actionText));
    const dc = 8 + Math.floor(rng() * 10); // 8-17
    return {
      needsCheck: !trivial,
      ability,
      skill: skill && SKILLS[skill] ? skill : undefined,
      dc,
      rationale: trivial
        ? "A simple, low-stakes action."
        : `Resolved with a ${skill ?? ability.toUpperCase()} check.`,
    };
  }

  async resolveAction(
    ctx: CampaignContext,
    actorName: string,
    actionText: string,
    check: CheckResult | null,
  ): Promise<ResolveResult> {
    const rng = mulberry32(
      hashString(`${ctx.name}:${ctx.turnCount}:${actorName}:${actionText}`),
    );
    const success = check ? check.success : true;
    const crit = check?.critical ?? null;
    const effects: Effect[] = [];

    let outcome: string;
    if (crit === "hit") outcome = "A critical success! " + pick(OUTCOME_SUCCESS, rng);
    else if (crit === "miss") outcome = "A critical failure! " + pick(OUTCOME_FAIL, rng);
    else outcome = success ? pick(OUTCOME_SUCCESS, rng) : pick(OUTCOME_FAIL, rng);

    const flourish = pick(ESCALATIONS, rng);
    const quoted = actionText.trim().replace(/[.!?]+$/, "");
    const narration = [
      `${actorName} attempts to: "${quoted}." ${outcome}`,
      flourish,
    ].join(" ");

    if (success) {
      effects.push({
        kind: "xp",
        target: actorName,
        amount: crit === "hit" ? 150 : 60 + Math.floor(rng() * 60),
        note: "for a successful action",
      });
      if (rng() < 0.3) {
        const loot = pick(
          [
            { name: "Glimmering Trinket", description: "A curio of uncertain value" },
            { name: "Healing Draught", description: "Restores 2d4+2 HP" },
            { name: "Ancient Coin", description: "Worth a small fortune to the right buyer" },
          ],
          rng,
        );
        effects.push({ kind: "loot", target: actorName, item: loot });
      }
    } else {
      if (crit === "miss" || rng() < 0.5) {
        effects.push({
          kind: "damage",
          target: actorName,
          amount: 1 + Math.floor(rng() * 6),
          note: "from the botched attempt",
        });
      }
    }

    // Occasional milestone based on turn cadence and a little randomness.
    if ((ctx.turnCount + 1) % 4 === 0) {
      effects.push({
        kind: "milestone",
        title: pick(
          ["A Turn of Events", "The Plot Thickens", "Rising Action", "No Going Back"],
          rng,
        ),
        headline: `${actorName}'s latest gambit pushes the story into new territory.`,
      });
    }

    const sceneSummary =
      `${ctx.sceneSummary} Then ${actorName} ${actionText.trim()} (${success ? "succeeded" : "failed"}). ${flourish}`.slice(
        -1200,
      );

    return { narration, effects, sceneSummary };
  }

  async decideAgentAction(
    ctx: CampaignContext,
    agent: PartyMember,
  ): Promise<AgentDecision> {
    const rng = mulberry32(
      hashString(`${ctx.name}:${ctx.turnCount}:${agent.name}:decide`),
    );
    const persona = agent.persona.toLowerCase();
    const aggressive = /brav|reckless|warrior|fierce|bold|angry|barbar/.test(persona);
    const sneaky = /sneak|rogue|cautious|sly|cunning|shadow|thief/.test(persona);
    const charming = /charm|bard|diplomat|friendly|silver|persuas/.test(persona);

    const pools: string[] = [];
    if (aggressive)
      pools.push(
        "I ready my weapon and advance on the nearest threat, daring it to move.",
        "I let out a battle cry and strike first, trusting my strength.",
      );
    if (sneaky)
      pools.push(
        "I slip into the shadows and scout ahead for danger and treasure.",
        "I quietly search the area for anything valuable or trapped.",
      );
    if (charming)
      pools.push(
        "I flash a disarming smile and try to talk our way through this.",
        "I attempt to persuade whoever is nearest to help us.",
      );
    pools.push(
      "I examine our surroundings closely for clues about what to do next.",
      "I call the party together to decide on a bold plan.",
      "I press forward toward the heart of the mystery.",
    );

    return { actionText: pick(pools, rng) };
  }

  async milestoneRecap(
    ctx: CampaignContext,
    index: number,
    transcript: LogLine[],
  ): Promise<RecapResult> {
    const rng = mulberry32(hashString(`${ctx.name}:milestone:${index}`));
    const title = pick(
      ["A Chapter Closes", "Milestone Reached", "The Story So Far", "Onward and Upward"],
      rng,
    );
    const beats = transcript
      .filter((l) => l.type === "dm" || l.type === "player_action" || l.type === "agent")
      .slice(-8)
      .map((l) => `- **${l.author}:** ${l.content.replace(/\n+/g, " ").slice(0, 180)}`)
      .join("\n");
    const status = ctx.party
      .map(
        (p) =>
          `- **${p.name}** — level ${p.level} ${p.race} ${p.className}, HP ${p.hp}/${p.maxHp}${p.conditions.length ? `, conditions: ${p.conditions.join(", ")}` : ""}`,
      )
      .join("\n");
    const headline = `Milestone ${index}: the party pressed deeper into "${ctx.name}" and the stakes rose.`;
    const markdown = [
      `# ${title}`,
      "",
      "## TL;DR",
      `- ${headline}`,
      `- ${ctx.party.length} adventurer(s) still in play after ${ctx.turnCount} turns.`,
      "",
      "## What happened",
      beats || "_A quiet stretch on the road._",
      "",
      "## Party status",
      status,
    ].join("\n");
    return { title, headline, markdown };
  }
}
