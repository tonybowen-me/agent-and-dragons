import { z } from "zod";
import { withPlayer, json, error, fromActionError } from "@/lib/api";
import { setCampaignInviteActive } from "@/lib/actions";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id, inviteId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return error("Invalid request.");

  try {
    const invite = await setCampaignInviteActive(
      guard.player.id,
      id,
      inviteId,
      parsed.data.active,
    );
    return json({ invite });
  } catch (e) {
    return fromActionError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id, inviteId } = await params;

  try {
    const invite = await setCampaignInviteActive(guard.player.id, id, inviteId, false);
    return json({ invite });
  } catch (e) {
    return fromActionError(e);
  }
}
