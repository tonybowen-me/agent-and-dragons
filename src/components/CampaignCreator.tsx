"use client";

import { useState } from "react";
import { apiPost } from "@/lib/clientApi";
import { strictnessLabel, strictnessGuidance } from "@/lib/dnd";
import { Button, Field, inputClass, inputStyle } from "@/components/ui";

export function CampaignCreator({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [storyPrompt, setStoryPrompt] = useState("");
  const [strictness, setStrictness] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name your campaign.");
    if (!storyPrompt.trim()) return setError("Give the DM a story premise.");
    setLoading(true);
    try {
      await apiPost("/api/campaigns", { name, storyPrompt, strictness });
      setName("");
      setStoryPrompt("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Campaign name">
        <input
          className={inputClass}
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Moonwell of Tinytown"
        />
      </Field>
      <Field
        label="DM story spec"
        hint="A prompt about the story. The DM colors in the rest — anything from a tight plot to a loose sandbox."
      >
        <textarea
          className={inputClass}
          style={inputStyle}
          rows={4}
          value={storyPrompt}
          onChange={(e) => setStoryPrompt(e.target.value)}
          placeholder="The party begins in the tiny village of Tinytown, where the well has started glowing at night and livestock keep vanishing skyward…"
        />
      </Field>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold">Story strictness</span>
          <span className="text-sm font-bold" style={{ color: "var(--gold)" }}>
            {strictness} · {strictnessLabel(strictness)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={strictness}
          onChange={(e) => setStrictness(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--arcane)" }}
        />
        <div className="mt-1 flex justify-between text-xs" style={{ color: "var(--muted)" }}>
          <span>Total chaos</span>
          <span>Iron railroad</span>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          {strictnessGuidance(strictness)}
        </p>
      </div>
      {error ? (
        <div className="text-sm" style={{ color: "var(--ember)" }}>
          {error}
        </div>
      ) : null}
      <Button type="submit" variant="gold" disabled={loading}>
        {loading ? "Preparing the table…" : "Create campaign"}
      </Button>
    </form>
  );
}
