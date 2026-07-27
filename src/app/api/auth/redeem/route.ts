import { z } from "zod";
import { redeemInvite, setSessionCookie } from "@/lib/auth";
import { error, json } from "@/lib/api";

const schema = z.object({
  code: z.string().min(1),
  handle: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid request.");

  const result = await redeemInvite(parsed.data.code, parsed.data.handle);
  if (!result.ok || !result.token || !result.player)
    return error(result.error ?? "Could not redeem invite.", 400);

  await setSessionCookie(result.token);
  return json({
    player: { id: result.player.id, handle: result.player.handle },
    campaignId: result.campaignId ?? null,
  });
}
