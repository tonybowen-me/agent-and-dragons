import { z } from "zod";
import { withPlayer, json, error, fromActionError } from "@/lib/api";
import { loadCampaignView } from "@/lib/campaignView";
import { updateCampaign } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const view = await loadCampaignView(id, guard.player.id);
  if (!view) return error("Campaign not found.", 404);
  return json(view);
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  storyPrompt: z.string().min(1).max(4000).optional(),
  strictness: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return error("Invalid campaign details.");

  try {
    const campaign = await updateCampaign(guard.player.id, id, parsed.data);
    return json({ campaign });
  } catch (e) {
    return fromActionError(e);
  }
}
