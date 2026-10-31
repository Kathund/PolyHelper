ALTER TABLE tickets DROP COLUMN lastMessageBySupport;
ALTER TABLE tickets DROP COLUMN inactivityAlerts;
ALTER TABLE tickets DROP COLUMN lastAlertTimestamp;
ALTER TABLE tickets ADD COLUMN inactivityNoticeId TEXT DEFAULT NULL;
ALTER TABLE tickets ADD COLUMN inactivitySilenced INT NOT NULL DEFAULT 0;
