BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "matchId" TEXT;
CREATE INDEX IF NOT EXISTS "Broadcast_matchId_idx" ON "Broadcast"("matchId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Broadcast_matchId_fkey') THEN
    ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_matchId_fkey"
      FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
COMMIT;
