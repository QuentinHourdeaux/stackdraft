CREATE TABLE states (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('stack', 'draft')),
  name TEXT NOT NULL,
  color TEXT NOT NULL CHECK (
    length(color) = 7
    AND substr(color, 1, 1) = '#'
    AND color GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  ),
  position INTEGER NOT NULL CHECK (position >= 0),
  is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX states_scope_name_unique ON states (scope, name COLLATE NOCASE);
CREATE UNIQUE INDEX states_scope_position_unique ON states (scope, position);
CREATE UNIQUE INDEX states_one_default_per_scope ON states (scope) WHERE is_default = 1;

INSERT INTO states (
  id,
  scope,
  name,
  color,
  position,
  is_default,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'stack',
    'Planned',
    '#8d98a5',
    0,
    1,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'stack',
    'Active',
    '#8fa8ff',
    1,
    0,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'stack',
    'Paused',
    '#f0b35a',
    2,
    0,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'stack',
    'Completed',
    '#62d79b',
    3,
    0,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'draft',
    'Backlog',
    '#8d98a5',
    0,
    1,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    'draft',
    'Todo',
    '#8fa8ff',
    1,
    0,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000007',
    'draft',
    'In Progress',
    '#b28cff',
    2,
    0,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000008',
    'draft',
    'Done',
    '#62d79b',
    3,
    0,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    '00000000-0000-4000-8000-000000000009',
    'draft',
    'Canceled',
    '#ff7b8a',
    4,
    0,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
  );
