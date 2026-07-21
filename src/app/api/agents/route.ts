import { z } from "zod";
import { withPlayer, json, error, fromActionError } from "@/lib/api";
import { createAgent, listAgents } from "@/lib/actions";

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

export async function POST(req: Request) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid character details.");

  try {
    const agent = await createAgent(guard.player.id, parsed.data);
    return json({ agent }, 201);
  } catch (e) {
    return fromActionError(e);
  }
}

export async function GET() {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  return json({ agents: await listAgents(guard.player.id) });
}

export const dynamic = "force-dynamic";
