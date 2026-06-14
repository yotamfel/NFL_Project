import { useState } from 'react'

const useLang = () => {
  const [lang, setLang] = useState(() => localStorage.getItem('helpLang') ?? 'en')
  const set = l => { setLang(l); localStorage.setItem('helpLang', l) }
  return [lang, set]
}

// ─── content ─────────────────────────────────────────────────────────────────

const CONTENT = {
  en: {
    title: 'Platform Guide',
    toc: 'Contents',
    sections: [
      {
        id: 'players',
        icon: '🔍',
        title: 'Player Search',
        subsections: [
          {
            title: 'How to search',
            body: 'Type any part of a player\'s name in the main search box. Results appear instantly — click any row to open the full player profile.',
          },
          {
            title: 'Filters',
            body: 'Below the search box you can filter by Position, Season active, and Team without typing a name at all. Combine filters freely — e.g., "all WRs who played for the Cowboys in 2022".',
          },
          {
            title: 'Quick search (nav bar)',
            body: 'The search box in the top navigation bar is always available and takes you directly to a player\'s profile from any page.',
          },
        ],
      },
      {
        id: 'profile',
        icon: '📋',
        title: 'Player Profile',
        subsections: [
          {
            title: 'Header card',
            body: 'Shows position, active years, and number of seasons. If the player was drafted, you\'ll see round, pick, year, team, college, and Career AV. Combine measurements (height, weight, 40-yard dash, vertical, broad jump, bench, 3-cone, shuttle) are shown if available. Use the ★ button to save the player to your Saved list.',
          },
          {
            title: 'Stats tables — Basic / Advanced',
            body: 'Each stat category (Passing, Offense, Defense, Kicking, Punting, Returns) has a Basic and an Advanced view. Toggle with the buttons above the table. Hover any column header (look for the ⓘ icon) to see a full definition of that stat. This works on all tables in the profile — including Advanced Receiving and Next Gen Stats. Scroll tables horizontally if needed.',
          },
          {
            title: 'Career charts',
            body: 'Charts above each table show career trend lines. Each line has a colored dropdown — click it to switch to any other stat from the table (including Advanced stats). Defaults are pre-selected to the most meaningful metrics. Red shaded bands mark seasons where the player missed 4 or more games due to injury.',
          },
          {
            title: 'Injury History (2009+)',
            body: [
              'G column — shows games played vs. games expected that season (e.g. 5/16). A low number signals a long absence even if the weekly injury report has few entries.',
              'Missed column — the larger of: (1) games officially listed as Out on the weekly injury report, or (2) estimated missed games calculated from games played. When the estimate is used, a † mark appears.',
              '† (estimated) — the player likely went on IR mid-season. The weekly injury report stops listing IR players, so this column fills the gap.',
              'Doubtful / Quest. — count of games listed as Doubtful or Questionable on the official report.',
              'Injury badges — body parts flagged in weekly reports (Knee, Hamstring, etc.).',
              'Career charts show red shaded bands for seasons with 4+ missed games (official or estimated).',
            ],
          },
          {
            title: 'Advanced Receiving (WR / TE / RB) — PFR 2018+, NGS 2016+',
            body: [
              'ADOT — Average Depth of Target: how deep (in yards) the ball travels in the air on passes thrown to this receiver.',
              'YAC/Rec — Yards After Catch per reception.',
              'YBC/Rec — Yards Before Catch per reception (air yards on completions).',
              'BrkTkl — Broken tackles after the catch.',
              'Drop% — Percentage of catchable targets that were dropped.',
              'TgtRtg — Passer Rating when this player is the intended target.',
              'Sep — Average separation (ft) from the nearest defender at the moment of the throw. Higher = more open. (Next Gen Stats)',
              'Cush — Average cushion (ft) between receiver and corner at the snap. (Next Gen Stats)',
              'YAC+ — Yards After Catch above expectation per reception. Positive = better than expected. (Next Gen Stats)',
            ],
          },
          {
            title: 'Next Gen Stats — QB Passing (2016+)',
            body: [
              'TT — Avg Time to Throw (seconds): how long the QB holds the ball before releasing it.',
              'IAY — Avg Intended Air Yards: average depth of all pass attempts (completed or not).',
              'CAY — Avg Completed Air Yards: average air yards on completions only.',
              'ADOTS — Avg Air Yards to the Sticks: how far past (or short of) the first-down marker the QB targets.',
              'Aggr% — Aggressiveness: percentage of throws into tight windows (≤1 yard of separation). Higher = more aggressive.',
              'CPOE — Completion % Over Expected: how much better (or worse) the QB\'s completion rate is vs. what the model predicts given the difficulty of each throw. The best single metric for true QB accuracy.',
              'MaxDist — Maximum completed air distance in a single game that season.',
            ],
          },
          {
            title: 'Next Gen Stats — RB Rushing (2016+)',
            body: [
              'Eff — NGS Rushing Efficiency Score: composite metric for how efficiently the back uses blockers and hits gaps.',
              'TLOS — Avg Time to Line of Scrimmage (seconds): how quickly the back reaches the LOS. Lower can indicate decisive running.',
              'RYOE/A — Rush Yards Over Expected per Attempt: how many yards the runner gains above what an average back would given the same blocking situation. The best single metric for true RB impact.',
              'RPOE% — Rush % Over Expected: similar to RYOE but as a rate.',
              '8-Box% — Percentage of rush attempts where 8 or more defenders were in the box. Higher = the offense faced stacked fronts.',
            ],
          },
          {
            title: 'Snap Counts (2013+)',
            body: 'Shows what percentage of the team\'s offensive, defensive, or special-teams snaps the player was on the field for. Use the season dropdown to see a week-by-week breakdown for any season, or scroll down to see the career trend. A sudden drop in snap% is often an early sign of injury, role change, or decline.',
          },
          {
            title: 'AI Career Insights',
            body: 'At the bottom of every player profile, click "Generate Insights" to get a Claude-written 3–5 sentence analytical paragraph about the player\'s career. The narrative covers key stats, career trajectory, and interesting observations. Results are cached for 24 hours so repeat visits load instantly. Rate the insight with 👍 or 👎 to help improve future responses.',
          },
        ],
      },
      {
        id: 'comparison',
        icon: '⚖️',
        title: 'Player Comparison',
        subsections: [
          {
            title: 'Adding players',
            body: 'Click "+ Add player" and type a name to search. Add up to 4 players. The first player\'s position auto-sets the stat category. Remove any player with the × on their chip.',
          },
          {
            title: 'Career vs. Single Season',
            body: 'Toggle between "Career totals" (all regular-season games combined) and "Single season" to compare a specific year. When Single Season is active, a dropdown lets you pick the year.',
          },
          {
            title: 'Category & stat view',
            body: 'Use the category dropdown (top right) to switch between Passing, Offense, Defense, Kicking, Punting, and Returns. Toggle "Basic / All stats" above the table to expand to the full stat set.',
          },
          {
            title: 'Leaderboard',
            body: 'Always visible at the bottom of the page. Shows the top 20 players for any stat in the selected category and time scope. Use the stat dropdown to switch metrics. Players you have added to the comparison are highlighted in gold.',
          },
          {
            title: 'Advanced filters (Add player panel)',
            body: 'Expand "Filters" inside the Add Player panel to filter search results by position, season active, or stat threshold. The stat filter (category + stat + minimum value) ranks results by that stat so you can quickly find, say, all WRs with 1,000+ receiving yards in a single season.',
          },
          {
            title: 'AI Comparison Narrative',
            body: 'Once you have comparison data loaded, click "Generate Narrative" below the stats table. Claude writes a 4–6 sentence analytical paragraph comparing the players across key metrics, noting who leads in each stat and giving an overall verdict. Rate it with 👍 or 👎.',
          },
        ],
      },
      {
        id: 'draft',
        icon: '🎯',
        title: 'Draft Analysis',
        subsections: [
          {
            title: 'Browse draft picks',
            body: 'The default view shows all draft picks with their round, pick number, position, college, team, draft year, and Career AV. Filter by team, draft year, and position using the controls at the top. Click any player\'s name to open their full profile.',
          },
          {
            title: 'Career AV',
            body: 'Career Approximate Value is Pro Football Reference\'s position-neutral career quality metric. It accounts for games started, Pro Bowls, All-Pro selections, and position-specific production. It is not perfect, but it is the best single number for comparing career value across positions.',
          },
          {
            title: 'Custom Query',
            body: 'Switch to the "Custom" tab to build your own filter. Set a round threshold (e.g., "Round ≤ 3"), a stat threshold (e.g., "Career AV ≥ 60"), and optionally filter by position. You can also pick a specific stat from Passing, Offense, or Defense categories instead of Career AV, and choose Career totals or Single Season scope.',
          },
          {
            title: 'Steals & Busts',
            body: [
              'Steals: Players drafted in round 4 or later who achieved a Career AV of 50 or more. These are players who were significantly undervalued on draft day.',
              'Busts: Players drafted in rounds 1–2 who achieved a Career AV of 15 or less. High draft capital with very little return.',
              'The steal/bust thresholds apply to the currently selected stat category and stat when you switch away from Career AV — so you can find, for example, late-round QBs with high passing yardage totals.',
            ],
          },
          {
            title: 'Steal/Bust Recommendations',
            body: 'The Recommendations box under each steal/bust list shows players who statistically look like a steal or bust candidate based on their combine measurements vs. their Career AV. The model uses a regression trained on combine data (40 time, vertical, weight, etc.) to predict expected Career AV. A player with actual AV much higher than predicted = steal. Much lower = bust.',
          },
          {
            title: 'Round Stats',
            body: 'The "Round Stats" tab shows the average and median Career AV (or selected stat) for each draft round. This gives context for what you should realistically expect from picks at each round.',
          },
        ],
      },
      {
        id: 'trends',
        icon: '📈',
        title: 'League Trends',
        subsections: [
          {
            title: 'Season Trend chart',
            body: 'Shows how a selected stat has changed league-wide across seasons. Use the Category and Stat dropdowns to pick any metric (e.g., total passing yards per season across the whole league). Filter by Position and Season range to narrow the scope. The Aggregation toggle switches between Sum (total across all players) and Average (per player).',
          },
          {
            title: 'By Team chart',
            body: 'Switches to a horizontal bar chart showing the same stat broken down by team for the selected period. Bars are colored with official NFL team colors. Hover a bar to see the exact value. The table below lists all teams with their totals.',
          },
          {
            title: 'Season breakdown table',
            body: 'Below the chart, a table shows the value for each season in the selected range, useful for spotting year-over-year changes.',
          },
        ],
      },
      {
        id: 'smart',
        icon: '🤖',
        title: 'Smart Search',
        subsections: [
          {
            title: 'How it works',
            body: 'Type any question in natural English or Hebrew. The AI (Claude) translates your question into a SQL query and runs it directly against the database. Results appear as a table below.',
          },
          {
            title: 'Example questions',
            body: [
              'Who has the most passing yards since 2015?',
              'Top 10 WRs by receiving touchdowns in 2022',
              'Which QBs had a passer rating above 110 in a single season?',
              'Best Career AV for undrafted players',
              'All players drafted by the Patriots in round 1',
            ],
          },
          {
            title: 'View the SQL',
            body: 'Expand "Generated SQL" below the answer to see the exact query that was run. This is useful for understanding what the AI interpreted, and for debugging unexpected results.',
          },
          {
            title: 'Limitations',
            body: 'The AI only has access to data in this database (2000–2025, standard season stats + combine + draft). It cannot answer questions about play-by-play events, individual game logs, or real-time data. If it cannot find the data, it will say so.',
          },
          {
            title: 'Feedback',
            body: 'After each search result appears, use the 👍 / 👎 buttons (left of "Save result") to rate the answer. Your vote is stored and helps improve the AI\'s accuracy over time.',
          },
        ],
      },
      {
        id: 'anomalies',
        icon: '📡',
        title: 'Season Highlights',
        subsections: [
          {
            title: 'What are anomaly alerts?',
            body: 'The "Statistical Anomalies" section on the homepage surfaces players who are having statistically unusual seasons. The ETL runs every Wednesday during the regular season and pulls cumulative season-to-date stats from PFR — the anomaly engine re-runs immediately after, so alerts always reflect the most recently played week. Outside the season (March–August) they show the previous full season.',
          },
          {
            title: 'Alert types',
            body: [
              'Career High — cumulative season stats have already surpassed the player\'s previous career best in that metric. During the season this can trigger mid-year if a player is on a record pace.',
              'YoY Surge — stats are 40%+ higher than the same player\'s stats in the prior season. Catches breakout years and comeback stories.',
              'Efficiency — a rate stat (Passer Rating, Y/A, Y/Rec, Y/Carry) is 1.5+ standard deviations above the player\'s career average. Highlights players who are more efficient, not just more productive.',
              'Versatile — player contributed meaningfully in two categories: 300+ rushing yards AND 300+ receiving yards (dual-threat backs), or 200+ pass attempts AND 50+ rush attempts (dual-threat QBs).',
              'Above Avg — counting stat is 1.5+ standard deviations above career mean.',
              'Decline — counting stat is 1.5+ standard deviations below career mean. Flags significant drop-offs.',
            ],
          },
          {
            title: 'Filters',
            body: 'Use the filter chips (All / Career Highs / YoY Surge / Efficiency / Versatile / Above Avg / Decline) to focus on a specific alert type. The feed re-loads instantly on each selection.',
          },
          {
            title: 'Severity stars',
            body: [
              '★★ — Impressive: career high by 10%+, surge of 60%+, or efficiency 2σ above average.',
              '★★★ — Remarkable: career high by 30%+, surge of 100%+, efficiency 3σ above average, or dual-threat with 700+ yards in both categories.',
            ],
          },
          {
            title: 'Tracked metrics',
            body: 'Counting stats: passing yards/TDs, rushing yards/TDs, receiving yards/TDs, sacks, interceptions, passes defended, combined tackles. Rate stats: passer rating, yards per attempt, yards per reception, yards per carry. Volume thresholds apply (e.g. 200+ pass attempts for QBs) to filter out small-sample noise.',
          },
        ],
      },
      {
        id: 'saved',
        icon: '★',
        title: 'Saved',
        subsections: [
          {
            title: 'Saved players',
            body: 'Players you bookmark with the ★ button on their profile appear here. Click the name to go to their profile.',
          },
          {
            title: 'Notes on saved items',
            body: 'Every saved item (player, comparison, or search) can have a personal note. Click "+ Add a note…" below the item to write one. Click an existing note to edit it. Notes save automatically when you press Enter, click Save, or click away. Press Escape to cancel.',
          },
          {
            title: 'Saved comparisons',
            body: 'After building a comparison, click "Save comparison" to store it. It appears here with the player names and category. Click it to reload the comparison instantly.',
          },
          {
            title: 'Saved searches',
            body: 'Smart Search results can be saved. Each saved search shows the original question, the SQL, and the result table. Expand any entry to review.',
          },
          {
            title: 'Notes tab',
            body: 'The Notes tab is a free-form scratchpad. Type anything and press Enter (or click Save) to add a note. Click any existing note to edit it — it opens as a text area; Enter saves, Shift+Enter adds a new line, Escape cancels. Delete a note with the × button.',
          },
        ],
      },
      {
        id: 'glossary',
        icon: '📖',
        title: 'Stats Glossary',
        subsections: [
          {
            title: 'General',
            body: [
              'G — Games played',
              'Career AV — Career Approximate Value (Pro Football Reference composite career quality score)',
            ],
          },
          {
            title: 'Passing',
            body: [
              'Cmp / Att — Completions / Attempts',
              'Cmp% — Completion percentage',
              'Yds — Passing yards',
              'TD — Passing touchdowns',
              'INT — Interceptions thrown',
              'Rate — Traditional NFL passer rating (0–158.3 scale)',
              'QBR — ESPN\'s Total QBR (0–100 scale, accounts for all QB contributions)',
              'Y/A — Yards per attempt',
              'AY/A — Adjusted yards per attempt (bonuses for TDs, penalties for INTs)',
              'ANY/A — Adjusted Net Yards per Attempt (also subtracts sack yardage)',
              'Sk% — Percentage of dropbacks that ended in a sack',
              '4QC — 4th-quarter comebacks led',
              'GWD — Game-winning drives led',
            ],
          },
          {
            title: 'Receiving / Offense',
            body: [
              'Rec — Receptions',
              'Tgt — Targets (passes thrown at the receiver)',
              'Ctch% — Catch rate (Rec / Tgt)',
              'Y/Rec — Yards per reception',
              'Y/Tgt — Yards per target',
              'RecFD — Receiving first downs',
              'Att — Rush attempts (carries)',
              'RushYds — Rushing yards',
              'Y/Carry — Yards per carry',
              'RushFD — Rushing first downs',
              'Fmb — Fumbles',
              'ScrmYds — Scrimmage yards (receiving + rushing combined)',
            ],
          },
          {
            title: 'Defense',
            body: [
              'Tkl (Comb) — Combined tackles (solo + assisted)',
              'Solo — Solo tackles',
              'Ast — Assisted tackles',
              'TFL — Tackles for loss',
              'Sacks — Quarterback sacks',
              'QB Hits — Times the QB was hit (sacks + hurries)',
              'INT — Interceptions',
              'PD — Pass deflections (broken up passes)',
              'FF — Forced fumbles',
              'FR — Fumble recoveries',
              'Pick-6 (INT TD) — Interception returned for a touchdown',
              'Sfty — Safeties',
            ],
          },
          {
            title: 'Kicking',
            body: [
              'FGM / FGA — Field goals made / attempted',
              'FG% — Field goal percentage',
              'XPM / XPA — Extra points made / attempted',
              'KO — Kickoffs',
              'KO Avg — Average kickoff distance',
              'TB — Touchbacks',
              'TB% — Touchback percentage on kickoffs',
            ],
          },
          {
            title: 'Punting',
            body: [
              'Punts — Number of punts',
              'Y/Punt — Gross yards per punt',
              'Net Y/Punt — Net yards per punt (accounts for return yards)',
              'In20 — Punts downed inside the opponent\'s 20-yard line',
              'TB — Punts resulting in a touchback',
              'Blk — Blocked punts',
            ],
          },
          {
            title: 'Returns',
            body: [
              'PR / KR — Punt returns / Kick returns',
              'Y/PR / Y/KR — Yards per punt return / kick return',
              'PR TD / KR TD — Touchdowns on returns',
              'All-Purpose Yds — Total yards from receiving + rushing + returns combined',
            ],
          },
        ],
      },
    ],
  },

  he: {
    title: 'מדריך למשתמש',
    toc: 'תוכן עניינים',
    sections: [
      {
        id: 'players',
        icon: '🔍',
        title: 'חיפוש שחקנים',
        subsections: [
          {
            title: 'איך לחפש',
            body: 'הקלד חלק מהשם של השחקן בתיבת החיפוש הראשית. התוצאות מופיעות מיידית — לחץ על שורה כלשהי לפתיחת הפרופיל המלא.',
          },
          {
            title: 'פילטרים',
            body: 'מתחת לתיבת החיפוש ניתן לסנן לפי Position (עמדה), Season (שנה שהשחקן היה פעיל בה) ו-Team (קבוצה) — ללא צורך להקליד שם בכלל. שלב פילטרים בחופשיות, למשל: "כל WRs שיחקו ב-Cowboys ב-2022".',
          },
          {
            title: 'Quick Search (סרגל ניווט)',
            body: 'תיבת החיפוש בסרגל הניווט העליון זמינה בכל עמוד ומפנה ישירות לפרופיל השחקן.',
          },
        ],
      },
      {
        id: 'profile',
        icon: '📋',
        title: 'פרופיל שחקן',
        subsections: [
          {
            title: 'כרטיס כותרת',
            body: 'מציג Position, שנות פעילות ומספר עונות. אם השחקן נדרפט — מוצגים Round, Pick, שנה, קבוצה, מכללה ו-Career AV. מדדי Combine (גובה, משקל, 40-yard dash, Vertical, Broad Jump, Bench, 3-Cone, Shuttle) מוצגים אם קיימים. כפתור ★ שומר את השחקן ברשימת Saved.',
          },
          {
            title: 'טבלאות סטטיסטיקה — Basic / Advanced',
            body: 'כל קטגוריית סטטיסטיקה (Passing, Offense, Defense, Kicking, Punting, Returns) מגיעה בתצוגה Basic ו-Advanced. החלף ביניהן עם הכפתורים מעל הטבלה. עמוד על כותרת עמודה (חפש את סמל ⓘ) לקבלת הגדרה מלאה של הסטטיסטיקה — עובד בכל הטבלאות בפרופיל, כולל Advanced Receiving ו-Next Gen Stats. ניתן לגלול את הטבלה ימינה אם רחבה מדי.',
          },
          {
            title: 'Career Charts',
            body: 'הגרפים מעל כל טבלה מציגים קווי מגמה של הקריירה. לכל קו יש Dropdown צבעוני — לחץ עליו כדי לעבור לכל Stat אחר מהטבלה (כולל Advanced). ברירות המחדל מראש הן המדדים המשמעותיים ביותר. פסים אדומים מסמנים עונות שבהן השחקן החסיר 4 משחקים ומעלה עקב פציעה.',
          },
          {
            title: 'Injury History — היסטוריית פציעות (2009+)',
            body: [
              'עמודת G — משחקים שהשחקן שיחק מתוך הצפוי באותה עונה (למשל 5/16). מספר נמוך מצביע על היעדרות ארוכה גם אם אין רישומים רשמיים.',
              'עמודת Missed — הגבוה מבין: (1) משחקים שהשחקן רוּשם כ-Out בדוח השבועי, או (2) משחקים חסרים מוערכים מתוך נתוני G. כשנעשה שימוש בהערכה מופיע סימן †.',
              '† (מוערך) — השחקן כנראה נכנס ל-IR (Injured Reserve) באמצע העונה. דוח הפציעות השבועי מפסיק לציין שחקני IR, ולכן העמודה הזו ממלאת את הפער.',
              'Doubtful / Quest. — מספר משחקים שהשחקן נרשם כ-Doubtful או Questionable בדוח הרשמי.',
              'תגיות פציעה — איברי גוף שסומנו בדוחות השבועיים (Knee, Hamstring וכד\').',
              'גרפי קריירה מציגים פסים אדומים בעונות עם 4+ משחקים חסרים (רשמי או מוערך).',
            ],
          },
          {
            title: 'Advanced Receiving — WR / TE / RB (PFR 2018+, NGS 2016+)',
            body: [
              'ADOT — Average Depth of Target: עומק ממוצע של הזריקה (ביארדים) על מסירות שנשלחו לרצפטור הזה.',
              'YAC/Rec — Yards After Catch per reception: יארדים לאחר הקליטה לכל קליטה.',
              'YBC/Rec — Yards Before Catch per reception: ה-Air Yards של השלמות בלבד.',
              'BrkTkl — Broken Tackles: מגעי הגנה שנשברו לאחר הקליטה.',
              'Drop% — אחוז הזריקות הקלוטות שנפלו.',
              'TgtRtg — Passer Rating כשהשחקן הזה הוא המטרה המיועדת.',
              'Sep — ממוצע המרחק (ברגליים) מהמגן הקרוב ברגע הזריקה. גבוה יותר = פתוח יותר. (Next Gen Stats)',
              'Cush — Cushion: המרחק הממוצע בין הRB/WR לCB בתחילת כל סנאפ. (Next Gen Stats)',
              'YAC+ — Yards After Catch מעל הציפייה לכל קליטה. חיובי = טוב מהצפוי. (Next Gen Stats)',
            ],
          },
          {
            title: 'Next Gen Stats — QB Passing (2016+)',
            body: [
              'TT — Avg Time to Throw: זמן ממוצע (בשניות) שהQB מחזיק בכדור לפני הזריקה.',
              'IAY — Avg Intended Air Yards: עומק ממוצע של כל ניסיון מסירה (כולל אי-השלמות).',
              'CAY — Avg Completed Air Yards: Air Yards ממוצע על השלמות בלבד.',
              'ADOTS — Avg Air Yards to the Sticks: כמה יארדים מעל (או מתחת) לסימן ה-First Down הQB מכוון.',
              'Aggr% — Aggressiveness: אחוז הזריקות לחלונות צרים (פחות מ-1 יארד Separation). גבוה יותר = אגרסיבי יותר.',
              'CPOE — Completion % Over Expected: כמה אחוזי השלמה מעל (או מתחת) למה שהמודל מנבא בהתאם לקושי הזריקות. המדד הטוב ביותר לדיוק אמיתי של QB.',
              'MaxDist — המרחק המקסימלי של השלמה יחידה באותה עונה.',
            ],
          },
          {
            title: 'Next Gen Stats — RB Rushing (2016+)',
            body: [
              'Eff — NGS Rushing Efficiency Score: מדד מורכב ליעילות הריצה.',
              'TLOS — Avg Time to Line of Scrimmage: כמה שניות לוקח לRB להגיע לקו ה-LOS. נמוך יותר יכול לסמן ריצה נחושה.',
              'RYOE/A — Rush Yards Over Expected per Attempt: יארדים מעל הציפייה לניסיון ריצה. המדד הטוב ביותר להשפעת RB אמיתית.',
              'RPOE% — Rush % Over Expected: דומה ל-RYOE כשיעור.',
              '8-Box% — אחוז ניסיונות הריצה מול 8 מגנים ומעלה בקופסה. גבוה = ההתקפה נתקלה בחזיתות דחוסות.',
            ],
          },
          {
            title: 'Snap Counts (2013+)',
            body: 'מציג איזה אחוז מה-Snaps של הקבוצה השחקן היה על המגרש. השתמש ב-Dropdown של העונה לפירוט שבועי, או גלול למטה לראות את מגמת הקריירה. ירידה פתאומית ב-Snap% היא לעיתים קרובות אינדיקציה מוקדמת לפציעה, שינוי תפקיד או ירידה.',
          },
          {
            title: 'AI Career Insights — תובנות קריירה',
            body: 'בתחתית כל פרופיל שחקן, לחץ "Generate Insights" לקבלת פסקת ניתוח של 3–5 משפטים שנכתבה על ידי Claude. הניתוח מכסה נתוני מפתח, מסלול הקריירה, ותצפיות מעניינות. התוצאות שמורות במטמון ל-24 שעות. דרג את הניתוח עם 👍 או 👎.',
          },
        ],
      },
      {
        id: 'comparison',
        icon: '⚖️',
        title: 'השוואת שחקנים',
        subsections: [
          {
            title: 'הוספת שחקנים',
            body: 'לחץ על "+ Add player" וחפש לפי שם. ניתן להוסיף עד 4 שחקנים. ה-Category נקבע אוטומטית לפי ה-Position של השחקן הראשון. הסר שחקן עם × על ה-chip שלו.',
          },
          {
            title: 'Career vs. Single Season',
            body: 'עבור בין "Career totals" (סה"כ כל המשחקים הרגולריים) ל-"Single Season" להשוואת עונה ספציפית. כשסינגל-סיזון פעיל, Dropdown מאפשר בחירת השנה.',
          },
          {
            title: 'Category ותצוגת Stat',
            body: 'השתמש ב-Dropdown של הקטגוריה (Passing, Offense, Defense, Kicking, Punting, Returns) כדי לעבור בין סוגי סטטיסטיקה. Toggle "Basic / All stats" מעל הטבלה מרחיב לכלל הסטטיסטיקות.',
          },
          {
            title: 'Leaderboard',
            body: 'תמיד גלוי בתחתית העמוד. מציג 20 השחקנים המובילים בכל Stat בקטגוריה ובטווח הזמן שנבחרו. עבור בין Metrics עם ה-Dropdown של הסטטיסטיקה. שחקנים שהוספת להשוואה מסומנים בזהב.',
          },
          {
            title: 'Advanced Filters (פאנל הוספת שחקן)',
            body: 'פתח "Filters" בפאנל הוספת שחקן לסינון לפי Position, עונה, או ספי Stat. פילטר הסטטיסטיקה (Category + Stat + ערך מינימלי) מדרג תוצאות לפי הסטטיסטיקה הנבחרת — למשל: כל WRs עם 1,000+ ReceivingYards בעונה אחת.',
          },
          {
            title: 'AI Comparison Narrative — נרטיב השוואה',
            body: 'לאחר טעינת נתוני ההשוואה, לחץ "Generate Narrative" מתחת לטבלת הסטטיסטיקה. Claude כותב פסקת ניתוח של 4–6 משפטים המשווה בין השחקנים על פני מדדי מפתח, מציין מי מוביל בכל סטטיסטיקה ונותן פסיקה כוללת. דרג עם 👍 או 👎.',
          },
        ],
      },
      {
        id: 'draft',
        icon: '🎯',
        title: 'ניתוח Draft',
        subsections: [
          {
            title: 'גלישת בחירות Draft',
            body: 'התצוגה הראשונית מציגה את כל בחירות ה-Draft עם Round, Pick, Position, College, Team, שנה ו-Career AV. סנן לפי קבוצה, שנת Draft ו-Position. לחץ על שם שחקן לפתיחת הפרופיל.',
          },
          {
            title: 'Career AV',
            body: 'Career Approximate Value הוא מדד איכות קריירה ניטרלי-עמדה של Pro Football Reference. הוא מביא בחשבון משחקים מופיעים, Pro Bowls, All-Pro ועוד. הוא לא מושלם, אך הוא המספר היחיד הטוב ביותר להשוואת ערך קריירה בין עמדות שונות.',
          },
          {
            title: 'Custom Query',
            body: 'עבור ל-Tab "Custom" לבניית פילטר מותאם אישית. הגדר סף Round (למשל "Round ≤ 3"), סף Stat (למשל "Career AV ≥ 60"), ואופציונלית Position. ניתן גם לבחור Stat ספציפי מקטגוריות Passing, Offense או Defense במקום Career AV, ולבחור Career totals או Single Season.',
          },
          {
            title: 'Steals & Busts',
            body: [
              'Steals ("גנבות"): שחקנים שנדרפטו בסיבוב 4 ומעלה והשיגו Career AV של 50 ומעלה. אלה שחקנים שנמוך מאוד הוערכו ביום ה-Draft.',
              'Busts ("כישלונות"): שחקנים שנדרפטו בסיבובים 1–2 והשיגו Career AV של 15 ומטה. השקעת Draft גבוהה עם תשואה נמוכה מאוד.',
              'הספים חלים גם על ה-Stat שנבחר אם עברת מ-Career AV לסטטיסטיקה אחרת.',
            ],
          },
          {
            title: 'Recommendations — המלצות Steal/Bust',
            body: 'תיבת ה-Recommendations מתחת לכל רשימה מציגה שחקנים שנראים כמועמדים ל-Steal או Bust לפי מדדי ה-Combine שלהם מול ה-Career AV בפועל. המודל משתמש ב-Regression שאומן על נתוני Combine (40 Time, Vertical, Weight וכד\') לחיזוי Career AV צפוי. AV בפועל גבוה בהרבה מהצפוי = Steal. נמוך בהרבה = Bust.',
          },
          {
            title: 'Round Stats',
            body: 'Tab "Round Stats" מציג את הממוצע והחציון של Career AV (או הסטטיסטיקה שנבחרה) לפי כל סיבוב Draft. מספק הקשר לציפיות ריאליות מבחירות בכל סיבוב.',
          },
        ],
      },
      {
        id: 'trends',
        icon: '📈',
        title: 'League Trends',
        subsections: [
          {
            title: 'Season Trend',
            body: 'מציג כיצד Stat נבחר השתנה ברחבי הליגה לאורך עונות. בחר Category ו-Stat ב-Dropdowns. סנן לפי Position וטווח שנים. ה-Toggle Aggregation עובר בין Sum (סה"כ כל השחקנים) ל-Average (לשחקן).',
          },
          {
            title: 'By Team',
            body: 'עובר לתרשים עמודות אופקיות המציג את אותו Stat לפי קבוצה לתקופה הנבחרת. העמודות צבועות בצבעי ה-NFL הרשמיים. עמוד על עמודה לצפייה בערך המדויק. טבלה מתחת מציגה את כל הקבוצות.',
          },
          {
            title: 'Season Breakdown',
            body: 'טבלה מתחת לגרף מציגה את הערך לכל עונה בטווח הנבחר — שימושית לזיהוי שינויים משנה לשנה.',
          },
        ],
      },
      {
        id: 'smart',
        icon: '🤖',
        title: 'Smart Search',
        subsections: [
          {
            title: 'איך זה עובד',
            body: 'הקלד שאלה חופשית בעברית או אנגלית. ה-AI (Claude) מתרגם את השאלה ל-SQL ומריץ אותה ישירות מול בסיס הנתונים. התוצאות מופיעות כטבלה.',
          },
          {
            title: 'דוגמאות לשאלות',
            body: [
              'מי צבר הכי הרבה Passing Yards מאז 2015?',
              '10 WRs המובילים ב-Receiving Touchdowns ב-2022',
              'אילו QBs השיגו Passer Rating מעל 110 בעונה אחת?',
              'הטוב ביותר Career AV לשחקנים שלא נדרפטו',
              'כל השחקנים שנדרפטו ע"י ה-Patriots בסיבוב 1',
            ],
          },
          {
            title: 'צפייה ב-SQL',
            body: 'פתח "Generated SQL" מתחת לתשובה לצפייה בשאילתה המדויקת שהורצה. שימושי להבנת מה ה-AI פירש, ולאיתור תוצאות בלתי צפויות.',
          },
          {
            title: 'מגבלות',
            body: 'ה-AI ניגש רק לנתונים שבבסיס הנתונים (2000–2025, סטטיסטיקות עונה רגילה + Combine + Draft). הוא לא יכול לענות על שאלות Play-by-Play, Game Logs פרטניים, או נתונים בזמן אמת. אם הנתון לא קיים, הוא יאמר זאת ישירות.',
          },
          {
            title: 'Feedback — משוב',
            body: 'לאחר שהתוצאה מופיעה, השתמש בכפתורי 👍 / 👎 (משמאל לכפתור "Save result") לדירוג התשובה. ההצבעה נשמרת ועוזרת לשפר את דיוק ה-AI לאורך זמן.',
          },
        ],
      },
      {
        id: 'anomalies',
        icon: '📡',
        title: 'Season Highlights — חריגות סטטיסטיות',
        subsections: [
          {
            title: 'מה זה Anomaly Alerts?',
            body: 'החלק "Statistical Anomalies" בדף הבית מציג שחקנים עם עונות סטטיסטיות חריגות. ה-ETL רץ כל רביעי במהלך עונת הסדרה ומושך נתוני עונה-מצטברים מ-PFR. מיד לאחר מכן מחשב מחדש את כל החריגות — כך שהן תמיד משקפות את הנתונים המצטברים עד השבוע האחרון ששוחק. מחוץ לעונה (מרץ–אוגוסט) מוצגת העונה הקודמת בשלמותה.',
          },
          {
            title: 'סוגי התראות',
            body: [
              'Career High — הנתון המצטבר של השחקן בעונה הנוכחית כבר עבר את שיא הקריירה הקודם שלו. במהלך העונה זה יכול להדליק אזהרה גם באמצע השנה אם השחקן בקצב שיא.',
              'YoY Surge — שיפור של 40%+ לעומת אותו שחקן בעונה הקודמת. תופס עונות פריצה וחזרות לפסגה.',
              'Efficiency — מדד יעילות (Passer Rating, Y/A, Y/Rec, Y/Carry) גבוה ב-1.5+ סטיות תקן מעל ממוצע הקריירה. מדגיש שחקנים שיעילים יותר, לא רק פרודוקטיביים יותר.',
              'Versatile — תרומה משמעותית בשתי קטגוריות: 300+ יארד ריצה + 300+ יארד קליטה (RB דואלי), או 200+ ניסיונות מסירה + 50+ ניסיונות ריצה (QB דואלי).',
              'Above Avg — מדד ספירה 1.5+ סטיות תקן מעל ממוצע הקריירה.',
              'Decline — מדד ספירה 1.5+ סטיות תקן מתחת לממוצע. מסמן ירידה משמעותית.',
            ],
          },
          {
            title: 'פילטרים',
            body: 'השתמש בכפתורי הפילטר (All / Career Highs / YoY Surge / Efficiency / Versatile / Above Avg / Decline) כדי להתמקד בסוג התראה ספציפי. הפיד נטען מחדש מיידית בכל בחירה.',
          },
          {
            title: 'דירוג חומרה (כוכביות)',
            body: [
              '★★ — מרשים: שיא קריירה ב-10%+, Surge של 60%+, או יעילות 2σ מעל הממוצע.',
              '★★★ — יוצא דופן: שיא קריירה ב-30%+, Surge של 100%+, יעילות 3σ, או שחקן דואלי עם 700+ יארד בשתי הקטגוריות.',
            ],
          },
          {
            title: 'מדדים שנבדקים',
            body: 'מדדי ספירה: Passing Yards/TDs, Rush Yards/TDs, Rec Yards/TDs, Sacks, Interceptions, Passes Defended, Combined Tackles. מדדי יעילות: Passer Rating, Y/A, Y/Rec, Y/Carry. ספי נפח מינימלי חלים (למשל 200+ ניסיונות מסירה ל-QBs) כדי לסנן רעש של מדגמים קטנים.',
          },
        ],
      },
      {
        id: 'saved',
        icon: '★',
        title: 'Saved',
        subsections: [
          {
            title: 'שחקנים שמורים',
            body: 'שחקנים שסימנת עם ★ בפרופיל שלהם מופיעים כאן. לחץ על השם כדי לעבור לפרופיל.',
          },
          {
            title: 'הערות על פריטים שמורים',
            body: 'לכל פריט שמור (שחקן, השוואה, או חיפוש) ניתן להוסיף הערה אישית. לחץ על "+ Add a note…" מתחת לפריט כדי לכתוב אחת. לחץ על הערה קיימת כדי לערוך אותה. ההערה נשמרת אוטומטית בלחיצה על Enter, כפתור Save, או לחיצה מחוץ לשדה. לחץ Escape לביטול.',
          },
          {
            title: 'השוואות שמורות',
            body: 'לאחר בניית השוואה, לחץ "Save comparison" לשמירתה. היא מופיעה כאן עם שמות השחקנים והקטגוריה. לחץ עליה לטעינה מחדש מיידית.',
          },
          {
            title: 'Smart Search שמורות',
            body: 'תוצאות Smart Search ניתנות לשמירה. כל רשומה מציגה את השאלה המקורית, ה-SQL, וטבלת התוצאות. פתח כל רשומה לסקירה.',
          },
          {
            title: 'טאב Notes',
            body: 'טאב Notes הוא לוח כתיבה חופשי. הקלד כל דבר ולחץ Enter (או כפתור Save) להוספת הערה. לחץ על הערה קיימת כדי לערוך אותה — היא נפתחת כ-Textarea; Enter שומר, Shift+Enter מוסיף שורה, Escape מבטל. מחק הערה עם כפתור ×.',
          },
        ],
      },
      {
        id: 'glossary',
        icon: '📖',
        title: 'מילון מונחים',
        subsections: [
          {
            title: 'כללי',
            body: [
              'G — Games: משחקים שהשחקן שיחק בהם',
              'Career AV — Career Approximate Value: מדד ניטרלי-עמדה של Pro Football Reference לאיכות קריירה',
            ],
          },
          {
            title: 'Passing',
            body: [
              'Cmp / Att — Completions / Attempts: השלמות / ניסיונות',
              'Cmp% — אחוז השלמות',
              'Yds — Passing Yards',
              'TD — Touchdowns',
              'INT — Interceptions',
              'Rate — NFL Passer Rating (סולם 0–158.3)',
              'QBR — ESPN Total QBR (סולם 0–100, מביא בחשבון את כל תרומות ה-QB)',
              'Y/A — Yards per Attempt',
              'AY/A — Adjusted Y/A (בונוס ל-TD, קנס ל-INT)',
              'ANY/A — Adjusted Net Y/A (כולל גם ניכוי יארדי Sack)',
              'Sk% — אחוז Sacks מכלל ה-Dropbacks',
              '4QC — 4th Quarter Comebacks: הובלת הפיכות ברבע הרביעי',
              'GWD — Game-Winning Drives: הובלת Drive מנצח',
            ],
          },
          {
            title: 'Receiving / Offense',
            body: [
              'Rec — Receptions: קליטות',
              'Tgt — Targets: מסירות שנשלחו לשחקן',
              'Ctch% — Catch Rate: Rec / Tgt',
              'Y/Rec — Yards per Reception',
              'Y/Tgt — Yards per Target',
              'RecFD — Receiving First Downs',
              'Att — Carries: ניסיונות ריצה',
              'RushYds — Rushing Yards',
              'Y/Carry — Yards per Carry',
              'RushFD — Rushing First Downs',
              'Fmb — Fumbles: כדורים שנפלו',
              'ScrmYds — Scrimmage Yards: Receiving + Rushing',
            ],
          },
          {
            title: 'Defense',
            body: [
              'Tkl (Comb) — Combined Tackles: Solo + Assisted',
              'TFL — Tackles for Loss: עצירות מאחורי קו ה-Scrimmage',
              'Sacks — עצירות QB מאחורי קו ה-Scrimmage',
              'QB Hits — פגיעות בQB (Sacks + Hurries)',
              'INT — Interceptions: יירוטים',
              'PD — Pass Deflections: הסטת מסירות',
              'FF — Forced Fumbles: כפיית נפילות כדור',
              'FR — Fumble Recoveries: לקיחות כדור שנפל',
              'Pick-6 — Interception החזיר ל-Touchdown',
              'Sfty — Safety: עצירת יריב באזור ה-End Zone',
            ],
          },
          {
            title: 'Kicking',
            body: [
              'FGM / FGA — Field Goals Made / Attempted',
              'FG% — אחוז Field Goals',
              'XPM / XPA — Extra Points Made / Attempted',
              'TB — Touchbacks על Kickoffs',
              'TB% — אחוז Touchbacks',
            ],
          },
          {
            title: 'Punting',
            body: [
              'Y/Punt — Gross Yards per Punt',
              'Net Y/Punt — Net Yards per Punt (אחרי ניכוי יארדי ה-Return)',
              'In20 — Punts שנחתו בתוך ה-20 של היריב',
              'Blk — Blocked Punts',
            ],
          },
          {
            title: 'Returns',
            body: [
              'PR / KR — Punt Returns / Kick Returns',
              'Y/PR / Y/KR — Yards per Punt Return / Kick Return',
              'All-Purpose Yds — Receiving + Rushing + Returns',
            ],
          },
        ],
      },
    ],
  },
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Guide() {
  const [lang, setLang] = useLang()
  const isHe = lang === 'he'
  const c = CONTENT[lang]

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">
            {isHe ? 'NFL DATA' : 'NFL DATA'}
          </p>
          <h1 className="text-3xl font-black text-white tracking-tight">{c.title}</h1>
        </div>

        {/* Language toggle */}
        <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-1 text-sm font-semibold">
          <button onClick={() => setLang('en')}
            className={`px-4 py-1.5 rounded-lg transition-colors ${!isHe ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            English
          </button>
          <button onClick={() => setLang('he')}
            className={`px-4 py-1.5 rounded-lg transition-colors ${isHe ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            עברית
          </button>
        </div>
      </div>

      {/* Table of contents */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{c.toc}</p>
        <div className="flex flex-wrap gap-2">
          {c.sections.map(s => (
            <a key={s.id} href={`#${s.id}`}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-slate-700/60 bg-slate-900/60
                text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
              <span>{s.icon}</span>
              <span>{s.title}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      {c.sections.map(section => (
        <div key={section.id} id={section.id}
          className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-6 space-y-5 scroll-mt-20">

          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span>{section.icon}</span>
            {section.title}
          </h2>

          <div className="space-y-4">
            {section.subsections.map((sub, i) => (
              <div key={i}>
                <h3 className="text-amber-400/90 font-bold text-sm mb-1.5">{sub.title}</h3>
                {Array.isArray(sub.body) ? (
                  <ul className={`space-y-1 ${isHe ? 'pr-4' : 'pl-4'}`}>
                    {sub.body.map((line, j) => {
                      const dash = line.indexOf('—')
                      const hasDash = dash !== -1
                      return (
                        <li key={j} className="text-slate-300 text-sm leading-relaxed flex gap-2">
                          <span className="text-slate-600 shrink-0 mt-0.5">›</span>
                          <span>
                            {hasDash ? (
                              <>
                                <span className="text-white font-semibold">{line.slice(0, dash + 1)}</span>
                                {line.slice(dash + 1)}
                              </>
                            ) : line}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-slate-300 text-sm leading-relaxed">{sub.body}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-center text-slate-600 text-xs pb-4">
        {isHe
          ? 'מקור נתונים: Pro Football Reference · Next Gen Stats · 2000–2025 · 11,000+ שחקנים'
          : 'Data: Pro Football Reference · Next Gen Stats · 2000–2025 · 11,000+ players'}
      </p>
    </div>
  )
}
