"""Test the Excel-serial-date recovery formula and measure corruption scope across multiple years."""
import re
from datetime import date
import pandas as pd
from pathlib import Path

BASE = Path(r"C:\Users\yotam\OneDrive\שולחן העבודה\data_analyst\פרויקט\Pro Football Reference")
DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/((?:19|20)\d{2})$")
EXCEL_EPOCH = date(1899, 12, 31)

def recover_serial(s):
    m = DATE_RE.match(str(s))
    if not m:
        return None
    dd, mm, yyyy = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if dd == 0:
        return 0
    try:
        return (date(yyyy, mm, dd) - EXCEL_EPOCH).days
    except ValueError:
        return None

# Test recovery on known examples
print("=== Recovery test ===")
for s in ["00/01/1900", "01/01/1900", "04/01/1900", "12/02/1900"]:
    print(f"{s} -> {recover_serial(s)}")

# Cross-check: in defense 2024, compare corrupted vs clean values for same logical stat
print("\n=== Cross-check: defense 2024, distribution of recovered Int values vs clean Int values ===")
df = pd.read_csv(BASE / "Defense Tables" / "2024 defense.csv", header=1, encoding="utf-8-sig", dtype=str)
recovered = df["Int"].apply(recover_serial)
clean = pd.to_numeric(df["Int"], errors="coerce")
combined = recovered.combine_first(clean)
print("combined value counts (should look like a sane INT distribution, mostly 0-3):")
print(combined.value_counts().sort_index().head(10))

# Measure corruption scope: % of numeric-ish columns affected, across several years/categories
print("\n=== Corruption scope across years (defense, offense, passing, kicking) ===")
samples = {
    "defense": [(BASE / "Defense Tables" / f"{y} defense.csv", 1) for y in (2005, 2015, 2024)],
    "offense": [(BASE / "Offense Tables" / f"{y} offense.csv", 1) for y in (2005, 2015, 2024)],
    "passing": [(BASE / "Passing Tables" / f"{y} passing.csv", 0) for y in (2005, 2015, 2024)],
    "kicking": [(BASE / "Kicking Tables" / f"{y} kicking.csv", 1) for y in (2005, 2015, 2024)],
}
for cat, files in samples.items():
    for path, hdr in files:
        d = pd.read_csv(path, header=hdr, encoding="utf-8-sig", dtype=str)
        hits = {}
        for col in d.columns:
            ratio = d[col].dropna().astype(str).str.match(DATE_RE).mean()
            if ratio > 0:
                hits[col] = round(ratio, 3)
        print(f"  {cat} {path.name}: {hits}")
