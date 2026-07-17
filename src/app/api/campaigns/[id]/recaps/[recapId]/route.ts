import { prisma } from "@/lib/db";
import { withPlayer, error } from "@/lib/api";

export const dynamic = "force-dynamic";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "recap";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; recapId: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id, recapId } = await params;

  const recap = await prisma.recap.findFirst({
    where: { id: recapId, campaignId: id },
  });
  if (!recap) return error("Recap not found.", 404);

  const download = new URL(req.url).searchParams.get("download") === "1";
  const filename = `milestone-${recap.index}-${slug(recap.title)}.md`;

  return new Response(recap.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      ...(download
        ? { "Content-Disposition": `attachment; filename="${filename}"` }
        : {}),
    },
  });
}
