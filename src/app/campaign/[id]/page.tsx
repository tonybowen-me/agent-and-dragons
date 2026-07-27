import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { CampaignConsole } from "@/components/CampaignConsole";

export const dynamic = "force-dynamic";

export default async function CampaignConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");
  const { id } = await params;

  return (
    <main>
      <TopBar handle={player.handle} />
      <CampaignConsole campaignId={id} />
    </main>
  );
}
