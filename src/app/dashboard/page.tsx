import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  return (
    <main>
      <TopBar handle={player.handle} />
      <DashboardClient />
    </main>
  );
}
