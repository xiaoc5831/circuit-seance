#!/usr/bin/env bash
# Detached launcher: bg.sh <label> <prompt-file> [flags]; writes docs/kiro-runs/<label>.summary.txt when done
cd "$(dirname "$0")/../.."
label=$1
bash docs/kiro-runs/run.sh "$@" > docs/kiro-runs/$label.summary.txt 2>&1
echo DONE >> docs/kiro-runs/$label.summary.txt
