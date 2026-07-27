"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/clientApi";
import { Button, Field, inputClass, inputStyle } from "@/components/ui";

export function InviteForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill the code when arriving from a shared campaign invite link (/?code=...).
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("code");
    if (shared) setCode(shared);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{ campaignId: string | null }>("/api/auth/redeem", {
        code,
        handle,
      });
      router.push(res.campaignId ? `/play/${res.campaignId}` : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Invite code" hint="Try DRAGON or TAVERN if you were sent here to play.">
        <input
          className={inputClass}
          style={inputStyle}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ENTER-CODE"
          autoCapitalize="characters"
        />
      </Field>
      <Field label="Your handle" hint="How other players will see you at the table.">
        <input
          className={inputClass}
          style={inputStyle}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="e.g. mistwalker"
        />
      </Field>
      {error ? (
        <div className="text-sm" style={{ color: "var(--ember)" }}>
          {error}
        </div>
      ) : null}
      <Button type="submit" variant="gold" disabled={loading} className="w-full">
        {loading ? "Opening the gate…" : "Enter the tavern"}
      </Button>
    </form>
  );
}
