"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/clientApi";
import type { CampaignMessage, CampaignViewData } from "@/lib/types";
import { AgentSheet } from "@/components/AgentSheet";
import { ChroniclePanel } from "@/components/ChroniclePanel";
import { Badge, Button, Panel, inputClass, inputStyle } from "@/components/ui";

const POLL_MS = 4000;

function MessageRow({ msg }: { msg: CampaignMessage }) {
  if (msg.type === "dm") {
    return (
      <div
        className="rounded-lg border-l-4 p-3"
        style={{ borderColor: "var(--arcane)", background: "var(--panel-2)" }}
      >
        <div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--arcane)" }}>
          Dungeon Master
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
      </div>
    );
  }
  if (msg.type === "player_action" || msg.type === "agent") {
    return (
      <div className="rounded-lg p-3" style={{ background: "var(--bg-soft)" }}>
        <div className="mb-0.5 flex items-center gap-2 text-xs">
          <span className="font-bold" style={{ color: "var(--gold)" }}>
            {msg.author}
          </span>
          <Badge>{msg.type === "agent" ? "auto" : "player"}</Badge>
        </div>
        <div className="whitespace-pre-wrap text-sm italic">{msg.content}</div>
      </div>
    );
  }
  if (msg.type === "roll") {
    const roll = msg.roll;
    const color = roll
      ? roll.critical === "hit"
        ? "var(--emerald)"
        : roll.critical === "miss"
          ? "var(--ember)"
          : roll.success
            ? "var(--emerald)"
            : "var(--ember)"
      : "var(--muted)";
    return (
      <div className="flex items-center gap-2 px-2 text-xs" style={{ color }}>
        <span>🎲</span>
        <span className="font-mono">{msg.content}</span>
      </div>
    );
  }
  // system / rules / chronicle
  return (
    <div className="px-2 text-xs" style={{ color: "var(--muted)" }}>
      {msg.content}
    </div>
  );
}

