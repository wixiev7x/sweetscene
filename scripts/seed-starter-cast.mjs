#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════
 * Seed the SweetScene starter cast (SFW, original, adults only).
 *
 *   SEED_SUPABASE_URL=https://<ref>.supabase.co \
 *   SEED_SERVICE_KEY=<service role key> \
 *   node scripts/seed-starter-cast.mjs
 *
 * Idempotent: a character is matched by name among SweetScene originals
 * (creator_id IS NULL) and updated instead of duplicated. Portraits are
 * generated once per name and stored in the public `avatars` bucket
 * under cast/<slug>.jpg (skipped if already uploaded unless
 * SEED_REGEN=1). Keys are read from the environment only.
 * ════════════════════════════════════════════════════════════════════ */
import { readFile } from "node:fs/promises";

const URL_ = process.env.SEED_SUPABASE_URL;
const KEY = process.env.SEED_SERVICE_KEY;
const REGEN = process.env.SEED_REGEN === "1";
if (!URL_ || !KEY) {
  console.error("SEED_SUPABASE_URL and SEED_SERVICE_KEY are required");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const cast = JSON.parse(await readFile(new URL("./starter-cast.json", import.meta.url), "utf8"));

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function seedOf(s) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % 100000;
}

function portraitPrompt(c) {
  const anime = c.audience === "anime";
  const style = anime
    ? "high quality anime key visual illustration, detailed, soft cel shading"
    : "cinematic painted portrait, photorealistic digital painting";
  return [
    style,
    c.look,
    "adult, fully clothed, tasteful, elegant",
    "moody low-key candlelight with warm rim light, deep wine red and champagne gold color palette",
    "shallow depth of field, vertical portrait composition, upper body, looking at viewer",
    "no text, no watermark",
  ].join(", ");
}

async function exists(path) {
  const r = await fetch(`${URL_}/storage/v1/object/info/public/avatars/${path}`, { headers: H });
  return r.ok;
}

async function makePortrait(c) {
  const path = `cast/${slug(c.name)}.jpg`;
  const publicUrl = `${URL_}/storage/v1/object/public/avatars/${path}`;
  if (!REGEN && (await exists(path))) return publicUrl;
  const prompt = encodeURIComponent(portraitPrompt(c));
  const src = `https://image.pollinations.ai/prompt/${prompt}?width=640&height=1024&nologo=true&model=flux&seed=${seedOf(c.name)}`;
  /* Free tier allows ~1 image / 45s per IP — pace and retry on 402/429/503. */
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const img = await fetch(src, { signal: AbortSignal.timeout(120_000) });
      const type = img.headers.get("content-type") ?? "";
      if (!img.ok || !type.startsWith("image/")) throw new Error(`gen ${img.status} ${type}`);
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length > 2_000_000) throw new Error("image too large");
      const up = await fetch(`${URL_}/storage/v1/object/avatars/${path}`, {
        method: "POST",
        headers: { ...H, "Content-Type": type.includes("png") ? "image/png" : "image/jpeg", "x-upsert": "true", "cache-control": "31536000" },
        body: buf,
      });
      if (!up.ok) throw new Error(`upload ${up.status} ${await up.text()}`);
      await new Promise((r) => setTimeout(r, 47_000));
      return publicUrl;
    } catch (e) {
      console.warn(`  portrait attempt ${attempt} failed for ${c.name}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 50_000));
    }
  }
  return null;
}

function row(c, avatar) {
  return {
    name: c.name,
    tagline: c.tagline,
    short_description: c.desc,
    full_personality: c.desc,
    user_prompt: `You are ${c.name}. ${c.desc} Personality: ${c.personality.join(", ")}. Stay in character, keep the story safe-for-work, and keep the scene moving with vivid but brief narration.`,
    personality: c.personality,
    first_message: c.first,
    tags: c.tags,
    category: c.category,
    audience: c.audience,
    scenario_tags: [],
    is_nsfw: false,
    is_featured: !!c.featured,
    is_hidden: false,
    visibility: "public",
    status: "published",
    avatar_url: avatar,
  };
}

let ok = 0;
for (const c of cast) {
  process.stdout.write(`• ${c.name} … `);
  const avatar = await makePortrait(c);
  const find = await fetch(
    `${URL_}/rest/v1/characters?select=id&creator_id=is.null&name=eq.${encodeURIComponent(c.name)}`,
    { headers: H },
  );
  const found = find.ok ? await find.json() : [];
  const body = JSON.stringify(row(c, avatar));
  const res = found[0]
    ? await fetch(`${URL_}/rest/v1/characters?id=eq.${found[0].id}`, {
        method: "PATCH",
        headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
        body,
      })
    : await fetch(`${URL_}/rest/v1/characters`, {
        method: "POST",
        headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
        body,
      });
  if (res.ok) {
    ok++;
    console.log(`${found[0] ? "updated" : "created"}${avatar ? "" : " (no portrait)"}`);
  } else {
    console.log(`FAILED ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
console.log(`\n${ok}/${cast.length} characters seeded.`);
