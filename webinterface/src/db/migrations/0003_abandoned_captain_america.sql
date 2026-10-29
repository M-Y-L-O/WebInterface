ALTER TABLE "usersettings" ADD COLUMN "defaultModel" text DEFAULT 'gemini-2.5-flash' NOT NULL;--> statement-breakpoint
ALTER TABLE "usersettings" ADD COLUMN "optEpochs" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "usersettings" ADD COLUMN "optGenerations" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "usersettings" ADD COLUMN "localAgentAddress" text DEFAULT 'http://127.0.0.1:8080' NOT NULL;--> statement-breakpoint
ALTER TABLE "usersettings" ADD COLUMN "localAgentName" text DEFAULT 'Local MYLO Client' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "usersettings_user_uidx" ON "usersettings" USING btree ("userId");