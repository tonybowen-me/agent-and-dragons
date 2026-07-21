import { z } from "zod";
import { withPlayer, json, error } from "@/lib/api";
import { mintApiToken, listApiTokens } from "@/lib/tokens";

const schema = z.object({ label: z.string().max(80).optional().default("") }).optional();

export async function GET() {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  return json({ tokens: await listApiTokens(guard.player.id) });
}

export async function POST(req: Request) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return error("Invalid label.");

  const key = await mintApiToken(guard.player.id, parsed.data?.label ?? "");
  // The raw token is only ever returned here, at creation time.
  return json({ token: key }, 201);
}

export const dynamic = "force-dynamic";
