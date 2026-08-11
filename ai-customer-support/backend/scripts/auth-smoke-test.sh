#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT:-3000}}"
EMAIL="test.auth.$(date +%s%N)@example.com"
PASSWORD="Password123!"
NAME="Auth Smoke Test"

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local headers_file body_file status
  headers_file="$(mktemp)"
  body_file="$(mktemp)"

  if [[ -n "$body" ]]; then
    status=$(curl -sS -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' \
      -d "$body" \
      -D "$headers_file" -o "$body_file" -w '%{http_code}')
  else
    status=$(curl -sS -X "$method" "$BASE_URL$path" \
      -D "$headers_file" -o "$body_file" -w '%{http_code}')
  fi

  cat "$body_file"
  rm -f "$headers_file" "$body_file"
  return "$status"
}

assert_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected $label status $expected, got $actual" >&2
    exit 1
  fi
}

register_body=$(mktemp)
register_status=$(curl -sS -X POST "$BASE_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  -o "$register_body" -w '%{http_code}')
assert_status "$register_status" "201" "register"

TOKEN=$(node -e "const fs=require('fs'); const body=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(!body.token) process.exit(1); console.log(body.token)" "$register_body")
rm -f "$register_body"

login_body=$(mktemp)
login_status=$(curl -sS -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  -o "$login_body" -w '%{http_code}')
assert_status "$login_status" "200" "login"
LOGIN_TOKEN=$(node -e "const fs=require('fs'); const body=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(!body.token) process.exit(1); console.log(body.token)" "$login_body")
rm -f "$login_body"

me_body=$(mktemp)
me_status=$(curl -sS -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $LOGIN_TOKEN" \
  -o "$me_body" -w '%{http_code}')
assert_status "$me_status" "200" "me"
node -e "const fs=require('fs'); const body=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if(body.user?.email !== process.argv[2] || body.user?.password) process.exit(1);" "$me_body" "$EMAIL"
rm -f "$me_body"

echo "Auth smoke test passed for $EMAIL"
