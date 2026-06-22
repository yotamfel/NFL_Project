// One-line descriptions for every stat key used in the app.
// Used to render tooltip explanations in tables and filters.
export const STAT_DEFS = {
  g:               'Games played in the season',

  // Passing - basic
  cmp:             'Pass completions',
  att:             'Pass attempts (passing), or rush attempts (offense)',
  yds:             'Total yards gained',
  td:              'Touchdowns thrown (QB) or scored',
  int:             'Interceptions thrown (QB) or caught (defense)',

  // Passing - advanced
  rate:            'NFL Passer Rating (0–158.3). Composite formula weighing completion %, yards/attempt, TD %, and INT %. Anything above 100 is considered excellent.',
  qbr:             'ESPN Total QBR (0–100). Measures QB contribution to win probability. 50 = average. Only available from 2006 onward.',
  y_per_a:         'Yards Per Attempt - passing yards ÷ pass attempts.',
  ay_per_a:        'Adjusted Yards Per Attempt - (yards + 20×TD − 45×INT) ÷ attempts. Penalizes INTs and rewards TDs on top of raw Y/A.',
  ny_per_a:        'Net Yards Per Attempt - (yards − sack yards) ÷ (attempts + sacks). Treats each sack like a failed pass play.',
  any_per_a:       'Adjusted Net Yards Per Attempt - combines the TD/INT bonus from AY/A with the sack penalty from NY/A. Often considered the single best QB efficiency metric.',
  sk:              'Times sacked (QB) or QB sacks recorded (defense)',
  sk_pct:          'Sack Rate - % of pass plays (dropbacks) that end in a sack. Lower is better for a QB.',
  _4qc:            '4th-Quarter Comebacks - drives led in the final 4 minutes of the 4th quarter or overtime that tied or put the team ahead.',
  gwd:             'Game-Winning Drives - final drives in Q4 or OT that produced a go-ahead score that held through the end of the game.',
  _1d:             'First downs thrown for (passing)',
  qbrec:           'Win-Loss-Tie record as starting QB',

  // Offense - basic
  rec:             'Receptions',
  rec_yds:         'Receiving yards',
  rec_td:          'Receiving touchdowns',
  rush_yds:        'Rushing yards',
  rush_td:         'Rushing touchdowns',
  yscm:            'Scrimmage yards - rushing yards + receiving yards combined',
  touch:           'Touches - rushes + receptions combined',

  // Offense - advanced
  tgt:             'Targets - number of times targeted as a receiver on a pass play',
  ctch_pct:        'Catch % - receptions ÷ targets. Measures how often a receiver converts targets into completions.',
  y_per_tgt:       'Yards Per Target - receiving yards ÷ targets. Key receiving efficiency metric that rewards players who see lots of usage.',
  y_per_r:         'Yards Per Reception - average gain per catch.',
  rec_lng:         'Longest reception in the season',
  rush_lng:        'Longest rush in the season',
  rec_first_downs: 'First downs earned on receptions',
  rush_first_downs:'First downs earned on runs',
  fmb:             'Fumbles - times the ball was fumbled (regardless of who recovered it)',

  // Defense - basic
  comb:            'Combined tackles (solo + assisted)',
  solo:            'Solo tackles',
  ast:             'Assisted tackles',
  pd:              'Pass Deflections - passes broken up or batted away',
  ff:              'Forced Fumbles - knocking the ball loose from the ball-carrier',
  fr:              'Fumble Recoveries',

  // Defense - advanced
  tfl:             'Tackles For Loss - tackles made behind the line of scrimmage',
  qb_hits:         'QB Hits - making significant contact with the QB on a pass play (includes sacks but is broader)',
  int_ret_yds:     'Interception Return Yards - total yards gained after catching an INT',
  int_td:          'Pick-Sixes - interceptions returned for touchdowns',
  fr_td:           'Fumble Recovery Touchdowns - fumbles recovered and returned for a score',
  fum_ret_yds:     'Fumble Return Yards',
  sfty:            'Safeties - tackling the ball-carrier in their own end zone (worth 2 points)',

  // Kicking - basic
  fgm_total:       'Total field goals made',
  fga_total:       'Total field goals attempted',
  xpm:             'Extra points (PATs) made',
  xpa:             'Extra points (PATs) attempted',

  // Kicking - by distance
  fgm_0_19:        'FG made from inside 20 yards (extremely rare)',
  fga_0_19:        'FG attempted from inside 20 yards',
  fgm_20_29:       'FG made from 20-29 yards - near-automatic range for NFL kickers',
  fga_20_29:       'FG attempted from 20-29 yards',
  fgm_30_39:       'FG made from 30-39 yards',
  fga_30_39:       'FG attempted from 30-39 yards',
  fgm_40_49:       'FG made from 40-49 yards - range where kickers start to separate from average',
  fga_40_49:       'FG attempted from 40-49 yards',
  fgm_50_plus:     'FG made from 50+ yards - elite territory; very few kickers are reliable here',
  fga_50_plus:     'FG attempted from 50+ yards',

  // Kicking - kickoffs
  ko:              'Total kickoffs in the season',
  koyds:           'Total kickoff yards',
  koavg:           'Average kickoff distance (yards)',
  tb:              'Touchbacks - kickoff kicked into or through the opponent\'s end zone',
  tb_pct:          'Touchback % - % of kickoffs resulting in a touchback. Higher = better starting field position for the defense.',

  // Punting - basic
  pnt:             'Total punts',
  netyds:          'Net punt yards - total gross yards minus return yards surrendered',
  pnt20:           'Punts inside the 20 - landed in opponent\'s 20-yard zone without going through the end zone',

  // Punting - advanced
  y_per_p:         'Gross Yards Per Punt - average punt distance before the returner touches it',
  ny_per_p:        'Net Yards Per Punt - gross yards minus return yards allowed. Best single punting efficiency metric.',
  retyds:          'Return Yards Allowed - total yards opponents gained on punt returns',
  blck:            'Blocked Punts - punt kicked into (or blocked at) the line of scrimmage',
  in20_pct:        'Inside-20 % - % of punts landing inside the opponent\'s 20-yard line without a touchback',

  // Returns - basic
  punt_ret:        'Punt returns',
  punt_ret_yds:    'Punt return yards',
  punt_ret_td:     'Punt return touchdowns',
  kick_ret:        'Kick returns',
  kick_ret_yds:    'Kick return yards',
  kick_ret_td:     'Kick return touchdowns',

  // Returns - advanced
  y_per_punt_ret:  'Yards Per Punt Return - average gain per punt returned',
  y_per_kick_ret:  'Yards Per Kick Return - average gain per kick returned',
  punt_ret_lng:    'Longest punt return in the season',
  kick_ret_lng:    'Longest kick return in the season',
  apyd:            'All-Purpose Yards - rushing + receiving + return yards combined. Measures total field contribution.',
}
