import type { ReactNode } from "react";

function safeHref(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value) ? value : "#";
}

function inlineContent(text: string): ReactNode[] {
  const pattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|_[^_]+_)/g;
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part, index) => {
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = safeHref(link[2]);
        return (
          <a
            key={index}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="text-brand font-bold underline underline-offset-4"
          >
            {link[1]}
          </a>
        );
      }
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("_") && part.endsWith("_"))
        return <em key={index}>{part.slice(1, -1)}</em>;
      return part;
    });
}

export function SimpleRichText({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let ordered = false;

  function flushList() {
    if (!listItems.length) return;
    const ListTag = ordered ? "ol" : "ul";
    blocks.push(
      <ListTag
        key={`list-${blocks.length}`}
        className={`space-y-2 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}
      >
        {listItems.map((item, index) => (
          <li key={index}>{inlineContent(item)}</li>
        ))}
      </ListTag>,
    );
    listItems = [];
  }

  lines.forEach((line) => {
    const numbered = line.match(/^\d+\.\s+(.+)/);
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (numbered || bullet) {
      const nextOrdered = Boolean(numbered);
      if (listItems.length && ordered !== nextOrdered) flushList();
      ordered = nextOrdered;
      listItems.push((numbered?.[1] ?? bullet?.[1] ?? "").trim());
      return;
    }
    flushList();
    if (!line.trim()) return;
    if (line.startsWith("## ")) {
      blocks.push(
        <h2
          key={blocks.length}
          className="font-heading mt-8 text-2xl font-semibold"
        >
          {inlineContent(line.slice(3))}
        </h2>,
      );
      return;
    }
    blocks.push(<p key={blocks.length}>{inlineContent(line)}</p>);
  });
  flushList();

  return <div className="space-y-6">{blocks}</div>;
}
