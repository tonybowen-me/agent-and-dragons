"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiPatch } from "@/lib/clientApi";
import type { CampaignInvite, CampaignViewData } from "@/lib/types";
import { strictnessLabel } from "@/lib/dnd";
import { ChroniclePanel } from "@/components/ChroniclePanel";
import { Badge, Button, Field, Panel, inputClass, inputStyle } from "@/components/ui";

export function CampaignConsole({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<CampaignViewData | null>(null);
  const [invites, setInvites] = useState<CampaignInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notOwner, setNotOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  // DM spec form
  const [name, setName] = useState("");
  const [storyPrompt, setStoryPrompt] = useState("");
  const [strictness, setStrictness] = useState(50);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Invite form
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    const res = await apiGet<{ invites: CampaignInvite[] }>(
      `/api/campaigns/${campaignId}/invites`,
    );
    setInvites(res.invites);
  }, [campaignId]);

  const load = useCallback(async () => {
    try {
      const view = await apiGet<CampaignViewData>(`/api/campaigns/${campaignId}`);
      setData(view);
      setName(view.campaign.name);
      setStoryPrompt(view.campaign.storyPrompt);
      setStrictness(view.campaign.strictness);
      if (!view.viewer.isOwner) {
        setNotOwner(true);
        return;
      }
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load campaign.");
    }
  }, [campaignId, loadInvites]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSpec = async () => {
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      await apiPatch(`/api/campaigns/${campaignId}`, {
        name: name.trim(),
        storyPrompt: storyPrompt.trim(),
        strictness,
      });
      setSavedMsg("Saved.");
      await load();
      setTimeout(() => setSavedMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/campaigns/${campaignId}/invites`, {
        label: inviteLabel.trim() || undefined,
        maxUses: Number.isFinite(inviteMaxUses) ? inviteMaxUses : 0,
      });
      setInviteLabel("");
      setInviteMaxUses(0);
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invite.");
    } finally {
      setBusy(false);
    }
  };

  const toggleInvite = async (invite: CampaignInvite) => {
    setBusy(true);
    setError(null);
    try {
      await apiPatch(`/api/campaigns/${campaignId}/invites/${invite.id}`, {
        active: !invite.active,
      });
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update invite.");
    } finally {
      setBusy(false);
    }
  };

  const startCampaign = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/campaigns/${campaignId}/start`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  };

  const inviteLink = (code: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/?code=${encodeURIComponent(code)}`
      : `/?code=${encodeURIComponent(code)}`;

  const copy = (text: string, code: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  if (notOwner) {
    return (
      <div className="mx-auto max-w-3xl p-10 text-center">
        <p style={{ color: "var(--muted)" }}>
          Only the DM (campaign creator) can open this console.
        </p>
        <Link href={`/play/${campaignId}`} className="mt-4 inline-block underline">
          Go to the play view
        </Link>
      </div>
    );
  }

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
        Opening the DM console…
      </div>
    );
  }

  const { campaign, party } = data;
  const isLobby = campaign.status === "lobby";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{campaign.name}</h1>
            <Badge color={campaign.status === "active" ? "var(--emerald)" : "var(--gold)"}>
              {campaign.status}
            </Badge>
            <Badge color="var(--arcane)">DM console</Badge>
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            {campaign.turnCount} turns · {campaign.milestoneCount} milestones · by @
            {campaign.createdBy}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/play/${campaignId}`}>
            <Button variant="gold">{campaign.status === "active" ? "Watch live" : "Open play view"}</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">Table</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <p className="mb-3 text-sm" style={{ color: "var(--ember)" }}>
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* DM spec */}
        <Panel>
          <h2 className="font-display text-lg font-bold">DM story spec</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            The prompt the agentic DM colors in, and how tightly it follows the plot.
          </p>
          <div className="mt-3 space-y-3">
            <Field label="Campaign name">
              <input
                className={inputClass}
                style={inputStyle}
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Story prompt" hint="What the story is about — the DM improvises the rest.">
              <textarea
                className={inputClass}
                style={{ ...inputStyle, minHeight: 120 }}
                value={storyPrompt}
                maxLength={4000}
                onChange={(e) => setStoryPrompt(e.target.value)}
              />
            </Field>
            <Field label={`Strictness — ${strictnessLabel(strictness)} (${strictness})`}>
              <input
                type="range"
                min={0}
                max={100}
                value={strictness}
                onChange={(e) => setStrictness(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: "var(--arcane)" }}
              />
              <div className="flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                <span>Total chaos</span>
                <span>Iron railroad</span>
              </div>
            </Field>
            <div className="flex items-center gap-2">
              <Button variant="primary" disabled={busy} onClick={saveSpec}>
                Save spec
              </Button>
              {savedMsg ? (
                <span className="text-xs" style={{ color: "var(--emerald)" }}>
                  {savedMsg}
                </span>
              ) : null}
            </div>
          </div>
        </Panel>

        {/* Invites */}
        <Panel>
          <h2 className="font-display text-lg font-bold">Invite codes</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Share a code (or link) — redeeming it drops the player into this campaign.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[140px]">
              <Field label="Label (optional)">
                <input
                  className={inputClass}
                  style={inputStyle}
                  value={inviteLabel}
                  maxLength={60}
                  placeholder={campaign.name}
                  onChange={(e) => setInviteLabel(e.target.value)}
                />
              </Field>
            </div>
            <div className="w-28">
              <Field label="Max uses" hint="0 = unlimited">
                <input
                  type="number"
                  min={0}
                  max={1000}
                  className={inputClass}
                  style={inputStyle}
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                />
              </Field>
            </div>
            <Button variant="gold" disabled={busy} onClick={createInvite}>
              + Generate
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {invites.length ? (
              invites.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-lg border p-3"
                  style={{ background: "var(--bg-soft)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm" style={{ color: "var(--gold)" }}>
                        {inv.code}
                      </code>
                      <Badge color={inv.active ? "var(--emerald)" : "var(--ember)"}>
                        {inv.active ? "active" : "revoked"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={() => copy(inv.code, `code-${inv.id}`)}>
                        {copiedCode === `code-${inv.id}` ? "Copied!" : "Copy code"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => copy(inviteLink(inv.code), `link-${inv.id}`)}
                      >
                        {copiedCode === `link-${inv.id}` ? "Copied!" : "Copy link"}
                      </Button>
                      <Button
                        variant={inv.active ? "danger" : "primary"}
                        disabled={busy}
                        onClick={() => toggleInvite(inv)}
                      >
                        {inv.active ? "Revoke" : "Reactivate"}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    {inv.label ? `${inv.label} · ` : ""}
                    {inv.uses} used
                    {inv.maxUses > 0 ? ` / ${inv.maxUses} max` : " · unlimited"}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                No invite codes yet. Generate one to let players join this campaign.
              </p>
            )}
          </div>
        </Panel>

        {/* Party */}
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              Party <span style={{ color: "var(--muted)" }}>({party.length})</span>
            </h2>
            {isLobby ? (
              <Button variant="gold" disabled={busy || party.length === 0} onClick={startCampaign}>
                {busy ? "Summoning…" : "Begin adventure"}
              </Button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {party.length ? (
              party.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border p-2"
                  style={{ background: "var(--bg-soft)", borderColor: "var(--border)" }}
                >
                  <div>
                    <span className="font-display font-semibold">{a.name}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
                      {a.race} {a.className} · L{a.level} · @{a.ownerHandle}
                    </span>
                  </div>
                  <Badge color={a.alive ? "var(--emerald)" : "var(--ember)"}>
                    HP {a.hp}/{a.maxHp}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                No adventurers have joined yet. Share an invite code above.
              </p>
            )}
          </div>
          {isLobby && party.length === 0 ? (
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Add at least one adventurer before beginning.
            </p>
          ) : null}
        </Panel>

        {/* Chronicle */}
        <Panel>
          <ChroniclePanel campaignId={campaignId} recaps={data.recaps} />
        </Panel>
      </div>
    </div>
  );
}
