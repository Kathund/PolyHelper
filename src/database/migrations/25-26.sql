ALTER TABLE tickets ADD COLUMN hasMessageFromOwner INT NOT NULL DEFAULT 0;
UPDATE tickets SET hasMessageFromOwner = 1;
