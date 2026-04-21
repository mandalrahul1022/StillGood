CREATE TABLE IF NOT EXISTS "GmailIntegration" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "userId"       TEXT NOT NULL UNIQUE,
  "accessToken"  TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiresAt"    DATETIME NOT NULL,
  "gmailEmail"   TEXT NOT NULL,
  "lastSyncAt"   DATETIME,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmailIntegration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
