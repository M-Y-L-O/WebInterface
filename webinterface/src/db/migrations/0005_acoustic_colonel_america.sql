CREATE TABLE "ai_chats" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"projectKey" text NOT NULL,
	"title" text DEFAULT 'Chat' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geminiContents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usersettings" ADD COLUMN "aiTemperature" double precision DEFAULT 0.4 NOT NULL;--> statement-breakpoint
ALTER TABLE "usersettings" ADD COLUMN "aiThinking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_chats" ADD CONSTRAINT "ai_chats_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chats_user_project_idx" ON "ai_chats" USING btree ("userId","projectKey");