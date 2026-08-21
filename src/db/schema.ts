// Schema for the M8 Training feature (see docs/PROJECT_BRIEF.md).
// Applied once per fresh database via CREATE TABLE IF NOT EXISTS, so it is
// safe to run on every worker startup.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  played_at TEXT NOT NULL,
  pgn TEXT NOT NULL,
  result TEXT
);

CREATE TABLE IF NOT EXISTS missed_tactics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id),
  fen TEXT NOT NULL,
  best_move TEXT NOT NULL,
  motif TEXT,
  created_at TEXT NOT NULL,
  next_review_at TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  solved_streak INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id),
  positive_1 TEXT,
  positive_2 TEXT,
  improve_1 TEXT,
  improve_2 TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unlocked_at TEXT
);

CREATE TABLE IF NOT EXISTS streak_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT
);

INSERT OR IGNORE INTO streak_state (id, current_streak, longest_streak, last_active_date)
VALUES (1, 0, 0, NULL);

-- M11: one imported repertoire per side (White/Black), re-import replaces it
-- and its units wholesale rather than accumulating duplicates.
CREATE TABLE IF NOT EXISTS repertoires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  side TEXT NOT NULL UNIQUE CHECK (side IN ('w', 'b')),
  source_filename TEXT,
  root_fen TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  game_count INTEGER NOT NULL DEFAULT 0,
  merged_game_count INTEGER NOT NULL DEFAULT 0,
  drill_unit_count INTEGER NOT NULL DEFAULT 0
);

-- One row per drill unit (a real decision point in the merged tree, per
-- extractDrillUnits in src/engine/repertoire.ts) -- not one row per raw PGN
-- line. Same SRS column shape as missed_tactics so the two can eventually
-- share one drill-session scheduler (see docs/PROJECT_BRIEF.md M11 note).
CREATE TABLE IF NOT EXISTS repertoire_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repertoire_id INTEGER NOT NULL REFERENCES repertoires(id),
  unit_key TEXT NOT NULL,
  setup_uci TEXT NOT NULL,
  steps TEXT NOT NULL,
  source_labels TEXT NOT NULL,
  next_review_at TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  solved_streak INTEGER NOT NULL DEFAULT 0,
  UNIQUE (repertoire_id, unit_key)
);

-- Append-only history behind repertoire_units' current next_review_at/
-- review_count/solved_streak -- those columns are just the *current* SRS
-- state, overwritten on every attempt; this keeps every attempt so "was this
-- new / did I get it right / did I miss it" can be reviewed over time (e.g.
-- a per-unit or per-repertoire history, or a grade-distribution view).
CREATE TABLE IF NOT EXISTS repertoire_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES repertoire_units(id),
  result TEXT NOT NULL CHECK (result IN ('introduced', 'correct', 'incorrect')),
  solved_streak_after INTEGER NOT NULL,
  attempted_at TEXT NOT NULL
);

-- M8: when the user's 12-week plan started. Single row, set lazily (INSERT
-- OR IGNORE with the current time) the first time the Training tab needs a
-- week number, rather than requiring an onboarding step.
CREATE TABLE IF NOT EXISTS training_plan (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  started_at TEXT NOT NULL
);

-- M8: manually-toggled checklist items (most of the plan's tasks -- Woodpecker,
-- slow-game analysis, opening/endgame/strategy review -- happen outside this
-- app, so the app can't observe them; the user checks them off itself). A row
-- exists only while its item is checked -- unchecking deletes it rather than
-- storing a false. scope_key is a calendar date (YYYY-MM-DD) for Base Work
-- items, which reset daily, or "week-N" for Extra Credit items, which reset
-- only when a new week starts.
CREATE TABLE IF NOT EXISTS checklist_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  UNIQUE (scope_key, item_key)
);
`

export const SCHEMA_TABLE_NAMES = [
  'games',
  'missed_tactics',
  'journal_entries',
  'badges',
  'streak_state',
  'repertoires',
  'repertoire_units',
  'repertoire_attempts',
  'training_plan',
  'checklist_checks',
] as const
