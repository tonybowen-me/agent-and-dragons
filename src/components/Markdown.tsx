import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  // Handle **bold** and *italic*.
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[2]) nodes.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3]) nodes.push(<em key={key++}>{match[3]}</em>);
    else if (match[4])
      nodes.push(
        <code key={key++} style={{ color: "var(--emerald)" }}>
          {match[4]}
        </code>,
      );
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length) {
      const items = [...list];
      blocks.push(
        <ul key={key++}>
          {items.map((li, i) => (
            <li key={i}>{renderInline(li)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    if (line.startsWith("### ")) blocks.push(<h3 key={key++}>{renderInline(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={key++}>{renderInline(line.slice(3))}</h2>);
    else if (line.startsWith("# ")) blocks.push(<h1 key={key++}>{renderInline(line.slice(2))}</h1>);
    else if (line.startsWith("> "))
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-2 pl-3 italic"
          style={{ borderColor: "var(--gold)", color: "var(--muted)" }}
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
    else if (/^---+$/.test(line))
      blocks.push(<hr key={key++} style={{ borderColor: "var(--border)" }} />);
    else blocks.push(<p key={key++}>{renderInline(line)}</p>);
  }
  flushList();

  return <div className="markdown text-sm leading-relaxed">{blocks}</div>;
}
