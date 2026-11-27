#!/usr/bin/env bash
# usage: sbq.sh DESIGN|MAIN <sql-file>   (runs SQL via Supabase Management API; token read from env file, never printed)
set -euo pipefail
case "$1" in DESIGN) ref=rcgxcxygoatdmpxnvnbu; var=SUPABASE_TOKEN_DESIGN;; MAIN) ref=vnugflrlzrvngopweixe; var=SUPABASE_TOKEN_MAIN;; *) exit 2;; esac
tok=$(grep "^$var=" ~/.sweetscene-deploy.env | cut -d= -f2- | tr -d '"'"'"' ')
python3 -c 'import json,sys; print(json.dumps({"query": open(sys.argv[1]).read()}))' "$2" |
  curl -sS -X POST "https://api.supabase.com/v1/projects/$ref/database/query" \
    -H "Authorization: Bearer $tok" -H "Content-Type: application/json" --data-binary @- -w '\nHTTP %{http_code}\n'
