ALTER TABLE "Team"
ADD COLUMN IF NOT EXISTS "calendarAccent" VARCHAR(7)
CHECK ("calendarAccent" ~ '^#[0-9A-Fa-f]{6}$');
