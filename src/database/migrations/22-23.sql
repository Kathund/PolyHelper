CREATE TABLE ticketBlacklistUsers (
  id TEXT PRIMARY KEY,
  lastUpdated INT NOT NULL DEFAULT 0,
  user TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'No reason provided',
  addedBy TEXT NOT NULL,
  active INT NOT NULL DEFAULT 1,
  removedReason TEXT DEFAULT NULL,
  removedBy TEXT DEFAULT NULL,
  logMessageId TEXT DEFAULT NULL
);
