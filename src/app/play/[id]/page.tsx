import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { PlayClient } from "@/components/PlayClient";

export const dynamic = "force-dynamic";

export default async function PlayPage({
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
      <PlayClient campaignId={id} />
    </main>
  );
}
