CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  stack_id TEXT NULL REFERENCES stacks(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(title) >= 1 AND length(title) <= 160),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 20000),
  state_id TEXT NOT NULL REFERENCES states(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX drafts_stack_id_idx ON drafts (stack_id);
CREATE INDEX drafts_state_id_idx ON drafts (state_id);
