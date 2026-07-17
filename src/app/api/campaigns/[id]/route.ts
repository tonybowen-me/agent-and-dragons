import { withPlayer, json, error } from "@/lib/api";
import { loadCampaignView } from "@/lib/campaignView";

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
