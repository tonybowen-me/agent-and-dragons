"use client";

import { useState } from "react";
import {
  ABILITIES,
  abilityModifier,
  formatModifier,
  xpToNextLevel,
} from "@/lib/dnd";
import { Badge } from "@/components/ui";
import type { PartyAgent } from "@/lib/types";

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));
  const color = pct > 50 ? "var(--emerald)" : pct > 20 ? "var(--gold)" : "var(--ember)";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full"
      style={{ background: "var(--bg-soft)" }}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function AgentSheet({ agent }: { agent: PartyAgent }) {
  const [open, setOpen] = useState(false);
  const nextXp = xpToNextLevel(agent.xp);

  return (
    <div
      className="rounded-lg border p-3"
      style={{
        background: "var(--bg-soft)",
        borderColor: agent.mine ? "var(--gold)" : "var(--border)",
        opacity: agent.alive ? 1 : 0.55,
      }}
    >
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <div className="font-display font-semibold">
            {agent.name}{" "}
            {!agent.alive ? <span style={{ color: "var(--ember)" }}>(down)</span> : null}
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            L{agent.level} {agent.race} {agent.className} · @{agent.ownerHandle}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold">
            {agent.hp}/{agent.maxHp} HP
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            AC {agent.ac}
          </div>
        </div>
      </button>
      <div className="mt-2">
        <HpBar hp={agent.hp} maxHp={agent.maxHp} />
      </div>

      {agent.conditions.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.conditions.map((c) => (
            <Badge key={c} color="var(--ember)">
              {c}
            </Badge>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-3 text-xs">
          <div className="grid grid-cols-6 gap-1 text-center">
            {ABILITIES.map((a) => (
              <div key={a.key}>
                <div style={{ color: "var(--muted)" }}>{a.short}</div>
                <div className="font-semibold">{agent.abilities[a.key]}</div>
                <div style={{ color: "var(--gold)" }}>
                  {formatModifier(abilityModifier(agent.abilities[a.key]))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ color: "var(--muted)" }}>
            XP {agent.xp}
            {nextXp ? ` · ${nextXp.needed} to level ${agent.level + 1}` : " · max level"} ·{" "}
            {agent.gold} gp
          </div>

          {agent.skills.length ? (
            <div>
              <span style={{ color: "var(--muted)" }}>Skills: </span>
              {agent.skills.join(", ")}
            </div>
          ) : null}

          <div>
            <div className="mb-1 font-semibold" style={{ color: "var(--muted)" }}>
              Inventory
            </div>
            {agent.inventory.length ? (
              <ul className="space-y-0.5">
                {agent.inventory.map((i) => (
                  <li key={i.id}>
                    • {i.name}
                    {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                    {i.description ? (
                      <span style={{ color: "var(--muted)" }}> — {i.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <span style={{ color: "var(--muted)" }}>Empty</span>
            )}
          </div>

          <div style={{ color: "var(--muted)" }}>
            <span className="font-semibold">Persona:</span> {agent.persona}
          </div>
        </div>
      ) : null}
    </div>
  );
}
