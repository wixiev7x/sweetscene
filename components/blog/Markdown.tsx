import Link from "next/link";
import type { ReactNode } from "react";

/* Minimal, safe markdown: headings, paragraphs, lists, bold/italic,
 * links (internal or https), blockquotes. No raw HTML is ever emitted. */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) {
      const href = m[2];
      if (href.startsWith("/")) out.push(<Link key={k} href={href}>{m[1]}</Link>);
      else if (/^https:\/\//.test(href)) out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer">{m[1]}</a>);
      else out.push(m[1]);
    } else if (m[3]) out.push(<strong key={k}>{m[3]}</strong>);
    else if (m[4]) out.push(<em key={k}>{m[4]}</em>);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        const k = `b${i}`;
        if (t.startsWith("### ")) return <h3 key={k} id={slugify(t.slice(4))}>{inline(t.slice(4), k)}</h3>;
        if (t.startsWith("## ")) return <h2 key={k} id={slugify(t.slice(3))}>{inline(t.slice(3), k)}</h2>;
        if (t.startsWith("> ")) return <blockquote key={k}>{inline(t.replace(/^> ?/gm, ""), k)}</blockquote>;
        const lines = t.split("\n");
        if (lines.every((l) => /^[-*] /.test(l))) return <ul key={k}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${k}-${j}`)}</li>)}</ul>;
        if (lines.every((l) => /^\d+\. /.test(l))) return <ol key={k}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""), `${k}-${j}`)}</li>)}</ol>;
        return <p key={k}>{inline(t.replace(/\n/g, " "), k)}</p>;
      })}
    </>
  );
}
