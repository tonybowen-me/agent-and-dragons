"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { Badge, Button } from "@/components/ui";
import type { RecapSummary } from "@/lib/types";

export function ChroniclePanel({
  campaignId,
  recaps,
}: {
  campaignId: string;
  recaps: RecapSummary[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function open(recap: RecapSummary) {
    setOpenId(recap.id);
    setLoading(true);
    setMarkdown("");
    const res = await fetch(`/api/campaigns/${campaignId}/recaps/${recap.id}`, {
      cache: "no-store",
    });
    setMarkdown(await res.text());
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Chronicle</h3>
        {recaps.length ? (
          <a
            href={`/api/campaigns/${campaignId}/chronicle?download=1`}
            className="text-xs font-semibold hover:underline"
            style={{ color: "var(--gold)" }}
          >
            ⬇ Full .md
          </a>
        ) : null}
      </div>
      <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>
        Human recaps written at each milestone. Skim the headline or read the full beat.
      </p>

      {recaps.length ? (
        <ol className="space-y-2">
          {[...recaps].reverse().map((r) => (
            <li
              key={r.id}
              className="rounded-lg border p-2"
              style={{ background: "var(--bg-soft)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  #{r.index} {r.title}
                </span>
                <Badge>turn {r.turnAt}</Badge>
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                {r.headline}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => open(r)}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "var(--arcane)" }}
                >
                  Read
                </button>
                <a
                  href={`/api/campaigns/${campaignId}/recaps/${r.id}?download=1`}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "var(--gold)" }}
                >
                  ⬇ .md
                </a>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          No milestones recorded yet. Recaps appear as the story hits milestones.
        </p>
      )}

      {openId ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border p-5"
            style={{ background: "var(--panel)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Milestone recap</h3>
              <Button variant="ghost" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </div>
            {loading ? (
              <p style={{ color: "var(--muted)" }}>Loading…</p>
            ) : (
              <Markdown source={markdown} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
