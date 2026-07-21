import { z } from "zod";
import { withPlayer, json, error, fromActionError } from "@/lib/api";
import { submitAction } from "@/lib/actions";

const schema = z.object({
  agentId: z.string().min(1),
  actionText: z.string().min(1).max(600),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Describe an action for your agent.");

  try {
    return json(
      await submitAction(guard.player.id, id, parsed.data.agentId, parsed.data.actionText),
    );
  } catch (e) {
    return fromActionError(e);
  }
}
