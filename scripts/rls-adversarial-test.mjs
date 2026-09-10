#!/usr/bin/env node
/**
 * RLS adversarial test — SweetScene
 *
 * Proves (or disproves) that a user who is NOT a participant of a chat
 * cannot read or write that chat's rows through the DIRECT Supabase
 * REST API, bypassing all UI. This is the attack the RLS policies
 * exist to stop; the test attacks exactly that way.
 *
 * Flow:
 *   1. Creates three throwaway accounts (A, B, C) via the auth API
 *      (admin-confirmed when a service key is provided).
 *   2. Creates a match between A and C (exactly what the app's server
 *      code does — service-role insert) plus one message from A.
 *   3. CONTROL: A reads the match + messages  → must succeed.
 *   4. ATTACK: B (outsider) reads the same rows  → must return NOTHING.
 *   5. ATTACK: B writes a message into the chat / patches the match
 *      → must be rejected (401/403/42501) or affect 0 rows.
 *   6. EXPOSURE CHECK: B reads other users' sensitive profile columns
 *      → reported (PASS only after the 2026-09-10 revoke migration).
 *   7. Optional cleanup (--cleanup) deletes the test users.
 *
 * Usage:
 *   node scripts/rls-adversarial-test.mjs
 *
 * Env (all required except where noted):
 *   SUPABASE_URL              e.g. https://runjhpkyqcdbiijrqmfl.supabase.co
 *   SUPABASE_ANON_KEY         the project's anon key
 *   SUPABASE_SERVICE_ROLE_KEY optional — enables autoconfirm + cleanup;
 *                             without it the script needs the project's
 *                             signup setting to autoconfirm emails.
 *
 * Exit code 0 = all checks passed; 1 = at least one FAILED ( printed
 * in red-equivalent FAIL lines). Nothing is fabricated: every verdict
 * line shows the actual HTTP status and body the API returned.
 */

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CLEANUP = process.argv.includes("--cleanup");

if (!URL_ || !ANON) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY (and optionally SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(2);
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  console.log(`      ${detail}`);
}

async function api(path, { method = "GET", token = ANON, body, apikey = ANON } = {}) {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${token}`,
      ...(method === "POST" || method === "PATCH"
        ? { "Content-Type": "application/json", Prefer: "return=representation" }
        : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, text };
}

const rand = Math.random().toString(36).slice(2, 8);
const users = {};
const createdUserIds = [];

async function signUp(name) {
  const email = `ss-rls-${name.toLowerCase()}-${rand}@example.com`;
  const password = `Rls!Test-${rand}-${name}`;
  let r = await api("/auth/v1/signup", {
    method: "POST",
    body: { email, password },
  });
  let accessToken = r.json?.access_token ?? null;
  let userId = r.json?.user?.id ?? r.json?.id ?? null;

  if (!accessToken && SERVICE) {
    // Email confirmation required — confirm via admin, then sign in.
    if (!userId && r.json?.user?.id) userId = r.json.user.id;
    if (userId) {
      await api(`/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        token: SERVICE,
        apikey: SERVICE,
        body: { email_confirm: true },
      });
    }
    r = await api("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });
    accessToken = r.json?.access_token ?? null;
  }

  if (!accessToken) {
    throw new Error(
      `Could not get a session for ${name} (status ${r.status}: ${r.text.slice(0, 200)}). ` +
        "Provide SUPABASE_SERVICE_ROLE_KEY so the script can auto-confirm the test account."
    );
  }
  return { email, password, token: accessToken, id: userId ?? r.json?.user?.id ?? null };
}

async function getUserIdFromToken(token) {
  const r = await api("/auth/v1/user", { token });
  return r.json?.id ?? null;
}


/** Ground truth via the service key — what the row ACTUALLY says,
 *  independent of what RLS shows the attacker. */
async function groundTruthMatchStatus(matchId) {
  const r = await api(`/rest/v1/matches?id=eq.${matchId}&select=status`, {
    token: SERVICE,
    apikey: SERVICE,
  });
  return r.json?.[0]?.status ?? "(row gone)";
}
async function groundTruthMessageExists(messageId) {
  const r = await api(`/rest/v1/messages?id=eq.${messageId}&select=id`, {
    token: SERVICE,
    apikey: SERVICE,
  });
  return Array.isArray(r.json) && r.json.length > 0;
}

