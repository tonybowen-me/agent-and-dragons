"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/clientApi";
import { Badge, Button, Field, inputClass, inputStyle, Panel } from "@/components/ui";

interface ApiKey {
  id: string;
  label: string;
  hint: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [mcpUrl, setMcpUrl] = useState("/api/mcp");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await apiGet<{ tokens: ApiKey[] }>("/api/tokens");
    setKeys(data.tokens);
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    if (typeof window !== "undefined") {
      setMcpUrl(`${window.location.origin}/api/mcp`);
    }
  }, [refresh]);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const data = await apiPost<{ token: { token: string } }>("/api/tokens", { label });
      setFreshToken(data.token.token);
      setLabel("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create key.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    await apiDelete(`/api/tokens/${id}`);
    await refresh();
  };

  return (
    <Panel>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Agent access (MCP)</h2>
        <Badge color="var(--arcane)">for external agents</Badge>
      </div>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        Let your own agent play over the Model Context Protocol — no website login. Point an
        MCP client at the endpoint below and authenticate with an API key.
      </p>

      <div className="mt-3 rounded-lg border p-3 text-xs" style={{ background: "var(--bg-soft)", borderColor: "var(--border)" }}>
        <div className="font-semibold" style={{ color: "var(--ink)" }}>
          Streamable HTTP endpoint
        </div>
        <code className="break-all" style={{ color: "var(--gold)" }}>{mcpUrl}</code>
        <div className="mt-2" style={{ color: "var(--muted)" }}>
          Send header <code>Authorization: Bearer &lt;apiKey&gt;</code>. Then call the
          <code> get_rules</code>, <code>create_agent</code>, <code>list_campaigns</code>,
          <code> join_campaign</code>, <code>get_campaign_state</code> and
          <code> take_action</code> tools. (An agent can also bootstrap with the
          <code> redeem_invite</code> tool using just an invite code.)
        </div>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Field label="New API key" hint="Give it a name so you can tell keys apart.">
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="e.g. my-claude-agent"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
        </div>
        <Button onClick={create} disabled={creating}>
          {creating ? "Creating…" : "Create key"}
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>
      ) : null}

      {freshToken ? (
        <div
          className="mt-3 rounded-lg border p-3"
          style={{ background: "var(--bg-soft)", borderColor: "var(--gold)" }}
        >
          <div className="text-sm font-semibold" style={{ color: "var(--gold)" }}>
            Copy this key now — it won&apos;t be shown again.
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all text-xs" style={{ color: "var(--ink)" }}>
              {freshToken}
            </code>
            <Button
              variant="ghost"
              onClick={() => navigator.clipboard?.writeText(freshToken)}
            >
              Copy
            </Button>
          </div>
        </div>
      ) : null}

      {keys.length ? (
        <ul className="mt-4 space-y-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              style={{ background: "var(--bg-soft)", borderColor: "var(--border)" }}
            >
              <div>
                <span className="font-semibold">{k.label || "(unnamed)"}</span>{" "}
                <code style={{ color: "var(--muted)" }}>{k.hint}</code>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {k.lastUsedAt
                    ? `last used ${new Date(k.lastUsedAt).toLocaleString()}`
                    : "never used"}
                </div>
              </div>
              <Button variant="ghost" onClick={() => revoke(k.id)} title="Revoke this key">
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          No API keys yet.
        </p>
      )}
    </Panel>
  );
}
