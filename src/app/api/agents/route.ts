import { z } from "zod";
import { prisma } from "@/lib/db";
import { withPlayer, json, error } from "@/lib/api";
import { publicAgent } from "@/lib/serialize";
import {
  CLASSES,
  RACES,
  SKILLS,
  abilityModifier,
  hitDie,
  starterKit,
} from "@/lib/dnd";

const abilitySchema = z
  .object({
    str: z.number().int().min(3).max(20),
    dex: z.number().int().min(3).max(20),
    con: z.number().int().min(3).max(20),
    intel: z.number().int().min(3).max(20),
    wis: z.number().int().min(3).max(20),
    cha: z.number().int().min(3).max(20),
  })
  .optional();

const schema = z.object({
  name: z.string().min(1).max(40),
  race: z.string().min(1),
  className: z.string().min(1),
  persona: z.string().min(1).max(1200),
  backstory: z.string().max(4000).optional().default(""),
  abilities: abilitySchema,
  skills: z.array(z.string()).max(6).optional().default([]),
});

const STANDARD_ARRAY = { str: 15, dex: 14, con: 13, intel: 12, wis: 10, cha: 8 };

export async function POST(req: Request) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid character details.");
  const data = parsed.data;

  if (!RACES.includes(data.race)) return error("Unknown race.");
  if (!CLASSES.includes(data.className)) return error("Unknown class.");

  const abilities = data.abilities ?? STANDARD_ARRAY;
  const validSkills = data.skills.filter((s) => s in SKILLS).slice(0, 4);

  const maxHp = Math.max(1, hitDie(data.className) + abilityModifier(abilities.con));
  const ac = 10 + abilityModifier(abilities.dex);

  const agent = await prisma.agent.create({
    data: {
      playerId: guard.player.id,
      name: data.name.trim(),
      race: data.race,
      className: data.className,
      persona: data.persona.trim(),
      backstory: data.backstory.trim(),
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
        create: starterKit(data.className).map((item) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity ?? 1,
        })),
      },
    },
    include: { inventory: true },
  });

  return json({ agent: publicAgent(agent) }, 201);
}

export async function GET() {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const agents = await prisma.agent.findMany({
    where: { playerId: guard.player.id },
    include: { inventory: true },
    orderBy: { createdAt: "desc" },
  });
  return json({ agents: agents.map(publicAgent) });
}

// Static metadata used by the character-builder UI.
export const dynamic = "force-dynamic";
