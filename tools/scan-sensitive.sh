#!/usr/bin/env bash
# Pre-commit sanitisation check for the training material AND the boilerplate.
# Run before every commit and record the printed counts in the WORKLOG.
#
# Exit 0 = clean · 1 = a finding (each listed with file:line) · 2 = the scan could not
# run (missing list or files). It fails closed: a scan that cannot read its inputs
# never reports clean.
#
# Hosts, URLs and IPs are checked against tools/scan-allowlist.list (public/reserved
# names, in-tree). People/client/infrastructure names are checked against a deny-list
# kept OUTSIDE the tree, so this script never publishes what it guards against.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(dirname "$HERE")
ALLOW="$HERE/scan-allowlist.list"
EXC="$HERE/scan-exceptions.list"
DENY=${SCAN_DENYLIST:-/data/claude/edu-training/denylist.txt}
ROOTS=("$ROOT/docs/ai-agent-training" "$ROOT/boilerplate")

test -s "$ALLOW" || { echo "scan: allow-list $ALLOW missing or empty" >&2; exit 2; }
test -f "$EXC" || { echo "scan: exceptions file $EXC missing" >&2; exit 2; }
test -s "$DENY" || { echo "scan: deny-list $DENY missing or empty" >&2; exit 2; }
for r in "${ROOTS[@]}"; do test -d "$r" || { echo "scan: $r missing" >&2; exit 2; }; done

mapfile -t FILES < <(find "${ROOTS[@]}" -type f \
  \( -name '*.md' -o -name '*.ts' -o -name '*.mjs' -o -name '*.js' -o -name '*.json' \
     -o -name '*.tpl' -o -name '*.yaml' -o -name '*.yml' -o -name '*.sh' -o -name Dockerfile \
     -o -name '.env*' -o -name '.npmrc' -o -name '.dockerignore' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -name WORKLOG.md)
test "${#FILES[@]}" -gt 0 || { echo "scan: no files found" >&2; exit 2; }
echo "scan: ${#FILES[@]} files under ${#ROOTS[@]} roots"

FAIL=0
SUPPRESSED=0
excepted() { # "file:line:match" -> 0 if a reviewed exception covers it
  local file=${1%%:*} rel path sub
  rel=${file#"$ROOT"/}
  while IFS='|' read -r path sub _; do
    case "$path" in ''|'#'*) continue ;; esac
    [ "$rel" = "$path" ] && grep -nF -- "$sub" "$file" | grep -q "^$(printf '%s' "$1" | cut -d: -f2):" && return 0
  done < "$EXC"
  return 1
}
report() { # label, hits (newline-separated "file:line:match")
  local kept="" n=0 s=0 h
  while IFS= read -r h; do
    [ -z "$h" ] && continue
    if excepted "$h"; then s=$((s+1)); else kept+="$h"$'\n'; n=$((n+1)); fi
  done <<< "$2"
  SUPPRESSED=$((SUPPRESSED+s))
  echo "  $1: $n$([ "$s" -gt 0 ] && echo " (+$s reviewed exceptions)")"
  if [ "$n" -ne 0 ]; then printf '%s' "$kept" | sed 's/^/    /'; FAIL=1; fi
}

# 1. Pattern checks that must be zero outright.
pattern() { # label, ERE, [grep flags]
  local hits
  hits=$(grep -nHoE ${3:-} "$2" "${FILES[@]}" || true)
  report "$1" "$hits"
}
pattern account-id   '[0-9]{6}:[0-9a-f-]{20,}'
pattern token-shape  '(glpat-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|\bsk-[a-zA-Z0-9]{16,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{12}|eyJ[a-zA-Z0-9_-]{10,}\.)'
pattern key-assign   '(password|passwd|secret|token|api[_-]?key)[a-z_]*[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9+/_-]{12,}' -i
pattern webhook      'webhook[^ ]*(/hooks?/|/webhook/)[A-Za-z0-9]' -i
pattern names        "\\b($(grep -v '^#' "$DENY" | sed '/^$/d' | paste -sd'|'))\\b" -i
pattern ticket-key   '\b(AIF|DC|SK)[-0-9]{4,}'

# 2. Hosts, URLs and IPv4: anything NOT on the allow-list is a finding.
allowed() { # host -> 0 if allow-listed exactly or as a parent domain
  local h=$1 a
  while read -r a; do
    case "$a" in ''|'#'*) continue ;; esac
    [ "$h" = "$a" ] && return 0
    case "$h" in *."$a") return 0 ;; esac
  done < "$ALLOW"
  return 1
}
HOSTHITS=$(grep -nHoiE 'https?://[A-Za-z0-9.-]+|\b[0-9]{1,3}(\.[0-9]{1,3}){3}\b|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|io|dev|cloud|internal|local|ai|co)\b' "${FILES[@]}" || true)
BAD=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  host=$(printf '%s' "${line#*:*:}" | sed -E 's#^https?://##I' | tr 'A-Z' 'a-z')
  allowed "$host" || BAD+="$line"$'\n'
done <<< "$HOSTHITS"
report "host/url/ip not allow-listed" "$BAD"

echo "  reviewed exceptions applied: $SUPPRESSED"
exit $FAIL
