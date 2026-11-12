CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  lastUpdated INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'UNKNOWN',
  sourceUrl TEXT,
  modrinthId TEXT,
  notes TEXT
);
ALTER TABLE tickets DROP COLUMN taggedProject;
ALTER TABLE tickets ADD COLUMN taggedProjectId TEXT DEFAULT NULL;
