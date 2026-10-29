CREATE TABLE supportTeams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  supportRole TEXT NOT NULL,
  ticketPingRole TEXT NOT NULL
);
ALTER TABLE panels ADD COLUMN supportTeamId TEXT DEFAULT NULL;
