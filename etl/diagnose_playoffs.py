"""Verify PFR playoff page URL format and table structure."""
import shutil, tempfile, time
from bs4 import BeautifulSoup, Comment
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE_URL   = "https://www.pro-football-reference.com"
CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

CHECKS = [
    ("/years/2022/playoffs/passing.htm",   "2022 passing"),
    ("/years/2022/playoffs/scrimmage.htm", "2022 offense"),
    ("/years/2022/playoffs/defense.htm",   "2022 defense"),
    ("/years/1975/playoffs/passing.htm",   "1975 passing"),
]

_drv = _tmp = None
def get_driver():
    global _drv, _tmp
    if _drv is None:
        _tmp = tempfile.mkdtemp(prefix="pfr_po_")
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

try:
    drv = get_driver()
    print("Warming up CF...")
    drv.get(BASE_URL)
    time.sleep(18)
    print("CF ready\n")

    for path, label in CHECKS:
        print(f"=== {label}: {path} ===")
        drv.get(BASE_URL + path)
        time.sleep(12)
        tables = find_tables(drv.page_source)
        if not tables:
            print("  No tables found (wrong URL?)")
        for tid, tbl in tables.items():
            thead = tbl.find("thead")
            trs = thead.find_all("tr") if thead else []
            row = trs[-1] if trs else None
            cols = [th.get("data-stat","?") for th in (row.find_all(["th","td"]) if row else [])][:10]
            print(f"  table '{tid}': cols={cols}")
        print()
finally:
    if _drv:
        try: _drv.quit()
        except: pass
    if _tmp:
        shutil.rmtree(_tmp, ignore_errors=True)
