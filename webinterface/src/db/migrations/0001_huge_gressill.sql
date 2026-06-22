CREATE TABLE "clientconfigs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"address" text NOT NULL,
	"apiKey" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usersettings" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"lastUsed" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientconfigs" ADD CONSTRAINT "clientconfigs_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usersettings" ADD CONSTRAINT "usersettings_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;