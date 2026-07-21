import { prisma } from "@/lib/db";
import { withPlayer, error } from "@/lib/api";
import { strictnessLabel } from "@/lib/dnd";

export const dynamic = "force-dynamic";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "campaign";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await withPlayer();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { recaps: { orderBy: { index: "asc" } } },
  });
  if (!campaign) return error("Campaign not found.", 404);

  const header = [
    `# ${campaign.name} — The Chronicle`,
    "",
    `> ${campaign.storyPrompt}`,
    "",
    `- **Story strictness:** ${campaign.strictness}/100 (${strictnessLabel(campaign.strictness)})`,
    `- **Turns played:** ${campaign.turnCount}`,
    `- **Milestones:** ${campaign.recaps.length}`,
    "",
    "## High-level timeline",
    ...(campaign.recaps.length
      ? campaign.recaps.map(
          (r) => `${r.index}. **${r.title}** (turn ${r.turnAt}) — ${r.headline}`,
        )
      : ["_No milestones recorded yet._"]),
    "",
    "---",
    "",
  ].join("\n");

  const body = campaign.recaps
    .map((r) => r.markdown)
    .join("\n\n---\n\n");

  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(header + body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="${slug(campaign.name)}-chronicle.md"`,
          }
        : {}),
    },
  });
}
