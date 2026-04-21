-- Seed FreshnessRule entries for every category the Gmail extractor emits.
-- Without these rules the freshness engine falls back to a hardcoded 4 days,
-- which produced implausible expiry dates for pantry-stable items (rice,
-- condiments, frozen) and overly generous ones for perishables.
--
-- INSERT OR IGNORE keeps any rows that already exist (seed, prior manual
-- edits); only missing categories get populated.
INSERT OR IGNORE INTO "FreshnessRule" ("id", "category", "unopenedDays", "openedDays")
VALUES
  ('rule_dairy',      'dairy',      7,   4),
  ('rule_meat',       'meat',       3,   2),
  ('rule_produce',    'produce',    5,   3),
  ('rule_leftovers',  'leftovers',  4,   2),
  ('rule_bread',      'bread',      7,   5),
  ('rule_beverages',  'beverages',  14,  7),
  ('rule_grains',     'grains',     180, 60),
  ('rule_snacks',     'snacks',     60,  14),
  ('rule_condiments', 'condiments', 180, 60),
  ('rule_frozen',     'frozen',     60,  14),
  ('rule_other',      'other',      14,  7);
