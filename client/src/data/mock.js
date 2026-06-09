// Placeholder data whose shapes match the real API responses exactly —
// stage 8 replaces these with fetch() calls without changing anything else.

export const MOCK_SEARCH_RESULTS = [
  { player_id: 'MahoPa00', player_name: 'Patrick Mahomes', pos: 'QB', first_season: 2017, last_season: 2024, n_seasons: 8 },
  { player_id: 'BradTo00', player_name: 'Tom Brady', pos: 'QB', first_season: 2000, last_season: 2022, n_seasons: 23 },
  { player_id: 'KelcTr00', player_name: 'Travis Kelce', pos: 'TE', first_season: 2013, last_season: 2024, n_seasons: 12 },
  { player_id: 'HillTy00', player_name: 'Tyreek Hill', pos: 'WR', first_season: 2016, last_season: 2024, n_seasons: 9 },
  { player_id: 'JeffJu00', player_name: 'Justin Jefferson', pos: 'WR', first_season: 2020, last_season: 2024, n_seasons: 5 },
]

export const MOCK_PLAYER_PROFILE = {
  player: {
    player_id: 'MahoPa00',
    player_name: 'Patrick Mahomes',
    pos: 'QB',
    first_season: 2017,
    last_season: 2024,
    n_seasons: 8,
  },
  categories: [
    {
      category: 'passing',
      seasons: [
        { season: 2018, team: 'KAN', g: 16, cmp: 383, att: 580, yds: 5097, td: 50, int: 12 },
        { season: 2019, team: 'KAN', g: 16, cmp: 319, att: 484, yds: 4031, td: 26, int: 5 },
        { season: 2020, team: 'KAN', g: 16, cmp: 390, att: 588, yds: 4740, td: 38, int: 6 },
        { season: 2021, team: 'KAN', g: 17, cmp: 436, att: 658, yds: 4839, td: 37, int: 13 },
        { season: 2022, team: 'KAN', g: 17, cmp: 435, att: 648, yds: 5250, td: 41, int: 12 },
        { season: 2023, team: 'KAN', g: 17, cmp: 401, att: 597, yds: 4183, td: 27, int: 11 },
        { season: 2024, team: 'KAN', g: 17, cmp: 379, att: 578, yds: 4279, td: 26, int: 11 },
      ],
      career: { g: 116, cmp: 2743, att: 4133, yds: 32419, td: 245, int: 70 },
    },
  ],
  draft: { draft_year: 2017, round: 1, pick: 10, team: 'KAN', college: 'Texas Tech', career_av: 140 },
  combine: { pos: 'QB', ht: '6_2', wt: 230, _40yd: 4.80, vertical: 32.0 },
}

export const MOCK_COMPARISON = {
  players: [
    { player_id: 'MahoPa00', player_name: 'Patrick Mahomes', pos: 'QB' },
    { player_id: 'BradTo00', player_name: 'Tom Brady', pos: 'QB' },
  ],
  career: [
    { player_id: 'MahoPa00', player_name: 'Patrick Mahomes', g: 116, cmp: 2743, att: 4133, yds: 32419, td: 245, int: 70 },
    { player_id: 'BradTo00', player_name: 'Tom Brady', g: 335, cmp: 7753, att: 12049, yds: 89214, td: 649, int: 212 },
  ],
}

export const MOCK_STEALS = [
  { player_name: 'Tom Brady', draft_year: 2000, round: 6, pick: 199, pos: 'QB', team: 'NWE', career_av: 184 },
  { player_name: 'Russell Wilson', draft_year: 2012, round: 3, pick: 75, pos: 'QB', team: 'SEA', career_av: 139 },
  { player_name: 'Travis Kelce', draft_year: 2013, round: 3, pick: 63, pos: 'TE', team: 'KAN', career_av: 90 },
  { player_name: 'Dak Prescott', draft_year: 2016, round: 4, pick: 135, pos: 'QB', team: 'DAL', career_av: 94 },
]

export const MOCK_BUSTS = [
  { player_name: 'JaMarcus Russell', draft_year: 2007, round: 1, pick: 1, pos: 'QB', team: 'OAK', career_av: 6 },
  { player_name: 'Trey Lance', draft_year: 2021, round: 1, pick: 3, pos: 'QB', team: 'SFO', career_av: 5 },
  { player_name: 'Josh Rosen', draft_year: 2018, round: 1, pick: 10, pos: 'QB', team: 'ARI', career_av: 3 },
  { player_name: 'Dwayne Haskins', draft_year: 2019, round: 1, pick: 15, pos: 'QB', team: 'WAS', career_av: 4 },
]

export const MOCK_DRAFT_PICKS = [
  { draft_year: 2017, round: 1, pick: 10, player_name: 'Patrick Mahomes', pos: 'QB', team: 'KAN', career_av: 140 },
  { draft_year: 2017, round: 1, pick: 27, player_name: 'Derek Barnett', pos: 'DE', team: 'PHI', career_av: 37 },
  { draft_year: 2017, round: 2, pick: 38, player_name: 'Deshaun Watson', pos: 'QB', team: 'HOU', career_av: 75 },
  { draft_year: 2017, round: 3, pick: 83, player_name: 'JuJu Smith-Schuster', pos: 'WR', team: 'PIT', career_av: 50 },
  { draft_year: 2017, round: 4, pick: 105, player_name: 'Kareem Hunt', pos: 'RB', team: 'KAN', career_av: 56 },
]
