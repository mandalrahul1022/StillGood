-- Add googleId to User so Google-authenticated accounts can be looked up by
-- Google's stable `sub` claim rather than just email (email can change on
-- Google side, but `sub` never does for a given Google account).
-- Nullable because existing email/password users obviously have no Google id.
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "User_googleId_key" ON "User" ("googleId");
