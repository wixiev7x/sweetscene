# sweetscene — deployment setup

Everything below is done from a browser plus one terminal. No secret in
this repository, and none should ever be pasted into a chat window,
issue, or commit message.

---

## ⚠️ Read this first — unapplied migrations

`lib/supabase/schema.sql` is an **append-only** file. Seven blocks near
the end have **not** been run against the database yet:

| Line | Block | Consequence if skipped |
|---|---|---|
| 2649 | Server-authoritative age cohort | Age gating is client-trusted — a user can set their own cohort |
| 2812 | Payments hardening | Duplicate webhooks double-credit tokens |
| 2870 | Ban enforcement + platform settings | **The app breaks.** See below |
| 3013 | Avatar URL hardening | Any user can harvest every viewer's IP address |
| 3076 | Restore EXECUTE on auth.uid() RPCs | **Must be applied with the others.** See below |
| 3116 | Account deletion | Deleting an account destroys its payment records |
| 3153 | Cohort-segregated matchmaking | **Minors and adults are matched into the same live scene** |

Apply them in order (2649 → 2812 → 2870 → 3013 → 3076 → 3116 → 3153).
Each block is idempotent — re-running is safe.

**The ban block (2870) is not optional.** `assertNotBanned()` was changed
from fail-open to fail-closed, so it now denies the action when it cannot
reach the `is_current_user_banned()` RPC. That function is defined in this
block. Until it is applied, every gated action returns "Could not verify
account status." The admin settings page also needs the
`platform_settings` table from this block.

**Block 3076 repairs blocks A1 and A7** (lines ~1959 and ~2044), which
revoked EXECUTE on `deduct_tokens` and `append_solo_messages` from
`authenticated`. Both functions scope their write with `auth.uid()`, so
they only work when called by the end user — which is what the code does.
The revoke leaves no working caller: the user client gets permission
denied, and the service-role client has a NULL `auth.uid()` that matches
no row. With A1/A7 applied and 3076 missing, **matchmaking and solo chat
both fail** — every match returns "Not enough tokens" and every solo
message returns "Failed to save message". The negative-amount abuse the
revoke targeted is already closed by the sign guard in the same block.

**Block 3116 must be applied before account deletion is used.** It
changes `payments.user_id` from `ON DELETE CASCADE` to `SET NULL`.
Without it, a user deleting their account also deletes their payment
history — which the privacy policy commits to retaining for 7 years, and
which you need for tax purposes. Everything else in the cascade graph is
already correct: the user's own data cascades, and the other
participant's match and message history is `SET NULL` so it survives.

**Block 3153 closes an age-mixing hole and is the most urgent of the
seven.** The platform floor is 16+ and NSFW is gated to
`age_cohort = 'adult'`, but that gate only ever governed what a user
could *see*. Nothing governed who they could be *paired with*: the queue
query filtered on tier and scenario tags, and `claim_match` checked only
that the match was open and neither user had blocked the other. A
16-year-old and a 35-year-old could be dropped into the same anonymous
two-human scene.

The block adds `matches.cohort`, set by a trigger from the creator's
profile — never by the client — and makes `claim_match` refuse a join
from a different cohort. An unrecorded age resolves to `minor`, because
the cost of guessing wrong that way is a missed match and the cost of
guessing the other way is an adult in a scene with a child. The
application-side filter in `lib/actions/matchmaking.ts` is only a fast
path; `claim_match` is the enforcement point, since a client can call
that RPC with any match id it can name.

---

## 1. Supabase (free tier)

