import { z } from "zod";
import { withPlayer, json, error, fromActionError } from "@/lib/api";
import { createCampaignInvite, listCampaignInvites } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  try {
    return json({ invites: await listCampaignInvites(guard.player.id, id) });
  } catch (e) {
    return fromActionError(e);
  }
}

const createSchema = z.object({
  label: z.string().max(60).optional(),
  maxUses: z.number().int().min(0).max(1000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) return error("Invalid invite details.");

  try {
    const invite = await createCampaignInvite(guard.player.id, id, parsed.data);
    return json({ invite }, 201);
  } catch (e) {
    return fromActionError(e);
  }
}
