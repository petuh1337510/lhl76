-- Additive only. Run first on a restored isolated database; never reset the database.
BEGIN;
ALTER TABLE "Playoff" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Playoff" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayoffSeries" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlayoffSeries" ADD COLUMN "sourceHomeId" TEXT;
ALTER TABLE "PlayoffSeries" ADD COLUMN "sourceAwayId" TEXT;
ALTER TABLE "PlayoffSeries" ADD COLUMN "sourceOutcome" TEXT NOT NULL DEFAULT 'WINNER';
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_sourceHomeId_fkey" FOREIGN KEY ("sourceHomeId") REFERENCES "PlayoffSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_sourceAwayId_fkey" FOREIGN KEY ("sourceAwayId") REFERENCES "PlayoffSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD COLUMN "playoffSeriesId" TEXT;
ALTER TABLE "Match" ADD COLUMN "playoffGame" INTEGER;
ALTER TABLE "Match" ADD CONSTRAINT "Match_playoffSeriesId_fkey" FOREIGN KEY ("playoffSeriesId") REFERENCES "PlayoffSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Match_playoffSeriesId_playoffGame_key" ON "Match"("playoffSeriesId", "playoffGame");
COMMIT;
