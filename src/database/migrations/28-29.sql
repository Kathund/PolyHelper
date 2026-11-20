ALTER TABLE supportTeams RENAME COLUMN ticketPingRole TO newTicketPingRole;
ALTER TABLE supportTeams ADD COLUMN inactivityTicketPingRole TEXT;
UPDATE supportTeams SET inactivityTicketPingRole = newTicketPingRole;
ALTER TABLE supportTeams ALTER COLUMN inactivityTicketPingRole SET NOT NULL;
