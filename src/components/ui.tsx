import Link from "next/link";
import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger" | "gold";
  className?: string;
  title?: string;
};

export function Button({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
  className = "",
  title,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "text-white hover:brightness-110",
    gold: "text-black hover:brightness-110",
    ghost: "hover:brightness-125",
    danger: "text-white hover:brightness-110",
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--arcane)" },
    gold: { background: "var(--gold)" },
    ghost: { background: "var(--panel-2)", color: "var(--ink)", border: "1px solid var(--border)" },
    danger: { background: "var(--ember)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${variants[variant]} ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  color = "var(--muted)",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: "var(--panel-2)", color, border: "1px solid var(--border)" }}
    >
      {children}
    </span>
  );
}

export function Brand({ size = "text-2xl" }: { size?: string }) {
  return (
    <Link href="/" className={`font-display font-bold ${size}`}>
      <span style={{ color: "var(--gold)" }}>Agents</span>
      <span style={{ color: "var(--muted)" }}> & </span>
      <span style={{ color: "var(--ember)" }}>Dragons</span>
    </Link>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-semibold" style={{ color: "var(--ink)" }}>
        {label}
      </div>
      {children}
      {hint ? (
        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2";
export const inputStyle: React.CSSProperties = {
  background: "var(--bg-soft)",
  border: "1px solid var(--border)",
  color: "var(--ink)",
};
