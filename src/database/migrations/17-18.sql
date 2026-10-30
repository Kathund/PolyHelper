ALTER TABLE panels DROP COLUMN cleanName;
ALTER TABLE panels DROP COLUMN pingSupportRoleOnOpen;
ALTER TABLE panels ADD COLUMN pingSupportTeamOnOpen INT NOT NULL DEFAULT 1;
ALTER TABLE panels ADD COLUMN openingMessageContent TEXT NOT NULL DEFAULT '{mention}';
ALTER TABLE panels ADD COLUMN openingMessageTitle TEXT NOT NULL DEFAULT '{panelName}';
ALTER TABLE panels ADD COLUMN buttonStyle INT NOT NULL DEFAULT 2;
