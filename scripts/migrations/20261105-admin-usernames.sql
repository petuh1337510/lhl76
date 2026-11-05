-- Additive migration: existing users, password hashes, emails and roles stay intact.
BEGIN;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

WITH candidates AS (
  SELECT id,
    lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) AS stem
  FROM "User" WHERE "username" IS NULL
), numbered AS (
  SELECT id, stem, count(*) OVER (PARTITION BY stem) AS duplicates
  FROM candidates
)
UPDATE "User" AS u
SET "username" = CASE
  WHEN n.duplicates = 1 AND n.stem ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    THEN n.stem
  ELSE 'legacy-' || left(replace(u.id, '-', ''), 25)
END
FROM numbered AS n WHERE u.id = n.id;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

COMMIT;
