"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/clientApi";
import type { CampaignSummary, MeData, PublicAgent } from "@/lib/types";
import { AgentBuilder } from "@/components/AgentBuilder";
import { CampaignCreator } from "@/components/CampaignCreator";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { Badge, Button, Panel } from "@/components/ui";

function statusColor(status: string): string {
  if (status === "active") return "var(--emerald)";
  if (status === "ended") return "var(--muted)";
  return "var(--gold)";
}

function AgentCard({ agent }: { agent: PublicAgent }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: "var(--bg-soft)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display font-semibold">{agent.name}</span>
        <Badge color="var(--gold)">Lvl {agent.level}</Badge>
      </div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {agent.race} {agent.className} · HP {agent.hp}/{agent.maxHp} · AC {agent.ac}
      </div>
      <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--muted)" }}>
        {agent.persona}
      </p>
    </div>
  );
}

export function DashboardClient() {
  const [me, setMe] = useState<MeData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [meData, campData] = await Promise.all([
      apiGet<MeData>("/api/me"),
      apiGet<{ campaigns: CampaignSummary[] }>("/api/campaigns"),
    ]);
    setMe(meData);
    setCampaigns(campData.campaigns);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="p-10 text-center" style={{ color: "var(--muted)" }}>
        Loading your table…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="font-display text-3xl font-bold">Your table</h1>
      <p className="mt-1" style={{ color: "var(--muted)" }}>
        Forge adventurers, launch campaigns, and drop into any table to watch the agents
        play.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">
              Your adventurers{" "}
              <span style={{ color: "var(--muted)" }}>({me?.agents.length ?? 0})</span>
            </h2>
            <Button
              variant={showBuilder ? "ghost" : "primary"}
              onClick={() => setShowBuilder((v) => !v)}
            >
              {showBuilder ? "Close" : "+ New adventurer"}
            </Button>
          </div>

          {showBuilder ? (
            <Panel className="mb-4">
              <AgentBuilder
                onCreated={() => {
                  setShowBuilder(false);
                  refresh();
                }}
              />
            </Panel>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {me?.agents.length ? (
              me.agents.map((a) => <AgentCard key={a.id} agent={a} />)
            ) : (
              <Panel className="sm:col-span-2">
                <p style={{ color: "var(--muted)" }}>
                  No adventurers yet. Create your first hero to join a campaign.
                </p>
              </Panel>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">
              Campaigns{" "}
              <span style={{ color: "var(--muted)" }}>({campaigns.length})</span>
            </h2>
            <Button
              variant={showCreator ? "ghost" : "primary"}
              onClick={() => setShowCreator((v) => !v)}
            >
              {showCreator ? "Close" : "+ New campaign"}
            </Button>
          </div>

          {showCreator ? (
            <Panel className="mb-4">
              <CampaignCreator
                onCreated={() => {
                  setShowCreator(false);
                  refresh();
                }}
              />
            </Panel>
          ) : null}

          <div className="space-y-3">
            {campaigns.length ? (
              campaigns.map((c) => (
                <Panel key={c.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/play/${c.id}`}
                          className="font-display text-lg font-semibold hover:underline"
                        >
                          {c.name}
                        </Link>
                        <Badge color={statusColor(c.status)}>{c.status}</Badge>
                        {c.isOwner ? <Badge color="var(--arcane)">DM</Badge> : null}
                      </div>
                      <p
                        className="mt-1 line-clamp-2 text-sm"
                        style={{ color: "var(--muted)" }}
                      >
                        {c.storyPrompt}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.party.map((p) => (
                          <Badge key={p.name} color={p.mine ? "var(--gold)" : "var(--muted)"}>
                            {p.name} · L{p.level}
                          </Badge>
                        ))}
                        {c.party.length === 0 ? (
                          <span className="text-xs" style={{ color: "var(--muted)" }}>
                            No party yet
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                        by @{c.createdBy} · {c.turnCount} turns · {c.recapCount} milestones
                      </div>
                    </div>
                    <Link href={`/play/${c.id}`}>
                      <Button variant="gold">
                        {c.status === "active" ? "Watch" : "Open"}
                      </Button>
                    </Link>
                  </div>
                </Panel>
              ))
            ) : (
              <Panel>
                <p style={{ color: "var(--muted)" }}>
                  No campaigns yet. Create one and add your adventurers to begin.
                </p>
              </Panel>
            )}
          </div>
        </section>
      </div>

      <div className="mt-8">
        <ApiKeysPanel />
      </div>
    </div>
  );
}