export function PlayClient({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<CampaignViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionText, setActionText] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [autoRun, setAutoRun] = useState(false);
  const [copied, setCopied] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const autoRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const view = await apiGet<CampaignViewData>(`/api/campaigns/${campaignId}`);
      setData(view);
      setSelectedAgentId((prev) => {
        const mine = view.party.filter((p) => p.mine);
        if (prev && mine.some((m) => m.id === prev)) return prev;
        return mine[0]?.id ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load campaign.");
    }
  }, [campaignId]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!busyRef.current) load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.messages.length]);

  const setBusyState = (v: boolean) => {
    busyRef.current = v;
    setBusy(v);
  };

  const start = async () => {
    setBusyState(true);
    setError(null);
    try {
      await apiPost(`/api/campaigns/${campaignId}/start`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusyState(false);
    }
  };

  const join = async (agentId: string) => {
    setBusyState(true);
    try {
      await apiPost(`/api/campaigns/${campaignId}/join`, { agentId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusyState(false);
    }
  };

  const submitAction = async () => {
    if (!selectedAgentId || !actionText.trim()) return;
    setBusyState(true);
    setError(null);
    try {
      await apiPost(`/api/campaigns/${campaignId}/action`, {
        agentId: selectedAgentId,
        actionText: actionText.trim(),
      });
      setActionText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyState(false);
    }
  };

  const advance = useCallback(async () => {
    setBusyState(true);
    setError(null);
    try {
      await apiPost(`/api/campaigns/${campaignId}/advance`, {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not advance.");
      autoRef.current = false;
      setAutoRun(false);
    } finally {
      setBusyState(false);
    }
  }, [campaignId, load]);

  // Auto-run loop: keep taking autonomous turns while enabled.
  useEffect(() => {
    autoRef.current = autoRun;
    if (!autoRun) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !autoRef.current) return;
      if (!busyRef.current) await advance();
      if (!cancelled && autoRef.current) setTimeout(tick, 1200);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [autoRun, advance]);

  const copyShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (error && !data) {
    return (
      <div className="mx-auto max-w-3xl p-10 text-center">
        <p style={{ color: "var(--ember)" }}>{error}</p>
        <Link href="/dashboard" className="mt-4 inline-block underline">
          Back to your table
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-10 text-center" style={{ color: "var(--muted)" }}>
        Entering the table…
      </div>
    );
  }

  const { campaign, viewer, party, messages, recaps } = data;
  const myMembers = party.filter((p) => p.mine);
  const canDrive = viewer.role !== "spectator";
  const isLobby = campaign.status === "lobby";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{campaign.name}</h1>
            <Badge color={campaign.status === "active" ? "var(--emerald)" : "var(--gold)"}>
              {campaign.status}
            </Badge>
            {viewer.role === "spectator" ? <Badge color="var(--arcane)">spectating</Badge> : null}
            {viewer.isOwner ? <Badge color="var(--arcane)">DM</Badge> : null}
          </div>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
            {campaign.storyPrompt}
          </p>
          <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Strictness {campaign.strictness} · {campaign.strictnessLabel} · {campaign.turnCount}{" "}
            turns · by @{campaign.createdBy}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={copyShare}>
            {copied ? "Link copied!" : "Copy share link"}
          </Button>
          {viewer.isOwner ? (
            <Link href={`/campaign/${campaignId}`}>
              <Button variant="ghost">DM console</Button>
            </Link>
          ) : null}
          <Link href="/dashboard">
            <Button variant="ghost">Table</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Main column: adventure log + controls */}
        <div className="space-y-4">
          <Panel className="flex flex-col" >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Adventure log</h2>
              {busy ? (
                <span className="text-xs" style={{ color: "var(--arcane)" }}>
                  ✦ The DM is weaving the tale…
                </span>
              ) : null}
            </div>
            <div
              ref={logRef}
              className="flex flex-col gap-2 overflow-y-auto pr-1"
              style={{ height: "56vh" }}
            >
              {messages.length ? (
                messages.map((m) => <MessageRow key={m.id} msg={m} />)
              ) : (
                <p style={{ color: "var(--muted)" }}>
                  {isLobby
                    ? "The adventure hasn't started. Gather a party and begin."
                    : "No events yet."}
                </p>
              )}
            </div>
          </Panel>

          {/* Controls */}
          {isLobby ? (
            <Panel>
              <h3 className="font-display text-lg font-bold">Lobby</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Add your adventurers to the party. When ready, the DM begins the story.
              </p>
              {viewer.availableAgents.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {viewer.availableAgents.map((a) => (
                    <Button
                      key={a.id}
                      variant="ghost"
                      disabled={busy}
                      onClick={() => join(a.id)}
                    >
                      + {a.name} (L{a.level} {a.className})
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                  {myMembers.length ? (
                    "All your adventurers are in the party."
                  ) : (
                    <>
                      You have no free adventurers yet.{" "}
                      <Link href="/dashboard" className="underline">
                        Build one on your table
                      </Link>{" "}
                      to join.
                    </>
                  )}
                </p>
              )}
              {viewer.isOwner ? (
                <div className="mt-4">
                  <Button
                    variant="gold"
                    disabled={busy || party.length === 0}
                    onClick={start}
                  >
                    {busy ? "Summoning the DM…" : "Begin the adventure"}
                  </Button>
                  {party.length === 0 ? (
                    <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
                      Add at least one adventurer first.
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
                  Waiting for @{campaign.createdBy} (the DM) to begin.
                </p>
              )}
            </Panel>
          ) : canDrive ? (
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold">Your move</h3>
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={(e) => setAutoRun(e.target.checked)}
                    style={{ accentColor: "var(--arcane)" }}
                  />
                  Auto-run agents
                </label>
              </div>

              {myMembers.length ? (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <select
                      className={`${inputClass} max-w-[40%]`}
                      style={inputStyle}
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                    >
                      {myMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={actionText}
                      onChange={(e) => setActionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitAction();
                      }}
                      placeholder="I do whatever I want… e.g. 'I try to bribe the goblin king with cheese.'"
                    />
                    <Button variant="gold" disabled={busy || !actionText.trim()} onClick={submitAction}>
                      Act
                    </Button>
                  </div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Free-form — describe anything. The DM decides if a d20 check is needed.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  You have no agent in this party. Add one from the lobby or just watch.
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <Button variant="primary" disabled={busy} onClick={advance}>
                  ▶ Let an agent act
                </Button>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  Advance the story with the next agent&apos;s autonomous turn.
                </span>
              </div>
              {error ? (
                <p className="mt-2 text-xs" style={{ color: "var(--ember)" }}>
                  {error}
                </p>
              ) : null}
            </Panel>
          ) : (
            <Panel>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                You&apos;re spectating. Add one of your own agents from your table to join a
                future campaign, or just enjoy the show — it refreshes live.
              </p>
            </Panel>
          )}
        </div>

        {/* Side column: party + chronicle */}
        <div className="space-y-4">
          <Panel>
            <h3 className="mb-2 font-display text-lg font-bold">
              Party <span style={{ color: "var(--muted)" }}>({party.length})</span>
            </h3>
            <div className="space-y-2">
              {party.length ? (
                party.map((a) => <AgentSheet key={a.id} agent={a} />)
              ) : (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  No adventurers yet.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <ChroniclePanel campaignId={campaignId} recaps={recaps} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
