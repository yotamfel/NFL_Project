"""One-off exploration script: inspect raw CSV structure per category before writing cleaners."""
import pandas as pd
from pathlib import Path

BASE = Path(r"C:\Users\yotam\OneDrive\שולחן העבודה\data_analyst\פרויקט\Pro Football Reference")

CATEGORIES = {
    "passing": (BASE / "Passing Tables" / "2024 passing.csv", 0),
    "offense": (BASE / "Offense Tables" / "2024 offense.csv", 1),
    "defense": (BASE / "Defense Tables" / "2024 defense.csv", 1),
    "kicking": (BASE / "Kicking Tables" / "2024 kicking.csv", 1),
    "punting": (BASE / "Punting Tables" / "2024 punting.csv", 1),
    "returns": (BASE / "Returns Tables" / "2024 Returns.csv", 1),
    "combine": (BASE / "Combine Tables" / "2024 combine.csv", 0),
    "draft":   (BASE / "Draft Tabels Stats" / "Draft CSV" / "Draft 2022.csv", 1),
}

for name, (path, header_row) in CATEGORIES.items():
    print(f"\n{'='*20} {name} {'='*20}")
    df = pd.read_csv(path, header=header_row, encoding="utf-8-sig")
    print("shape:", df.shape)
    print("columns:", list(df.columns))
    print("dtypes sample:\n", df.dtypes.head(10))
    # show last column name + a few sample values
    last_col = df.columns[-1]
    print(f"last column '{last_col}' sample values:", df[last_col].dropna().unique()[:5])
