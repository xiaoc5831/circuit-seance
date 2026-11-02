#!/usr/bin/env bash
# usage: run.sh <label> <prompt-file> [extra kiro-cli flags...]
# Runs kiro-cli headless, saves stream-json, prints final text + credits used.
set -u
label=$1; pf=$2; shift 2
out=docs/kiro-runs/$label.jsonl
/home/sandbox/.local/bin/kiro-cli chat --v3 --no-interactive --trust-workspace --trust-all-tools \
  --output-format stream-json "$@" < "$pf" > "$out" 2>docs/kiro-runs/$label.stderr.log
echo "exit=$?"
python3 - "$out" <<'P'
import json,sys
cr=0;final=None
for l in open(sys.argv[1]):
    try:o=json.loads(l)
    except:continue
    d=o.get("data",{})
    if o.get("type")=="runFinished": final=d
    m=d.get("update",{}).get("_meta",{}).get("kiro",{})
    for s in m.get("promptTurnSummaries",[]) or []: cr+=s.get("usage",0)
print("credits_used=%.3f"%cr)
print("status=",final and final.get("status"))
print((final or {}).get("finalText","")[:3000])
P