1. Create a project at [supabase.com](https://supabase.com). **Put the
   region in the same country as the server that will run the app** — a
   page render makes several sequential queries, so app↔database distance
   multiplies, while visitor↔app distance is one round trip that
   Cloudflare's edge largely absorbs. Self-hosting from India means
   **South Asia (Mumbai)**. The region cannot be changed later.
2. Save the database password somewhere durable. Supabase shows it once.
3. **SQL Editor** → paste `lib/supabase/schema.sql` and run it. On a
   fresh project run the whole file top to bottom; on an existing one
   run only the unapplied blocks listed above.
4. **Authentication → Providers** → enable Google and Discord. Each
   needs an OAuth app on the provider's own console; the callback URL
   Supabase shows you goes into that console, not here.
5. **Authentication → URL Configuration** → set Site URL to your
   deployed origin and add `<origin>/auth/callback` to Redirect URLs.
   Add `http://localhost:3000/auth/callback` too, for local dev.
6. **Storage** → create a public bucket named `avatars`. Avatar URLs are
   allowlisted to your Supabase storage host — external image links are
   rejected by both the server action and a database constraint, because
   an external avatar leaks every viewer's IP to whoever set it.
7. **Project Settings → API** → copy the three Supabase values into
   `.env.local`.

### Make yourself admin

After signing in once so your profile row exists:

```sql
UPDATE profiles SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```

`/admin` is then reachable. Note that `ban_user` refuses to ban an admin
or yourself, so you cannot lock yourself out by accident.

### Free tier caveat

Supabase pauses a free project after 7 days with no activity. It resumes
on the next request, but the first one after a pause is slow. Anything
user-facing should be on a paid plan.

---

## 2. Environment variables

```bash
cp .env.example .env.local
```

Fill it in. `.env.example` documents each value and marks the four that
must stay in the environment.

Generate the encryption key with:

```bash
openssl rand -hex 32
```

**Do not lose it.** It decrypts every stored message. Rotating it makes
all existing chat history unreadable — there is no recovery path.

The only strictly required values to boot are the three Supabase ones,
`MESSAGE_ENCRYPTION_KEY`, and `NEXT_PUBLIC_SITE_URL`. Everything else
degrades gracefully: no AI key gives mock replies, no NOWPayments key
disables purchases, no Upstash falls back to in-memory rate limiting.

---

## 3. API tokens

Set these **either** in `.env.local` **or**, after deploying, at
`/admin/settings` in the running app. The dashboard writes to the
`platform_settings` table and overrides the environment value, taking
effect within 30 seconds without a redeploy. That is the intended path
for rotation.

| Service | Where to get it | Needed for |
|---|---|---|
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) → API keys | AI replies |
| Cloudflare Turnstile | Cloudflare dash → Turnstile → add site | Login captcha |
| NOWPayments | [nowpayments.io](https://nowpayments.io) → Settings → API keys, and Payment Settings → IPN secret | Crypto billing |
| Upstash Redis | [upstash.com](https://upstash.com) → create Redis DB → REST API | Distributed rate limiting |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com) → API keys | Image generation (VIP) |
| OpenAI | [platform.openai.com](https://platform.openai.com) → API keys | Content moderation. The moderations endpoint is free and does not consume paid credit |
| Error webhook | Discord or Slack → channel → Integrations → Incoming webhook | Server errors and warnings |

The dashboard never shows a stored secret back to you — only a masked
preview like `sk-a1…9f3c (51 chars)`. If you lose a key, rotate it at
the provider rather than trying to read it back. That is the correct
recovery path regardless.

### NOWPayments IPN

In the NOWPayments dashboard set the IPN callback URL to:

```
https://<your-domain>/api/nowpayments/webhook
```

The webhook verifies an HMAC-SHA512 signature over the sorted JSON body.
Without `NOWPAYMENTS_IPN_SECRET` set it rejects every callback, so
payments will be taken but tokens never credited. Send a test IPN from
the NOWPayments dashboard before going live.

---

## 4. Hosting

**Self-hosting on your own VPS? See `DEPLOY.md`** — server hardening,
systemd, Caddy for TLS, Cloudflare, and the go-live checklist. Skip the
rest of this section; everything else in this file still applies.

The Supabase region and the server must be in the same place. A page
render makes several sequential database queries, so distance between
app and database multiplies in a way distance between visitor and app
does not.

### Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Framework preset: Next.js. Root directory: the repo root. Build
   command and output directory: leave as detected.
3. **Settings → Environment Variables** → add every value from your
   `.env.local`. Vercel does not read that file.
4. Deploy, then set `NEXT_PUBLIC_SITE_URL` to the real deployment URL
   and redeploy. It is baked into the client bundle at build time, so
   changing it requires a rebuild, not just a restart.
5. Go back to Supabase → Authentication → URL Configuration and add the
   production callback URL.

### Preview deployments

Vercel gives every branch a unique URL, which will not match
`NEXT_PUBLIC_SITE_URL` and so will not be in Supabase's redirect
allowlist — OAuth fails on previews. Either add a wildcard redirect in
Supabase or accept that sign-in only works on production.

---

## 5. Post-deploy verification

Work through these in order. Each one has failed silently in testing.

- [ ] Sign in with Google and with Discord.
- [ ] Confirm the Turnstile widget **renders** on `/login`. If the box is
      blank, the CSP `frame-src` is wrong — check the browser console.
- [ ] Open a chat and send a message. A canned generic reply means the
      AI key is not resolving; check `/admin/settings`.
- [ ] Reload the chat and confirm history is readable. Garbled text
      means `MESSAGE_ENCRYPTION_KEY` differs from the one used to write.
- [ ] Visit `/admin` — it should load for you and redirect anyone else
      to `/lobby`.
- [ ] Temporarily restrict a throwaway account, confirm it is blocked,
      then unban it.
- [ ] Send a test IPN from NOWPayments and confirm the token balance
      moves. Send the **same** IPN twice and confirm it moves only once.
- [ ] Confirm `/admin/settings` shows masked previews and never a raw
      key.

---

## 6. Redesigning the UI

See **`LOVABLE.md`** before pointing Lovable, v0, or any other design
tool at this repo. All colour is tokenized in `app/globals.css` — editing
`--brand` rebrands the whole app — and `/style-guide` renders every token
and component on one page for verification.

That doc also lists the security boundaries a design tool must not
refactor. Four vulnerabilities in this codebase came from correct-looking
code sitting in the wrong file; a tool reorganising by appearance will
reintroduce them.

## 7. Operational notes

**Rate limiting.** Without Upstash the limiter is per-process memory.
On Vercel each serverless instance has its own, so the effective limit
is roughly `configured_limit × instance_count`. Configure Upstash before
launch.

**Secret rotation.** Anything marked dashboard-manageable rotates from
`/admin/settings` with no redeploy. The four ENV-ONLY values need a
redeploy, and `MESSAGE_ENCRYPTION_KEY` cannot be rotated at all without
losing history.

**Age policy.** The platform floor is 16+. NSFW content is gated
separately to `age_cohort = 'adult'` (18+) and is enforced server-side.
The SFW/NSFW toggle only ever narrows what a user sees; it cannot widen
access beyond their cohort. Since block 3153, matchmaking is also
segregated by cohort — a user only ever joins a match in their own.

## 8. Content moderation

Two layers, and only the first is on by default.

**The floor** — `containsBlockedTerm` in `lib/utils/safety.ts`. A short,
reviewable list of terms with no legitimate use here: CSAM, attack
planning, doxxing. It runs on every write path, in the browser and again
on the server, needs no configuration, and cannot fail.

Matching is done against a normalised form of the text, so the term list
is not the bypass it looks like. `p e d o`, `p.e.d.o`, `p3d0`, `peddo`,
`рedo` (Cyrillic er), `pédo`, `ｐｅｄｏ`, and a zero-width space wedged
mid-word all collapse onto the same pattern. It is still a floor: it
recognises restatements of a phrase it knows, and it cannot recognise
paraphrase. No keyword list can.

**The classifier** — `lib/utils/moderation.ts`. This is the layer that
catches what the floor cannot, and it is **off until you configure it**.
Set `MODERATION_PROVIDER` to `openai` with an OpenAI key, in `.env.local`
or at `/admin/settings`. The moderations endpoint is free and does not
consume paid credit, so there is no cost argument for leaving this off.

It screens character prompts, every sent message, **and the model's own
replies**. Output screening is the part that matters most: every other
control on that path guards the model's input and assumes the prompt
layers hold. Screening the output makes that assumption unnecessary —
whatever a user talks the model into, the result is checked on the way
out and replaced with a neutral line if it fails.

Category selection is NSFW-aware. `sexual` is refused on SFW surfaces
and permitted on adult ones — an adult roleplay platform that blocked it
outright would have no product. `sexual/minors` is refused on every
surface at every setting, and does not consult that flag.

If the classifier is unreachable the message is allowed through and the
failure is logged, because an outage at OpenAI should not stop every
conversation on the platform and the floor has already run. Set
`MODERATION_FAIL_CLOSED=true` to take the downtime instead.

**Before accepting public signups**, configure the classifier and apply
block 3153. Those two together are what make the 16+ floor real rather
than stated.
