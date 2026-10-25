#!/usr/bin/env sh
# Pre-commit sanitisation check for the training tree. Run before every commit and record
# the output in WORKLOG.md. Exits 1 if any pattern matches; prints a per-pattern count
# either way, so "0" is a reading, not an absence of output.
# The scan must not match its own patterns, so it excludes this file (and WORKLOG.md,
# which quotes pattern names when recording results).
DIR=$(dirname "$0")
test -d "$DIR" || { echo "scan: $DIR missing" >&2; exit 2; }
FILES=$(find "$DIR" -name '*.md' ! -name WORKLOG.md)
test -n "$FILES" || { echo "scan: no files found" >&2; exit 2; }
echo "scan: $(echo "$FILES" | wc -l) files"
FAIL=0
check() { # label, extended regex, grep flags
  n=$(echo "$FILES" | xargs grep -hoE $3 "$2" | wc -l)
  echo "  $1: $n"
  [ "$n" -eq 0 ] || { echo "$FILES" | xargs grep -nE $3 "$2"; FAIL=1; }
}
check ipv4            '\b[0-9]{1,3}(\.[0-9]{1,3}){3}\b'
check url             'https?://'
check hostname        '\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|io|dev|cloud|internal|local|ai|co)\b' -i
check webhook         'webhook[^ ]*(\.com|/hooks?/|=)' -i
check account-id      '[0-9]{6}:[0-9a-f-]{20,}'
check token-shape     '(glpat-|ghp_|\bsk-[a-zA-Z0-9]{16,}|xox[abp]-|AKIA[0-9A-Z]{12}|eyJ[a-zA-Z0-9_-]{10,})'
check key-assign      '(password|passwd|secret|token|api[_-]?key)[a-z_]*[[:space:]]*[:=][[:space:]]*[^ <$`]' -i
# Names (people, client, hosts) live OUTSIDE the tree so this script does not publish them.
DENY=${SCAN_DENYLIST:-/data/claude/edu-training/denylist.txt}
test -s "$DENY" || { echo "scan: deny-list $DENY missing or empty" >&2; exit 2; }
check names           "\\b($(paste -sd'|' "$DENY"))\\b" -i
check ticket-key      '\bAIF-[0-9]+'
exit $FAIL
