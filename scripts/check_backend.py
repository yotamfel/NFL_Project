#!/usr/bin/env python3
"""
Backend health check for Fourth & Data.

Usage:
    python scripts/check_backend.py              # test local dev server
    python scripts/check_backend.py --prod       # test production

Credentials (required for auth/admin checks):
    set ADMIN_USERNAME=yourname
    set ADMIN_PASSWORD=yourpassword

Exit code: 0 if all checks pass, 1 if any fail.
"""
import argparse
import os
import sys
import time

try:
    import requests
except ImportError:
    print("requests not installed — run: pip install requests")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--prod", action="store_true", help="Test production server")
args = parser.parse_args()

BASE = (
    os.getenv("API_URL", "https://fourth-and-data.up.railway.app")
    if args.prod
    else os.getenv("API_URL", "http://localhost:8000")
)
ADMIN_USER = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "")

print(f"\n{'='*55}")
print(f"  Fourth & Data — Backend Health Check")
print(f"  Target: {BASE}")
print(f"{'='*55}\n")

# ── Runner ─────────────────────────────────────────────────────────────────────
results = []

def check(name, fn):
    try:
        t0 = time.time()
        fn()
        ms = int((time.time() - t0) * 1000)
        results.append(("PASS", name, f"{ms}ms"))
        print(f"  \033[32m✓\033[0m  {name:<45} {ms}ms")
    except AssertionError as e:
        results.append(("FAIL", name, str(e)))
        print(f"  \033[31m✗\033[0m  {name:<45} {e}")
    except Exception as e:
        results.append(("ERROR", name, str(e)))
        print(f"  \033[33m!\033[0m  {name:<45} {e}")

def get(path, token=None, **kw):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.get(f"{BASE}/api{path}", headers=h, timeout=20, **kw)

def post(path, body, token=None, **kw):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{BASE}/api{path}", json=body, headers=h, timeout=20, **kw)

# ── Checks ─────────────────────────────────────────────────────────────────────
print("[ Public endpoints ]")

def test_health():
    r = get("/health")
    assert r.status_code == 200, f"status {r.status_code}"
    assert r.json().get("status") == "ok", f"body: {r.text[:80]}"
check("GET /health", test_health)

def test_meta():
    r = get("/meta")
    assert r.status_code == 200, f"status {r.status_code}"
    d = r.json()
    assert d.get("players", 0) > 0, "players count is 0"
    assert d.get("seasons", 0) > 0, "seasons count is 0"
    assert d.get("teams", 0) > 0,   "teams count is 0"
check("GET /meta (DB connectivity)", test_meta)

def test_player_search():
    r = get("/players/search?q=brady&limit=5")
    assert r.status_code == 200, f"status {r.status_code}"
    data = r.json()
    assert isinstance(data, list), "expected list"
    assert len(data) > 0, "no results for 'brady'"
check("GET /players/search?q=brady", test_player_search)

def test_trends():
    r = get("/trends/aggregate?category=passing&stat=pass_yds&agg=sum")
    assert r.status_code == 200, f"status {r.status_code}"
    data = r.json()
    assert isinstance(data, list) and len(data) > 0, "no trend data"
    seasons = [row["season"] for row in data]
    assert 1970 in seasons, "1970 missing from trend data"
    assert max(seasons) >= 2024,  f"latest season is {max(seasons)}, expected ≥2024"
check("GET /trends/aggregate (1970–present)", test_trends)

def test_anomalies():
    r = get("/anomalies?limit=5")
    assert r.status_code == 200, f"status {r.status_code}"
    assert isinstance(r.json(), list), "expected list"
check("GET /anomalies", test_anomalies)

# ── Auth ───────────────────────────────────────────────────────────────────────
print("\n[ Authentication ]")
token = None

def test_login():
    global token
    if not ADMIN_USER or not ADMIN_PASS:
        raise AssertionError("ADMIN_USERNAME / ADMIN_PASSWORD env vars not set — skipped")
    r = post("/auth/login", {"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"status {r.status_code} — {r.text[:80]}"
    d = r.json()
    assert "access_token" in d, "no access_token in response"
    assert d.get("user", {}).get("is_admin"), "logged-in user is not admin"
    token = d["access_token"]
check("POST /auth/login (admin)", test_login)

def test_me():
    if not token:
        raise AssertionError("no token — login failed, skipped")
    r = get("/auth/me", token=token)
    assert r.status_code == 200, f"status {r.status_code}"
    d = r.json()
    assert "unread_notifications_count" in d, "missing unread_notifications_count"
check("GET /auth/me", test_me)

# ── Authenticated user endpoints ───────────────────────────────────────────────
print("\n[ Authenticated endpoints ]")

def test_notifications():
    if not token:
        raise AssertionError("no token — skipped")
    r = get("/notifications", token=token)
    assert r.status_code == 200, f"status {r.status_code}"
    assert isinstance(r.json(), list), "expected list"
check("GET /notifications", test_notifications)

def test_saved():
    if not token:
        raise AssertionError("no token — skipped")
    r = get("/saved", token=token)
    assert r.status_code == 200, f"status {r.status_code}"
    assert isinstance(r.json(), list), "expected list"
check("GET /saved", test_saved)

# ── Admin endpoints ────────────────────────────────────────────────────────────
print("\n[ Admin endpoints ]")

def test_admin_stats():
    if not token:
        raise AssertionError("no token — skipped")
    r = get("/admin/stats", token=token)
    assert r.status_code == 200, f"status {r.status_code}"
    d = r.json()
    for key in ("total_users", "total_visits", "total_feedback"):
        assert key in d, f"missing key: {key}"
check("GET /admin/stats", test_admin_stats)

def test_admin_feedback():
    if not token:
        raise AssertionError("no token — skipped")
    r = get("/admin/feedback", token=token)
    assert r.status_code == 200, f"status {r.status_code}"
    assert isinstance(r.json(), list), "expected list"
check("GET /admin/feedback", test_admin_feedback)

def test_admin_users():
    if not token:
        raise AssertionError("no token — skipped")
    r = get("/admin/users", token=token)
    assert r.status_code == 200, f"status {r.status_code}"
    assert isinstance(r.json(), list), "expected list"
    assert len(r.json()) > 0, "no users found"
check("GET /admin/users", test_admin_users)

def test_admin_visits():
    if not token:
        raise AssertionError("no token — skipped")
    r = get("/admin/visits", token=token)
    assert r.status_code == 200, f"status {r.status_code}"
    assert isinstance(r.json(), list), "expected list"
check("GET /admin/visits", test_admin_visits)

# ── Summary ────────────────────────────────────────────────────────────────────
passed  = sum(1 for s, *_ in results if s == "PASS")
failed  = sum(1 for s, *_ in results if s == "FAIL")
errored = sum(1 for s, *_ in results if s == "ERROR")
total   = len(results)

print(f"\n{'='*55}")
print(f"  Results: {passed}/{total} passed", end="")
if failed:  print(f"  |  {failed} failed", end="")
if errored: print(f"  |  {errored} errors", end="")
print(f"\n{'='*55}\n")

if failed or errored:
    print("Failed checks:")
    for status, name, detail in results:
        if status != "PASS":
            icon = "\033[31m✗\033[0m" if status == "FAIL" else "\033[33m!\033[0m"
            print(f"  {icon}  {name}: {detail}")
    print()
    sys.exit(1)
