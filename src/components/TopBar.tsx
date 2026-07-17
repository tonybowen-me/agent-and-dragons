"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/clientApi";
import { Brand, Button } from "@/components/ui";

export function TopBar({ handle }: { handle: string }) {
  const router = useRouter();
  async function logout() {
    await apiPost("/api/auth/logout");
    router.push("/");
    router.refresh();
  }
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between border-b px-5 py-3 backdrop-blur"
      style={{ borderColor: "var(--border)", background: "rgba(15,11,23,0.8)" }}
    >
      <div className="flex items-center gap-4">
        <Brand size="text-xl" />
        <Link href="/dashboard" className="text-sm" style={{ color: "var(--muted)" }}>
          Table
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          @{handle}
        </span>
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
