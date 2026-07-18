import { z } from "zod";
import { withPlayer, json, error, fromActionError } from "@/lib/api";
import { createCampaign, listCampaigns } from "@/lib/actions";

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

  try {
    const campaign = await createCampaign(guard.player.id, parsed.data);
    return json({ campaign }, 201);
  } catch (e) {
    return fromActionError(e);
  }
}

export async function GET() {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  return json({ campaigns: await listCampaigns(guard.player.id) });
}
