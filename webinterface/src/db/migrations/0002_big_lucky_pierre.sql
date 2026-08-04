CREATE TABLE "userllmkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"authTag" text NOT NULL,
	"wrappedDek" text NOT NULL,
	"kekProvider" text NOT NULL,
	"keyFingerprint" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"verifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "userllmkeys" ADD CONSTRAINT "userllmkeys_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "userllmkeys_user_provider_uidx" ON "userllmkeys" USING btree ("userId","provider");
