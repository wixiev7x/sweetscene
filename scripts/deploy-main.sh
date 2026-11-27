#!/usr/bin/env bash
# Deploy current code to MAIN production (sweetscene.love) + quick smoke test. Owner runs: ~/sweetscene/scripts/deploy-main.sh
set -euo pipefail
cd "$(dirname "$0")/.."
tok=$(grep "^VERCEL_TOKEN_APP=" "$HOME/.sweetscene-deploy.env" | cut -d= -f2- | tr -d "\"' ")
VERCEL_ORG_ID=team_dS8tItrjiUeBxOxdA9SrGz33 VERCEL_PROJECT_ID=prj_sQzOffY5JpgHbQoyrERDnJgQhzy9 \
  vercel deploy --prod --yes --token "$tok" >/dev/null 2>&1
for p in / /signup /api/health; do printf '%-12s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' -L "https://sweetscene.love$p")"; done
echo "Deployed. Tell Claude 'done'."
