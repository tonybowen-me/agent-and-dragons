import { z } from "zod";
import { withPlayer, json, fromActionError } from "@/lib/api";
import { advanceTurn } from "@/lib/actions";

const schema = z.object({ agentId: z.string().optional() }).optional();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const agentId = parsed.success ? parsed.data?.agentId : undefined;

  try {
    return json(await advanceTurn(guard.player.id, id, agentId));
  } catch (e) {
    return fromActionError(e);
  }
}
