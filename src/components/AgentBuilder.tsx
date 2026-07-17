"use client";

import { useState } from "react";
import { apiPost } from "@/lib/clientApi";
import {
  ABILITIES,
  CLASSES,
  RACES,
  SKILLS,
  abilityModifier,
  formatModifier,
  type AbilityKey,
} from "@/lib/dnd";
import { Button, Field, inputClass, inputStyle } from "@/components/ui";

type Abilities = Record<AbilityKey, number>;
const DEFAULT_ABILITIES: Abilities = {
  str: 15,
  dex: 14,
  con: 13,
  intel: 12,
  wis: 10,
  cha: 8,
};

function roll4d6DropLowest(): number {
  const rolls = [0, 0, 0, 0].map(() => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  return rolls[1] + rolls[2] + rolls[3];
}

export function AgentBuilder({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [race, setRace] = useState(RACES[0]);
  const [className, setClassName] = useState(CLASSES[0]);
  const [persona, setPersona] = useState("");
  const [backstory, setBackstory] = useState("");
  const [abilities, setAbilities] = useState<Abilities>(DEFAULT_ABILITIES);
  const [skills, setSkills] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function rollAll() {
    setAbilities({
      str: roll4d6DropLowest(),
      dex: roll4d6DropLowest(),
      con: roll4d6DropLowest(),
      intel: roll4d6DropLowest(),
      wis: roll4d6DropLowest(),
      cha: roll4d6DropLowest(),
    });
  }

  function toggleSkill(skill: string) {
    setSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : prev.length >= 4
          ? prev
          : [...prev, skill],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give your adventurer a name.");
    if (!persona.trim()) return setError("Describe your adventurer's personality.");
    setLoading(true);
    try {
      await apiPost("/api/agents", {
        name,
        race,
        className,
        persona,
        backstory,
        abilities,
        skills,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create agent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={inputClass}
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Thornwick the Bold"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Race">
            <select
              className={inputClass}
              style={inputStyle}
              value={race}
              onChange={(e) => setRace(e.target.value)}
            >
              {RACES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select
              className={inputClass}
              style={inputStyle}
              value={className}
              onChange={(e) => setClassName(e.target.value)}
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <Field
        label="Personality prompt"
        hint="This drives how the AI roleplays your agent at the table."
      >
        <textarea
          className={inputClass}
          style={inputStyle}
          rows={3}
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="A reckless, honor-bound knight who charges first and asks questions never. Speaks in grand declarations."
        />
      </Field>

      <Field label="Backstory (optional)">
        <textarea
          className={inputClass}
          style={inputStyle}
          rows={2}
          value={backstory}
          onChange={(e) => setBackstory(e.target.value)}
          placeholder="Exiled from the northern holds after a duel gone wrong…"
        />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Ability scores</div>
          <Button variant="ghost" onClick={rollAll} type="button">
            🎲 Roll 4d6 drop lowest
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <div key={a.key} className="text-center">
              <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                {a.short}
              </div>
              <input
                type="number"
                min={3}
                max={20}
                className={`${inputClass} text-center`}
                style={inputStyle}
                value={abilities[a.key]}
                onChange={(e) =>
                  setAbilities((prev) => ({
                    ...prev,
                    [a.key]: Math.max(3, Math.min(20, Number(e.target.value) || 10)),
                  }))
                }
              />
              <div className="mt-1 text-xs" style={{ color: "var(--gold)" }}>
                {formatModifier(abilityModifier(abilities[a.key]))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold">
          Skill proficiencies{" "}
          <span style={{ color: "var(--muted)" }}>({skills.length}/4)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SKILLS).map((skill) => {
            const active = skills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className="rounded-full px-3 py-1 text-xs font-semibold transition"
                style={{
                  background: active ? "var(--arcane)" : "var(--panel-2)",
                  color: active ? "white" : "var(--muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="text-sm" style={{ color: "var(--ember)" }}>
          {error}
        </div>
      ) : null}
      <Button type="submit" variant="gold" disabled={loading}>
        {loading ? "Forging…" : "Create adventurer"}
      </Button>
    </form>
  );
}
