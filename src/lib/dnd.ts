// Core D&D 5e-flavored rules helpers shared by the engine and UI.

export type AbilityKey = "str" | "dex" | "con" | "intel" | "wis" | "cha";

export const ABILITIES: { key: AbilityKey; label: string; short: string }[] = [
  { key: "str", label: "Strength", short: "STR" },
  { key: "dex", label: "Dexterity", short: "DEX" },
  { key: "con", label: "Constitution", short: "CON" },
  { key: "intel", label: "Intelligence", short: "INT" },
  { key: "wis", label: "Wisdom", short: "WIS" },
  { key: "cha", label: "Charisma", short: "CHA" },
];

export const RACES = [
  "Human",
  "Elf",
  "Dwarf",
  "Halfling",
  "Half-Orc",
  "Tiefling",
  "Dragonborn",
  "Gnome",
];

export const CLASSES = [
  "Fighter",
  "Wizard",
  "Rogue",
  "Cleric",
  "Ranger",
  "Barbarian",
  "Bard",
  "Paladin",
  "Druid",
  "Sorcerer",
];

// Skill -> governing ability
export const SKILLS: Record<string, AbilityKey> = {
  Acrobatics: "dex",
  "Animal Handling": "wis",
  Arcana: "intel",
  Athletics: "str",
  Deception: "cha",
  History: "intel",
  Insight: "wis",
  Intimidation: "cha",
  Investigation: "intel",
  Medicine: "wis",
  Nature: "intel",
  Perception: "wis",
  Performance: "cha",
  Persuasion: "cha",
  Religion: "intel",
  "Sleight of Hand": "dex",
  Stealth: "dex",
  Survival: "wis",
};

// XP required to reach each level (index 0 unused; level 1 = 0 xp).
export const XP_THRESHOLDS = [
  0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonus(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / 4) + 2;
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 1; l < XP_THRESHOLDS.length; l++) {
    if (xp >= XP_THRESHOLDS[l]) level = l;
  }
  return level;
}

export function xpToNextLevel(xp: number): { next: number; needed: number } | null {
  const level = levelForXp(xp);
  if (level >= XP_THRESHOLDS.length - 1) return null;
  const next = XP_THRESHOLDS[level + 1];
  return { next, needed: next - xp };
}

export type Die = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export function rollDie(sides: Die, rng: () => number = Math.random): number {
  return Math.floor(rng() * sides) + 1;
}

export interface CheckResult {
  d20: number;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  critical: "hit" | "miss" | null;
}

export function abilityCheck(
  score: number,
  proficient: boolean,
  level: number,
  dc: number,
  rng: () => number = Math.random,
): CheckResult {
  const d20 = rollDie(20, rng);
  const modifier =
    abilityModifier(score) + (proficient ? proficiencyBonus(level) : 0);
  const total = d20 + modifier;
  const critical = d20 === 20 ? "hit" : d20 === 1 ? "miss" : null;
  const success =
    critical === "hit" ? true : critical === "miss" ? false : total >= dc;
  return { d20, modifier, total, dc, success, critical };
}

// Hit die by class, for HP.
const HIT_DIE: Record<string, Die> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
};

export function hitDie(className: string): Die {
  return HIT_DIE[className] ?? 8;
}

export function startingHp(className: string, con: number): number {
  return hitDie(className) + abilityModifier(con);
}

// Suggested starting kit per class.
export const STARTER_KITS: Record<
  string,
  { name: string; description: string; quantity?: number }[]
> = {
  Fighter: [
    { name: "Longsword", description: "1d8 slashing, versatile (1d10)" },
    { name: "Shield", description: "+2 AC when equipped" },
    { name: "Chain Mail", description: "AC 16" },
    { name: "Rations", description: "A day's trail food", quantity: 5 },
  ],
  Wizard: [
    { name: "Quarterstaff", description: "1d6 bludgeoning" },
    { name: "Spellbook", description: "Contains your prepared spells" },
    { name: "Component Pouch", description: "Material spell components" },
    { name: "Potion of Healing", description: "Restores 2d4+2 HP" },
  ],
  Rogue: [
    { name: "Shortsword", description: "1d6 piercing, finesse" },
    { name: "Shortbow", description: "1d6 piercing, ranged" },
    { name: "Thieves' Tools", description: "Proficiency to pick locks/traps" },
    { name: "Dagger", description: "1d4 piercing, finesse, thrown", quantity: 2 },
  ],
  Cleric: [
    { name: "Mace", description: "1d6 bludgeoning" },
    { name: "Holy Symbol", description: "Divine spellcasting focus" },
    { name: "Scale Mail", description: "AC 14 + Dex (max 2)" },
    { name: "Potion of Healing", description: "Restores 2d4+2 HP" },
  ],
};

export function starterKit(className: string) {
  return (
    STARTER_KITS[className] ?? [
      { name: "Simple Weapon", description: "A basic adventuring weapon" },
      { name: "Traveler's Pack", description: "Bedroll, rope, torches, rations" },
      { name: "Potion of Healing", description: "Restores 2d4+2 HP" },
    ]
  );
}

export function strictnessLabel(strictness: number): string {
  if (strictness >= 85) return "Iron Railroad";
  if (strictness >= 65) return "Guided Story";
  if (strictness >= 40) return "Balanced";
  if (strictness >= 15) return "Open Sandbox";
  return "Total Chaos";
}

export function strictnessGuidance(strictness: number): string {
  if (strictness >= 85)
    return "Adhere very strictly to the story premise and its intended plot beats. Gently but firmly steer players back to the main quest. Improvise only minor details.";
  if (strictness >= 65)
    return "Follow the story premise closely, but allow reasonable player-driven detours that eventually reconnect to the main plot.";
  if (strictness >= 40)
    return "Balance the story premise with player agency. Let the party meaningfully shape events while keeping the premise relevant.";
  if (strictness >= 15)
    return "Treat the premise as a loose starting point. Embrace player-driven improvisation and unexpected directions. Say yes often.";
  return "Anything goes. Escalate wildly and reward creativity. If the party wants to fly to the moon from a tiny village, find an absurd but entertaining way to make it happen.";
}
