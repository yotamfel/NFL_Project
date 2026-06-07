"""Scan every column in every category (one sample year) for Excel date-corruption patterns."""
import re
import pandas as pd
from pathlib import Path

BASE = Path(r"C:\Users\yotam\OneDrive\שולחן העבודה\data_analyst\פרויקט\Pro Football Reference")
DATE_RE = re.compile(r"^\d{1,2}/\d{1,2}/(19|20)\d{2}$")

CATEGORIES = {
    "passing": (BASE / "Passing Tables" / "2024 passing.csv", 0),
    "offense": (BASE / "Offense Tables" / "2024 offense.csv", 1),
    "defense": (BASE / "Defense Tables" / "2024 defense.csv", 1),
    "kicking": (BASE / "Kicking Tables" / "2024 kicking.csv", 1),
    "punting": (BASE / "Punting Tables" / "2024 punting.csv", 1),
    "returns": (BASE / "Returns Tables" / "2024 Returns.csv", 1),
    "combine": (BASE / "Combine Tables" / "2024 combine.csv", 0),
}

for name, (path, header_row) in CATEGORIES.items():
    df = pd.read_csv(path, header=header_row, encoding="utf-8-sig", dtype=str)
    affected = []
    for col in df.columns:
        sample = df[col].dropna().astype(str)
        if len(sample) == 0:
            continue
        match_ratio = sample.str.match(DATE_RE).mean()
        if match_ratio > 0.3:
            examples = sample[sample.str.match(DATE_RE)].unique()[:3]
            affected.append((col, round(match_ratio, 2), list(examples)))
    print(f"\n{name}: {len(affected)} affected column(s) of {len(df.columns)}")
    for col, ratio, examples in affected:
        print(f"   - {col!r}: {ratio*100:.0f}% date-like, e.g. {examples}")
