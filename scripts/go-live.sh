#!/usr/bin/env bash
# Invite-only go-live for MAIN (sweetscene.love). Run by the owner:  ~/sweetscene/scripts/go-live.sh
# Already done by Claude on 2026-11-27: MAIN backup, env (SFW_MODE=1, CRON_SECRET), 18 migrations, invite gate ON + codes.
# This script: seed starter cast on MAIN → deploy current `hardening` to production → smoke test.
# Rollback: vercel rollback dpl_2HJNvEpVY4dfwB9MHoK4Y3xbVF15 --scope team_dS8tItrjiUeBxOxdA9SrGz33
set -euo pipefail
cd "$(dirname "$0")/.."
ENVF="$HOME/.sweetscene-deploy.env"
get() { grep "^$1=" "$ENVF" | cut -d= -f2- | tr -d "\"' "; }
REF=vnugflrlzrvngopweixe
TEAM=team_dS8tItrjiUeBxOxdA9SrGz33
PROJ=prj_sQzOffY5JpgHbQoyrERDnJgQhzy9
PREV=dpl_2HJNvEpVY4dfwB9MHoK4Y3xbVF15

echo "== 1/3 seed starter cast on MAIN"
key=$(curl -s "https://api.supabase.com/v1/projects/$REF/api-keys?reveal=true" -H "Authorization: Bearer $(get SUPABASE_TOKEN_MAIN)" |
  python3 -c "import json,sys; print(next((k['api_key'] for k in json.load(sys.stdin) if k.get('name')=='service_role'), ''))")
[ -n "$key" ] || { echo "could not read MAIN service key"; exit 1; }
SEED_SUPABASE_URL="https://$REF.supabase.co" SEED_SERVICE_KEY="$key" node scripts/seed-starter-cast.mjs

echo "== 2/3 deploy to production (previous: $PREV)"
url=$(VERCEL_ORG_ID=$TEAM VERCEL_PROJECT_ID=$PROJ vercel deploy --prod --yes --token "$(get VERCEL_TOKEN_APP)" 2>/dev/null | tail -1)
echo "deployed: $url"

echo "== 3/3 smoke test"
fail=0
for p in /api/health / /signup /terms /privacy /blog; do
  code=$(curl -s -o /tmp/ss-smoke.html -w '%{http_code}' -L "https://sweetscene.love$p")
  nsfw=$(grep -ciE "nsfw|explicit|18\+ only" /tmp/ss-smoke.html || true)
  printf '%-12s %s  nsfw-words:%s\n' "$p" "$code" "$nsfw"
  [ "$code" = "200" ] || fail=1
done
if [ $fail = 1 ]; then
  echo "SMOKE TEST FAILED. Roll back with:"
  echo "  vercel rollback $PREV --scope $TEAM --token \$(grep ^VERCEL_TOKEN_APP= $ENVF | cut -d= -f2-)"
  exit 1
fi
echo "LIVE (invite-only). Tell Claude 'done' so it can verify."
