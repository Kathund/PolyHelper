ALTER TABLE panels ADD COLUMN lastUpdated INT NOT NULL DEFAULT 0;
CREATE INDEX panels_last_updated_idx ON panels (lastUpdated);
ALTER TABLE tickets ADD COLUMN lastUpdated INT NOT NULL DEFAULT 0;
CREATE INDEX tickets_last_updated_idx ON tickets (lastUpdated);
UPDATE tickets SET lastUpdated = openingTimestamp;
ALTER TABLE closeRequests ADD COLUMN lastUpdated INT NOT NULL DEFAULT 0;
ALTER TABLE supportTeams ADD COLUMN lastUpdated INT NOT NULL DEFAULT 0;
CREATE INDEX support_teams_last_updated_idx ON supportTeams (lastUpdated);
