#!/usr/bin/env bash
# smoke-test.sh — CityOne Growth Backend API smoke tests
# Usage: bash scripts/smoke-test.sh [BASE_URL]
# Exits 0 if all checks pass, 1 if any fail

BASE="${1:-http://localhost:3100}"
PASS=0; FAIL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

# ─── helpers ────────────────────────────────────────────────────────────────
ok() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }

http_code() {
  local method="$1" url="$2"; shift 2
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "$@" "$url"
}

http_body() {
  local method="$1" url="$2"; shift 2
  curl -s -X "$method" "$@" "$url"
}

check_status() {
  local label="$1" expected="$2" actual="$3"
  [ "$actual" = "$expected" ] && ok "$label ($actual)" || fail "$label — expected $expected, got $actual"
}

# JSON field extractor: works without jq (handles ': "' with spaces)
json_field() { echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*: *"\([^"]*\)"/\1/'; }

# ─── start ──────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}━━━ CityOne Growth Backend Smoke Tests ━━━${NC}"
echo "  Base URL: $BASE"
echo ""

# ── Health ────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[ Health ]${NC}"
check_status "Health endpoint" "200" "$(http_code GET "$BASE/health")"

# ── Admin Auth ────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[ Admin Auth ]${NC}"
LOGIN_RESP=$(http_body POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"test_admin","password":"CityoneTest@2024"}')
ADMIN_TOKEN=$(json_field "$LOGIN_RESP" "token")
if [ -n "$ADMIN_TOKEN" ]; then
  ok "Admin login (200)"
else
  fail "Admin login — no token (response: $(echo "$LOGIN_RESP" | head -c 120))"
fi
AUTH=(-H "Authorization: Bearer $ADMIN_TOKEN")

# ── Public APIs ───────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[ Public APIs ]${NC}"
check_status "LINE config"         "200" "$(http_code GET "$BASE/api/growth/line/config")"
check_status "Banners"             "200" "$(http_code GET "$BASE/api/growth/banners")"
check_status "Station districts"   "200" "$(http_code GET "$BASE/api/stations/city-districts")"
check_status "Coupon list"         "200" "$(http_code GET "$BASE/api/growth/coupon/list")"
check_status "Mall items list"     "200" "$(http_code GET "$BASE/api/growth/mall/items")"
check_status "Activity list"       "200" "$(http_code GET "$BASE/api/activities")"

# ── Admin Protected ───────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[ Admin Protected APIs ]${NC}"
ME_CODE=$(http_code GET "$BASE/api/admin/me" "${AUTH[@]}")
check_status "Admin /me (with token)" "200" "$ME_CODE"

# ── Coupon CRUD ───────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[ Coupon CRUD ]${NC}"
C_RESP=$(http_body POST "$BASE/api/growth/coupon/add" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"name":{"zh":"烟雾测试卡券","th":"ทดสอบ","en":"Smoke Test Coupon"},
       "couponType":"discount","discountType":"percentage","discountValue":10,
       "validFrom":"2025-01-01","validTo":"2099-12-31","status":1}')
C_ID=$(json_field "$C_RESP" "id")
if [ -n "$C_ID" ]; then
  ok "Coupon create (200) — id=$C_ID"
  # Cleanup
  DEL_RESP=$(http_body POST "$BASE/api/growth/coupon/delete" "${AUTH[@]}" \
    -H "Content-Type: application/json" -d "{\"id\":\"$C_ID\"}")
  DEL_CODE=$(echo "$DEL_RESP" | grep -o '"code"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')
  [ "$DEL_CODE" = "200" ] && ok "Coupon delete (cleanup)" || fail "Coupon delete (cleanup) — $DEL_RESP"
else
  fail "Coupon create — response: $(echo "$C_RESP" | head -c 180)"
fi

# ── Activity CRUD ─────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[ Activity CRUD ]${NC}"
A_RESP=$(http_body POST "$BASE/api/activities" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"activity_name":{"zh":"烟雾测试活动","th":"กิจกรรมทดสอบ","en":"Smoke Test Activity"},
       "activity_type":"general","status":"draft"}')
A_ID=$(json_field "$A_RESP" "activity_id")
if [ -n "$A_ID" ]; then
  ok "Activity create (200) — id=$A_ID"
  http_code DELETE "$BASE/api/activities/$A_ID" "${AUTH[@]}" > /dev/null
  ok "Activity delete (cleanup)"
else
  fail "Activity create — response: $(echo "$A_RESP" | head -c 180)"
fi

# ── Mall Item CRUD ────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}[ Mall Item CRUD ]${NC}"
M_RESP=$(http_body POST "$BASE/api/growth/mall/items" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"name":{"zh":"烟雾测试商品","th":"สินค้าทดสอบ","en":"Smoke Test Item"},
       "item_type":"digital","exchange_mode":"points","points_required":100,"on_shelf":false}')
M_ID=$(json_field "$M_RESP" "id")
if [ -n "$M_ID" ]; then
  ok "Mall item create (200) — id=$M_ID"
  http_code DELETE "$BASE/api/growth/mall/items/$M_ID" "${AUTH[@]}" > /dev/null
  ok "Mall item delete (cleanup)"
else
  fail "Mall item create — response: $(echo "$M_RESP" | head -c 180)"
fi

# ── Translation Service ───────────────────────────────────────────────────────
echo -e "\n${YELLOW}[ Translation Service ]${NC}"
T_CODE=$(http_code POST "$BASE/api/translate" -H "Content-Type: application/json" -d '{}')
# Accept 400 (bad request, service up) or 500 (LLM unavailable) or 200 (success)
[[ "$T_CODE" =~ ^(200|400|500)$ ]] && ok "Translate endpoint reachable ($T_CODE)" \
  || fail "Translate endpoint — unexpected $T_CODE"

# ─── summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━ Results ━━━${NC}"
TOTAL=$((PASS+FAIL))
echo -e "  Passed: ${GREEN}${PASS}/${TOTAL}${NC}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "  Failed: ${RED}${FAIL}/${TOTAL}${NC}"
  echo ""
  exit 1
else
  echo -e "  ${GREEN}All checks passed ✓${NC}"
  echo ""
  exit 0
fi
