import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/* Blog posts live in content/blog/<slug>.md with a small front-matter
 * header. Markdown subset rendered by lib/blog-render (no raw HTML). */

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  date: string;
  readMinutes: number;
};
export type Post = PostMeta & { body: string; faq: { q: string; a: string }[] };

const DIR = path.join(process.cwd(), "content", "blog");
const SLUG = /^[a-z0-9-]{3,80}$/;

function parse(slug: string, raw: string): Post {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const head = m ? m[1] : "";
  let body = m ? m[2] : raw;
  const get = (k: string) => head.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1].trim().replace(/^"|"$/g, "") ?? "";
  const faq: { q: string; a: string }[] = [];
  const faqIdx = body.search(/^## (FAQ|Frequently asked questions)\s*$/im);
  if (faqIdx >= 0) {
    for (const f of body.slice(faqIdx).matchAll(/^### (.+)\n+([\s\S]*?)(?=\n### |\n## |$)/gm)) faq.push({ q: f[1].trim(), a: f[2].trim() });
  }
  body = body.trim();
  const words = body.split(/\s+/).length;
  return {
    slug,
    title: get("title"),
    description: get("description"),
    keywords: get("keywords").split(",").map((s) => s.trim()).filter(Boolean),
    date: get("date"),
    readMinutes: Math.max(3, Math.round(words / 220)),
    body,
    faq,
  };
}

export async function listPosts(): Promise<PostMeta[]> {
  let files: string[] = [];
  try {
    files = (await readdir(DIR)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const posts = await Promise.all(files.map(async (f) => parse(f.replace(/\.md$/, ""), await readFile(path.join(DIR, f), "utf8"))));
  return posts
    .filter((p) => SLUG.test(p.slug) && p.title)
    .map(({ body: _b, faq: _f, ...meta }) => { void _b; void _f; return meta; })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!SLUG.test(slug)) return null;
  try {
    return parse(slug, await readFile(path.join(DIR, `${slug}.md`), "utf8"));
  } catch {
    return null;
  }
}
