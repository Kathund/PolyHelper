ALTER TABLE tickets ADD COLUMN closedBy TEXT DEFAULT NULL;
ALTER TABLE tickets ADD COLUMN closedReason TEXT DEFAULT NULL;
UPDATE tickets SET closedBy = '1560208437889990696', closedReason = 'No reason provided' WHERE closed = 1;
