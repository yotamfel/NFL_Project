"""
Diagnose which HTML table IDs exist on PFR pages that failed to scrape.
Prints all table ids found (including in HTML comments) for each failing year.
"""
import shutil, sys, tempfile, time
from bs4 import BeautifulSoup, Comment
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE_URL  = "https://www.pro-football-reference.com"
CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DELAY = 8  # give Cloudflare time to resolve

# Pages to diagnose: (label, path)
CHECKS = [
    ("passing 1975", "/years/1975/passing.htm"),
    ("defense 1997", "/years/1997/defense.htm"),
    ("defense 1998", "/years/1998/defense.htm"),
    ("combine 1990", "/draft/1990-combine.htm"),
    ("combine 1995", "/draft/1995-combine.htm"),
]

_driver = None
_tmp = None

def get_driver():
    global _driver, _tmp
    if _driver is None:
        _tmp = tempfile.mkdtemp(prefix="pfr_diag_")
        opts = Options()
        opts.binary_location = CHROME_BIN
        opts.add_argument(f"--user-data-dir={_tmp}")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)
        _driver = webdriver.Chrome(options=opts)
        time.sleep(2)
    return _driver

def find_all_table_ids(html):
    soup = BeautifulSoup(html, "html.parser")
    ids = set()
    for t in soup.find_all("table"):
        if t.get("id"):
            ids.add(t["id"])
    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        inner = BeautifulSoup(str(comment), "html.parser")
        for t in inner.find_all("table"):
            if t.get("id"):
                ids.add(t["id"] + "  (in comment)")
    return sorted(ids)

try:
    drv = get_driver()
    for label, path in CHECKS:
        url = BASE_URL + path
        print(f"\n{'='*60}")
        print(f"  {label}  ->  {url}")
        drv.get(url)
        time.sleep(DELAY)
        ids = find_all_table_ids(drv.page_source)
        if ids:
            for tid in ids:
                print(f"    table id: {tid}")
        else:
            print("    (no tables found — page may have failed to load)")
finally:
    if _driver:
        try: _driver.quit()
        except: pass
    if _tmp:
        shutil.rmtree(_tmp, ignore_errors=True)
