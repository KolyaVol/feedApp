DROP TABLE IF EXISTS feed_entries;
CREATE TABLE feed_entries (
  id TEXT PRIMARY KEY,
  food_type_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
);

DROP TABLE IF EXISTS food_types;
CREATE TABLE food_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  color TEXT NOT NULL,
  priority TEXT,
  weekly_minimum_amount REAL
);
INSERT INTO food_types (id, name, unit, color) VALUES
  ('1', 'Breast', 'ml', '#FFB6C1'),
  ('2', 'Formula', 'ml', '#87CEEB'),
  ('3', 'Puree', 'g', '#98FB98'),
  ('4', 'Water', 'ml', '#ADD8E6');

DROP TABLE IF EXISTS reminders;
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  time TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  repeat TEXT,
  notification_id TEXT
);

DROP TABLE IF EXISTS plan_days;
CREATE TABLE plan_days (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  food_type TEXT NOT NULL,
  food TEXT NOT NULL,
  amount_grams REAL NOT NULL,
  substitutions TEXT NOT NULL,
  notes TEXT,
  source_month INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  schedule_id TEXT NOT NULL
);

DROP TABLE IF EXISTS loaded_schedules;
CREATE TABLE loaded_schedules (
  id TEXT PRIMARY KEY,
  month INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  signs_of_readiness TEXT NOT NULL,
  safety_guidelines TEXT NOT NULL,
  loaded_at TEXT NOT NULL
);
