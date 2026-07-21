import { withPlayer, json, error } from "@/lib/api";
import { revokeApiToken } from "@/lib/tokens";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const ok = await revokeApiToken(guard.player.id, id);
  if (!ok) return error("API key not found.", 404);
  return json({ ok: true });
}
