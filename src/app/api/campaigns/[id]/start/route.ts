import { prisma } from "@/lib/db";
import { withPlayer, json, error } from "@/lib/api";
import { startCampaign } from "@/lib/engine";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return error("Campaign not found.", 404);
  if (campaign.createdById !== guard.player.id)
    return error("Only the campaign creator can begin the adventure.", 403);

  try {
    await startCampaign(id);
  } catch (e) {
    if (e instanceof Error && e.message === "NO_MEMBERS")
      return error("Add at least one agent before starting.");
    throw e;
  }
  return json({ ok: true });
}
