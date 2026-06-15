"""Find correct PFR URL for 2022 playoff stats + check 1975 table columns."""
import shutil, tempfile, time
from bs4 import BeautifulSoup, Comment
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE_URL   = "https://www.pro-football-reference.com"
CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

_drv = _tmp = None
def get_driver():
    global _drv, _tmp
    if _drv is None:
        _tmp = tempfile.mkdtemp(prefix="pfr_po2_")
        opts = Options()
        opts.binary_location = CHROME_BIN
        opts.add_argument(f"--user-data-dir={_tmp}")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)
        _drv = webdriver.Chrome(options=opts)
        time.sleep(2)
    return _drv

def find_tables(html):
    soup = BeautifulSoup(html, "html.parser")
    out = {}
    for t in soup.find_all("table"):
        if t.get("id"): out[t["id"]] = t
    for c in soup.find_all(string=lambda s: isinstance(s, Comment)):
        inner = BeautifulSoup(str(c), "html.parser")
        for t in inner.find_all("table"):
            if t.get("id"): out[t["id"] + "(c)"] = t
    return out

def check_url(drv, path, wait=20):
    drv.get(BASE_URL + path)
    time.sleep(wait)
    tables = find_tables(drv.page_source)
    return tables, drv.current_url

try:
    drv = get_driver()
    print("Warming up CF...")
    drv.get(BASE_URL)
    time.sleep(18)
    print("CF ready\n")

    # 1) Check 2022 season index for playoff links
    print("=== 2022 season index (/years/2022/) ===")
    drv.get(BASE_URL + "/years/2022/")
    time.sleep(12)
    soup = BeautifulSoup(drv.page_source, "html.parser")
    playoff_links = [a["href"] for a in soup.find_all("a", href=True)
                     if "playoff" in a["href"].lower() or "postseason" in a["href"].lower()]
    print(f"Playoff links found: {playoff_links[:20]}")
    print()

    # 2) Try alternate URL patterns for 2022 passing
    candidates_2022 = [
        "/years/2022/playoffs/passing.htm",
        "/years/2022/passing.htm",  # check if regular-season page lists POST too
    ]
    for path in candidates_2022:
        tables, final_url = check_url(drv, path, wait=22)
        print(f"URL: {path}")
        print(f"  Redirected to: {final_url}")
        for tid, tbl in tables.items():
            thead = tbl.find("thead")
            trs = thead.find_all("tr") if thead else []
            row = trs[-1] if trs else None
            cols = [(th.get("data-stat","?"), th.get_text(strip=True)) for th in (row.find_all(["th","td"]) if row else [])][:10]
            print(f"  table '{tid}': {cols}")
        if not tables:
            print("  (no tables)")
        print()

    # 3) Inspect the 1975 stathead_table more carefully with longer wait
    print("=== 1975 playoff passing (longer wait) ===")
    drv.get(BASE_URL + "/years/1975/playoffs/passing.htm")
    time.sleep(20)
    tables = find_tables(drv.page_source)
    for tid, tbl in tables.items():
        thead = tbl.find("thead")
        trs = thead.find_all("tr") if thead else []
        for i, tr in enumerate(trs):
            ths = [(th.get("data-stat","?"), th.get_text(strip=True)) for th in tr.find_all(["th","td"])]
            print(f"  '{tid}' header row {i}: {ths[:12]}")
        tbody = tbl.find("tbody")
        if tbody:
            rows = tbody.find_all("tr")
            if rows:
                sample = [(td.get("data-stat","?"), td.get_text(strip=True)) for td in rows[0].find_all(["td","th"])]
                print(f"  '{tid}' sample data row: {sample[:12]}")

finally:
    if _drv:
        try: _drv.quit()
        except: pass
    if _tmp:
        shutil.rmtree(_tmp, ignore_errors=True)
