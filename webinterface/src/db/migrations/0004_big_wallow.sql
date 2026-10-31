ALTER TABLE "usersettings" ADD COLUMN "aiMaxTurns" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "usersettings" ADD COLUMN "aiMaxToolCalls" integer DEFAULT 32 NOT NULL;