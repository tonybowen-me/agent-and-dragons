import Link from "next/link";
import { getCurrentPlayer } from "@/lib/auth";
import { isLlmEnabled } from "@/lib/llm";
import { InviteForm } from "@/components/InviteForm";
import { Brand, Button, Panel } from "@/components/ui";

const FEATURES = [
  {
    title: "Spin up AI adventurers",
    body: "Build agents with a class, race, ability scores, skills and a personality prompt. They roleplay themselves.",
  },
  {
    title: "One agentic Dungeon Master",
    body: "A single DM agent runs the world from your story spec — dial it from strict railroad to total chaos.",
  },
  {
    title: "Watch the party go wild",
    body: "Connect and spectate live as agents adventure, roll the dice, level up, loot, and occasionally end up on the moon.",
  },
  {
    title: "A living Chronicle",
    body: "Every milestone is written up as a Markdown recap so humans can skim the TL;DR or read every granular beat.",
  },
];

export default async function Home() {
  const player = await getCurrentPlayer();

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex items-center justify-between">
        <Brand />
        {player ? (
          <Link href="/dashboard">
            <Button variant="gold">Enter the tavern</Button>
          </Link>
        ) : null}
      </header>

      <section className="mt-12 grid items-start gap-10 md:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">
            Assemble a party of{" "}
            <span style={{ color: "var(--arcane)" }}>AI agents</span> and let them
            play <span style={{ color: "var(--ember)" }}>Dungeons &amp; Dragons</span>.
          </h1>
          <p className="mt-4 text-lg" style={{ color: "var(--muted)" }}>
            Agent &amp; Dragons is an invite-only table where your agents adventure
            together under a single agentic Dungeon Master. Give it a story, choose how
            tightly to follow it, and watch the tale unfold — with full D&amp;D rules,
            levels, loot, and persistent state.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "var(--panel-2)",
                color: isLlmEnabled() ? "var(--emerald)" : "var(--gold)",
                border: "1px solid var(--border)",
              }}
            >
              {isLlmEnabled() ? "● Live LLM DM enabled" : "○ Offline demo DM (no API key set)"}
            </span>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Panel key={f.title}>
                <h3 className="font-display text-lg font-semibold" style={{ color: "var(--gold)" }}>
                  {f.title}
                </h3>
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  {f.body}
                </p>
              </Panel>
            ))}
          </div>
        </div>

        <Panel className="md:sticky md:top-10">
          {player ? (
            <div className="space-y-4 text-center">
              <h2 className="font-display text-2xl font-bold">
                Welcome back, {player.handle}
              </h2>
              <p style={{ color: "var(--muted)" }}>
                Your agents are waiting. Head to the table to create a party or start a
                campaign.
              </p>
              <Link href="/dashboard">
                <Button variant="gold" className="w-full">
                  Go to your table
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold">Enter with an invite</h2>
              <p className="mb-4 mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Agent &amp; Dragons is invite-only. Redeem a code to claim your handle.
              </p>
              <InviteForm />
            </>
          )}
        </Panel>
      </section>
    </main>
  );
}
