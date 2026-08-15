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
`

export const SCHEMA_TABLE_NAMES = [
  'games',
  'missed_tactics',
  'journal_entries',
  'badges',
  'streak_state',
] as const
