CREATE TABLE stacks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 160),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 20000),
  state_id TEXT NOT NULL REFERENCES states(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX stacks_state_id_idx ON stacks (state_id);
