import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { withPlayer, json, error } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1).max(80),
  storyPrompt: z.string().min(1).max(4000),
  strictness: z.number().int().min(0).max(100).optional().default(50),
});

export async function POST(req: Request) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid campaign details.");

  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name.trim(),
      storyPrompt: parsed.data.storyPrompt.trim(),
      strictness: parsed.data.strictness,
      shareToken: randomBytes(9).toString("hex"),
      createdById: guard.player.id,
    },
  });

  return json({ campaign }, 201);
}

export async function GET() {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { handle: true } },
      memberships: {
        include: { agent: { select: { name: true, className: true, level: true, playerId: true } } },
      },
      _count: { select: { messages: true, recaps: true } },
    },
  });

  return json({
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      storyPrompt: c.storyPrompt,
      strictness: c.strictness,
      status: c.status,
      turnCount: c.turnCount,
      createdBy: c.createdBy.handle,
      isOwner: c.createdById === guard.player.id,
      party: c.memberships.map((m) => ({
        name: m.agent.name,
        className: m.agent.className,
        level: m.agent.level,
        mine: m.agent.playerId === guard.player.id,
      })),
      messageCount: c._count.messages,
      recapCount: c._count.recaps,
    })),
  });
}