async function main() {
  console.log(`\nRLS adversarial test against ${URL_}\n`);

  /* 1. Accounts */
  for (const name of ["A", "B", "C"]) {
    users[name] = await signUp(name);
    if (!users[name].id) users[name].id = await getUserIdFromToken(users[name].token);
    createdUserIds.push(users[name].id);
    console.log(`created ${name}: ${users[name].email} (${users[name].id})`);
  }
  if (!users.A.id || !users.B.id || !users.C.id) {
    throw new Error("Could not resolve test user IDs.");
  }
  if (!SERVICE) {
    console.log("NOTE: no service key — match/message rows must be created by the app's server code. Run with SUPABASE_SERVICE_ROLE_KEY for the full direct-DB flow.");
  }

  /* 2. A ↔ C match + one message (service role, mirroring the server) */
  let matchId = null;
  let messageId = null;
  if (SERVICE) {
    const m = await api("/rest/v1/matches", {
      method: "POST",
      token: SERVICE,
      apikey: SERVICE,
      body: {
        user_a: users.A.id,
        user_b: users.C.id,
        is_ai_match: false,
        status: "active",
        tier: "quick",
        cohort: "adult",
        scenario_tags: [],
        shared_pool: 2000,
      },
    });
    if (m.status !== 201) throw new Error(`match insert failed: ${m.status} ${m.text.slice(0, 200)}`);
    matchId = m.json?.[0]?.id ?? m.json?.id;

    const msg = await api("/rest/v1/messages", {
      method: "POST",
      token: SERVICE,
      apikey: SERVICE,
      body: {
        match_id: matchId,
        sender_id: users.A.id,
        sender_type: "human",
        content: "rls-test-message-from-A",
        tokens_used: 0,
      },
    });
    if (msg.status === 201) messageId = msg.json?.[0]?.id ?? msg.json?.id;
    console.log(`fixture: match ${matchId}${messageId ? `, message ${messageId}` : " (message insert skipped)"}`);
  } else {
    throw new Error("This script needs SUPABASE_SERVICE_ROLE_KEY to create the test fixture rows.");
  }

  /* 3. CONTROL — A reads own match */
  const aRead = await api(
    `/rest/v1/matches?id=eq.${matchId}&select=id,user_a,user_b`,
    { token: users.A.token }
  );
  record(
    "CONTROL: participant A reads the match",
    aRead.status === 200 && Array.isArray(aRead.json) && aRead.json.length === 1,
    `HTTP ${aRead.status} → ${JSON.stringify(aRead.json).slice(0, 120)}`
  );

  /* 4. ATTACK — B reads the same match */
  const bReadMatch = await api(
    `/rest/v1/matches?id=eq.${matchId}&select=id,user_a,user_b`,
    { token: users.B.token }
  );
  record(
    "ATTACK: outsider B reads the match",
    bReadMatch.status === 200 && Array.isArray(bReadMatch.json) && bReadMatch.json.length === 0,
    `HTTP ${bReadMatch.status} → ${JSON.stringify(bReadMatch.json).slice(0, 120)} (must be [])`
  );

  /* 5. ATTACK — B reads the messages */
  const bReadMsgs = await api(
    `/rest/v1/messages?match_id=eq.${matchId}&select=id,content`,
    { token: users.B.token }
  );
  record(
    "ATTACK: outsider B reads the messages",
    bReadMsgs.status === 200 && Array.isArray(bReadMsgs.json) && bReadMsgs.json.length === 0,
    `HTTP ${bReadMsgs.status} → ${JSON.stringify(bReadMsgs.json).slice(0, 120)} (must be [])`
  );

  /* 6. ATTACK — B writes a message into the chat */
  const bWriteMsg = await api("/rest/v1/messages", {
    method: "POST",
    token: users.B.token,
    body: {
      match_id: matchId,
      sender_id: users.B.id,
      sender_type: "human",
      content: "injected-by-B",
      tokens_used: 0,
    },
  });
  const writeBlocked =
    bWriteMsg.status === 401 || bWriteMsg.status === 403 || bWriteMsg.status === 42501 ||
    (bWriteMsg.status === 201 && (!Array.isArray(bWriteMsg.json) || bWriteMsg.json.length === 0));
  record(
    "ATTACK: outsider B injects a message",
    writeBlocked,
    `HTTP ${bWriteMsg.status} → ${bWriteMsg.text.slice(0, 140)} (must be 401/403/42501 or empty insert)`
  );

  /* 7. ATTACK — B patches the match row.
     PostgREST returns 200 + [] when RLS filters every row, so the only
     trustworthy verdict is GROUND TRUTH: read the row back with the
     service key and confirm B changed nothing. */
  const statusBefore = await groundTruthMatchStatus(matchId);
  const bPatchMatch = await api(`/rest/v1/matches?id=eq.${matchId}`, {
    method: "PATCH",
    token: users.B.token,
    body: { status: "ended" },
  });
  const statusAfter = await groundTruthMatchStatus(matchId);
  const patchBlocked =
    [401, 403, 42501].includes(bPatchMatch.status) ||
    (bPatchMatch.status === 200 && statusAfter === statusBefore);
  record(
    "ATTACK: outsider B patches the match",
    patchBlocked,
    `HTTP ${bPatchMatch.status} → ${bPatchMatch.text.slice(0, 100)} · ground-truth status ${statusBefore} → ${statusAfter} (unchanged = blocked)`
  );

  /* 8. ATTACK — B deletes A's message (ground truth: row must survive) */
  const bDeleteMsg = messageId
    ? await api(`/rest/v1/messages?id=eq.${messageId}`, { method: "DELETE", token: users.B.token })
    : { status: -1, text: "(fixture message missing)" };
  const msgSurvives = messageId ? (await groundTruthMessageExists(messageId)) : false;
  const deleteBlocked =
    [401, 403, 42501].includes(bDeleteMsg.status) || msgSurvives;
  record(
    "ATTACK: outsider B deletes A's message",
    deleteBlocked,
    `HTTP ${bDeleteMsg.status} → ${bDeleteMsg.text.slice(0, 100)} · ground-truth row still exists: ${msgSurvives}`
  );

  /* 9. EXPOSURE — B reads A's sensitive profile columns directly */
  const bReadProfile = await api(
    `/rest/v1/profiles?id=eq.${users.A.id}&select=tokens_balance,is_vip,nsfw_opt_in,age_cohort`,
    { token: users.B.token }
  );
  const exposed =
    bReadProfile.status === 200 &&
    Array.isArray(bReadProfile.json) &&
    bReadProfile.json.length > 0 &&
    Object.keys(bReadProfile.json[0]).length > 0;
  record(
    "EXPOSURE: outsider B reads A's tokens_balance/is_vip/nsfw_opt_in/age_cohort",
    !exposed,
    exposed
      ? `HTTP ${bReadProfile.status} → ${JSON.stringify(bReadProfile.json).slice(0, 140)} — STILL EXPOSED: run supabase/migrations/2026-09-10-01-profiles-sensitive-column-revokes.sql`
      : `HTTP ${bReadProfile.status} → ${bReadProfile.text.slice(0, 140)} (revoked or empty — good)`
  );

  /* 10. EXPOSURE — anon reads profile rows at all */
  const anonProfile = await api(
    `/rest/v1/profiles?id=eq.${users.A.id}&select=tokens_balance`,
    { token: ANON }
  );
  const anonExposed =
    anonProfile.status === 200 &&
    Array.isArray(anonProfile.json) &&
    anonProfile.json.length > 0 &&
    anonProfile.json[0].tokens_balance !== undefined;
  record(
    "EXPOSURE: anon key reads tokens_balance",
    !anonExposed,
    anonExposed
      ? `HTTP ${anonProfile.status} → ${JSON.stringify(anonProfile.json).slice(0, 120)} — STILL EXPOSED`
      : `HTTP ${anonProfile.status} → ${anonProfile.text.slice(0, 120)}`
  );

  /* Cleanup */
  if (CLEANUP && SERVICE) {
    for (const id of createdUserIds) {
      if (!id) continue;
      await api(`/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        token: SERVICE,
        apikey: SERVICE,
      });
    }
    console.log("\ncleanup: deleted test users (match/message rows cascade with the profile).");
  } else if (SERVICE) {
    console.log(
      "\ncleanup skipped (pass --cleanup). Test accounts to delete manually:" +
        Object.values(users).map((u) => ` ${u.email}`).join(",")
    );
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("FAILED CHECKS:");
    failed.forEach((f) => console.log(`  - ${f.name}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(2);
});
