"""Inspect specific data-quality issues: QBrec date corruption, string-typed numeric columns, sentinel values, junk rows."""
import pandas as pd
from pathlib import Path

BASE = Path(r"C:\Users\yotam\OneDrive\שולחן העבודה\data_analyst\פרויקט\Pro Football Reference")

print("=== passing: QBrec sample values + dtype reason ===")
df = pd.read_csv(BASE / "Passing Tables" / "2024 passing.csv", header=0, encoding="utf-8-sig")
print(df["QBrec"].dropna().unique()[:8])

print("\n=== passing: rows where Player-additional == '-9999' (junk rows) ===")
junk = df[df["Player-additional"] == "-9999"]
print(junk[["Player", "Pos", "Player-additional"]])

print("\n=== defense: why is 'Int' read as str? sample non-numeric values ===")
d = pd.read_csv(BASE / "Defense Tables" / "2024 defense.csv", header=1, encoding="utf-8-sig")
ints = d["Int"].dropna().unique()
non_numeric = [v for v in ints if not str(v).replace('.','',1).isdigit()]
print("non-numeric Int values:", non_numeric[:10])
print("sample Int values:", ints[:10])

print("\n=== offense: why is 'Tgt' str? ===")
o = pd.read_csv(BASE / "Offense Tables" / "2024 offense.csv", header=1, encoding="utf-8-sig")
tgts = o["Tgt"].dropna().unique()
non_numeric_t = [v for v in tgts if not str(v).replace('.','',1).isdigit()]
print("non-numeric Tgt values:", non_numeric_t[:10])

print("\n=== offense: junk rows (where -9999 col == '-9999' or Player == 'Player') ===")
print(o[(o["-9999"] == "-9999") | (o["Player"] == "Player")][["Player","Pos","-9999"]].head(10))

print("\n=== combine: Drafted column + Ht format ===")
c = pd.read_csv(BASE / "Combine Tables" / "2024 combine.csv", header=0, encoding="utf-8-sig")
print(c[["Player","Ht","Drafted (tm/rnd/yr)"]].head(3))
