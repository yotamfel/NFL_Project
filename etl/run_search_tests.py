"""
Non-career test cases from NL_SEARCH_TEST_SUITE.md.pdf
Runs SQL directly against the DB and compares to expected values.
Usage: python run_search_tests.py
"""
import sys
from pathlib import Path

# Load DATABASE_URL from server/.env
_env = Path(__file__).parent.parent / "server" / ".env"
if _env.exists():
    import os
    for line in _env.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()
            break

sys.path.insert(0, str(Path(__file__).parent))
from db import get_engine
from sqlalchemy import text

engine = get_engine()

PASS  = "PASS  ✓"
FAIL  = "FAIL  ✗"
INFO  = "INFO  —"  # no fixed expected, just show value

def q(label, sql, check=None, info=False):
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(sql)).fetchall()
        val = rows[0][0] if rows and len(rows[0]) == 1 else rows
        if info:
            print(f"{INFO}  {label}: {val}")
        elif check is None:
            print(f"{INFO}  {label}: {val}")
        elif check(val):
            print(f"{PASS}  {label}: {val}")
        else:
            print(f"{FAIL}  {label}: got {val!r}")
    except Exception as e:
        print(f"FAIL  ✗  {label}: ERROR — {e}")


print("\n══════════════════════════════════════════")
print("  CATEGORY 2 — Single-season queries")
print("══════════════════════════════════════════")

q("Q8  Mahomes TDs 2022 (expect 41)",
  "SELECT ps.td FROM passing_seasons ps JOIN players p ON p.player_id = ps.player_id WHERE p.player_name ILIKE '%mahomes%' AND ps.season = 2022",
  lambda v: v == 41)

q("Q9  Rushing leader 2012 name (expect Adrian Peterson)",
  "SELECT p.player_name FROM offense_seasons os JOIN players p ON p.player_id = os.player_id WHERE os.season = 2012 ORDER BY os.rush_yds DESC LIMIT 1",
  lambda v: "peterson" in str(v).lower())

q("Q9  Rushing leader 2012 yards (expect 2097)",
  "SELECT os.rush_yds FROM offense_seasons os JOIN players p ON p.player_id = os.player_id WHERE os.season = 2012 ORDER BY os.rush_yds DESC LIMIT 1",
  lambda v: abs(v - 2097) <= 1)

q("Q10 Justin Jefferson rec_yds 2022 (expect 1809)",
  "SELECT os.rec_yds FROM offense_seasons os JOIN players p ON p.player_id = os.player_id WHERE p.player_name ILIKE '%jefferson%' AND os.season = 2022",
  lambda v: abs(v - 1809) <= 1)

q("Q11 Sacks leader 2023 name (expect Micah Parsons or check)",
  "SELECT p.player_name FROM defense_seasons ds JOIN players p ON p.player_id = ds.player_id WHERE ds.season = 2023 ORDER BY ds.sk DESC LIMIT 1",
  info=True)

q("Q11 Sacks leader 2023 sacks",
  "SELECT ds.sk FROM defense_seasons ds JOIN players p ON p.player_id = ds.player_id WHERE ds.season = 2023 ORDER BY ds.sk DESC LIMIT 1",
  info=True)

q("Q12 Burrow passing yards 2021 (expect 4611)",
  "SELECT ps.yds FROM passing_seasons ps JOIN players p ON p.player_id = ps.player_id WHERE p.player_name ILIKE '%burrow%' AND ps.season = 2021",
  lambda v: abs(v - 4611) <= 1)

q("Q13 Tyreek Hill rec_yds 2023",
  "SELECT os.rec_yds FROM offense_seasons os JOIN players p ON p.player_id = os.player_id WHERE p.player_name ILIKE '%tyreek%' AND os.season = 2023",
  info=True)


print("\n══════════════════════════════════════════")
print("  CATEGORY 3 — Leaderboards (non-career)")
print("══════════════════════════════════════════")

q("Q19 Most TDs single season last 10 years (expect Manning 2013=55 or check)",
  "SELECT p.player_name, ps.td, ps.season FROM passing_seasons ps JOIN players p ON p.player_id = ps.player_id WHERE ps.season >= 2015 ORDER BY ps.td DESC LIMIT 1",
  info=True)


print("\n══════════════════════════════════════════")
print("  CATEGORY 4 — Position filters")
print("══════════════════════════════════════════")

q("Q20 Best WR 2023 by rec_yds",
  "SELECT p.player_name, os.rec_yds FROM offense_seasons os JOIN players p ON p.player_id = os.player_id WHERE os.season = 2023 AND os.pos = 'WR' ORDER BY os.rec_yds DESC LIMIT 1",
  info=True)

q("Q21 R1 TEs drafted since 2015 (expect Hockenson, Pitts etc)",
  "SELECT player_name, draft_year, pick FROM draft WHERE pos = 'TE' AND round = 1 AND draft_year >= 2015 ORDER BY draft_year, pick",
  info=True)

q("Q22 Most rushing TDs 2022 (expect Derrick Henry near top)",
  "SELECT p.player_name, os.rush_td FROM offense_seasons os JOIN players p ON p.player_id = os.player_id WHERE os.season = 2022 ORDER BY os.rush_td DESC LIMIT 3",
  info=True)

q("Q23 Most INTs since 2018",
  """SELECT p.player_name, SUM(ds.int) as total_int
     FROM defense_seasons ds JOIN players p ON p.player_id = ds.player_id
     WHERE ds.season >= 2018
     GROUP BY p.player_name ORDER BY total_int DESC LIMIT 3""",
  info=True)


