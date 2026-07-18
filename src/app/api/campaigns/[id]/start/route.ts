import { withPlayer, json, fromActionError } from "@/lib/api";
import { startCampaignAsPlayer } from "@/lib/actions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  try {
    return json(await startCampaignAsPlayer(guard.player.id, id));
  } catch (e) {
    return fromActionError(e);
  }
}
