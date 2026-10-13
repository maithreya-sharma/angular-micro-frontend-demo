#!/usr/bin/env bash
# Runs a command; on failure, surfaces the important log lines as GitHub
# annotations so they show up on the run summary page.
set -o pipefail
title="$1"; shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=$?
if [ $status -ne 0 ]; then
  grep -E -i -B2 -A6 "error|failed|✘|✖|NG[0-9]{4}|TS[0-9]{4}|Expected|Unknown argument|Cannot" "$log" \
    | grep -v -E "^\s*at .*node_modules" | head -c 48000 > "$log.err" || true
  [ -s "$log.err" ] || tail -c 48000 "$log" > "$log.err"
  split -b 6000 -d "$log.err" "$log.part."
  n=0
  for part in "$log".part.*; do
    n=$((n+1))
    [ $n -gt 8 ] && break
    msg=$(sed -e 's/%/%25/g' "$part" | sed -e ':a;N;$!ba;s/\r//g;s/\n/%0A/g')
    echo "::error title=${title} (${n})::${msg}"
  done
fi
exit $status