print("\n══════════════════════════════════════════")
print("  CATEGORY 5 — Cross-table JOINs")
print("══════════════════════════════════════════")

q("Q24 Mahomes draft pick (expect 10)",
  "SELECT d.pick FROM draft d JOIN players p ON p.player_id = d.player_id WHERE p.player_name ILIKE '%mahomes%'",
  lambda v: v == 10)

q("Q24 Mahomes draft year (expect 2017)",
  "SELECT d.draft_year FROM draft d JOIN players p ON p.player_id = d.player_id WHERE p.player_name ILIKE '%mahomes%'",
  lambda v: v == 2017)

q("Q25 Lamar Jackson height (expect 6_2)",
  "SELECT cs.ht FROM combine_seasons cs JOIN players p ON p.player_id = cs.player_id WHERE p.player_name ILIKE '%lamar jackson%'",
  lambda v: v == "6_2")

q("Q26 2017 R1 picks collective offense TDs",
  """SELECT SUM(oc.rec_td + oc.rush_td) as total_tds
     FROM draft d
     JOIN offense_career oc ON oc.player_id = d.player_id
     WHERE d.draft_year = 2017 AND d.round = 1""",
  info=True)

q("Q27 Players 1000+ rec_yds 2022 drafted after 2018",
  """SELECT p.player_name, os.rec_yds, d.draft_year
     FROM offense_seasons os
     JOIN players p ON p.player_id = os.player_id
     JOIN draft d ON d.player_id = p.player_id
     WHERE os.season = 2022 AND os.rec_yds >= 1000 AND d.draft_year > 2018
     ORDER BY os.rec_yds DESC LIMIT 10""",
  info=True)

q("Q28 Josh Allen avg offense snap pct 2022 (REG)",
  """SELECT ROUND(AVG(sc.offense_pct)::numeric * 100, 1)
     FROM snap_counts sc JOIN players p ON p.player_id = sc.player_id
     WHERE p.player_name ILIKE '%josh allen%' AND sc.season = 2022 AND sc.game_type = 'REG'""",
  info=True)

q("Q29 Best avg CPOE since 2020 (top 3)",
  """SELECT p.player_name, ROUND(AVG(ng.cpoe)::numeric, 2) as avg_cpoe
     FROM ngs_passing ng JOIN players p ON p.player_id = ng.player_id
     WHERE ng.season >= 2020
     GROUP BY p.player_name ORDER BY avg_cpoe DESC LIMIT 3""",
  info=True)


print("\n══════════════════════════════════════════")
print("  CATEGORY 6 — Edge cases")
print("══════════════════════════════════════════")

q("Q31 Tallest QB drafted (height format test)",
  """SELECT d.player_name, cs.ht,
          split_part(cs.ht,'_',1)::int * 12 + split_part(cs.ht,'_',2)::int AS inches
     FROM combine_seasons cs
     JOIN draft d ON d.player_id = cs.player_id
     WHERE d.pos = 'QB' AND cs.ht IS NOT NULL
     ORDER BY inches DESC LIMIT 1""",
  info=True)

q("Q32 Will Campbell games (expect null/0 — no box-score stats)",
  """SELECT COALESCE(SUM(os.g), 0) FROM draft d
     LEFT JOIN offense_seasons os ON os.player_id = d.player_id
     WHERE d.player_name ILIKE '%will campbell%'""",
  lambda v: v == 0)

q("Q36 Player count (expect ~11627)",
  "SELECT COUNT(*) FROM players",
  lambda v: 10000 < v < 15000)

q("Q37 Most picks 2020 draft (top team)",
  "SELECT team, COUNT(*) as picks FROM draft WHERE draft_year = 2020 GROUP BY team ORDER BY picks DESC LIMIT 3",
  info=True)

q("Q38 Antonio Brown drop_pct 2018",
  """SELECT ar.drop_pct FROM adv_receiving ar
     JOIN players p ON p.player_id = ar.player_id
     WHERE p.player_name ILIKE '%antonio brown%' AND ar.season = 2018""",
  info=True)

q("Q39 Best RYOE per att 2021 (top 3)",
  """SELECT p.player_name, nr.ryoe_per_att
     FROM ngs_rushing nr JOIN players p ON p.player_id = nr.player_id
     WHERE nr.season = 2021 ORDER BY nr.ryoe_per_att DESC LIMIT 3""",
  info=True)

q("Q40 Aaron Donald questionable appearances 2019",
  """SELECT COUNT(*) FROM injuries i
     JOIN players p ON p.player_id = i.player_id
     WHERE p.player_name ILIKE '%aaron donald%'
       AND i.season = 2019 AND i.report_status = 'Questionable'""",
  info=True)


print("\n══════════════════════════════════════════")
print("  REGRESSION TESTS (R2, R5, R6 logic, R7)")
print("══════════════════════════════════════════")

q("R2  Rushing leader 2012 (expect Adrian Peterson 2097)",
  "SELECT p.player_name, os.rush_yds FROM offense_seasons os JOIN players p ON p.player_id = os.player_id WHERE os.season = 2012 ORDER BY os.rush_yds DESC LIMIT 1",
  lambda v: isinstance(v, list) and "peterson" in str(v[0]).lower())

q("R5  Mahomes draft pick (expect 10, 2017, R1)",
  "SELECT d.pick, d.draft_year, d.round FROM draft d JOIN players p ON p.player_id = d.player_id WHERE p.player_name ILIKE '%mahomes%'",
  info=True)

q("R7  Player count (expect ~11627)",
  "SELECT COUNT(*) FROM players",
  lambda v: 10000 < v < 15000)

print()
